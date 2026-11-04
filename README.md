# Arcadia — The Verifiable Spatial Ledger

> **Meta Global AI Developer Hackathon Submission**  
> *Category: Multimodal Systems & Autonomous Agents*  
> *Author: Javier Quilumba*  
> *Live Demo: [http://localhost:3000/](http://localhost:3000/)*  
> *Test Suite: 114/114 Passing Tests · Conformance Harness: 3/3 Checks Green*

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
- Node.js 24+ (the test suite runs `.ts` files through Node's native type stripping, so older releases will not execute them)
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

### 3. Run All Tests (114/114 Passing)
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

### 6. Start the 3D Sanctuary & Dev Server
```bash
npm run dev
```
Open [http://localhost:3000/](http://localhost:3000/) in your browser.

- **[W][A][S][D]**: Walk through the 3D sanctuary with articulated anatomical avatar physics and floor foley.
- **[Shift]**: Sprint mode (5.2 m/s forward acceleration, leaning body posture, accelerated footstep cadence).
- **[Click 3D / Mouse Drag]**: Raycast directly onto any furniture item (Armchair, Bookshelf, Desk, Corkboard, Guitar, Bed, Turntable, Window, Butterfly) or drag for 360° orbital cinematic camera.
- **[E] Contextual Interaction**:
  - **Desk**: Open Max's Decision Journal with SAM 3.1 mask overlay, Muse Voice transcript, and causal branch resolution.
  - **Corkboard (Evidence Wall)**: Cinematic camera focus on red string connections between WhatsApp and voice memo, auto-opening the SHA-256 Ledger.
  - **Acoustic Guitar**: Fingerpicking indie arpeggios (Syd Matters · *Obstacles*) with 3D floating musical notes (♪ ♫) rising from the soundhole.
  - **Turntable**: Physical tonearm movement onto spinning vinyl with authentic needle drop crackle audio.
  - **Window**: Cycle through 3 distinct atmospheric states: *Atardecer Dorado* ☀️, *Tormenta de Dudas* 🌧️, and *Crepúsculo de Blackwell* 🌙.
- **[R] / Rewind**: Physical time-travel replay (avatar desands past 240 frames backwards with chromatic aberration warp and reverse audio stretch).
- **[⛓️ Ledger Badge]**: Toggle live cryptographic block inspector and audit hash continuity.

---

## 📜 License
MIT License. Built for the Meta Global AI Developer Hackathon 2026.

