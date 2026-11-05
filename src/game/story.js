/**
 * ARCADIA · Narrative engine
 * ---------------------------------------------------------------------------
 * Pure data + pure functions. No DOM, no Three.js, no I/O. Everything here is
 * deterministic and can be exercised by `tests/story.test.ts` under plain Node.
 *
 * The fiction
 * -----------
 * Arcadia is not a story about invented characters. It is Javier rebuilding
 * his own room from his own evidence — a photograph of his desk, a voice note
 * he recorded at 2 a.m., a bus ticket — and the Meta AI suite proving, pixel
 * by pixel and millisecond by millisecond, that those things are real. The
 * room is a reconstruction; the ledger is what keeps it honest.
 *
 * Design notes
 *  - A "scene" is either: a dialogue beat, a timed choice, an exploration
 *    objective anchored to a 3D hotspot, a chapter card, or an ending.
 *  - Every choice snapshots the *pre-choice* state into `timeline`. Rewinding
 *    restores that snapshot but keeps `memories`, `decisions` and
 *    `rewindCount`. That is the central fiction: time forgives, the ledger
 *    does not. The append-only SHA-256 chain in the 3D engine mirrors it.
 *  - Charges (Eco) are a real resource: 3 at the start, +1 per clue, capped
 *    at 5. No charge, no rewind. This stops the rewind from being a free
 *    "undo all mistakes" button.
 */

export const SAVE_VERSION = 3;
export const MAX_CHARGES = 5;

export const STAT_META = {
  confianza: { label: 'Trust', icon: 'heart', min: 0, max: 100 },
  notas: { label: 'Memory', icon: 'pen', min: 0, max: 100 },
  integridad: { label: 'Integrity', icon: 'shield', min: 0, max: 100 },
  eco: { label: 'Echo', icon: 'butterfly', min: 0, max: 100 },
  dinero: { label: 'Money', icon: 'coin', min: 0, max: 999, prefix: '$' },
};

export const CHAPTERS = {
  prologo: {
    index: '00',
    title: 'The Flutter',
    subtitle: 'Tuesday, 3 November · 16:42',
    epigraph: '“You cannot undo a photograph. You can look at it again.”',
  },
  c1: {
    index: '01',
    title: 'The Capture',
    subtitle: 'Tuesday · 16:47 · Golden hour',
    epigraph: '“A box does not interpret. It points.”',
  },
  c2: {
    index: '02',
    title: 'The Voice Note',
    subtitle: 'Tuesday · 21:14 · Dusk',
    epigraph: '“A recorded voice never forgets the hour it was spoken.”',
  },
  c3: {
    index: '03',
    title: 'The Crossroads',
    subtitle: 'Thursday · 14:55 · Storm',
    epigraph: '“Time forgives. The ledger does not.”',
  },
  final: {
    index: '—',
    title: 'Epilogue',
    subtitle: 'What stays written',
    epigraph: '“What you choose stays written”',
  },
};

export const HOTSPOTS = {
  desk: { name: 'Desk', icon: 'desk' },
  corkboard: { name: 'Corkboard', icon: 'pin' },
  turntable: { name: 'Turntable', icon: 'vinyl' },
  bookshelf: { name: 'Bookshelf', icon: 'books' },
  window: { name: 'Window', icon: 'window' },
  butterfly: { name: 'The butterfly', icon: 'butterfly' },
  guitar: { name: 'Guitar', icon: 'guitar' },
  armchair: { name: 'Armchair', icon: 'armchair' },
  bed: { name: 'The bed', icon: 'bed' },
};

export const CLUES = {
  mask_whatsapp: {
    title: 'Note on the desk',
    detail: 'SAM 3.1 segments the sticky note on the desk: “DELIVERY · THURSDAY 17:00 · $200”. IoU 99.96 %. It is no longer a memory: it is a box of pixels.',
    icon: 'image',
    seals: true,
  },
  voice_turn: {
    title: 'My voice note · 00:04–00:08',
    detail: 'Your own voice, recorded at 2:10 a.m.: “the bus leaves Thursday at 16:30”. Audio does not accept a creative summary: it has milliseconds.',
    icon: 'mic',
    seals: true,
  },
  schedule_photo: {
    title: 'Bus ticket',
    detail: 'A photo of the ticket, with the printed time and the seat number. It confirms the departure without relying on anyone’s memory.',
    icon: 'calendar',
    seals: true,
  },
  polaroid_faro: {
    title: 'Polaroid of the lighthouse',
    detail: 'On the back, in pencil: “the summer I still promised nothing”.',
    icon: 'camera',
  },
  mariposa_azul: {
    title: 'The November butterfly',
    detail: 'It should not be here. Every time you rewind, one more appears.',
    icon: 'butterfly',
  },
  acorde_marea: {
    title: 'Chords for “Low Tide”',
    detail: 'A sheet of chords written by hand. In the margin: “hard things can also be played slowly”.',
    icon: 'note',
  },
  carta_abuela: {
    title: 'Unsent letter',
    detail: '“Telling the truth late is still telling the truth. Don’t get used to arriving late.”',
    icon: 'letter',
  },
  sueno_tormenta: {
    title: 'Storm dream',
    detail: 'You dreamt of a lighthouse gone dark and a notebook full of seals that nobody could erase.',
    icon: 'rain',
  },
};

export const TOTAL_CLUES = Object.keys(CLUES).length;

export const ENDINGS = {
  verdad: {
    id: 'verdad',
    title: 'The sealed truth',
    badge: 'SECRET ENDING',
    weather: 0,
    tone: 'gold',
    verdict: 'You put every piece of evidence on the table before you decided.',
    paragraphs: [
      'You sent the screenshot, the voice note and the ticket. No swearing was needed: the ledger spoke for you, and it spoke in exact hours.',
      'The delivery moved to Friday. The bus left on Thursday at 16:30 and you were on it. You got home before the light in the hallway went out.',
      'The notebook closed with eight clues and a single branchless chain of blocks. For the first time, you did not feel the need to rewind.',
    ],
  },
  faro: {
    id: 'faro',
    title: 'The lighthouse at rest',
    badge: 'GOOD ENDING',
    weather: 0,
    tone: 'gold',
    verdict: 'You kept the promise without breaking the job.',
    paragraphs: [
      'You renegotiated the deadline, delivered on Friday and took the bus. It was not the easiest option or the fastest, but it was the one that left the least noise.',
      'It rained on Thursday, and on Friday the lighthouse came up gold. At home nobody asked why you arrived exactly on time: it was taken for granted.',
      'Things are still pending, yes. But this time you know exactly which ones.',
    ],
  },
  tormenta: {
    id: 'tormenta',
    title: 'The storm we chose',
    badge: 'BITTER ENDING',
    weather: 1,
    tone: 'storm',
    verdict: 'You delivered on time. The bus left without you.',
    paragraphs: [
      'The $200 arrived on schedule. At 16:31 the ticket stopped being worth anything, and at home they put out another plate that nobody touched.',
      'The job came out perfect. You spent the afternoon looking at the window with the feeling of having changed something you no longer know how to give back.',
      'The storm over Arcadia lasted three days. The ledger, on the other hand, will last longer.',
    ],
  },
  silencio: {
    id: 'silencio',
    title: 'The echo of what we never said',
    badge: 'MELANCHOLY ENDING',
    weather: 2,
    tone: 'dusk',
    verdict: 'Saying nothing is also a decision, and it also gets sealed.',
    paragraphs: [
      'You said nothing until Thursday. You arrived late to both places and not entirely at either.',
      'Nobody complained. That was the worst part. Some silences weigh more than any block in the chain.',
      'A blank page is left in the notebook. The blue butterfly is still resting on the window frame.',
    ],
  },
  bucle: {
    id: 'bucle',
    title: 'Infinite loop',
    badge: 'ANOMALOUS ENDING',
    weather: 2,
    tone: 'dusk',
    verdict: 'You went back so many times that the present stopped recognising you.',
    paragraphs: [
      'You rewound once to fix it. Again to be sure. Again because the last one “did not feel right”.',
      'The decisions are still sealed in the ledger, but you can no longer tell which one you are living in. Butterflies fill the room.',
      'Time gave you back every instant. It did not give you back certainty.',
    ],
  },
  eco: {
    id: 'eco',
    title: 'What the Echo left behind',
    badge: 'ENDING',
    weather: 2,
    tone: 'dusk',
    verdict: 'Neither disaster nor triumph: a real life, with real consequences.',
    paragraphs: [
      'You did what you could with what you knew at the time. Some things worked out; others slipped through your fingers.',
      'On Friday the sky settled into an undecided grey. You put the notebook away, switched off the turntable and went out for a walk.',
      'Sometimes the definitive version of a story is simply the one you decide to stop rewriting.',
    ],
  },
};

// ---------------------------------------------------------------------------
// SCENES
// ---------------------------------------------------------------------------

export const SCENES = {
  // ── PROLOGUE ──────────────────────────────────────────────────────────────
  'p.wake': {
    chapter: 'prologo', weather: 0,
    lines: [
      { who: 'narrador', style: 'narration', text: 'Tuesday, 3 November · 16:42. The room is half reconstructed: there are walls that are still memory and objects that are already pixels.' },
      { who: 'javier', text: 'I have spent three weeks rebuilding this room with Meta’s suite. Everything that goes back in its place has to be proven. No “I think it was here”.' },
      { who: 'narrador', style: 'thought', text: 'Arcadia does not draw a pretty room. It rebuilds yours, and seals every object it recovers.' },
    ],
    next: 'p.butterfly',
  },
  'p.butterfly': {
    chapter: 'prologo',
    lines: [
      { who: 'mariposa', style: 'thought', text: 'A blue butterfly settles on the beam of light. I did not reconstruct that one.' },
      { who: 'javier', text: '“What you choose stays written.” I wrote it on the first page of the notebook and I still don’t know why.' },
    ],
    next: 'p.phone',
  },
  'p.phone': {
    chapter: 'prologo', sfx: 'phone', weather: 0,
    lines: [
      { who: 'narrador', style: 'narration', text: 'The phone buzzes on the desk. It is not a message: it is Arcadia telling you it has finished reading your files.' },
      { who: 'muse', style: 'voice', text: 'Three pieces of evidence loaded. One photograph, one voice note, one ticket. Ready to reconstruct.' },
    ],
    objective: {
      hotspot: 'desk',
      text: 'Walk to the desk and open the evidence',
      label: 'Open the evidence',
      next: 'c1.open',
    },
  },

  // ── CHAPTER 1 ─────────────────────────────────────────────────────────────
  'c1.open': {
    chapter: 'c1', chapterCard: true, weather: 0,
    next: 'c1.reply',
  },
  'c1.reply': {
    chapter: 'c1',
    lines: [
      { who: 'javier', style: 'thought', text: 'Thursday at 17:00. Two hundred dollars. I am already doing sums with a calendar I have not opened yet.' },
      { who: 'muse', style: 'ledger', text: 'The note is anchored. The commitment is not: accepting it is still up to you.' },
    ],
    choices: [
      {
        id: 'accept', label: '“Count me in. Thursday at 17:00.”', hint: 'Accept without checking the calendar', tag: 'IMPULSIVE',
        timeLimit: 15000,
        effects: { stats: { confianza: 12, dinero: 200, notas: -8, eco: 8, integridad: -3 }, flags: ['acceptedFast'] },
        ledger: { type: 'commitment.accepted', note: 'Accepted without checking the calendar' },
        weather: 0, next: 'c1.a',
      },
      {
        id: 'check', label: '“Let me check my calendar and confirm.”', hint: 'Buy time before committing', tag: 'CAUTIOUS',
        timeLimit: 15000,
        effects: { stats: { confianza: 3, integridad: 10, eco: -4 }, flags: ['askedForTime'] },
        ledger: { type: 'commitment.deferred', note: 'Verification requested before accepting' },
        weather: 0, next: 'c1.b',
      },
      {
        id: 'negotiate', label: '“I can do it, but I need until Friday.”', hint: 'Negotiate the deadline before saying yes', tag: 'DIRECT',
        timeLimit: 15000,
        effects: { stats: { confianza: -6, integridad: 6, dinero: 80, eco: 3 }, flags: ['negotiated'] },
        ledger: { type: 'commitment.renegotiated', note: 'Scope questioned before the agreement' },
        weather: 0, next: 'c1.c',
      },
    ],
  },
  'c1.a': {
    chapter: 'c1',
    lines: [
      { who: 'javier', style: 'thought', text: 'Said it. The “yes” was easy. The hard part usually arrives later, when somebody asks you why.' },
      { who: 'narrador', style: 'narration', text: 'On the corkboard the sticky note is still pinned with a red tack. Arcadia has drawn a blue box around it.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Check the capture on the evidence board', label: 'Verify with SAM 3.1', next: 'c1.evidence' },
  },
  'c1.b': {
    chapter: 'c1',
    lines: [
      { who: 'javier', style: 'thought', text: 'A “not yet” is still an answer. What it cannot be is an invented “yes”.' },
      { who: 'narrador', style: 'narration', text: 'On the corkboard the sticky note is still pinned with a red tack. Arcadia has drawn a blue box around it.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Check the capture on the evidence board', label: 'Verify with SAM 3.1', next: 'c1.evidence' },
  },
  'c1.c': {
    chapter: 'c1',
    lines: [
      { who: 'javier', style: 'thought', text: 'Now there is a written deadline. Before there was only a fantasy with a price tag.' },
      { who: 'narrador', style: 'narration', text: 'On the corkboard the sticky note is still pinned with a red tack. Arcadia has drawn a blue box around it.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Check the capture on the evidence board', label: 'Verify with SAM 3.1', next: 'c1.evidence' },
  },
  'c1.evidence': {
    chapter: 'c1', evidence: 'mask',
    grant: {
      clues: ['mask_whatsapp'], charges: 1,
      ledger: { type: 'evidence.pixel_anchored', note: 'SAM 3.1 · IoU 99.96% · normalized box 0..1000' },
      sfx: 'clue',
    },
    lines: [
      { who: 'ledger', style: 'ledger', text: 'PIXEL ANCHOR · SAM 3.1 → “DELIVERY THURSDAY 17:00 · $200”. IoU 99.96 %. Box [24,232,519,427].' },
      { who: 'javier', text: 'It is no longer “I think I wrote something down”. It is this pixel, this hour, this number. Now I can actually decide.' },
    ],
    next: 'c1.close',
  },
  'c1.close': {
    chapter: 'c1',
    lines: [
      { who: 'narrador', style: 'narration', text: 'The sun drops behind the lighthouse. On the turntable there is a voice note you have not listened to yet.' },
      { who: 'javier', style: 'thought', text: 'Before I answer properly, I should hear what I told myself at two in the morning.' },
    ],
    next: 'c2.open',
  },

  // ── CHAPTER 2 ─────────────────────────────────────────────────────────────
  'c2.open': {
    chapter: 'c2', chapterCard: true, weather: 2,
    next: 'c2.hint',
  },
  'c2.hint': {
    chapter: 'c2',
    lines: [
      { who: 'narrador', style: 'narration', text: '21:14. The room has turned violet. The turntable blinks: there is a voice note waiting.' },
      { who: 'javier', style: 'thought', text: 'If analogue music tidies my head, a recorded voice should tidy the facts.' },
    ],
    objective: { hotspot: 'turntable', text: 'Play the voice note on the turntable', label: 'Listen to the voice note', next: 'c2.voice' },
  },
  'c2.voice': {
    chapter: 'c2', evidence: 'voice',
    grant: {
      clues: ['voice_turn'], charges: 1,
      ledger: { type: 'evidence.audio_anchored', note: 'Muse Voice · turn 00:04.400–00:08.600 · Speaker A' },
      sfx: 'clue',
    },
    lines: [
      { who: 'muse', style: 'voice', text: 'Javier, it’s ten past two. The bus leaves Thursday at 16:30 and I am not missing it again. I’ll be there. I promise.' },
      { who: 'ledger', style: 'ledger', text: 'AUDIO ANCHOR · Turn 2 · 00:04.400 → 00:08.600. The turn exists; the words are not invented.' },
      { who: 'javier', style: 'thought', text: '16:30. And the delivery at 17:00. Two sealed truths, perfectly incompatible.' },
    ],
    next: 'c2.tell',
  },
  'c2.tell': {
    chapter: 'c2',
    lines: [
      { who: 'javier', text: 'Now I know something I did not know this morning. And the one who said it was me.' },
    ],
    choices: [
      {
        id: 'honest', label: '“I won’t make 17:00. I’m telling you today.”', hint: 'Say all of it, right now', tag: 'HONEST',
        timeLimit: 16000,
        effects: { stats: { integridad: 14, confianza: 8, eco: -8 }, flags: ['honestEarly'] },
        ledger: { type: 'conflict.disclosed', note: 'Conflict disclosed to the other party' },
        next: 'c2.honest',
      },
      {
        id: 'wait', label: '“I can handle both, don’t worry.”', hint: 'Trust that you will work it out', tag: 'OPTIMISTIC',
        timeLimit: 16000,
        effects: { stats: { confianza: 4, notas: -6, eco: 12, integridad: -6 }, flags: ['overconfident'] },
        ledger: { type: 'conflict.concealed', note: 'Conflict left undisclosed' },
        next: 'c2.wait',
      },
      {
        id: 'silent', label: 'Write nothing until Thursday', hint: 'Let time decide', tag: 'EVASIVE',
        timeLimit: 16000,
        effects: { stats: { confianza: -10, integridad: -8, eco: 6 }, flags: ['wentSilent'] },
        ledger: { type: 'conflict.concealed', note: 'Deliberate silence' },
        next: 'c2.silent',
      },
    ],
  },
  'c2.honest': {
    chapter: 'c2',
    lines: [
      { who: 'javier', style: 'thought', text: 'I wrote it and sent it before I could change my mind. “I can deliver Friday morning.” It took them eleven seconds to say yes.' },
      { who: 'narrador', style: 'narration', text: 'A weight came off your shoulders. Telling the truth early is far cheaper than telling it late.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Find the ticket in the bookshelf', label: 'Photograph the ticket', next: 'c2.schedule' },
  },
  'c2.wait': {
    chapter: 'c2',
    lines: [
      { who: 'javier', style: 'thought', text: '“I can handle both.” I said it out loud to convince myself. It did not work.' },
      { who: 'narrador', style: 'narration', text: 'The ticket has been in the same book for three days. You still have not looked at it.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Find the ticket in the bookshelf', label: 'Photograph the ticket', next: 'c2.schedule' },
  },
  'c2.silent': {
    chapter: 'c2',
    lines: [
      { who: 'narrador', style: 'narration', text: 'You left the phone face down. Silence takes up room in a conversation too.' },
      { who: 'javier', style: 'thought', text: 'I’ll fix it tomorrow. That is what I told myself yesterday. And the day before.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Find the ticket in the bookshelf', label: 'Photograph the ticket', next: 'c2.schedule' },
  },
  'c2.schedule': {
    chapter: 'c2', evidence: 'schedule',
    grant: {
      clues: ['schedule_photo'], charges: 1,
      ledger: { type: 'evidence.document_anchored', note: 'Ticket · Thu 16:30 · seat 14C' },
      sfx: 'clue',
    },
    lines: [
      { who: 'ledger', style: 'ledger', text: 'CAUSAL CONFLICT DETECTED · Delivery 17:00 ⟷ Bus 16:30 · Required departure 16:15 · Overlap: 45 min. Detected once.' },
      { who: 'javier', text: 'Three pieces of evidence, one conflict, zero doubts. The only thing missing is choosing. And this time I won’t be able to say I didn’t know.' },
    ],
    next: 'c2.close',
  },
  'c2.close': {
    chapter: 'c2',
    lines: [
      { who: 'narrador', style: 'narration', text: 'Night closes over Arcadia. Tomorrow will be Thursday, and Thursday always arrives on time.' },
    ],
    next: 'c3.open',
  },

  // ── CHAPTER 3 ─────────────────────────────────────────────────────────────
  'c3.open': {
    chapter: 'c3', chapterCard: true, weather: 1,
    next: 'c3.morning',
  },
  'c3.morning': {
    chapter: 'c3',
    lines: [
      { who: 'narrador', style: 'narration', text: 'Thursday · 14:55. It is raining as if the sky had read the conflict too.' },
      { who: 'javier', text: 'The notebook is open on the page of crossroads. Beside it the ledger is still there: it does not erase, it does not edit, it does not forget.' },
      { who: 'mariposa', style: 'thought', text: 'There are still Echo charges left. You can go back... but only to an instant you already know.' },
    ],
    objective: { hotspot: 'desk', text: 'Open the Decision Notebook on the desk', label: 'Make the final decision', next: 'c3.final' },
  },
  'c3.final': {
    chapter: 'c3', evidence: 'conflict',
    lines: [
      { who: 'ledger', style: 'ledger', text: 'CURRENT STATE · 3 anchors · 1 conflict · SHA-256 chain valid. Every answer will append a new block.' },
      { who: 'javier', style: 'thought', text: 'This is the one that counts. Everything else was practice for writing this line.' },
    ],
    choices: [
      {
        id: 'deliver', label: 'Stay and deliver at 17:00', hint: '$200 today, tomorrow’s bus', tag: 'HIGH RISK',
        timeLimit: 22000,
        effects: { stats: { dinero: 200, confianza: 10, notas: -35, integridad: -12, eco: 25 }, flags: ['missedBus'] },
        ledger: { type: 'decision.final', note: 'Path A · Job first' },
        weather: 1, next: 'c3.a',
      },
      {
        id: 'study', label: 'Take the bus and deliver on Friday', hint: 'Protect what you already promised', tag: 'BALANCE',
        timeLimit: 22000,
        effects: { stats: { notas: 20, integridad: 16, dinero: 80, confianza: -4, eco: -12 }, flags: ['protectedPromise'] },
        ledger: { type: 'decision.final', note: 'Path B · Promise protected' },
        weather: 0, next: 'c3.b',
      },
      {
        id: 'together', label: 'Show all three proofs and renegotiate', hint: 'The whole truth, no shortcuts', tag: 'BRAVE',
        requires: { any: [{ flags: ['honestEarly'] }, { minStats: { integridad: 72 } }] },
        timeLimit: 22000,
        effects: { stats: { notas: 14, confianza: 18, integridad: 18, dinero: 120, eco: -20 }, flags: ['sharedTruth'] },
        ledger: { type: 'decision.final', note: 'Path C · Shared provenance' },
        weather: 0, next: 'c3.c',
      },
      {
        id: 'seal', label: 'Seal all eight clues into the ledger', hint: 'Requires having found absolutely everything', tag: 'SECRET',
        requires: { allClues: true },
        timeLimit: 22000,
        effects: { stats: { notas: 18, confianza: 22, integridad: 24, dinero: 140, eco: -25 }, flags: ['truthSealed'] },
        ledger: { type: 'decision.final', note: 'Path D · Complete truth sealed' },
        weather: 0, next: 'c3.d',
      },
    ],
  },
  'c3.a': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'You hit “sent” at 16:58. At 16:31 the bus had already left the station with nobody waiting for it.' },
      { who: 'javier', style: 'thought', text: 'The block is sealed already. I could rewind... but the ledger would remember even that.' },
    ],
  },
  'c3.b': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'You closed the laptop at 16:10, picked up your bag and reached the station four minutes early.' },
      { who: 'javier', style: 'thought', text: 'Not every ending is fireworks. Some are simply arriving on time.' },
    ],
  },
  'c3.c': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'You handed them the screenshot, the voice note and the ticket. There was no argument: there were two parties looking at the same fact.' },
      { who: 'javier', style: 'thought', text: 'Sharing the proof was easier than carrying it.' },
    ],
  },
  'c3.d': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'ledger', style: 'ledger', text: '8/8 CLUES · CHAIN VERIFIED · NO PENDING BRANCHES. The final block seals in golden light.' },
      { who: 'javier', style: 'thought', text: 'Eight clues, one truth, no alternative version that needs hiding.' },
    ],
  },

  // ── FLAVOR / EXPLORATION SCENES ───────────────────────────────────────────
  'f.window': {
    grant: { clues: ['polaroid_faro'], charges: 1, stats: { integridad: 2 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'A polaroid taped to the window frame. The lighthouse, tiny, holding against the wind.' },
      { who: 'javier', style: 'thought', text: '“The summer I still promised nothing.” Strange to write something that true.' },
    ],
  },
  'f.butterfly': {
    grant: { clues: ['mariposa_azul'], charges: 1, stats: { eco: 4 }, sfx: 'clue' },
    lines: [
      { who: 'mariposa', style: 'thought', text: 'It rests on your sleeve for a second and then leaves. Every time time folds, another one appears.' },
      { who: 'javier', style: 'thought', text: 'Sometimes I think they are not butterflies: they are the versions I did not choose, coming to say hello.' },
    ],
  },
  'f.guitar': {
    grant: { clues: ['acorde_marea'], charges: 1, stats: { eco: -4 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Four chords and the creak of the wood. The room drops half a tempo.' },
      { who: 'javier', style: 'thought', text: '“Hard things can also be played slowly.” Quite the advice for a Tuesday.' },
    ],
  },
  'f.armchair': {
    grant: { clues: ['carta_abuela'], charges: 1, stats: { integridad: 3 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Under the armchair cushion, a letter that was never sent. The handwriting is unmistakable.' },
      { who: 'javier', style: 'thought', text: '“Telling the truth late is still telling the truth. Don’t get used to arriving late.”' },
    ],
  },
  'f.bed': {
    grant: { clues: ['sueno_tormenta'], charges: 1, stats: { eco: 5 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'You lie down for a moment. The pillow still smells of rain from a nap that never happened.' },
      { who: 'javier', style: 'thought', text: 'I dreamt of a lighthouse gone dark and a notebook full of seals nobody could erase. Better not sleep any more.' },
    ],
  },
  'f.desk': {
    lines: [
      { who: 'javier', style: 'thought', text: 'The notebook is waiting, open. It is not yet time to write the last line.' },
    ],
  },
  'f.corkboard': {
    lines: [
      { who: 'javier', style: 'thought', text: 'The red thread joins the notes. The capture still has to go through the segmenter before it stops being an opinion.' },
    ],
  },
  'f.turntable': {
    lines: [
      { who: 'javier', style: 'thought', text: 'The needle drops, the vinyl crackles. I still have not played the voice note.' },
    ],
  },
  'f.bookshelf': {
    lines: [
      { who: 'javier', style: 'thought', text: 'The ticket must be among the old notes. Right now there is only dust and patience.' },
    ],
  },
};

/** Hotspot → flavour scene. Only these five grant collectible clues. */
export const FLAVOR = {
  window: 'f.window',
  butterfly: 'f.butterfly',
  guitar: 'f.guitar',
  armchair: 'f.armchair',
  bed: 'f.bed',
  desk: 'f.desk',
  corkboard: 'f.corkboard',
  turntable: 'f.turntable',
  bookshelf: 'f.bookshelf',
};

export const TUTORIAL_STEPS = [
  { id: 'move', title: 'Walk', text: 'W A S D or the arrow keys. The avatar has real inertia and collisions.', keys: ['W', 'A', 'S', 'D'], icon: 'walk' },
  { id: 'look', title: 'Look around', text: 'Drag the mouse to orbit. The wheel pulls closer and pushes away.', keys: ['MOUSE'], icon: 'orbit' },
  { id: 'approach', title: 'Follow the beacon', text: 'Walk to the desk. The ring marks the objective and the compass gives the distance.', keys: ['WASD'], icon: 'compass' },
  { id: 'interact', title: 'Interact', text: 'When the marker appears, press E or click the object.', keys: ['E'], icon: 'spark' },
  { id: 'rewind', title: 'Feel the Echo', text: 'Press R. Time folds backwards. It is your gift and a limited resource.', keys: ['R'], icon: 'rewind' },
];

/**
 * Progressive onboarding: four visual beats that teach the loop by making the
 * player *do* it, not by showing a wall of text. Each step declares the real
 * signal that completes it, so the assistant never lies about progress.
 */
export const ONBOARDING_STEPS = [
  {
    id: 'explore', icon: 'walk', title: 'Explore your space',
    text: 'Move with W A S D and drag the mouse to turn the camera 360°.',
    keys: ['W', 'A', 'S', 'D'],
  },
  {
    id: 'meta', icon: 'spark', title: 'Wake the Meta AI suite',
    text: 'Press I or the Meta AI button. SAM and Muse Voice are about to read your evidence.',
    keys: ['I'],
  },
  {
    id: 'rebuild', icon: 'desk', title: 'Reconstruct an object',
    text: 'Walk to the desk and click. SAM 3.1 scans it and the ledger seals it.',
    keys: ['E'],
  },
  {
    id: 'reflect', icon: 'armchair', title: 'Sit down and think',
    text: 'Interact with the armchair or the bed. The camera drops into first person.',
    keys: ['V'],
  },
];

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    sceneId: 'p.wake',
    chapterId: 'prologo',
    weather: 0,
    stats: { confianza: 50, notas: 72, integridad: 58, eco: 18, dinero: 0 },
    charges: 3,
    clues: [],
    flags: {},
    timeline: [],
    decisions: [],
    memories: [],
    grantedScenes: [],
    rewindCount: 0,
    objective: null,
    tutorialDone: false,
    onboardingDone: false,
    finished: null,
    startedAt: Date.now(),
  };
}

export function cloneState(state) {
  return structuredClone(state);
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** Apply a declarative effect bundle to a copy of the state. */
export function applyEffects(state, effects = {}) {
  const next = cloneState(state);
  const stats = effects.stats || {};
  for (const [key, delta] of Object.entries(stats)) {
    const meta = STAT_META[key];
    if (!meta) continue;
    next.stats[key] = clamp((next.stats[key] ?? 0) + delta, meta.min, meta.max);
  }
  if (effects.charges) next.charges = clamp(next.charges + effects.charges, 0, MAX_CHARGES);
  for (const clue of effects.clues || []) {
    if (!next.clues.includes(clue)) next.clues.push(clue);
  }
  for (const flag of effects.flags || []) next.flags[flag] = true;
  return next;
}

/** Enter a scene: apply its one-shot grant exactly once, remember chapter/weather. */
export function enterScene(state, sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) return { ok: false, reason: 'UNKNOWN_SCENE', state };
  let next = cloneState(state);
  next.sceneId = sceneId;
  if (scene.chapter) next.chapterId = scene.chapter;
  if (scene.weather !== undefined) next.weather = scene.weather;
  if (scene.grant && !next.grantedScenes.includes(sceneId)) {
    next = applyEffects(next, scene.grant);
    next.grantedScenes.push(sceneId);
  }
  return { ok: true, state: next, scene };
}

export function requirementsMet(state, req) {
  if (!req) return true;
  if (req.clues && !req.clues.every((c) => state.clues.includes(c))) return false;
  if (req.allClues && state.clues.length < TOTAL_CLUES) return false;
  if (req.flags && !req.flags.every((f) => state.flags[f])) return false;
  if (req.minStats && !Object.entries(req.minStats).every(([k, v]) => (state.stats[k] ?? 0) >= v)) return false;
  if (req.maxRewinds !== undefined && state.rewindCount > req.maxRewinds) return false;
  if (req.any && !req.any.some((sub) => requirementsMet(state, sub))) return false;
  return true;
}

export function availableChoices(state, sceneId) {
  const scene = SCENES[sceneId];
  if (!scene?.choices) return [];
  return scene.choices.filter((choice) => requirementsMet(state, choice.requires));
}

export function choose(state, sceneId, choiceId) {
  const scene = SCENES[sceneId];
  const choice = scene?.choices?.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'UNKNOWN_CHOICE', state };
  if (!requirementsMet(state, choice.requires)) return { ok: false, reason: 'LOCKED', state };

  const before = cloneState(state);
  const next = applyEffects(before, choice.effects);
  const stamp = Date.now();
  next.timeline.push({ sceneId, choiceId, label: choice.label, at: stamp, snapshot: before });
  next.decisions.push({ sceneId, choiceId, label: choice.label, at: stamp, undone: false });
  return { ok: true, state: next, choice };
}

export function canRewind(state) {
  if (state.finished) return { ok: false, reason: 'FINISHED' };
  if (!state.timeline.length) return { ok: false, reason: 'NO_DECISION' };
  if (state.charges <= 0) return { ok: false, reason: 'NO_CHARGE' };
  // Older snapshots are trimmed from saved games to keep localStorage small.
  if (!state.timeline[state.timeline.length - 1]?.snapshot) return { ok: false, reason: 'NO_SNAPSHOT' };
  return { ok: true };
}

/**
 * Undo the last decision. The snapshot is restored, but the memory of the
 * undone branch survives — exactly like the append-only ledger.
 */
export function rewind(state) {
  const check = canRewind(state);
  if (!check.ok) return { ok: false, reason: check.reason, state };

  const entry = state.timeline[state.timeline.length - 1];
  const restored = cloneState(entry.snapshot);
  restored.charges = Math.max(0, state.charges - 1);
  restored.rewindCount = state.rewindCount + 1;
  restored.memories = Array.from(new Set([...state.memories, entry.label]));
  restored.sceneId = entry.sceneId;
  restored.objective = null;
  // The decision log is append-only: mark the undone branch instead of deleting it.
  restored.decisions = cloneState(state.decisions);
  for (let i = restored.decisions.length - 1; i >= 0; i--) {
    const d = restored.decisions[i];
    if (d.sceneId === entry.sceneId && d.choiceId === entry.choiceId) {
      d.undone = true;
      break;
    }
  }
  return { ok: true, state: restored, entry };
}

export function computeEnding(state) {
  if (state.flags.truthSealed) return ENDINGS.verdad;
  if (state.rewindCount >= 4 || state.stats.eco >= 78) return ENDINGS.bucle;
  if (state.stats.notas >= 78 && state.stats.confianza >= 62 && state.stats.integridad >= 65) return ENDINGS.faro;
  if (state.stats.dinero >= 250 && state.stats.notas < 62) return ENDINGS.tormenta;
  if (state.stats.confianza < 38) return ENDINGS.silencio;
  return ENDINGS.eco;
}

/** Structural integrity of the story graph. Used by the test suite. */
export function validateStory() {
  const errors = [];
  const ids = new Set(Object.keys(SCENES));
  for (const [id, scene] of Object.entries(SCENES)) {
    const targets = [];
    if (scene.next) targets.push(scene.next);
    if (scene.objective?.next) targets.push(scene.objective.next);
    for (const c of scene.choices || []) if (c.next) targets.push(c.next);
    for (const t of targets) if (!ids.has(t)) errors.push(`${id} -> missing scene "${t}"`);
    if (scene.objective && !HOTSPOTS[scene.objective.hotspot]) errors.push(`${id} -> unknown hotspot "${scene.objective.hotspot}"`);
    for (const clue of scene.grant?.clues || []) if (!CLUES[clue]) errors.push(`${id} -> unknown clue "${clue}"`);
    const choiceIds = (scene.choices || []).map((c) => c.id);
    if (new Set(choiceIds).size !== choiceIds.length) errors.push(`${id} -> duplicate choice id`);
    for (const c of scene.choices || []) {
      if (!c.label || !c.next) errors.push(`${id}/${c.id} -> incomplete choice`);
      if (c.requires?.clues) for (const clue of c.requires.clues) if (!CLUES[clue]) errors.push(`${id}/${c.id} -> unknown required clue`);
    }
  }
  for (const [hotspot, id] of Object.entries(FLAVOR)) {
    if (!HOTSPOTS[hotspot]) errors.push(`FLAVOR -> unknown hotspot "${hotspot}"`);
    if (!ids.has(id)) errors.push(`FLAVOR -> missing scene "${id}"`);
  }
  return errors;
}

export const STORY = {
  chapters: CHAPTERS,
  scenes: SCENES,
  flavor: FLAVOR,
  clues: CLUES,
  hotspots: HOTSPOTS,
  endings: ENDINGS,
  onboarding: ONBOARDING_STEPS,
};
