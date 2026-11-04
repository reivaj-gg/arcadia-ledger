/**
 * Arcadia — SAM 3.1 mask geometry
 * ==============================
 * Turns a segmentation record into something a 3D scene can actually use.
 *
 * Division of labour
 * ------------------
 * The base85 payload is decoded by the official `@meta-sam/parser` package, not
 * by us: its alphabet is not published and matches neither Ascii85, Z85 nor
 * RFC 1924, so a hand-rolled decoder would be a guess dressed as code. The
 * package's own `decodeMaskToSVGPath` is deliberately *not* used either: it
 * emits coordinates like `-0.5` that fall outside the raster, which is fine for
 * an overlay but wrong for an extrusion. We take the validated raster and trace
 * the boundary ourselves, where we can test the geometry.
 *
 * Two facts that cost a debug cycle to learn, recorded so nobody pays twice:
 *
 *  1. `SegmentationMask.payload` **includes** the `~` / `!` encoding marker,
 *     despite the package's `.d.ts` saying it is the text *after* the marker.
 *     Passing a marker-less payload to `decodeMaskToRaster` throws
 *     `invalid_mask_payload`.
 *  2. The raster is the bounding box at 1:1, not a downscale of the frame.
 *     `bounds.right - bounds.left === mask.width` for every payload observed.
 *     `decodeMaskGeometry` scales anyway, so the mapping stays correct if the
 *     API ever changes that.
 *
 * Coordinate spaces, in the order they appear
 * -------------------------------------------
 *  - **lattice**: integer points `0..width` x `0..height` inside the raster.
 *    A pixel `(x, y)` owns the square `[x, x+1) x [y, y+1)`, so a contour lies
 *    exactly on pixel borders and never on a pixel centre.
 *  - **source**: the same point plus `bounds.left` / `bounds.top`, i.e. pixels
 *    of the original image. This is the space SAM prompts use.
 *  - **domain**: `PixelBoundingBox`, normalized `0..1000`, half-open.
 */

import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
  type ImageSegmentationResult,
  type SegmentationMaskBounds,
  type SegmentationMaskEncoding,
  type SegmentationMaskRecord,
  type ResponsesEvent,
} from '@meta-sam/parser';

import type { PixelBoundingBox } from '../domain/schema.ts';

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

export type SamParserErrorCode =
  | 'invalid_media'
  | 'stream_failed'
  | 'decode_failed'
  | 'empty_mask';

export class SamParserError extends Error {
  readonly code: SamParserErrorCode;

  constructor(code: SamParserErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'SamParserError';
    this.code = code;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/* ------------------------------------------------------------------------- */
/* Geometry types                                                            */
/* ------------------------------------------------------------------------- */

export interface ContourPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A closed ring. The last point is *not* repeated: it connects back to the
 * first, which is what every polygon renderer expects.
 */
export interface Contour {
  readonly points: readonly ContourPoint[];
  /** Shoelace area in square pixels. Signed; sign encodes winding. */
  readonly area: number;
  /**
   * `outer` encloses foreground, `hole` encloses background inside an outer
   * ring. A hole must be rendered with the opposite winding to cut correctly.
   */
  readonly kind: 'outer' | 'hole';
}

export interface MaskRasterSummary {
  readonly width: number;
  readonly height: number;
  /** Number of foreground pixels. */
  readonly filled: number;
  /** `filled / (width * height)`, in `0..1`. */
  readonly coverage: number;
}

export interface MaskGeometry {
  readonly objectId: string;
  /** The SAM revision this mask belongs to; higher means refined. */
  readonly revision: number;
  /** Stable identity across revisions, e.g. `image:*:0`. */
  readonly identity: string;
  /** `null` when the model reported none. Absence is not zero. */
  readonly confidence: number | null;
  readonly encoding: SegmentationMaskEncoding;
  /** Half-open source-pixel box, exactly as parsed from the wire. */
  readonly bounds: SegmentationMaskBounds;
  /** The same box in domain space: `[ymin, xmin, ymax, xmax]`, `0..1000`. */
  readonly box: PixelBoundingBox;
  readonly raster: MaskRasterSummary;
  /** Source-pixel rings, simplified. Empty when the mask has no foreground. */
  readonly contours: readonly Contour[];
}

export interface MaskGeometryOptions {
  /** Intrinsic width of the image the mask belongs to, in pixels. */
  readonly mediaWidth: number;
  /** Intrinsic height of the image the mask belongs to, in pixels. */
  readonly mediaHeight: number;
  /**
   * Douglas–Peucker tolerance in source pixels. The default removes the
   * one-pixel staircase that a raster boundary always has, while keeping a real
   * edge: at `0.75` a diagonal stays a diagonal and a corner stays a corner.
   */
  readonly simplifyTolerance?: number;
}

const DEFAULT_SIMPLIFY_TOLERANCE = 0.75;
const COORD_SPACE_MAX = 1000;

/* ------------------------------------------------------------------------- */
/* Non-streaming text -> official parser                                     */
/* ------------------------------------------------------------------------- */

/**
 * `parseImageStream` is the only entry point the package offers, and it takes an
 * event stream. The non-streaming Responses call returns one finished string, so
 * we replay it as a one-delta stream. That is not a workaround: it is exactly
 * the shape the API produces when streaming is disabled, and it exercises the
 * same incremental parser the live path would.
 *
 * The lane fields are constant because a single response has a single output
 * text lane. The parser rejects `response.completed` that arrives before
 * `response.output_text.done`, so the order below is load-bearing.
 */
const LANE = { item_id: 'sam_object_prompt', output_index: 0, content_index: 0 } as const;

export async function parseSegmentationText(text: string): Promise<ImageSegmentationResult> {
  async function* events(): AsyncGenerator<ResponsesEvent> {
    yield { type: 'response.output_text.delta', ...LANE, delta: text };
    yield { type: 'response.output_text.done', ...LANE, text };
    yield { type: 'response.completed' };
  }

  try {
    return await parseImageStream(events()).finalResult;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SamParserError('stream_failed', `Could not parse the SAM output stream: ${detail}`, {
      cause: error,
    });
  }
}

/* ------------------------------------------------------------------------- */
/* Contour tracing                                                           */
/* ------------------------------------------------------------------------- */

type Ring = ContourPoint[];

/** Lattice point -> single integer, for use as a Map key. */
function encodePoint(x: number, y: number, stride: number): number {
  return y * stride + x;
}

function decodePoint(index: number, stride: number): ContourPoint {
  const x = index % stride;
  return { x, y: (index - x) / stride };
}

/**
 * Trace every boundary ring of a binary raster.
 *
 * Method: crack following. Each foreground pixel contributes a directed edge for
 * every side that touches background. Edges are directed so the foreground is
 * always on the walker's left, which makes a hole wind the opposite way from the
 * ring that contains it — the sign of the shoelace area then classifies the ring
 * without a separate containment test.
 *
 * Ambiguity only happens where two foreground pixels touch at a single corner,
 * and there are two edges in and two out. Turning **left** (counter-clockwise)
 * is chosen there, which keeps diagonally-touching pixels in separate rings.
 * That is 4-connectivity, and it is what a renderer wants: the alternative
 * produces a bowtie that revisits the pinch vertex, which no extruder can use.
 *
 * @param raster Row-major, `width * height`, values `0` or `1`.
 */
export function traceMaskContours(
  raster: Uint8Array,
  width: number,
  height: number,
): Contour[] {
  if (width <= 0 || height <= 0) return [];
  if (raster.length !== width * height) {
    throw new SamParserError(
      'decode_failed',
      `Raster has ${raster.length} samples but ${width}x${height} was declared.`,
    );
  }

  const stride = width + 1;

  const isForeground = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && raster[y * width + x] === 1;

  const edgeFrom: number[] = [];
  const edgeTo: number[] = [];
  /** 0 = +x, 1 = +y, 2 = -x, 3 = -y. Screen coordinates, y grows downwards. */
  const edgeDirection: number[] = [];
  const used: boolean[] = [];
  const outgoing = new Map<number, number[]>();

  const addEdge = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    direction: number,
  ): void => {
    const index = edgeTo.length;
    edgeFrom.push(encodePoint(fromX, fromY, stride));
    edgeTo.push(encodePoint(toX, toY, stride));
    edgeDirection.push(direction);
    used.push(false);

    const key = encodePoint(fromX, fromY, stride);
    const bucket = outgoing.get(key);
    if (bucket === undefined) outgoing.set(key, [index]);
    else bucket.push(index);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raster[y * width + x] !== 1) continue;

      // Direction is chosen so the foreground sits on the walker's left.
      if (!isForeground(x, y - 1)) addEdge(x + 1, y, x, y, 2); // top, right to left
      if (!isForeground(x + 1, y)) addEdge(x + 1, y + 1, x + 1, y, 3); // right, bottom up
      if (!isForeground(x, y + 1)) addEdge(x, y + 1, x + 1, y + 1, 0); // bottom, left to right
      if (!isForeground(x - 1, y)) addEdge(x, y, x, y + 1, 1); // left, top down
    }
  }

  const rings: Ring[] = [];
  const edgeCount = edgeTo.length;

  for (let start = 0; start < edgeCount; start += 1) {
    if (used[start] === true) continue;

    const startPoint = edgeFrom[start] as number;
    used[start] = true;

    let currentPoint = edgeTo[start] as number;
    let incomingDirection = edgeDirection[start] as number;
    const ring: Ring = [decodePoint(startPoint, stride)];

    // Every edge is consumed at most once, so a ring cannot be longer than the
    // edge count. The guard turns a malformed graph into a dropped ring instead
    // of a hang.
    while (currentPoint !== startPoint && ring.length <= edgeCount) {
      ring.push(decodePoint(currentPoint, stride));

      const bucket = outgoing.get(currentPoint);
      let next = -1;
      let bestRank = Number.POSITIVE_INFINITY;

      if (bucket !== undefined) {
        for (const candidate of bucket) {
          if (used[candidate] === true) continue;
          // Left turn first, then straight, then right, then reverse. Left is
          // what separates two pixels that only share a corner.
          const turn = ((edgeDirection[candidate] as number) - incomingDirection + 4) % 4;
          const rank = turn === 3 ? 0 : turn === 0 ? 1 : turn === 1 ? 2 : 3;
          if (rank < bestRank) {
            bestRank = rank;
            next = candidate;
          }
        }
      }

      if (next === -1) break; // Open ring: only reachable from a malformed graph.
      used[next] = true;
      incomingDirection = edgeDirection[next] as number;
      currentPoint = edgeTo[next] as number;
    }

    if (ring.length >= 3) rings.push(ring);
  }

  return classifyRings(rings);
}

/** Shoelace. Positive and negative areas are both valid; the sign is winding. */
export function signedArea(points: readonly ContourPoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] as ContourPoint;
    const next = points[(index + 1) % points.length] as ContourPoint;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

/**
 * Winding tells outer from hole because the tracer keeps foreground on the left.
 * The largest ring decides which sign is "outer": a mask whose only ring is a
 * hole does not exist, and the biggest ring of a connected blob is always its
 * outer boundary.
 */
function classifyRings(rings: readonly Ring[]): Contour[] {
  if (rings.length === 0) return [];

  let dominantSign = 1;
  let largestArea = -1;
  for (const ring of rings) {
    const area = Math.abs(signedArea(ring));
    if (area > largestArea) {
      largestArea = area;
      dominantSign = signedArea(ring) >= 0 ? 1 : -1;
    }
  }

  return rings.map((points) => {
    const area = signedArea(points);
    const sign = area >= 0 ? 1 : -1;
    return { points, area, kind: sign === dominantSign ? 'outer' : 'hole' } as const;
  });
}

/* ------------------------------------------------------------------------- */
/* Simplification                                                            */
/* ------------------------------------------------------------------------- */

function squaredDistanceToSegment(
  point: ContourPoint,
  start: ContourPoint,
  end: ContourPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }

  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clamped = projection < 0 ? 0 : projection > 1 ? 1 : projection;
  const nearestX = start.x + clamped * dx;
  const nearestY = start.y + clamped * dy;

  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}

/** Douglas–Peucker for an open polyline. Keeps both endpoints. */
function simplifyPolyline(points: readonly ContourPoint[], toleranceSq: number): ContourPoint[] {
  if (points.length <= 2) return [...points];

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const pending: Array<readonly [number, number]> = [[0, points.length - 1]];

  while (pending.length > 0) {
    const [first, last] = pending.pop() as readonly [number, number];
    const start = points[first] as ContourPoint;
    const end = points[last] as ContourPoint;

    let farthest = -1;
    let farthestDistance = toleranceSq;

    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredDistanceToSegment(points[index] as ContourPoint, start, end);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = index;
      }
    }

    if (farthest !== -1) {
      keep[farthest] = 1;
      pending.push([first, farthest], [farthest, last]);
    }
  }

  const simplified: ContourPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (keep[index] === 1) simplified.push(points[index] as ContourPoint);
  }
  return simplified;
}

/**
 * Remove vertices that sit exactly on the line between their neighbours.
 *
 * A closed ring has no privileged start, but Douglas–Peucker needs fixed
 * endpoints, so the split vertex is always kept even when it lies in the middle
 * of a straight edge. This pass removes only those exactly-redundant points —
 * it deliberately does not use the simplification tolerance, because a thin
 * shape would then lose real corners.
 */
function dropRedundantVertices(points: readonly ContourPoint[]): ContourPoint[] {
  if (points.length <= 3) return [...points];

  const exactlyCollinear = 1e-18; // distance <= 1e-9 px
  let current = [...points];
  let removed = true;

  while (removed && current.length > 3) {
    removed = false;
    const next: ContourPoint[] = [];

    for (let index = 0; index < current.length; index += 1) {
      const previous = current[(index - 1 + current.length) % current.length] as ContourPoint;
      const point = current[index] as ContourPoint;
      const successor = current[(index + 1) % current.length] as ContourPoint;

      if (squaredDistanceToSegment(point, previous, successor) <= exactlyCollinear) {
        removed = true;
        continue;
      }
      next.push(point);
    }

    if (next.length < 3) break;
    current = next;
  }

  return current;
}

/**
 * Simplify a closed ring.
 *
 * Douglas–Peucker needs two fixed endpoints, and a ring has none, so the ring is
 * split at the point farthest from its first vertex. Both halves are then
 * simplified as open polylines and rejoined. Returns the input unchanged when
 * simplification would collapse it below a triangle.
 */
export function simplifyRing(points: readonly ContourPoint[], tolerance: number): ContourPoint[] {
  if (points.length <= 3 || tolerance <= 0) return [...points];

  const first = points[0] as ContourPoint;
  let splitAt = 0;
  let farthest = -1;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index] as ContourPoint;
    const distance = (point.x - first.x) ** 2 + (point.y - first.y) ** 2;
    if (distance > farthest) {
      farthest = distance;
      splitAt = index;
    }
  }

  if (splitAt === 0) return [...points];

  const toleranceSq = tolerance * tolerance;
  const head = simplifyPolyline(points.slice(0, splitAt + 1), toleranceSq);
  const tail = simplifyPolyline([...points.slice(splitAt), first], toleranceSq);

  // Drop the duplicated split point at the head of `tail` and the repeated
  // closing point at its end; the ring is closed by construction.
  const merged = [...head, ...tail.slice(1, -1)];

  // Collinear runs can leave consecutive duplicates.
  const deduped: ContourPoint[] = [];
  for (const point of merged) {
    const previous = deduped[deduped.length - 1];
    if (previous === undefined || previous.x !== point.x || previous.y !== point.y) {
      deduped.push(point);
    }
  }

  const cleaned = dropRedundantVertices(deduped);
  return cleaned.length >= 3 ? cleaned : [...points];
}

/* ------------------------------------------------------------------------- */
/* Record -> geometry                                                        */
/* ------------------------------------------------------------------------- */

function clampToCoordSpace(value: number): number {
  return Math.min(COORD_SPACE_MAX, Math.max(0, Math.round(value)));
}

/**
 * Half-open source box -> domain box.
 *
 * `right` / `bottom` are exclusive, so a box that reaches the image edge becomes
 * `1000` and never `1000 - 1`. The `+1` floor keeps a box that rounds down to a
 * single coordinate a real region instead of a zero-area point.
 */
export function boxFromBounds(
  bounds: SegmentationMaskBounds,
  mediaWidth: number,
  mediaHeight: number,
): PixelBoundingBox {
  const xmin = clampToCoordSpace((bounds.left / mediaWidth) * COORD_SPACE_MAX);
  const ymin = clampToCoordSpace((bounds.top / mediaHeight) * COORD_SPACE_MAX);
  const xmax = Math.min(
    COORD_SPACE_MAX,
    Math.max(xmin + 1, clampToCoordSpace((bounds.right / mediaWidth) * COORD_SPACE_MAX)),
  );
  const ymax = Math.min(
    COORD_SPACE_MAX,
    Math.max(ymin + 1, clampToCoordSpace((bounds.bottom / mediaHeight) * COORD_SPACE_MAX)),
  );

  return [ymin, xmin, ymax, xmax];
}

/**
 * Decode one mask record into raster summary plus source-pixel contours.
 *
 * Throws `SamParserError` when the payload is structurally invalid, which is the
 * correct response: a mask that cannot be decoded is not a mask we may draw.
 */
export function decodeMaskGeometry(
  record: SegmentationMaskRecord,
  options: MaskGeometryOptions,
): MaskGeometry {
  const { mediaWidth, mediaHeight } = options;
  if (mediaWidth <= 0 || mediaHeight <= 0) {
    throw new SamParserError(
      'invalid_media',
      `Media must have positive dimensions, got ${mediaWidth}x${mediaHeight}.`,
    );
  }

  let raster: Uint8Array;
  try {
    raster = decodeMaskToRaster(record.mask);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SamParserError('decode_failed', `Mask payload could not be decoded: ${detail}`, {
      cause: error,
    });
  }

  const { width, height } = record.mask;
  const rings = traceMaskContours(raster, width, height);

  const tolerance = options.simplifyTolerance ?? DEFAULT_SIMPLIFY_TOLERANCE;

  // The raster is the bounds at 1:1 in every payload observed, but scaling keeps
  // the mapping honest if the API ever returns a downscaled mask.
  const scaleX = (record.bounds.right - record.bounds.left) / width;
  const scaleY = (record.bounds.bottom - record.bounds.top) / height;

  const contours = classifyRings(
    rings.map((ring) =>
      simplifyRing(ring.points, tolerance).map((point) => ({
        x: record.bounds.left + point.x * scaleX,
        y: record.bounds.top + point.y * scaleY,
      })),
    ),
  );

  let filled = 0;
  for (const sample of raster) if (sample === 1) filled += 1;

  return {
    objectId: record.objectId,
    revision: record.revision,
    identity: record.identity,
    confidence: record.confidence ?? null,
    encoding: record.mask.encoding,
    bounds: record.bounds,
    box: boxFromBounds(record.bounds, mediaWidth, mediaHeight),
    raster: {
      width,
      height,
      filled,
      coverage: width * height === 0 ? 0 : filled / (width * height),
    },
    contours,
  };
}

/** Geometry for every mask in a parsed result, in emission order. */
export function geometriesFromResult(
  result: ImageSegmentationResult,
  options: MaskGeometryOptions,
): MaskGeometry[] {
  return recordsOfKind(result.records, 'mask').map((record) =>
    decodeMaskGeometry(record, options),
  );
}
