# Arcadia — Provenance & Extraction Eval Harness Report

Generated: 2026-11-04T14:36:27.653Z  
Benchmark Size: **20 synthetic multimodal test cases** (10 visual, 10 audio)  
Target Models: **Muse Spark 1.3** · **SAM 3.1** · **Muse Voice Transcribe 1.0**

## 📊 Summary Scorecard

| Metric | Measured Value | Target Benchmark | Status |
|---|---|---|---|
| **Overall Extraction Accuracy** | **100.0%** | $\ge 95.0\%$ | **PASS ✓** |
| **Mean SAM 3.1 Localization (IoU)** | **95.42%** | $\ge 85.0\%$ | **PASS ✓** |
| **Muse Voice Turn Bracketing Precision** | **99.44%** | $\ge 95.0\%$ | **PASS ✓** |
| **Average End-to-End Latency** | **366.1 ms** | $< 500\text{ ms}$ | **PASS ✓** |
| **Average Verification Cost** | **\$0.0020 USD** | $< \$0.01\text{ USD}$ | **PASS ✓** |

---

## 🖼️ 1. Visual Evidence Benchmarks (Muse Spark $\to$ SAM 3.1)

| ID | Name | Category | SAM 3.1 IoU | Extraction | Latency | Est. Cost |
|---|---|---|---|---|---|---|
| `VIS-01` | WhatsApp Gig Offer | Freelance Chat | **95.6%** | ✓ Correct | 342 ms | \$0.0035 |
| `VIS-02` | Slack Contract Amendment | Client Agreement | **96.1%** | ✓ Correct | 318 ms | \$0.0034 |
| `VIS-03` | Invoice Milestone 2 | Billing Receipt | **97.9%** | ✓ Correct | 365 ms | \$0.0036 |
| `VIS-04` | Telegram Code Review Deadline | Team Chat | **92.9%** | ✓ Correct | 295 ms | \$0.0031 |
| `VIS-05` | Email Retainer Renewal | Email | **95.5%** | ✓ Correct | 380 ms | \$0.0038 |
| `VIS-06` | Discord Workshop RSVP | Community | **95.5%** | ✓ Correct | 288 ms | \$0.0030 |
| `VIS-07` | Upwork Project Milestone | Platform Contract | **96.5%** | ✓ Correct | 340 ms | \$0.0035 |
| `VIS-08` | SMS Bank Transfer Notice | Payment SMS | **92.6%** | ✓ Correct | 260 ms | \$0.0028 |
| `VIS-09` | Notion Task Deadline | Project Management | **95.9%** | ✓ Correct | 310 ms | \$0.0032 |
| `VIS-10` | Sublease Deposit Agreement | Personal Agreement | **95.6%** | ✓ Correct | 355 ms | \$0.0036 |

---

## 🎙️ 2. Audio Evidence Benchmarks (Muse Voice Transcribe 1.0)

| ID | Name | Category | Speaker Diarization | Turn Precision | Latency | Est. Cost |
|---|---|---|---|---|---|---|
| `AUD-01` | Calculus Class Attendance Note | Personal Dilemma | Spk A (100%) | **100.0%** | 420 ms | \$0.0006 |
| `AUD-02` | Team Standup Blockers | Meeting | Spk B (100%) | **96.9%** | 460 ms | \$0.0007 |
| `AUD-03` | Doctor Appointment Reminder | Voice Memo | Spk A (100%) | **100.0%** | 390 ms | \$0.0005 |
| `AUD-04` | Mentor Session Booking | Call Excerpt | Spk B (100%) | **99.6%** | 410 ms | \$0.0006 |
| `AUD-05` | Equipment Return Commitment | Voice Memo | Spk A (100%) | **100.0%** | 380 ms | \$0.0005 |
| `AUD-06` | Study Group Meetup | Group Audio | Spk C (100%) | **98.4%** | 450 ms | \$0.0006 |
| `AUD-07` | Gym Subscription Freeze | Call Excerpt | Spk A (100%) | **100.0%** | 395 ms | \$0.0005 |
| `AUD-08` | Podcast Recording Schedule | Voice Memo | Spk A (100%) | **99.5%** | 405 ms | \$0.0006 |
| `AUD-09` | Family Dinner Confirmation | Family Audio | Spk B (100%) | **100.0%** | 375 ms | \$0.0005 |
| `AUD-10` | Hackathon Video Submission Deadline | Personal Memo | Spk A (100%) | **100.0%** | 385 ms | \$0.0005 |

---

## 🔬 Methodology & Provenance Invariants

1. **Pixel Box IoU:** Intersection-over-union computed across normalized 0..1000 space:
   $$\text{IoU}(A, B) = \frac{\text{Area}(A \cap B)}{\text{Area}(A \cup B)}$$
   Boxes with $\text{IoU} \ge 0.85$ are considered high-fidelity pixel provenance anchors.

2. **Audio Turn Bracketing:** Evaluates turn-level boundaries ($[\text{startMs}, \text{endMs}]$) returned in DIARIZATION mode. As documented by Meta, Muse Voice does not emit word-level timestamps; claims are grounded at turn level.

3. **Reproducibility:** Run `npm run eval` locally to reproduce this scorecard.
