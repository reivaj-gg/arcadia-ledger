# Arcadia — The Verifiable Spatial Ledger

> **Meta Global AI Developer Hackathon Submission**  
> *Category: Multimodal Systems & Autonomous Agents*  
> *Author: Javier Quilumba*  
> *Live Demo: [http://localhost:3000/](http://localhost:3000/)*  
> *Test Suite: 76/76 Passing Tests · Eval Benchmark: 20/20 Cases Verified*

---

## 🎯 The Core Thesis

> *"An AI assistant that hallucinates or cannot prove where an agreement came from is not an assistant — it is an unhedged debt of trust. Arcadia converts chaotic human interactions into an auditable, cryptographically sealed ledger of proven facts."*

Current AI productivity tools summarize conversations and calendar events using generic embeddings, frequently hallucinating deadlines, commitments, and details. When disputes arise, the user has no receipts.

**Arcadia eliminates this by enforcing physical multimodal provenance**:
1. Every claim is anchored to **pixel-level segmentations** from **SAM 3.1** and **turn-level speech utterances** from **Muse Voice Transcribe 1.0**.
2. Claims are sealed into an **append-only bitemporal ledger** linked by a **SHA-256 cryptographic hash chain** (genesis block `0000...`).
3. If an agreement changes, history is never rewritten with `UPDATE`: a new event is signed, and **Rewind (`asOf`)** allows exact time-travel reconstruction of what was true at any instant in the past.
4. Spatially visualized in a nostalgic, interactive **3D WebGL sanctuary** (Three.js) where the **Z-axis encodes time** ($Z < 0$ history, $Z = 0$ present desk, $Z > 0$ causal branches).

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
2. **SAM 3.1 (Pixel-Perfect Precision):** Receives Spark's box prompt through the token grammar `<|box;x1=..;y1=..;x2=..;y2=..|>` and refines it into a sub-pixel segmentation mask (`one_bit` encoding, confidence $\ge 95\%$).
3. **Muse Voice Transcribe 1.0 (Utterance Grounding):** Ingests mono 16-bit PCM WAV (16 kHz / 24 kHz) and outputs speaker diarization with exact turn boundaries (`startMs`/`endMs`), grounding spoken promises without hallucinated word timestamps.
4. **Local-Only Privacy Policy:** Sensitive evidence marked `sensitivity: 'local-only'` is hard-blocked by adapter middleware and never leaves the local machine.

---

## 📊 Quantitative Evaluation Scorecard (Eval Harness)

To guarantee engineering excellence, Arcadia includes a reproducible **20-case quantitative benchmark** (`scripts/eval.ts`):

| Evaluation Metric | Measured Result | Benchmark Target | Verdict |
|---|---|---|---|
| **Overall Extraction Accuracy** | **100.0%** | $\ge 95.0\%$ | **PASS ✓** |
| **Mean SAM 3.1 Localization (IoU)** | **95.42%** | $\ge 85.0\%$ | **PASS ✓** |
| **Muse Voice Turn Bracketing Precision** | **99.44%** | $\ge 95.0\%$ | **PASS ✓** |
| **Average Verification Latency** | **366.1 ms** | $< 500\text{ ms}$ | **PASS ✓** |
| **Average Batch Verification Cost** | **\$0.0019 USD** | $< \$0.01\text{ USD}$ | **PASS ✓** |

*Reproduce anytime by running `npm run eval`.*

---

## 🏛️ System Architecture & Codebase Layout

```
Myidea/
├── server/
│   ├── index.ts             # Secure Node proxy (isolates META_API_KEY from client)
│   └── policy.ts            # Local-only privacy gate, auth resolution & error mapping
├── src/
│   ├── domain/
│   │   ├── schema.ts        # Pure Zod contracts (PixelBoundingBox, AudioTurn, DomainEvent)
│   │   └── ledger.ts        # Immutable EventLedger, SHA-256 hash chaining, Rewind asOf()
│   ├── services/
│   │   ├── metaAdapter.ts   # Multimodal adapter for Spark 1.3, SAM 3.1 & Muse Voice
│   │   └── fixtures.ts      # Deterministic, self-contained SVG & turn fixtures
│   └── main.js              # Three.js 3D Sanctuary, procedural audio & spatial timeline
├── scripts/
│   ├── eval.ts              # 20-case quantitative evaluation benchmark harness
│   └── dev.mjs              # Concurrently launches Vite UI + Node API proxy
├── tests/
│   ├── ledger.test.ts       # 28 tests: hash chain, bitemporal rewind, tampering detection
│   ├── metaAdapter.test.ts  # 26 tests: WAV validator, SAM token parser, rate limiter
│   ├── server.test.ts       # 21 tests: API proxy security, local-only privacy guard
│   └── e2e.test.ts          # Full end-to-end custody chain integration test
├── EVAL_RESULTS.md          # Generated benchmark results
└── package.json             # Pure Node 24 + TypeScript (Zero Python dependency)
```

---

## 🛡️ Anti-Project Compliance & Rubric Shield

| Rule / Requirement | Status | How Arcadia Complies |
|---|---|---|
| **Meta Model Count** | **Super-compliant** | Uses **3 Meta models** (Muse Spark 1.3, SAM 3.1, Muse Voice Transcribe 1.0). |
| **Banned: Mental Health Chatbot** | **Zero Risk** | Arcadia has no mood tracking, emotion gauges, or mental health advice. It is purely an agreement auditor. |
| **Banned: Generic RAG** | **Zero Risk** | Does not use vector databases or naive embedding searches. Claims are linked via formal cryptographic anchors. |
| **Banned: Simple Image Analyzer** | **Zero Risk** | Implements the full bidirectional Spark $\to$ SAM $\to$ Ledger handshake. |
| **Data Privacy** | **Enforced** | Local-only evidence never crosses the network; verified by unit test `policy: local-only evidence never reaches the network`. |
| **Public Video Demo** | **Ready** | 3-minute structured walkthrough covering the 3 scenarios. |

---

## 🚀 Quickstart & Local Reproduction

### Prerequisites
- Node.js 20+ (Node 24 recommended, built-in TypeScript strip types)
- npm 10+

### 1. Installation
```bash
git clone https://github.com/reivaj-gg/arcadia-ledger.git
cd arcadia-ledger
npm install
```

### 2. Run All Tests (76/76 Passing)
```bash
npm test
```

### 3. Run Quantitative Eval Harness (20 Cases)
```bash
npm run eval
```

### 4. Start the 3D Sanctuary & Dev Server
```bash
npm run dev
```
Open [http://localhost:3000/](http://localhost:3000/) in your browser.

- **[W][A][S][D]**: Walk through the 3D room.
- **[Mouse Drag]**: 360° orbital cinematic camera.
- **[E] Proximity**: Open Max Caulfield's sketchbook at the desk to inspect the SAM 3.1 pixel mask, audio turns, and SHA-256 receipts.
- **[Rewind Button]**: Test bitemporal time travel and state rollback.
- **[⛓️ Ledger Badge]**: Toggle live cryptographic block inspector.

---

## 📜 License
MIT License. Built for the Meta Global AI Developer Hackathon 2026.
