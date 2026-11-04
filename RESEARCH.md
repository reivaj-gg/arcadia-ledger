# Meta Global AI Developer Hackathon 2026 — Research Dossier

> Sources: official event page + Official Rules/Waiver (cerebralvalley.ai), dev.meta.ai docs
> (overview, models, pricing, cookbook, geographic policy), press coverage, GitHub topic scan.
> Compiled 2026-11-02. Verify anything marked UNKNOWN before relying on it.

---

## 1. Snapshot

| Item | Value |
|---|---|
| Official name | Meta Global AI Developer Hackathon |
| Organizers | Meta (Superintelligence Labs) + Cerebral Valley |
| Format | Virtual, worldwide, 10 days |
| Runs | Oct 26 → Nov 4, 2026 |
| **Submission deadline** | **Nov 4, 9:00 PM ET = Nov 4, 23:00 ART (UTC-3)** |
| Judging | Nov 4–8 |
| Winners | Nov 9 (closing ceremony, live finals) |
| Bonus prizes announced | ~Nov 10 |
| Entry | Free, but **application-gated** (closed Oct 25, 11:59 PM ET) |
| Cap | 20,000 accepted applicants |
| Prize pool | $1,000,000 cash |
| Build credits | $150 Meta Model API per selected participant (+ partner credits) |

### Prize table (from Official Rules)

| Place | Indie track ($400k) | Startup track ($550k) |
|---|---|---|
| 1st | $150,000 | $250,000 |
| 2nd | $100,000 | $150,000 |
| 3rd | $75,000 | $75,000 |
| 4th | $50,000 | $50,000 |
| 5th | $25,000 | $25,000 |
| Bonus | up to $50,000 aggregate (community vote, most viral, etc.) | |

Payout: USD via Tremendous, within 30 days of verification. W-9 (US) / W-8BEN (non-US).
Winners pay taxes and transfer fees.

---

## 2. Judging rubric — this is the whole game

| Criterion | Weight | What it really means |
|---|---|---|
| **Impact** | **30%** | Who benefits, how much it matters, could people actually use it, does it fit a theme |
| **Use of Meta AI Tooling** | **25%** | Creative use, beyond a basic integration, capabilities people did not expect |
| **Demo** | **25%** | Working + impressive, holds up live, quality of the demo video |
| **Technical Depth & Execution** | **20%** | Sound engineering, real craft |

Track lens (not weighted, but frames the read):
- **Indie**: creativity, technical ambition, whether it works.
- **Startup**: technical execution, whether it holds up in production.

### Implications (non-negotiable)
1. **75% of the score is Impact + Demo.** A beautiful architecture with a boring demo loses.
2. "Use of Meta AI Tooling" is 25%: one model = basic integration. **Combine 2–4 Meta models** in a way where each is load-bearing.
3. Demo is scored twice (live + video). **Record the video before the last day.**
4. Judging is by humans watching many entries: the first 20 seconds must show a real problem and a real result.

---

## 3. Build surface — Meta Model API

- Base URL: `https://api.meta.ai/v1`
- Auth: `Authorization: Bearer $MODEL_API_KEY`
- Drop-in compatible with **OpenAI SDK** and **Anthropic SDK**; OpenAI-compatible agent CLIs work.
- 1,048,576-token context on Wonder and Spark.

| Model | ID | Input → Output | Price | Rate limit |
|---|---|---|---|---|
| Muse Wonder (preview) | `muse-wonder-1.0` | text/image/video/audio/PDF → text | $4 in / $20 out per 1M | 3k RPM / 4M TPM |
| Muse Spark 1.3 | `muse-spark-1.3` | text/image/video/audio/PDF → text | $1.25 / $4.25 per 1M | 3k RPM / 4M TPM |
| Muse Spark 1.3 Contributor | `muse-spark-1.3-contributor` | same | $0.10 / $0.20 per 1M (**trains Meta models**) | 150 RPM / 3M TPM |
| Muse Image | `muse-image-1.0` | text+image → image | $0.01 / image | 150 RPM |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | audio → text | $0.18 / hour | 256 concurrent streams, 16k streams/hr |
| SAM 3.1 | `sam-3.1` | prompt+image/video → boxes+masks | $2.50 / 1k images; $0.20 / 1k frames (min 50 frames) | 3k RPM |
| Muse Spark Open | open weights | 816B MoE, 42B active; self-host (SGLang/vLLM) or Baseten/Modal/Fireworks | free/self | n/a |
| Muse Glimmer | open weights | distilled from Spark, Apache 2.0, local/edge | free/self | n/a |
| Muse Code | CLI agent | terminal/CI coding agent on Spark | subscription or PAYG | n/a |

Extras:
- **Web search grounding**: `$2.50 / 1,000 queries`, inline citations, no retrieval stack.
- **Prompt caching**: cached input $0.15 (standard) / $0.002 (contributor).
- **Reasoning effort**: `minimal` → `max` (max not on contributor tier).
- **Structured output**, **tool calling** (parallel, streamed), **tool search**, **file handling**, **background responses** (600/min).
- **Computer use** recipes exist (desktop control from screenshots).

### $150 credit math (standard tier)
- Muse Spark: ~120M input tokens.
- Muse Image: ~15,000 images.
- Voice Transcribe: ~833 hours.
- SAM 3.1: ~60,000 images or ~750,000 frames.
- Agent loops burn tokens fast: cap steps, cache prefixes, test on small inputs.

### Partner credits (select participants)
- Baseten: $100 + 2M TPM for open-weight models.
- Modal: $100 (Endpoints, serverless GPUs, sandboxes, training).
- Fireworks: $100 + workshop (Sinan Ozdemir).

### Geography (matters for eligibility vs. ability)
- Argentina: **allowed**.
- Hackathon excludes: Belarus, China, Russia, **all of Ukraine**, Syria, Crimea/Donetsk/Luhansk, Cuba, North Korea, Iran + sanctions targets.
- Model API additionally blocks: Afghanistan, Cambodia, Ethiopia, Haiti, Iraq, Libya, Myanmar, Nicaragua, Pakistan, Somalia, Venezuela, Western Sahara, etc.
- **Muse Image is blocked in India.**

---

## 4. Themes

**Theme 1 — Build for Your World.** Bring Meta's models into your domain. Solve a problem you know firsthand. Free up time and mental space. Make something possible that wasn't before.

**Theme 2 — Push the Frontier.** Software, robotics, manufacturing, energy, materials and beyond. Give a machine a new capability, accelerate a scientific experiment, unlock a better way to understand and control a physical system.

What Meta rewards (inferred from their product push + Connect 2026):
1. Multiple Meta models working together.
2. Consumer / everyday-user scale (Meta's DNA: billions of users).
3. Voice, vision, hands-free, glasses-ready.
4. Agentic: the model **does**, not just chats.
5. Open-weights / on-device when privacy matters (Glimmer).
6. Responsible design: safety, privacy, age-appropriate.

---

## 5. Competitive landscape (public repos, Nov 2)

13 repos tagged `meta-ai-hackathon-2026`. Sample:

| Repo | Pitch | Models |
|---|---|---|
| aegis-home | Photo → prioritized fall-hazard plan for older adults' homes; ES/PT/EN | Spark + SAM 3.1 |
| attest | Proof-of-fix for AI PRs: reproduce bug, confirm fix, sealed receipt | computer use |
| PIVOT | Film a room, ask if furniture fits; verified 3D geometry (0/36 false claims vs 15/36) | SAM 3.1 + Spark |
| muse-qc-cell | Robotic arm quality-inspection cell for injection-molded parts | Spark |
| LoadTruth | Video-verified volumetric tickets for disaster debris + FEMA compliance | SAM 3.1 + Spark |
| WildScore | Wildlife clips → evidence-linked event timeline, auditable CSV | SAM 3.1 + Spark |
| cellproof | LLM proposes rules, exact solver verifies them | Spark |
| cyber-stage | Phone walkthrough → staged real-estate listing | Spark, Wonder, Image, SAM |
| listsnap | Product photo → Shopify/Woo listing + studio photos + IG post | Spark + SAM + Image |
| Orchanium | Retrosynthesis: literature → knowledge graph, two agents argue, rule-based verdict | Spark |
| adaptive-IVR-agent | Agent that learns to navigate phone IVR trees | voice |

**Read:** the field is crowded with "multimodal + domain" demos. Two differentiators are emerging:
- **Verification / grounding**: several top-looking entries sell "verified, not generated" (attest, cellproof, PIVOT, LoadTruth). Deterministic checks beat model confidence in front of judges.
- **Physical world**: robotics, manufacturing, field work — matches "Push the Frontier" and is visually undeniable.

Gaps barely covered: real-time voice agents, on-device/offline (Glimmer), consumer social/creator tools, accessibility, education for kids, multiplayer AI.

---

## 6. Submission — what is known vs. unknown

Known:
- Submitted through `cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit`.
- Original work, owned by you/team; third-party technical help allowed if components remain yours; open source allowed under its license.
- One track per project; Indie teams up to 4, Representative submits and lists members.
- You keep IP, but Organizers get a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license (incl. marketing). **Nothing shared is confidential.**

UNKNOWN (not published publicly; must confirm in Discord/portal):
- Exact submission fields.
- Whether a public repo / live URL / test access is required.
- Required demo video length and format.
- Language requirements.

> Action: log into Cerebral Valley and open the submit page. That is the single highest-value
> unknown left. Do it before writing more code.

---

## 7. Strategy for the remaining ~48h

**Hard clock:** submit by Nov 4, 23:00 ART. Aim for Nov 4, 12:00 ART.

1. **Pick the domain you actually know** (Build for Your World) or one with an undeniable physical demo (Push the Frontier). Domain credibility is 30% of the score.
2. **Two Meta models minimum, each load-bearing.** Canonical combo: SAM 3.1 (perception/measurement) → Muse Spark (reasoning/decision) → optional Muse Image or Voice Transcribe as the interface.
3. **Add a deterministic verifier.** Geometry, units, arithmetic, schema validation, or a solver. Show the model's claim being checked, and show it catching a wrong claim. This is the current meta and it reads as "technical depth" (20%) without a big codebase.
4. **Demo video: 90 seconds, scripted, recorded 24h early.** Structure: problem (10s) → live input (20s) → result on screen (30s) → the verified number (15s) → what's next (15s). No slides.
5. **Live demo must survive.** Pre-recorded fallback clip, local cache of model responses, no dependency on conference Wi-Fi.
6. **Write the submission text for the rubric**, in rubric order: Impact / Use of Meta AI Tooling / Technical Depth / Demo link.
7. **Cost control:** use `muse-spark-1.3-contributor` for dev loops on non-sensitive data; switch to standard for the final recorded run. Cache the stable prefix. Cap agent steps.

### Traps
- Contributor tier trains Meta models: never put real user/client data through it.
- Muse Image unavailable in India — do not make it the only path if you might demo from there.
- Don't ship a wrapper. "Basic integration" is explicitly called out as the low end of the 25%.
- Don't rely on the hidden 6-hour grace period in the page data; no rule mentions it.

---

## 8. Open questions to resolve (in order)

1. Are we accepted? (application closed Oct 25 — without acceptance there is no entry)
2. Do we have the $150 credit grant / API key working?
3. What are the exact submission fields? (log in to the portal)
4. Which track: Indie (solo/≤4) or Startup (needs a real startup + active employee as Representative)?
5. Discord link for office hours / workshop schedule.
