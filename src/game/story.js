/**
 * ARCADIA · Narrative engine
 * ---------------------------------------------------------------------------
 * Pure data + pure functions. No DOM, no Three.js, no I/O. Everything here is
 * deterministic and can be exercised by `tests/story.test.ts` under plain Node.
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
  confianza: { label: 'Confianza', icon: 'heart', min: 0, max: 100 },
  notas: { label: 'Expediente', icon: 'pen', min: 0, max: 100 },
  integridad: { label: 'Integridad', icon: 'shield', min: 0, max: 100 },
  eco: { label: 'Eco', icon: 'butterfly', min: 0, max: 100 },
  dinero: { label: 'Dinero', icon: 'coin', min: 0, max: 999, prefix: '$' },
};

export const CHAPTERS = {
  prologo: {
    index: '00',
    title: 'El aleteo',
    subtitle: 'Martes, 3 de noviembre · 16:42',
    epigraph: '«No se puede deshacer una fotografía. Sí se puede volver a mirarla.»',
  },
  c1: {
    index: '01',
    title: 'El mensaje',
    subtitle: 'Martes · 16:47 · Atardecer dorado',
    epigraph: '«Toda promesa empieza siendo un mensaje que alguien decide creer.»',
  },
  c2: {
    index: '02',
    title: 'La nota de voz',
    subtitle: 'Martes · 21:14 · Crepúsculo',
    epigraph: '«Una voz grabada no olvida la hora en que fue dicha.»',
  },
  c3: {
    index: '03',
    title: 'La encrucijada',
    subtitle: 'Jueves · 14:55 · Tormenta',
    epigraph: '«El tiempo perdona. El ledger, no.»',
  },
  final: {
    index: '—',
    title: 'Epílogo',
    subtitle: 'Lo que queda escrito',
    epigraph: '«Lo que elijas queda escrito»',
  },
};

export const HOTSPOTS = {
  desk: { name: 'Escritorio', icon: 'desk' },
  corkboard: { name: 'Tablón', icon: 'pin' },
  turntable: { name: 'Tocadiscos', icon: 'vinyl' },
  bookshelf: { name: 'Biblioteca', icon: 'books' },
  window: { name: 'Ventana', icon: 'window' },
  butterfly: { name: 'La mariposa', icon: 'butterfly' },
  guitar: { name: 'Guitarra', icon: 'guitar' },
  armchair: { name: 'Sillón', icon: 'armchair' },
  bed: { name: 'La cama', icon: 'bed' },
};

export const CLUES = {
  mask_whatsapp: {
    title: 'Captura de WhatsApp',
    detail: 'El recuadro «jueves 4 PM · $200» queda segmentado a nivel de píxel. IoU 96,1 %. Ya no es una interpretación: son coordenadas.',
    icon: 'image',
    seals: true,
  },
  voice_turn: {
    title: 'Turno de voz · 00:04–00:08',
    detail: 'La voz del profesor Salas fija el examen de 15:00 a 17:00. El audio no admite resumen creativo: tiene milisegundos.',
    icon: 'mic',
    seals: true,
  },
  schedule_photo: {
    title: 'Horario firmado',
    detail: 'Una foto del horario de cálculo, con el sello del departamento. Confirma el solapamiento sin depender de la memoria de nadie.',
    icon: 'calendar',
    seals: true,
  },
  polaroid_faro: {
    title: 'Polaroid del faro',
    detail: 'Al dorso, a lápiz: «Mariana y yo, el verano en que aún no prometíamos nada».',
    icon: 'camera',
  },
  mariposa_azul: {
    title: 'La mariposa de noviembre',
    detail: 'No debería estar aquí. Cada vez que rebobinas, aparece una más.',
    icon: 'butterfly',
  },
  acorde_marea: {
    title: 'Acordes de «Marea baja»',
    detail: 'Una hoja de acordes escrita a mano. En el margen: «las cosas difíciles también se pueden tocar despacio».',
    icon: 'note',
  },
  carta_abuela: {
    title: 'Carta sin enviar',
    detail: '«Mijo, decir la verdad tarde sigue siendo decir la verdad. No te acostumbres a llegar tarde.»',
    icon: 'letter',
  },
  sueno_tormenta: {
    title: 'Sueño de tormenta',
    detail: 'Soñaste con un faro apagado y un cuaderno lleno de sellos que nadie podía borrar.',
    icon: 'rain',
  },
};

export const TOTAL_CLUES = Object.keys(CLUES).length;

export const ENDINGS = {
  verdad: {
    id: 'verdad',
    title: 'La verdad sellada',
    badge: 'FINAL SECRETO',
    weather: 0,
    tone: 'gold',
    verdict: 'Pusiste todas las pruebas sobre la mesa antes de decidir.',
    paragraphs: [
      'Mariana leyó el chat, escuchó la nota de voz y vio el horario. No hizo falta que le juraras nada: el ledger habló por ti.',
      'Movieron la entrega al viernes a las 11, fuiste al examen y la feria del faro terminó con tu diseño colgado en la pared principal. Nadie tuvo que elegir entre dos personas.',
      'El cuaderno se cerró con ocho pistas y una sola cadena de bloques sin ramas. Por primera vez, no sentiste la necesidad de rebobinar.',
    ],
  },
  faro: {
    id: 'faro',
    title: 'El faro en calma',
    badge: 'BUEN FINAL',
    weather: 0,
    tone: 'gold',
    verdict: 'Protegiste tu expediente sin soltar la mano de Mariana.',
    paragraphs: [
      'Renegociaste la entrega, fuiste a clase y escribiste un mensaje honesto. No fue la opción más fácil ni la más rápida, pero fue la que dejó menos ruido.',
      'El jueves llovió, y el viernes el faro amaneció dorado. Mariana te envió una foto del diseño impreso con un simple «gracias por decírmelo».',
      'Quedan cosas pendientes, sí. Pero esta vez sabes exactamente cuáles.',
    ],
  },
  tormenta: {
    id: 'tormenta',
    title: 'La tormenta que elegimos',
    badge: 'FINAL AMARGO',
    weather: 1,
    tone: 'storm',
    verdict: 'Ganaste el encargo. Algo más se fue con él.',
    paragraphs: [
      'Los $200 llegaron a tiempo. El examen, no. El profesor Salas no hizo preguntas: solo anotó una ausencia en una hoja que tampoco se puede editar.',
      'Mariana quedó contenta. Tú pasaste la tarde mirando la ventana con la sensación de haber cambiado algo que ya no sabes cómo devolver.',
      'La tormenta sobre Arcadia duró tres días. El ledger, en cambio, durará más.',
    ],
  },
  silencio: {
    id: 'silencio',
    title: 'El eco de lo que no dijimos',
    badge: 'FINAL MELANCÓLICO',
    weather: 2,
    tone: 'dusk',
    verdict: 'Callar también es una decisión, y también se sella.',
    paragraphs: [
      'Nunca le contaste a Mariana lo del examen. El jueves llegaste tarde a los dos sitios y a ninguno del todo.',
      'Ella no reclamó. Eso fue lo peor. Hay silencios que pesan más que cualquier bloque de la cadena.',
      'En el cuaderno queda una página en blanco. La mariposa azul sigue posada en el marco de la ventana.',
    ],
  },
  bucle: {
    id: 'bucle',
    title: 'Bucle infinito',
    badge: 'FINAL ANÓMALO',
    weather: 2,
    tone: 'dusk',
    verdict: 'Tantas veces volviste atrás que el presente dejó de reconocerte.',
    paragraphs: [
      'Rebobinaste una vez para arreglarlo. Otra para estar seguro. Otra porque la anterior «no se sentía bien».',
      'Las decisiones siguen selladas en el ledger, pero tú ya no distingues cuál de ellas es la que estás viviendo. Las mariposas llenan la habitación.',
      'El tiempo te devolvió cada instante. No te devolvió la certeza.',
    ],
  },
  eco: {
    id: 'eco',
    title: 'Lo que el Eco dejó',
    badge: 'FINAL',
    weather: 2,
    tone: 'dusk',
    verdict: 'Ni desastre ni triunfo: una vida real, con consecuencias reales.',
    paragraphs: [
      'Hiciste lo que pudiste con lo que sabías en ese momento. Algunas cosas salieron bien, otras se te escaparon entre los dedos.',
      'El viernes el cielo quedó en un gris indeciso. Guardaste el cuaderno, apagaste el tocadiscos y saliste a caminar.',
      'A veces la versión definitiva de una historia es simplemente la que decides dejar de reescribir.',
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
      { who: 'narrador', style: 'narration', text: 'Martes, 3 de noviembre · 16:42. El otoño se filtra por la ventana como si el tiempo fuera miel.' },
      { who: 'javier', text: 'Otra tarde en Arcadia. La cámara, el cuaderno, el tocadiscos... y esa sensación de que hoy algo se va a romper.' },
      { who: 'narrador', style: 'thought', text: 'Tienes un don que no pediste: puedes deshacer un instante. Pero cada vez que lo haces, algo queda escrito.' },
    ],
    next: 'p.butterfly',
  },
  'p.butterfly': {
    chapter: 'prologo',
    lines: [
      { who: 'mariposa', style: 'thought', text: 'Una mariposa azul se posa en el aire. No debería estar aquí en noviembre.' },
      { who: 'javier', text: '«Lo que elijas queda escrito». Lo apunté en la primera página del cuaderno y todavía no sé por qué.' },
    ],
    next: 'p.phone',
  },
  'p.phone': {
    chapter: 'prologo', sfx: 'phone', weather: 0,
    lines: [
      { who: 'narrador', style: 'narration', text: 'El teléfono vibra sobre el escritorio. Una notificación. Luego otra.' },
      { who: 'mariana', style: 'phone', text: '¿Javi? ¿Me ayudas con el diseño para el jueves? Te pago $200. Entrega a las 4 PM.' },
      { who: 'mariana', style: 'phone', text: 'Es para la feria del faro. Si no lo mandamos el jueves, perdemos el espacio.' },
    ],
    objective: {
      hotspot: 'desk',
      text: 'Acércate al escritorio y abre el teléfono',
      label: 'Leer el mensaje completo',
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
      { who: 'javier', style: 'thought', text: 'Jueves a las 4. Doscientos dólares. Dos mensajes y ya estoy haciendo cuentas mentales con una agenda que no he abierto.' },
      { who: 'mariana', style: 'phone', text: '¿?? (escribiendo...)' },
    ],
    choices: [
      {
        id: 'accept', label: '«Cuenta conmigo, jueves a las 4.»', hint: 'Responder sin mirar la agenda', tag: 'IMPULSIVO',
        timeLimit: 15000,
        effects: { stats: { confianza: 12, dinero: 200, notas: -8, eco: 8, integridad: -3 }, flags: ['acceptedFast'] },
        ledger: { type: 'commitment.accepted', note: 'Aceptado sin verificar agenda' },
        weather: 0, next: 'c1.a',
      },
      {
        id: 'check', label: '«Déjame revisar mi agenda y te confirmo.»', hint: 'Ganar tiempo antes de comprometerte', tag: 'PRUDENTE',
        timeLimit: 15000,
        effects: { stats: { confianza: 3, integridad: 10, eco: -4 }, flags: ['askedForTime'] },
        ledger: { type: 'commitment.deferred', note: 'Verificación solicitada antes de aceptar' },
        weather: 0, next: 'c1.b',
      },
      {
        id: 'negotiate', label: '«¿$200 por todo el diseño? Hablemos del alcance.»', hint: 'Negociar antes de decir que sí', tag: 'DIRECTO',
        timeLimit: 15000,
        effects: { stats: { confianza: -6, integridad: 6, dinero: 80, eco: 3 }, flags: ['negotiated'] },
        ledger: { type: 'commitment.renegotiated', note: 'Alcance cuestionado antes del acuerdo' },
        weather: 0, next: 'c1.c',
      },
    ],
  },
  'c1.a': {
    chapter: 'c1',
    lines: [
      { who: 'mariana', style: 'phone', text: '¡Sabía que podía contar contigo! Te paso los archivos esta noche.' },
      { who: 'javier', style: 'thought', text: 'El «sí» fue facilísimo. Lo difícil suele llegar después, cuando alguien te pregunta por qué.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Comprueba la captura en el tablón de evidencias', label: 'Verificar con SAM 3.1', next: 'c1.evidence' },
  },
  'c1.b': {
    chapter: 'c1',
    lines: [
      { who: 'mariana', style: 'phone', text: 'Vale, pero dime hoy, que tengo que cerrar el pedido.' },
      { who: 'javier', style: 'thought', text: 'Un «todavía no» también es una respuesta. Lo que no puede ser es un «sí» inventado.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Comprueba la captura en el tablón de evidencias', label: 'Verificar con SAM 3.1', next: 'c1.evidence' },
  },
  'c1.c': {
    chapter: 'c1',
    lines: [
      { who: 'mariana', style: 'phone', text: 'Buen punto. Es portada + 3 piezas. Si te parece poco lo vemos, ¿sí?' },
      { who: 'javier', style: 'thought', text: 'Ahora hay un alcance escrito. Antes solo había una ilusión con precio.' },
    ],
    objective: { hotspot: 'corkboard', text: 'Comprueba la captura en el tablón de evidencias', label: 'Verificar con SAM 3.1', next: 'c1.evidence' },
  },
  'c1.evidence': {
    chapter: 'c1', evidence: 'mask',
    grant: {
      clues: ['mask_whatsapp'], charges: 1,
      ledger: { type: 'evidence.pixel_anchored', note: 'SAM 3.1 · IoU 96.1% · box normalizado 0..1000' },
      sfx: 'clue',
    },
    lines: [
      { who: 'ledger', style: 'ledger', text: 'ANCLAJE PIXELAR · SAM 3.1 → «Entrega Jueves 4 PM / $200». IoU 96,1 %. Sin interpretación: coordenadas.' },
      { who: 'javier', text: 'Vale. Ya no es «creo que me pidió...». Es exactamente esto, en estos píxeles, a esta hora. Ahora puedo decidir de verdad.' },
    ],
    next: 'c1.close',
  },
  'c1.close': {
    chapter: 'c1',
    lines: [
      { who: 'narrador', style: 'narration', text: 'El sol baja sobre el faro. En algún lugar de la casa, una notificación de voz espera a ser escuchada.' },
      { who: 'javier', style: 'thought', text: 'Antes de contestar del todo, debería oír lo que dejó el profesor en el contestador.' },
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
      { who: 'narrador', style: 'narration', text: '21:14. La habitación se ha vuelto violeta. El tocadiscos parpadea: hay una nota de voz sin escuchar.' },
      { who: 'javier', style: 'thought', text: 'Si la música analógica me ordena la cabeza, una voz grabada debería ordenarme los hechos.' },
    ],
    objective: { hotspot: 'turntable', text: 'Pon la nota de voz en el tocadiscos', label: 'Escuchar nota de voz', next: 'c2.voice' },
  },
  'c2.voice': {
    chapter: 'c2', evidence: 'voice',
    grant: {
      clues: ['voice_turn'], charges: 1,
      ledger: { type: 'evidence.audio_anchored', note: 'Muse Voice · turno 00:04.400–00:08.600 · Speaker A' },
      sfx: 'clue',
    },
    lines: [
      { who: 'profesor', style: 'voice', text: 'Javier, soy Salas. Recordatorio: el examen de cálculo es el jueves de 3 a 5, sin excepciones. Nos vemos allí.' },
      { who: 'ledger', style: 'ledger', text: 'ANCLAJE DE AUDIO · Turno 2 · 00:04.400 → 00:08.600. El turno existe; las palabras no se inventan.' },
      { who: 'javier', style: 'thought', text: 'Cuatro de la tarde. Entre tres y cinco. Dos verdades selladas, perfectamente incompatibles.' },
    ],
    next: 'c2.tell',
  },
  'c2.tell': {
    chapter: 'c2',
    lines: [
      { who: 'javier', text: 'Mariana sigue esperando una respuesta. Y ahora sé algo que ella no sabe.' },
    ],
    choices: [
      {
        id: 'honest', label: '«Tengo examen a esa hora. Busquemos otra fecha.»', hint: 'Decírselo todo, ahora', tag: 'HONESTO',
        timeLimit: 16000,
        effects: { stats: { integridad: 14, confianza: 8, eco: -8 }, flags: ['honestEarly'] },
        ledger: { type: 'conflict.disclosed', note: 'Conflicto comunicado a la contraparte' },
        next: 'c2.honest',
      },
      {
        id: 'wait', label: '«Puedo con las dos cosas, no te preocupes.»', hint: 'Confiar en que ya lo resolverás', tag: 'OPTIMISTA',
        timeLimit: 16000,
        effects: { stats: { confianza: 4, notas: -6, eco: 12, integridad: -6 }, flags: ['overconfident'] },
        ledger: { type: 'conflict.concealed', note: 'Conflicto no comunicado' },
        next: 'c2.wait',
      },
      {
        id: 'silent', label: 'No escribir nada hasta el jueves', hint: 'Dejar que el tiempo decida', tag: 'EVASIVO',
        timeLimit: 16000,
        effects: { stats: { confianza: -10, integridad: -8, eco: 6 }, flags: ['wentSilent'] },
        ledger: { type: 'conflict.concealed', note: 'Silencio deliberado' },
        next: 'c2.silent',
      },
    ],
  },
  'c2.honest': {
    chapter: 'c2',
    lines: [
      { who: 'mariana', style: 'phone', text: 'Gracias por decírmelo ahora y no el jueves a las 4. ¿Viernes por la mañana? Yo aviso a la feria.' },
      { who: 'javier', style: 'thought', text: 'Se me quitó un peso de encima. Decir la verdad pronto es mucho más barato que decirla tarde.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Busca el horario oficial en la biblioteca', label: 'Fotografiar el horario', next: 'c2.schedule' },
  },
  'c2.wait': {
    chapter: 'c2',
    lines: [
      { who: 'mariana', style: 'phone', text: '¡Genial! Entonces quedamos el jueves. Te mando los archivos ahora.' },
      { who: 'javier', style: 'thought', text: '«Puedo con las dos cosas». Lo dije en voz alta para convencerme. No funcionó.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Busca el horario oficial en la biblioteca', label: 'Fotografiar el horario', next: 'c2.schedule' },
  },
  'c2.silent': {
    chapter: 'c2',
    lines: [
      { who: 'narrador', style: 'narration', text: 'Dejaste el teléfono boca abajo. El silencio también ocupa sitio en una conversación.' },
      { who: 'javier', style: 'thought', text: 'Mañana lo arreglo. Eso me dije ayer. Y anteayer.' },
    ],
    objective: { hotspot: 'bookshelf', text: 'Busca el horario oficial en la biblioteca', label: 'Fotografiar el horario', next: 'c2.schedule' },
  },
  'c2.schedule': {
    chapter: 'c2', evidence: 'schedule',
    grant: {
      clues: ['schedule_photo'], charges: 1,
      ledger: { type: 'evidence.document_anchored', note: 'Horario departamental · Cálculo II · Jue 15:00–17:00' },
      sfx: 'clue',
    },
    lines: [
      { who: 'ledger', style: 'ledger', text: 'CONFLICTO CAUSAL DETECTADO · Entrega 16:00–17:00 ⟷ Examen 15:00–17:00 · Solapamiento: 60 min. Detectado 1 vez.' },
      { who: 'javier', text: 'Tres pruebas, un conflicto, cero dudas. Lo único que falta es elegir. Y esta vez no podré decir que no lo sabía.' },
    ],
    next: 'c2.close',
  },
  'c2.close': {
    chapter: 'c2',
    lines: [
      { who: 'narrador', style: 'narration', text: 'La noche se cierra sobre Arcadia. Mañana será jueves, y el jueves siempre llega puntual.' },
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
      { who: 'narrador', style: 'narration', text: 'Jueves · 14:55. Llueve como si el cielo también hubiera leído el conflicto.' },
      { who: 'javier', text: 'El cuaderno está abierto en la página de las encrucijadas. A su lado, el ledger sigue ahí: no borra, no edita, no olvida.' },
      { who: 'mariposa', style: 'thought', text: 'Aún quedan cargas de Eco. Puedes volver atrás... pero solo a un instante que ya conoces.' },
    ],
    objective: { hotspot: 'desk', text: 'Abre el Cuaderno de Decisiones en el escritorio', label: 'Tomar la decisión final', next: 'c3.final' },
  },
  'c3.final': {
    chapter: 'c3', evidence: 'conflict',
    lines: [
      { who: 'ledger', style: 'ledger', text: 'ESTADO ACTUAL · 3 anclajes · 1 conflicto · Cadena SHA-256 válida. Cada respuesta añadirá un bloque nuevo.' },
      { who: 'javier', style: 'thought', text: 'Esta es la que cuenta. Todo lo demás fue prepararse para escribir esta línea.' },
    ],
    choices: [
      {
        id: 'deliver', label: 'Entregar el jueves y faltar a clase', hint: '$200 hoy, una ausencia para siempre', tag: 'ALTO RIESGO',
        timeLimit: 22000,
        effects: { stats: { dinero: 200, confianza: 10, notas: -35, integridad: -12, eco: 25 }, flags: ['skippedExam'] },
        ledger: { type: 'decision.final', note: 'Senda A · Encargo prioritario' },
        weather: 1, next: 'c3.a',
      },
      {
        id: 'study', label: 'Ir al examen y renegociar la entrega', hint: 'Proteger lo que ya estaba comprometido', tag: 'EQUILIBRIO',
        timeLimit: 22000,
        effects: { stats: { notas: 20, integridad: 16, dinero: 80, confianza: -4, eco: -12 }, flags: ['protectedClass'] },
        ledger: { type: 'decision.final', note: 'Senda B · Expediente protegido' },
        weather: 0, next: 'c3.b',
      },
      {
        id: 'together', label: 'Enseñarle las tres pruebas y decidir juntos', hint: 'La verdad completa, sin atajos', tag: 'VALIENTE',
        requires: { any: [{ flags: ['honestEarly'] }, { minStats: { integridad: 72 } }] },
        timeLimit: 22000,
        effects: { stats: { notas: 14, confianza: 18, integridad: 18, dinero: 120, eco: -20 }, flags: ['sharedTruth'] },
        ledger: { type: 'decision.final', note: 'Senda C · Proveniencia compartida' },
        weather: 0, next: 'c3.c',
      },
      {
        id: 'seal', label: 'Sellar las ocho pistas en el ledger', hint: 'Requiere haber encontrado absolutamente todo', tag: 'SECRETO',
        requires: { allClues: true },
        timeLimit: 22000,
        effects: { stats: { notas: 18, confianza: 22, integridad: 24, dinero: 140, eco: -25 }, flags: ['truthSealed'] },
        ledger: { type: 'decision.final', note: 'Senda D · Verdad completa sellada' },
        weather: 0, next: 'c3.d',
      },
    ],
  },
  'c3.a': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'Marcaste «enviado» a las 15:58. A las 16:03, el aula de cálculo cerró la puerta.' },
      { who: 'javier', style: 'thought', text: 'El bloque ya está sellado. Podría rebobinar... pero el ledger recordaría incluso eso.' },
    ],
  },
  'c3.b': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'Escribiste el mensaje más difícil de la semana. Lo enviaste. Y fuiste a clase.' },
      { who: 'javier', style: 'thought', text: 'No todos los finales son fuegos artificiales. Algunos son simplemente llegar a tiempo.' },
    ],
  },
  'c3.c': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'narrador', style: 'narration', text: 'Le pasaste la captura, el turno de voz y el horario. No hubo discusión: hubo dos personas mirando el mismo hecho.' },
      { who: 'javier', style: 'thought', text: 'Compartir la prueba fue más fácil que cargar con ella.' },
    ],
  },
  'c3.d': {
    chapter: 'c3', ending: true,
    lines: [
      { who: 'ledger', style: 'ledger', text: '8/8 PISTAS · CADENA VERIFICADA · SIN RAMAS PENDIENTES. El bloque final se sella con luz dorada.' },
      { who: 'javier', style: 'thought', text: 'Ocho pistas, una verdad, ninguna versión alternativa que necesite esconderse.' },
    ],
  },

  // ── FLAVOR / EXPLORATION SCENES ───────────────────────────────────────────
  'f.window': {
    grant: { clues: ['polaroid_faro'], charges: 1, stats: { integridad: 2 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Una polaroid sujeta con cinta al marco de la ventana. El faro, diminuto, resistiendo el viento.' },
      { who: 'javier', style: 'thought', text: '«Mariana y yo, el verano en que aún no prometíamos nada». Qué raro escribir algo tan cierto.' },
    ],
  },
  'f.butterfly': {
    grant: { clues: ['mariposa_azul'], charges: 1, stats: { eco: 4 }, sfx: 'clue' },
    lines: [
      { who: 'mariposa', style: 'thought', text: 'Se posa en tu manga un segundo y se va. Cada vez que el tiempo se dobla, aparece otra igual.' },
      { who: 'javier', style: 'thought', text: 'A veces pienso que no son mariposas: son las versiones que no elegí, viniendo a saludar.' },
    ],
  },
  'f.guitar': {
    grant: { clues: ['acorde_marea'], charges: 1, stats: { eco: -4 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Cuatro acordes y el crujido de la madera. La habitación baja medio tempo.' },
      { who: 'javier', style: 'thought', text: '«Las cosas difíciles también se pueden tocar despacio». Menudo consejo para un martes.' },
    ],
  },
  'f.armchair': {
    grant: { clues: ['carta_abuela'], charges: 1, stats: { integridad: 3 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Bajo el cojín del sillón, una carta que nunca se envió. La letra es inconfundible.' },
      { who: 'javier', style: 'thought', text: '«Decir la verdad tarde sigue siendo decir la verdad. No te acostumbres a llegar tarde.»' },
    ],
  },
  'f.bed': {
    grant: { clues: ['sueno_tormenta'], charges: 1, stats: { eco: 5 }, sfx: 'clue' },
    lines: [
      { who: 'narrador', style: 'narration', text: 'Te recuestas un momento. La almohada todavía huele a lluvia de una siesta que no ocurrió.' },
      { who: 'javier', style: 'thought', text: 'Soñé con un faro apagado y un cuaderno lleno de sellos que nadie podía borrar. Mejor no dormir más.' },
    ],
  },
  'f.desk': {
    lines: [
      { who: 'javier', style: 'thought', text: 'El cuaderno espera abierto. Aún no es el momento de escribir la última línea.' },
    ],
  },
  'f.corkboard': {
    lines: [
      { who: 'javier', style: 'thought', text: 'El hilo rojo une las notas. Falta pasar la captura por el segmentador para que deje de ser una opinión.' },
    ],
  },
  'f.turntable': {
    lines: [
      { who: 'javier', style: 'thought', text: 'La aguja baja, el vinilo cruje. Todavía no he puesto la nota de voz.' },
    ],
  },
  'f.bookshelf': {
    lines: [
      { who: 'javier', style: 'thought', text: 'Entre apuntes viejos debe estar el horario firmado. Ahora mismo solo hay polvo y paciencia.' },
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
  { id: 'move', title: 'Camina', text: 'W A S D o las flechas. El avatar tiene inercia y colisiones reales.', keys: ['W', 'A', 'S', 'D'], icon: 'walk' },
  { id: 'look', title: 'Mira alrededor', text: 'Arrastra con el ratón para orbitar. La rueda acerca y aleja.', keys: ['RATÓN'], icon: 'orbit' },
  { id: 'approach', title: 'Sigue el faro', text: 'Acércate al escritorio. El anillo marca el objetivo y el compás da la distancia.', keys: ['WASD'], icon: 'compass' },
  { id: 'interact', title: 'Interactúa', text: 'Cuando aparezca el marcador, pulsa E o haz clic en el objeto.', keys: ['E'], icon: 'spark' },
  { id: 'rewind', title: 'Siente el Eco', text: 'Pulsa R. El tiempo se dobla hacia atrás. Es tu don y un recurso limitado.', keys: ['R'], icon: 'rewind' },
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

export const STORY = { chapters: CHAPTERS, scenes: SCENES, flavor: FLAVOR, clues: CLUES, hotspots: HOTSPOTS, endings: ENDINGS };
