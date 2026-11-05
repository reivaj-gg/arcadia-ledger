# Arcadia — The Verifiable Spatial Ledger

> **Meta Global AI Developer Hackathon Submission**  
> *Category: Multimodal Systems & Autonomous Agents*  
> *Author: Javier Quilumba*  
> *Live Demo: [http://localhost:3000/](http://localhost:3000/)*  
> *Test Suite: 132/132 Passing Tests · Conformance Harness: 3/3 Checks Green*  
> *Now playable as a full narrative game — see [🎮 Arcadia, the game](#-arcadia-the-game)*

---

## 🎯 The Core Thesis

> *"An AI assistant that hallucinates or cannot prove where an agreement came from is not an assistant — it is an unhedged debt of trust. Arcadia converts chaotic human interactions into an auditable, cryptographically sealed ledger of proven facts."*

Current AI productivity tools summarize conversations and calendar events using generic embeddings, frequently hallucinating deadlines, commitments, and details. When disputes arise, the user has no receipts.

**Arcadia eliminates this by enforcing physical multimodal provenance**:
1. Every claim is anchored to **pixel-level segmentations** from **SAM 3.1** and **turn-level speech utterances** from **Muse Voice Transcribe 1.0**.
2. Claims are sealed into an **append-only bitemporal ledger** linked by a **SHA-256 cryptographic hash chain** (genesis block `0000...`).
3. If an agreement changes, history is never rewritten with `UPDATE`: a new event is signed, and **Rewind (`asOf`)** allows exact time-travel reconstruction of what was true at any instant in the past.
4. Spatially visualized in an interactive **3D WebGL sanctuary** (Three.js), where commitments occupy positions in the room and the ledger's bitemporal **Rewind** is exposed as an in-scene control.

---

## 🎮 Arcadia, the game

The 3D sanctuary is no longer just a technical showcase: it is the stage of a **playable narrative game** inspired by the structure of *Life is Strange* (cinematic framing, handwritten typography, a butterfly motif, emotionally weighted timed choices, and a rewind that is a **costly resource**, not a free undo). No protected assets are used — all portraits, lettering, FX and audio are generated procedurally.

**Story.** Tuesday, 3 November. A WhatsApp message promises $200 for a Thursday 4 PM delivery; a voice memo fixes an exam for Thursday 3–5 PM; the department schedule confirms the overlap. Five chapters, 35 scenes, 8 collectible clues, 4 timed decision points, 2 locked secret branches and **6 endings** (`verdad`, `faro`, `tormenta`, `silencio`, `bucle`, `eco`).

**Systems that actually do something**

| System | Behaviour |
|---|---|
| Interactive onboarding | Five real-action steps: walk (WASD), orbit camera (mouse drag), follow the 3D beacon, interact with the desk, feel the rewind (R). Skippable, replayable from the pause menu. |
| Dialogue | Inline SVG portraits, typewriter text, speaker identities, style variants (phone / voice / ledger / thought / narration), click or Space to advance. |
| Timed choices | 15–22 s countdowns; hesitation auto-selects the default branch. Keyboard `1–4`, arrows + Enter, or click. Locked branches show their exact requirement. |
| Consequences | Five live stats (`confianza`, `notas`, `integridad`, `eco`, `dinero`) plus flags feed the ending calculation. Weather shifts with the story (golden hour → dusk → storm). |
| Clues & Eco | 8 clues hidden in real 3D hotspots; each restores one Eco charge (max 5). No charges ⇒ no rewind. |
| Rewind | Restores the pre-choice snapshot, spends a charge, keeps the *memory* of the undone branch, marks the decision `undone` (never deletes it) and seals a `narrative.rewound` ledger block. Time forgives; the chain does not. |
| Objectives | Real 3D hotspots drive the plot. A pulsing world-space beacon and a screen-space waypoint show live distance in metres. |
| Save / continue | `localStorage` (`arcadia.game.v3`) with compacted timeline snapshots so saves never grow exponentially. |
| Journal & ledger | Two-page decision journal (clues, stats, sealed decisions, memories of other timelines) wired to the live SHA-256 block inspector. |

**Controls**

| Key | Action |
|---|---|
| `W A S D` / arrows, `Shift` | Walk / sprint in the 3D room |
| Mouse drag / wheel | Orbit / zoom the cinematic camera |
| `E` or 3D click | Interact with the highlighted hotspot |
| `Space` / `Enter` / click | Advance dialogue |
| `1–4`, `↑ ↓`, `Enter` | Choose a branch |
| `R` / ⏪ button | Rewind one decision (costs 1 Eco) |
| `J` | Decision journal · `L` ledger · `M` music |
| `Esc` | Pause menu (freezes timed choices) |

**Architecture.** The game is a separate layer; the Three.js renderer was **not rewritten**. `src/main.js` publishes a late-bound capability table (`bus.api`) and emits input/interaction events; `src/game/*` consumes them.

| File | Responsibility |
|---|---|
| `src/game/bus.js` | Synchronous event bus + capability table (the only bridge to the 3D engine) |
| `src/game/story.js` / `story.d.ts` | Pure, deterministic narrative graph and state machine (no DOM, no Three.js) |
| `src/game/game.js` | Runtime: HUD, dialogue, choices, tutorial, save, pause, endings, FX |
| `src/game/game.css` | The whole visual identity: paper/ink/tape tokens, torn-edge surfaces, ring-bound journal, tabbed pause menu |
| `src/game/icons.js` | 55 hand-drawn 24×24 line icons + `notebookSpiral()` and `polaroidScene()` procedural assets. No emoji, no icon font, no network request |
| `src/game/portraits.js` | Inline SVG character portraits (zero external assets) |
| `tests/story.test.ts` | 18 deterministic tests for graph integrity, grants, locks, rewind, save compaction, endings and ledger events |

Decisions, discovered evidence and rewinds are sealed into the **same** append-only SHA-256 chain as the multimodal evidence, through three new strict Zod payloads in `src/domain/schema.ts`: `narrative.decision`, `narrative.clue`, `narrative.rewound`. The game→ledger adapter in `src/main.js` normalises fields and is deliberately non-fatal: an optional audit write can never break a player's scene.

**Look and feel.** The interface is built from paper, ink and tape rather than glass and neon. Every surface is a torn-edged sheet (`clip-path`) with depth from `drop-shadow` — `clip-path` discards `box-shadow`, so shadow is applied as a filter that follows the silhouette. The journal is a ring-bound notebook with four lined pages in two spreads, taped polaroids, stamp marks for sealed decisions and ink rows for stats. The pause menu is a tabbed paper folder; the HUD is a strip of taped chips.

Type is a four-voice stack: **Caveat** (handwritten headings), **Kalam** (handwriting body), **Barlow Condensed** (UI labels), **JetBrains Mono** (ledger). All artwork is generated in code — `icons.js` draws 55 line icons, `notebookSpiral()` draws the binding, and `polaroidScene(seed)` renders a deterministic dusk-lighthouse photograph with unique gradient IDs per instance. There are no image files, no icon font, no emoji and no external asset request.

The 3D room was re-lit for the same reason: ACES exposure dropped from `1.25` to `1.04`, the key light from a saturated amber `4.5` to a softer `2.9`, so highlights stop clipping to white and the paper UI no longer sits on a blown-out background.

All music is original and self-titled (*Marea baja*, *Atardecer en Arcadia*, *Lluvia en la Ventana*); the procedural guitar plays original folk progressions. No licensed track, artist, character or franchise reference remains in the source.

---

## 🤝 The Meta Multimodal Handshake (25% Criteria)

Arcadia pairs Meta's flagship models in an explicit, complementary pipeline documented in Meta's research:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHAOTIC HUMAN EVIDENCE                          │
│          [ WhatsApp / Slack Screenshots ]        [ Voice Notes ]       │
└───────────────────────────────┬────────────────────────────┬───────────┘
                                │                            │
                                ▼                            ▼
                  ┌───────────────────────────┐┌───────────────────────────┐
                  │      Muse Spark 1.3       ││ Muse Voice Transcribe 1.0 │
                  │  Extracts structured claim││ Turns, startMs/endMs,     │
                  │  & rough [y1,x1,y2,x2] box││ Speaker A/B diarization   │
                  └─────────────┬─────────────┘└─────────────┬─────────────┘
                                │                            │
                                ▼                            │
                  ┌───────────────────────────┐              │
                  │          SAM 3.1          │              │
                  │ Prompts with Spark box,   │              │
                  │ emits pixel mask token    │              │
                  └─────────────┬─────────────┘              │
                                │                            │
                                └─────────────┬──────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │     PROVENANCE ANCHOR       │
                               │  Exact Pixels + Audio Turn  │
                               └──────────────┬──────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │   APPEND-ONLY HASH CHAIN    │
                               │ SHA-256 Event Ledger (Core) │
                               └──────────────┬──────────────┘
                                              ▼
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
      ┌───────────────────────────┐                       ┌───────────────────────────┐
      │   Bitemporal Rewind Engine│                       │ 3D Spatial Sanctuary UI   │
      │   asOf(t) Causal Timeline │                       │ Three.js WebGL + Audio    │
      └───────────────────────────┘                       └───────────────────────────┘
```

1. **Muse Spark 1.3 (Scene Interpretation):** Reads multimodal evidence, reasons over intent, extracts verifiable structured commitments, and proposes approximate bounding coordinates in normalized `0..1000` space.
2. **SAM 3.1 (Pixel-Perfect Precision):** Receives Spark's box prompt through the token grammar `<|box;x1=..;y1=..;x2=..;y2=..|>` and refines it into a segmentation mask (`one_bit` or `lossless` encoding). Confidence is reported only when the model returns it; absence is never rendered as zero.
3. **Muse Voice Transcribe 1.0 (Utterance Grounding):** Ingests mono 16-bit PCM WAV (16 kHz / 24 kHz) and outputs speaker diarization with exact turn boundaries (`startMs`/`endMs`), grounding spoken promises without hallucinated word timestamps.
4. **Local-Only Privacy Policy:** Sensitive evidence marked `sensitivity: 'local-only'` is hard-blocked by adapter middleware and never leaves the local machine.

---

## 📊 Conformance Harness (What Is Actually Measured)

Arcadia ships a reproducible harness (`npm run eval`) that measures **pipeline behaviour**, not model quality. Every number is computed by running the real code on synthetic inputs; the report in `EVAL_RESULTS.md` states this in its first paragraph.

| Check | What It Proves | Threshold |
|---|---|---|
| **Coordinate round-trip IoU** (10 cases) | A domain box survives encode → wire grammar → parse → decode without losing a row or column. This is the check that catches the half-open vs. inclusive off-by-one. | worst case ≥ 85% |
| **Audio contract verdicts** (10 cases) | Ten synthetic WAVs with known correct answers, through the real validator: stereo, 44.1 kHz, 8-bit, IEEE float, 11-minute and truncated files are refused locally before a paid round-trip. | 10/10 |
| **Ledger invariants** | Hash chain verifies, a substituted evidence id is rejected on import, a planted one-hour overlap is detected exactly once, and the bitemporal rewind sees both commitments before reconciliation. | all four |

**What this harness does not do:** it does not score Muse Spark, SAM 3.1 or Muse Voice Transcribe against real media. That requires a Model API key, real screenshots and real recordings, and the demo video is the evidence for it. An earlier revision compared hand-written predictions against hand-written ground truth and printed a hardcoded PASS; that number was arithmetic without measurement and has been removed.

*Reproduce anytime by running `npm run eval`.*

---

## 🏛️ System Architecture & Codebase Layout

```
Myidea/
├── server/
│   ├── index.ts             # Secure Node proxy (isolates MODEL_API_KEY from client)
│   └── policy.ts            # Local-only privacy gate, key resolution & error mapping
├── src/
│   ├── domain/
│   │   ├── schema.ts        # Pure Zod contracts (PixelBoundingBox, AudioTurn, DomainEvent)
│   │   └── ledger.ts        # Immutable EventLedger, SHA-256 hash chaining, Rewind asOf()
│   ├── services/
│   │   ├── metaAdapter.ts   # Multimodal adapter for Spark 1.3, SAM 3.1 & Muse Voice
│   │   ├── samParser.ts     # Official mask decode -> source-pixel contours & domain box
│   │   ├── audioContract.ts # WAV/ASR contract enforced before any byte is uploaded
│   │   └── fixtures.ts      # Deterministic, self-contained SVG & turn fixtures
│   ├── game/
│   │   ├── bus.js           # Event bus / late-bound 3D capability table
│   │   ├── story.js         # Pure narrative graph: scenes, choices, rewind, endings
│   │   ├── story.d.ts       # Typed surface for the plain-JS engine (TS test suite)
│   │   ├── game.js          # Browser runtime: HUD, dialogue, tutorial, FX, saves
│   │   ├── game.css         # Paper/ink design language, torn edges, journal, pause menu
│   │   ├── icons.js         # Hand-drawn SVG icon set + procedural polaroid/spiral
│   │   └── portraits.js     # Procedural inline SVG character portraits
│   └── main.js              # Three.js 3D Sanctuary, procedural audio & spatial timeline
├── scripts/
│   ├── eval.ts              # Conformance harness: round-trip, audio, ledger invariants
│   ├── smoke.ts             # One live call per Meta model; writes SMOKE_RESULTS.md
│   └── dev.mjs              # Concurrently launches Vite UI + Node API proxy
├── tests/
│   ├── ledger.test.ts       # 28 tests: hash chain, bitemporal rewind, tampering detection
│   ├── metaAdapter.test.ts  # 42 tests: WAV contract, SAM prompt grammar, key resolution
│   ├── samParser.test.ts    # 20 tests: mask decode, contour tracing, simplification
│   ├── server.test.ts       # 21 tests: API proxy security, local-only privacy guard
│   ├── smokeMedia.test.ts   # 2 tests: generated PNG/WAV satisfy the wire contract
│   ├── story.test.ts        # 18 tests: narrative graph, grants, rewind, endings, ledger events
│   └── e2e.test.ts          # Full end-to-end custody chain integration test
├── EVAL_RESULTS.md          # Generated conformance report
└── package.json             # Pure Node 24 + TypeScript (Zero Python dependency)
```

---

## 🛡️ Anti-Project Compliance & Rubric Shield

| Rule / Requirement | Status | How Arcadia Complies |
|---|---|---|
| **Meta Model Count** | **Super-compliant** | Uses **3 Meta models** (Muse Spark 1.3, SAM 3.1, Muse Voice Transcribe 1.0). |
| **Banned: Mental Health Chatbot** | **Zero Risk** | Arcadia has no mood tracking, emotion gauges, or mental health advice. It is purely an agreement auditor. |
| **Banned: Generic RAG** | **Zero Risk** | Does not use vector databases or naive embedding searches. Claims are linked via formal cryptographic anchors. |
| **Banned: Simple Image Analyzer** | **Zero Risk** | Implements the full Spark $\to$ SAM $\to$ Ledger handshake: the box proposes, the mask measures, the ledger seals. |
| **Data Privacy** | **Enforced** | Local-only evidence never crosses the network; verified by unit test `policy: local-only evidence never reaches the network`. |
| **Public Video Demo** | **In preparation** | 3-minute structured walkthrough, recorded after the feature freeze. |

---

## 🚀 Quickstart & Local Reproduction

### Prerequisites
- Node.js 22.6+ with native TypeScript type stripping (verified on v22.22.2; earlier releases cannot execute the `.ts` test files)
- npm 10+

### 1. Installation
```bash
git clone https://github.com/reivaj-gg/arcadia-ledger.git
cd arcadia-ledger
npm install
```

### 2. Configure the environment
```bash
cp .env.example .env
```
- Leave `MODEL_API_KEY` empty and `MOCK_MODE=true` to run entirely on deterministic fixtures with zero network calls.
- Set `MODEL_API_KEY` and `MOCK_MODE=false` for live model calls. `MOCK_MODE=false` without a key is a boot error, never a silent downgrade to fixtures.
- `META_API_KEY` is accepted as a legacy alias and warns at boot; `MODEL_API_KEY` is the documented name.
- The key is read by `server/index.ts` only. It must never carry a `VITE_` prefix, because Vite inlines those into the client bundle.

### 3. Run All Tests (132/132 Passing)
```bash
npm test
npx tsc --noEmit   # Node strips types without checking them; run both
```

### 4. Run the Conformance Harness
```bash
npm run eval
```

### 5. Live Smoke Test (one call per model)
```bash
npm run smoke -- --check   # local only: validates the generated PNG/WAV, no credits
npm run smoke              # one real call to Spark, SAM and Muse Voice
```
- Refuses to run without `MODEL_API_KEY`; it never falls back to fixtures.
- Fails if any receipt says `mock: true`, because a smoke test that served a fixture answers the wrong question.
- Writes `SMOKE_RESULTS.md` with latency, tokens, cost and request id per call.
- The image is synthetic and the audio is a tone, so this proves the wire contract, not recognition quality.

### 6. Play the game (3D Sanctuary + narrative layer)
```bash
npm run dev          # Vite UI on :3000 + secure API proxy
npm run build        # production bundle in dist/
npm run preview      # serve the production build locally
```
Open [http://localhost:3000/](http://localhost:3000/) in your browser. The **title screen** offers *Nueva partida* (with the interactive tutorial), *Continuar* (saved run) and *Cómo se juega* (tutorial only). Game controls are listed in [🎮 Arcadia, the game](#-arcadia-the-game).

The legacy 3D systems still serve the game: the articulated avatar, floor foley, 360° orbital camera, procedural weather, guitar/bed/armchair postures, turntable and the live SHA-256 block inspector all remain functional. The narrative layer owns input during dialogue and menus; exploration returns control to the avatar. Rewind now plays the physical 240-frame avatar replay **and** restores the narrative snapshot, spending one Eco charge while writing an immutable `narrative.rewound` block.

A headless CDP smoke test exercised the full chain (title → tutorial → dialogue → journal-over-dialogue → 3D raycast objective → timed choice → pause freeze → decision → ledger seal → rewind) with **21/21 checks green and zero console errors**, including an assertion that no emoji is rendered anywhere in the UI.

---

## 📜 License
MIT License. Built for the Meta Global AI Developer Hackathon 2026.

