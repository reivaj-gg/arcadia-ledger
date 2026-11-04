# Arcadia — Conformance Harness Report

Generated: 2026-11-04T21:58:55.818Z

## What this report is

This harness measures **pipeline behaviour**, not model quality. Every number
below is computed by running the real code on synthetic inputs. No value is an
estimate of how well Muse Spark, SAM 3.1 or Muse Voice Transcribe perform on real
media — that requires a Model API key, real screenshots and real recordings.

An earlier revision of this file compared hand-written predictions against
hand-written ground truth and reported the result as accuracy. That number was
arithmetic without measurement, and it has been removed.

## Summary

| Check | Measured | Threshold | Status |
|---|---|---|---|
| Coordinate round-trip, mean IoU | 99.96% | ≥ 85% | PASS |
| Coordinate round-trip, worst case | 99.63% | ≥ 85% | PASS |
| Audio contract verdicts | 10/10 | 10/10 | PASS |
| Ledger hash chain verifies | yes, 6 events | yes | PASS |
| Ledger rejects tampering | yes | yes | PASS |
| Ledger detects planted conflict | yes | yes | PASS |
| Bitemporal rewind sees both commitments | 2 | 2 | PASS |

## 1. Coordinate round-trip

A domain box is encoded into a SAM 3.1 prompt by `buildObjectPrompt`, parsed back
out of the token grammar by `parseSegmentationText`, and converted back to a
domain box. IoU is between the box that went in and the box that came out.

This is the check that catches the off-by-one: the domain box is half-open while
the wire's `x2`/`y2` are inclusive, so an encoder that forgets to subtract one
loses a row and a column on every request.

| ID | Case | Media | IoU | Prompt |
|---|---|---|---|---|
| `VIS-01` | WhatsApp gig offer | 720×1280 | 100.00% | `<0f>1<\|box;x1=24;y1=232;x2=519;y2=427;w=720;h=1280\|>` |
| `VIS-02` | Slack amendment | 1080×1920 | 100.00% | `<0f>1<\|box;x1=54;y1=230;x2=733;y2=498;w=1080;h=1920\|>` |
| `VIS-03` | Invoice milestone | 1240×1754 | 100.00% | `<0f>1<\|box;x1=124;y1=526;x2=1115;y2=964;w=1240;h=1754\|>` |
| `VIS-04` | Code review deadline | 720×1280 | 99.63% | `<0f>1<\|box;x1=58;y1=576;x2=445;y2=741;w=720;h=1280\|>` |
| `VIS-05` | Retainer renewal | 1920×1080 | 100.00% | `<0f>1<\|box;x1=77;y1=227;x2=1573;y2=442;w=1920;h=1080\|>` |
| `VIS-06` | Workshop RSVP | 720×1280 | 100.00% | `<0f>1<\|box;x1=43;y1=192;x2=359;y2=357;w=720;h=1280\|>` |
| `VIS-07` | Upwork milestone | 1000×1000 | 100.00% | `<0f>1<\|box;x1=250;y1=400;x2=749;y2=599;w=1000;h=1000\|>` |
| `VIS-08` | Bank transfer notice | 390×844 | 100.00% | `<0f>1<\|box;x1=0;y1=0;x2=151;y2=100;w=390;h=844\|>` |
| `VIS-09` | Notion task deadline | 2560×1440 | 100.00% | `<0f>1<\|box;x1=2304;y1=1008;x2=2533;y2=1050;w=2560;h=1440\|>` |
| `VIS-10` | Sublease deposit | 800×1000 | 100.00% | `<0f>1<\|box;x1=80;y1=100;x2=719;y2=899;w=800;h=1000\|>` |

## 2. Audio contract verdicts

Ten synthetic WAV files, each with a known correct answer, through the real
`inspectWav`. The point is that invalid audio is refused **locally**, before a
paid round-trip that would only return a bare `400`.

| ID | Case | Expected | Actual | Status |
|---|---|---|---|---|
| `AUD-01` | Mono 24 kHz PCM | accept | accept | ok |
| `AUD-02` | Mono 16 kHz PCM | accept | accept | ok |
| `AUD-03` | Ten minutes exactly | accept | accept | ok |
| `AUD-04` | EXTENSIBLE PCM | accept | accept | ok |
| `AUD-05` | Stereo 24 kHz | reject | reject | ok |
| `AUD-06` | 44.1 kHz | reject | reject | ok |
| `AUD-07` | 8-bit PCM | reject | reject | ok |
| `AUD-08` | IEEE float 16-bit | reject | reject | ok |
| `AUD-09` | Eleven minutes | reject | reject | ok |
| `AUD-10` | Truncated data chunk | reject | reject | ok |

## 3. Ledger invariants

A real `EventLedger` with two commitments whose valid ranges overlap by one
hour. The harness checks that the chain verifies, that a substituted evidence id
is rejected on import, that the overlap is found exactly once, and that the
projection taken before reconciliation still shows the earlier state.

| Invariant | Result |
|---|---|
| Chain verifies | true (6 events) |
| Tampering rejected | true |
| Planted conflict detected | true |
| Rewind before reconciliation | 2 commitment(s), status `proposed` |

## Reproduce

```
npm install
npm test      # 100+ unit and integration tests
npm run eval  # regenerates this file
```
