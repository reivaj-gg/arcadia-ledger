# Arcadia: The Verifiable Spatial Ledger — Master Technical Specification

> **Project:** Arcadia (The Verifiable Spatial Ledger & Multimodal Provenance Sanctuary)  
> **Competition:** Meta Global AI Developer Hackathon ($1,000,000 USD Prize Pool)  
> **Hosts:** Meta Superintelligence Labs & Cerebral Valley  
> **Track:** Indie Developer Track / Startup Track  
> **Bonus Categories:** Best Creative Build ($5K), Best Agentic Use-Case ($5K), Most Viral ($20K)  
> **Submission Deadline:** November 4, 2026 @ 9:00 PM ET  
> **Repository:** `https://github.com/reivaj-gg/arcadia-ledger`  
> **Live Interface:** `http://localhost:3000/`  
> **Test Coverage:** 109/109 Tests Passing · Conformance Harness: 3/3 Checks Green  

---

## 1. Executive Summary & Core Thesis

> *"An AI assistant that hallucinates or cannot prove where an agreement came from is not an assistant — it is an unhedged debt of trust. Arcadia converts chaotic human interactions into an auditable, cryptographically sealed ledger of proven facts."*

Modern generative AI tools summarize chat histories, emails, and voice notes into fuzzy vector embeddings, routinely hallucinating commitments, times, and pricing. When real-world disputes happen, users have no receipts.

**Arcadia eliminates this by enforcing physical, pixel- and turn-level multimodal provenance:**
1. **Verifiable Anchoring:** Every extracted commitment is anchored directly to pixel-level masks from **SAM 3.1** and turn-level speech utterances from **Muse Voice Transcribe 1.0**.
2. **Immutable Append-Only Ledger:** Facts are sealed into an append-only bitemporal ledger linked by a **SHA-256 cryptographic hash chain** (genesis block `0000...`). No `UPDATE` or `DELETE` operations ever exist.
3. **Bitemporal Time Travel (`asOf`):** History is strictly immutable. If an agreement changes, a new event is signed. Any historical state can be reconstructed with cryptographic precision at any point in time.
4. **Spatial Sanctuary UI:** A cinematic 3D WebGL room built in Three.js where commitments live as tangible spatial entities, and time-travel rewind is exposed as an interactive in-world mechanic.

---

## 2. Meta Multimodal Handshake (25% Criteria)

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
      │   asOf(t) Causal Timeline │                       │ Three.js WebGL + Foley    │
      └───────────────────────────┘                       └───────────────────────────┘
```

### The Three Models & Their Strict Roles:
1. **Muse Spark 1.3 (Scene Interpretation & Structured Extraction):**  
   Reads messy screenshots and chat exports. Emits structured JSON schemas adhering to strict Zod contracts and proposes approximate region bounding boxes in normalized `0..1000` space.
2. **SAM 3.1 (Sub-Pixel Geometry & Masking):**  
   Receives Spark's approximate coordinates as a `<|box;...|>` prompt token, returning exact segmentation masks (`<|mask;...|>`). Decoded into source-pixel polygon contours. Confidence is kept strictly nullable if not reported by the model.
3. **Muse Voice Transcribe 1.0 (Utterance Turn Grounding):**  
   Processes 16-bit mono PCM WAV (16 kHz / 24 kHz) files under 10 minutes. Returns speaker diarization (Speaker A/B) and millisecond turn brackets (`startMs`/`endMs`), grounding spoken agreements without hallucinating word-level timestamps.

---

## 3. Four-Tier Modular Architecture

The entire codebase is built in **TypeScript strict mode** on **Node.js 24**, with zero Python dependencies and zero naive vector databases:

| Layer | Directory | Responsibilities & Tech Stack |
|---|---|---|
| **Core Domain** | `src/domain/*` | Pure functional domain models: `schema.ts`, `ledger.ts`. Zod contracts, canonical JSON serialization, SHA-256 hash chaining, bitemporal `asOf()` queries, conflict detection. Zero I/O, zero network dependencies. |
| **Model Adapters** | `src/services/*` | `metaAdapter.ts`, `samParser.ts`, `audioContract.ts`. Typed adapters for Spark 1.3, SAM 3.1, and Muse Voice. Token parsing, coordinate normalization, contour polygon simplification, WAV header pre-validation. |
| **Secure Proxy** | `server/*` | Node.js proxy (`server/index.ts`, `server/policy.ts`) running on `:8787`. Isolates `MODEL_API_KEY` from client bundles. Enforces `local-only` privacy policy before any bytes cross the network. |
| **Spatial UI** | `index.html`, `src/main.js` | 3D WebGL Sanctuary (Three.js), procedural textures, AABB collision sliding, articulated avatar rigging, spatial raycast interaction, Web Audio synth foley, in-scene SHA-256 block inspector. |
| **Narrative Game** | `src/game/*` | Playable game layer. `story.js` is a pure DOM-free scene graph / state machine (35 scenes, 8 clues, 6 endings); `game.js` owns HUD, dialogue, timed choices, tutorial, FX, saves and pause; `game.css` supplies the paper/ink presentation (torn-edge sheets, ring-bound journal, tabbed pause) and `icons.js` the hand-drawn SVG icon set plus procedural polaroid/spiral assets; `bus.js` is the **only** bridge to the 3D engine (late-bound `bus.api` capability table + synchronous channels). The renderer was not rewritten. |

**Integration contract.** `src/main.js` publishes `bus.api` (scene, camera, hotspots, world state, ledger append, input lock, projection) and emits `interact`, `input:rewind`, `camera:drag` and `world:state`. The game layer gets *first refusal* on every world interaction and owns the keyboard during dialogue/menus; the avatar is unlocked only during exploration. This keeps the 3D engine a renderer and makes the narrative logic independently testable.

---

## 4. Cryptographic Ledger & Data Integrity

Every event in Arcadia is permanently sealed:

$$\text{Event Hash} = \text{SHA256}(\text{seq} + \text{prevHash} + \text{payloadHash} + \text{timestamp})$$

* **Genesis Block:** `0000000000000000000000000000000000000000000000000000000000000000`.
* **Append-Only Invariant:** Modifying any historical block payload or timestamp instantly breaks subsequent hashes, triggering visual tamper alerts in the HUD.
* **Bitemporal Dimensions:**
  - **Transaction Time (`recordedAt`):** When the ledger ingested the evidence.
  - **Valid Time (`validFrom` / `validTo`):** When the real-world commitment actually takes effect.
* **Rewind (`asOf(timestamp)`):** Projects the timeline back to any prior state, discarding facts learned after that point.
* **Narrative events:** Three additional strict Zod payloads — `narrative.decision`, `narrative.clue`, `narrative.rewound` — seal game actions into the **same** chain as the multimodal evidence. The game→ledger adapter in `src/main.js` normalises fields and is non-fatal, so an optional audit write cannot abort a player's scene.
* **The central invariant, now mechanical:** a player rewind restores the pre-choice snapshot, spends one Eco charge and keeps the *memory* of the undone branch, but the decision row is marked `undone` (never deleted) and a `narrative.rewound` block is appended. Rewinding time cannot rewrite custody — *el tiempo perdona, el ledger no*.
* **Save compaction:** timeline snapshots are full state clones; only the three most recent survive serialisation and nested recursion is stripped, so `localStorage` usage stays bounded. Older instants become non-rewindable with an explicit `NO_SNAPSHOT` reason.

---

## 5. Quantitative Conformance Scorecard

Arcadia features an automated, reproducible benchmark suite (`npm run eval`):

* **Coordinate Round-Trip Precision (10 cases):** `99.96%` Mean IoU (worst case: `99.63%`). Catches half-open vs. closed interval coordinate edge cases.
* **Audio Contract Enforcer (10 synthetic WAV cases):** `10/10` passed. Validates format constraints locally (stereo, 44.1 kHz, 8-bit, IEEE float, >10 min cap, truncated chunks) to protect users from wasted API spend.
* **Ledger Invariants:** Verified hash continuity, tamper detection, single-pass conflict detection, and bitemporal state reconstruction.
* **Unit & E2E Tests:** `132/132` passing across all modules in `~1.0s`, including 18 deterministic narrative-engine tests (`tests/story.test.ts`).
* **Browser Smoke Test:** headless CDP walkthrough of the production build, `21/21` checks green, zero console errors — title → tutorial → dialogue → journal continuity and pagination → 3D raycast objective → timed choice → pause timer freeze → nested overlay return → decision → SHA-256 ledger seal → rewind, plus assertions that the icon set is in use and that no emoji renders anywhere.

---

## 6. Anti-Project Compliance & Rubric Shield

| Criterion | Evaluation Requirement | Arcadia Implementation |
|---|---|---|
| **Use of Meta AI (25%)** | Deep, non-trivial use of Meta models | Chains **3 Meta models** (Muse Spark 1.3 + SAM 3.1 + Muse Voice Transcribe 1.0) via documented handshakes. |
| **Utility & Impact (30%)** | Solves a real, painful problem | Solves conversational commitment hallucinations and dispute resolution with verifiable cryptographic receipts. |
| **Technical Quality (25%)** | Robust engineering, clean code, tests | 132 tests, strict TypeScript, honest eval harness, secure Node key proxy, headless browser smoke test, zero Python dependencies. |
| **Originality & Delight (20%)** | Distinctive, memorable design | A complete narrative game in a 3D sanctuary: tutorial, cinematic dialogue with procedural portraits, timed consequential choices, 8 hidden clues, Eco-limited rewind, 6 endings, and a decision journal welded to the live hash chain. |
| **Banned Categories** | No generic RAG, no chatbots | **Zero Risk:** No vector DB, no naive semantic search, no emotional therapy bots. Purely a verifiable commitment auditor. |

---

## 7. Submission Checklist

- [x] Strict TypeScript compilation (`npx tsc --noEmit` $\to$ 0 errors)
- [x] Full test suite passing (`npm test` $\to$ 132/132)
- [x] Narrative game layer integrated without rewriting the 3D renderer
- [x] Headless browser smoke test of the production build (21/21 checks, zero console errors)
- [x] Conformance benchmark running (`npm run eval` $\to$ 3/3 checks green)
- [x] Production bundle verified (`npm run build` $\to$ clean dist)
- [x] Secure Node proxy running concurrently with Vite dev server (`npm run dev`)
- [x] Copyrighted character names sanitized from source files
- [x] Comprehensive README.md and technical specification
- [ ] 3-Minute Video Demo recorded according to 4-scene script
- [ ] Git remote configured and pushed to `https://github.com/reivaj-gg/arcadia-ledger`
- [ ] Submission submitted at `https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit`
