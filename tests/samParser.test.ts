/**
 * SAM 3.1 mask geometry tests.
 *
 * Two layers, on purpose:
 *
 *  - Integration against a **real** payload lifted from Meta's own docs, so the
 *    official decoder and our bridge are proven on bytes we did not author.
 *  - Unit tests on synthetic rasters whose area and ring count are known by
 *    hand, so the contour tracer is judged against arithmetic, not against
 *    whatever it happens to output.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { recordsOfKind } from '@meta-sam/parser';

import {
  SamParserError,
  boxFromBounds,
  decodeMaskGeometry,
  geometriesFromResult,
  parseSegmentationText,
  signedArea,
  simplifyRing,
  traceMaskContours,
  type ContourPoint,
} from '../src/services/samParser.ts';

/* ------------------------------------------------------------------------- */
/* Fixtures                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Frame 0, prompt "button", 320x334 source, two objects, lossless (`~`) masks.
 * Copied verbatim from the "Reading segmentation output" page of the Meta Model
 * API docs. If the grammar ever changes, this test is the first thing that
 * fails — which is exactly where we want the alarm.
 */
const DOC_LINE =
  "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>" +
  "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>" +
  ",1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|>" +
  "<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>";

const DOC_MEDIA = { mediaWidth: 320, mediaHeight: 334 } as const;

/** Build a raster from rows of `#` (foreground) and `.` (background). */
function rasterOf(rows: readonly string[]): { raster: Uint8Array; width: number; height: number } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const raster = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const row = rows[y] as string;
    assert.equal(row.length, width, 'every fixture row must have the same width');
    for (let x = 0; x < width; x += 1) {
      raster[y * width + x] = row[x] === '#' ? 1 : 0;
    }
  }

  return { raster, width, height };
}

function ringArea(points: readonly ContourPoint[]): number {
  return Math.abs(signedArea(points));
}

/* ------------------------------------------------------------------------- */
/* Real payload, official decoder                                            */
/* ------------------------------------------------------------------------- */

test('parse: the documented line yields both boxes and both masks', async () => {
  const result = await parseSegmentationText(DOC_LINE);

  assert.equal(result.outcome.status, 'completed');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(recordsOfKind(result.records, 'box').length, 2);
  assert.equal(recordsOfKind(result.records, 'mask').length, 2);

  // Object ids are sparse on the wire, not necessarily 0-based and dense.
  assert.deepEqual(
    recordsOfKind(result.records, 'mask').map((record) => record.objectId),
    ['0', '1'],
  );
});

test('parse: box coordinates stay half-open, so right = wire x2 + 1', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const [first] = recordsOfKind(result.records, 'box');

  assert.ok(first !== undefined);
  // Wire said x1=211;x2=270, which covers pixels 211..270 inclusive.
  assert.equal(first.left, 211);
  assert.equal(first.right, 271);
  assert.equal(first.top, 228);
  assert.equal(first.bottom, 255);
});

test('parse: an empty output is an empty result, not an exception', async () => {
  const result = await parseSegmentationText('');

  assert.equal(result.outcome.status, 'completed');
  assert.equal(result.records.length, 0);
});

test('parse: a malformed token is reported as a diagnostic, never thrown', async () => {
  const result = await parseSegmentationText('<0f>0<|box;x1=bad|>');

  assert.equal(result.records.length, 0);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.severity, 'error');
  assert.equal(result.diagnostics[0]?.code, 'malformed_record');
});

/* ------------------------------------------------------------------------- */
/* Real payload -> geometry                                                  */
/* ------------------------------------------------------------------------- */

test('geometry: the documented mask decodes to a covered box', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const [geometry] = geometriesFromResult(result, DOC_MEDIA);

  assert.ok(geometry !== undefined);
  assert.equal(geometry.objectId, '0');
  assert.equal(geometry.encoding, 'lossless');
  assert.equal(geometry.confidence, null, 'absence of confidence is not zero');

  // The raster is the bounds at 1:1, which is the invariant the mapping rests on.
  assert.equal(geometry.bounds.right - geometry.bounds.left, geometry.raster.width);
  assert.equal(geometry.bounds.bottom - geometry.bounds.top, geometry.raster.height);

  assert.equal(geometry.raster.width, 60);
  assert.equal(geometry.raster.height, 27);
  assert.equal(geometry.raster.filled, 1539);
  assert.ok(geometry.raster.coverage > 0.9);

  // 211..271 of 320, 228..255 of 334, in the domain's 0..1000 space.
  assert.deepEqual(geometry.box, [683, 659, 763, 847]);
});

test('geometry: contours trace the mask, not the bounding box', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const [geometry] = geometriesFromResult(result, DOC_MEDIA);

  assert.ok(geometry !== undefined);
  assert.ok(geometry.contours.length >= 1);

  const outer = geometry.contours.filter((contour) => contour.kind === 'outer');
  const holes = geometry.contours.filter((contour) => contour.kind === 'hole');
  assert.ok(outer.length >= 1);

  // Outer area minus holes must approximate the filled pixel count. The slack is
  // the simplification tolerance acting on a boundary that is genuinely ragged.
  const netArea =
    outer.reduce((sum, contour) => sum + ringArea(contour.points), 0) -
    holes.reduce((sum, contour) => sum + ringArea(contour.points), 0);

  const slack = geometry.raster.filled * 0.05;
  assert.ok(
    Math.abs(netArea - geometry.raster.filled) <= slack,
    `net contour area ${netArea} should be within ${slack} of ${geometry.raster.filled} filled pixels`,
  );

  // Every point must land inside the source box. A contour outside it would mean
  // the bounds offset was applied twice or not at all.
  for (const contour of geometry.contours) {
    for (const point of contour.points) {
      assert.ok(point.x >= geometry.bounds.left - 1e-9 && point.x <= geometry.bounds.right + 1e-9);
      assert.ok(point.y >= geometry.bounds.top - 1e-9 && point.y <= geometry.bounds.bottom + 1e-9);
    }
  }
});

test('geometry: the two objects keep their own identity and revision', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const geometries = geometriesFromResult(result, DOC_MEDIA);

  assert.equal(geometries.length, 2);
  assert.deepEqual(
    geometries.map((geometry) => geometry.identity),
    ['image:*:0', 'image:*:1'],
  );
  assert.deepEqual(
    geometries.map((geometry) => geometry.revision),
    [1, 1],
  );
});

test('geometry: a corrupt payload is refused, not drawn as something plausible', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const [record] = recordsOfKind(result.records, 'mask');
  assert.ok(record !== undefined);

  const corrupt = {
    ...record,
    // Flip the encoding marker so the payload no longer matches its declaration.
    mask: { ...record.mask, payload: `!${record.mask.payload.slice(1)}` },
  };

  assert.throws(
    () => decodeMaskGeometry(corrupt, DOC_MEDIA),
    (error: unknown) => error instanceof SamParserError && error.code === 'decode_failed',
  );
});

test('geometry: a non-positive media size is refused', async () => {
  const result = await parseSegmentationText(DOC_LINE);
  const [record] = recordsOfKind(result.records, 'mask');
  assert.ok(record !== undefined);

  assert.throws(
    () => decodeMaskGeometry(record, { mediaWidth: 0, mediaHeight: 334 }),
    (error: unknown) => error instanceof SamParserError && error.code === 'invalid_media',
  );
});

/* ------------------------------------------------------------------------- */
/* Contour tracing on synthetic rasters                                      */
/* ------------------------------------------------------------------------- */

test('trace: a filled rectangle is one ring with four corners', () => {
  const { raster, width, height } = rasterOf(['####', '####', '####']);

  const contours = traceMaskContours(raster, width, height);

  assert.equal(contours.length, 1);
  const [only] = contours;
  assert.ok(only !== undefined);
  assert.equal(only.kind, 'outer');
  assert.equal(ringArea(only.points), 12, '4 x 3 = 12 square pixels');

  // The tracer emits every lattice point on the edge; simplification is what
  // collapses them to corners, so here we assert the simplification directly.
  const simplified = simplifyRing(only.points, 0.1);
  assert.equal(simplified.length, 4);
  assert.equal(ringArea(simplified), 12);
});

test('trace: an empty raster has no rings', () => {
  const { raster, width, height } = rasterOf(['...', '...']);

  assert.deepEqual(traceMaskContours(raster, width, height), []);
});

test('trace: a donut yields an outer ring and an opposite-winding hole', () => {
  const { raster, width, height } = rasterOf([
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####',
  ]);

  const contours = traceMaskContours(raster, width, height);

  assert.equal(contours.length, 2);

  const outer = contours.find((contour) => contour.kind === 'outer');
  const hole = contours.find((contour) => contour.kind === 'hole');
  assert.ok(outer !== undefined, 'expected one outer ring');
  assert.ok(hole !== undefined, 'expected one hole');

  assert.equal(ringArea(outer.points), 25);
  assert.equal(ringArea(hole.points), 9);

  // Opposite winding is what makes the hole cut out when rendered.
  assert.equal(Math.sign(outer.area), -Math.sign(hole.area));

  // 25 - 9 = 16, which is exactly how many foreground pixels there are.
  const filled = raster.reduce((sum, sample) => sum + sample, 0);
  assert.equal(ringArea(outer.points) - ringArea(hole.points), filled);
});

test('trace: diagonally touching pixels stay two rings, not one bowtie', () => {
  const { raster, width, height } = rasterOf(['#.', '.#']);

  const contours = traceMaskContours(raster, width, height);

  // 4-connectivity: a bowtie polygon would be unusable for extrusion.
  assert.equal(contours.length, 2);
  for (const contour of contours) {
    assert.equal(contour.kind, 'outer');
    assert.equal(ringArea(contour.points), 1);
  }
});

test('trace: a declared size that disagrees with the raster is a hard error', () => {
  assert.throws(
    () => traceMaskContours(new Uint8Array(6), 4, 3),
    (error: unknown) => error instanceof SamParserError && error.code === 'decode_failed',
  );
});

/* ------------------------------------------------------------------------- */
/* Simplification                                                            */
/* ------------------------------------------------------------------------- */

test('simplify: collinear points collapse, real corners survive', () => {
  const square: ContourPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 0, y: 3 },
  ];

  const simplified = simplifyRing(square, 0.1);

  assert.equal(simplified.length, 4);
  assert.equal(ringArea(simplified), ringArea(square));
  // The four corners are exactly the points that must never be dropped.
  assert.deepEqual(
    simplified.map((point) => `${point.x},${point.y}`).sort(),
    ['0,0', '0,3', '3,0', '3,3'],
  );
});

test('simplify: a triangle is already minimal and is returned untouched', () => {
  const triangle: ContourPoint[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ];

  assert.deepEqual(simplifyRing(triangle, 10), triangle);
});

test('simplify: a tolerance of zero is a no-op rather than a degenerate ring', () => {
  const ring: ContourPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  assert.equal(simplifyRing(ring, 0).length, ring.length);
});

/* ------------------------------------------------------------------------- */
/* Domain box conversion                                                     */
/* ------------------------------------------------------------------------- */

test('box: a box that reaches the edge becomes 1000, not 999', () => {
  assert.deepEqual(
    boxFromBounds({ left: 0, top: 0, right: 320, bottom: 334 }, 320, 334),
    [0, 0, 1000, 1000],
  );
});

test('box: a sub-pixel region still has one unit of extent', () => {
  const box = boxFromBounds({ left: 10, top: 10, right: 11, bottom: 11 }, 4000, 4000);

  assert.equal(box[2] - box[0] >= 1, true, 'height must be at least one unit');
  assert.equal(box[3] - box[1] >= 1, true, 'width must be at least one unit');
});

test('box: coordinates are clamped into the domain space', () => {
  const box = boxFromBounds({ left: -5, top: -5, right: 999, bottom: 999 }, 320, 334);

  for (const value of box) {
    assert.ok(value >= 0 && value <= 1000, `coordinate ${value} escaped 0..1000`);
  }
});
