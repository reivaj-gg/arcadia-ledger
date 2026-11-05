/**
 * Hand-drawn SVG character portraits. Kept as inline SVG so the game has zero
 * image assets, works offline, and stays crisp on any DPI.
 */
const wrap = (inner, bg = '#efe2cd') => `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="bg-${bg.replace('#', '')}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#c9b291"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" fill="url(#bg-${bg.replace('#', '')})"/>
  <g stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

const javier = () => wrap(`
  <path d="M22 120 Q24 86 60 84 Q96 86 98 120 Z" fill="#2f5d7c"/>
  <path d="M50 84 L60 96 L70 84" fill="#f4e6d0"/>
  <path d="M38 42 Q38 18 60 18 Q82 18 82 42 L84 66 Q84 88 60 90 Q36 88 36 66 Z" fill="#dfb896"/>
  <path d="M34 46 Q30 22 48 16 Q62 8 78 16 Q90 20 86 44 L82 40 Q78 30 66 30 Q46 28 40 44 Z" fill="#2b1d16"/>
  <path d="M34 44 Q28 34 34 28 Q40 34 40 44 Z" fill="#2b1d16"/>
  <path d="M86 44 Q92 34 86 28 Q80 34 80 44 Z" fill="#2b1d16"/>
  <ellipse cx="48" cy="58" rx="4.5" ry="5.5" fill="#fff"/>
  <ellipse cx="72" cy="58" rx="4.5" ry="5.5" fill="#fff"/>
  <circle cx="48.5" cy="58.5" r="2.6" fill="#3a2318"/>
  <circle cx="72.5" cy="58.5" r="2.6" fill="#3a2318"/>
  <path d="M43 50 Q48 47 53 50 M67 50 Q72 47 77 50" stroke="#3a2318" stroke-width="2" fill="none"/>
  <path d="M53 73 Q60 78 67 73" stroke="#8a4b37" stroke-width="2" fill="none"/>
  <path d="M26 118 Q34 96 48 92" stroke="#e0a83c" stroke-width="5" fill="none"/>
  <rect x="44" y="96" width="14" height="10" rx="2" fill="#1b1b1b"/>
  <circle cx="51" cy="101" r="3" fill="#5bb6d6"/>
`, '#f0d9ad');

const mariana = () => wrap(`
  <path d="M28 46 Q26 14 60 12 Q94 14 92 46 L94 92 Q88 100 80 96 L76 70 L44 70 L40 96 Q32 100 26 92 Z" fill="#7a3b32"/>
  <path d="M20 120 Q22 88 60 84 Q98 88 100 120 Z" fill="#1f6f76"/>
  <path d="M50 84 L60 94 L70 84" fill="#f6e4cb"/>
  <path d="M38 42 Q38 20 60 20 Q82 20 82 42 L82 66 Q82 88 60 90 Q38 88 38 66 Z" fill="#e8bd98"/>
  <path d="M34 44 Q30 18 50 16 Q60 10 72 16 Q90 20 86 46 L82 38 Q76 28 60 28 Q44 28 38 40 Z" fill="#7a3b32"/>
  <ellipse cx="48" cy="58" rx="4.5" ry="5" fill="#fff"/>
  <ellipse cx="72" cy="58" rx="4.5" ry="5" fill="#fff"/>
  <circle cx="48.5" cy="58" r="2.5" fill="#3b5a3a"/>
  <circle cx="72.5" cy="58" r="2.5" fill="#3b5a3a"/>
  <path d="M43 50 Q48 48 53 50 M67 50 Q72 48 77 50" stroke="#5c3226" stroke-width="2" fill="none"/>
  <path d="M53 73 Q60 79 67 73" stroke="#b25b52" stroke-width="2.2" fill="none"/>
  <circle cx="36" cy="66" r="3" fill="#e8c14a"/>
  <circle cx="84" cy="66" r="3" fill="#e8c14a"/>
`, '#f3d8c2');

const profesor = () => wrap(`
  <path d="M20 120 Q24 88 60 84 Q96 88 100 120 Z" fill="#6b5842"/>
  <path d="M52 84 L60 96 L68 84" fill="#e9dec9"/>
  <path d="M38 42 Q38 20 60 20 Q82 20 82 42 L82 66 Q82 88 60 90 Q38 88 38 66 Z" fill="#d8ad86"/>
  <path d="M34 40 Q32 16 60 16 Q88 16 86 40 L82 34 Q74 26 60 26 Q44 26 38 34 Z" fill="#c9c4bb"/>
  <path d="M40 52 h18 v12 h-18 z M62 52 h18 v12 h-18 z" fill="none" stroke="#3a3a38" stroke-width="2.5" rx="3"/>
  <path d="M58 57 h4" stroke="#3a3a38" stroke-width="2.5"/>
  <circle cx="49" cy="58" r="2.3" fill="#2c2c2a"/>
  <circle cx="71" cy="58" r="2.3" fill="#2c2c2a"/>
  <path d="M52 74 Q60 76 68 74" stroke="#8a6247" stroke-width="2" fill="none"/>
  <path d="M44 68 Q60 82 76 68" stroke="#b7b1a7" stroke-width="3" fill="none"/>
`, '#dfe3dc');

const narrador = () => wrap(`
  <rect x="18" y="10" width="84" height="100" rx="2" fill="#fbf5e6" stroke="#b7a486" stroke-width="1.6"/>
  <path d="M30 12 v96" stroke="#c9b79a" stroke-width="1" opacity=".8"/>
  <path d="M36 30 h50 M36 40 h50 M36 50 h44 M36 60 h50 M36 70 h36" stroke="#cbb99b" stroke-width="1.6" opacity=".75"/>
  <path d="M38 34 q6 -5 10 0 t10 0 t10 0 t10 0" stroke="#3b4a5a" stroke-width="2" fill="none" opacity=".85"/>
  <path d="M38 46 q8 -4 12 1 t12 -1 t12 2" stroke="#3b4a5a" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M38 58 q10 -4 14 1 t10 0" stroke="#3b4a5a" stroke-width="2" fill="none" opacity=".55"/>
  <circle cx="76" cy="80" r="9" fill="none" stroke="#8c2f2b" stroke-width="1.6" opacity=".55"/>
  <path d="M70 80 q6 6 12 -6" stroke="#8c2f2b" stroke-width="1.6" fill="none" opacity=".55"/>
  <path d="M44 22 h26" stroke="#8c2f2b" stroke-width="2.4" opacity=".8"/>
`, '#ece0c8');

const ledger = () => wrap(`
  <rect x="16" y="16" width="88" height="88" rx="4" fill="#f7f0df" stroke="#8a7f6b" stroke-width="1.8"/>
  <path d="M16 34 h88" stroke="#8a7f6b" stroke-width="1.4"/>
  <text x="26" y="29" fill="#8c2f2b" font-family="monospace" font-size="9" font-weight="bold" letter-spacing="1">SHA-256</text>
  <path d="M28 48 h64 M28 60 h64 M28 72 h42" stroke="#46525f" stroke-width="2" opacity=".45"/>
  <circle cx="76" cy="84" r="10" fill="none" stroke="#8c2f2b" stroke-width="1.8"/>
  <path d="M71 84 l4 4 l7 -8" stroke="#8c2f2b" stroke-width="1.8" fill="none"/>
`, '#e3d8c0');

const mariposa = () => wrap(`
  <path d="M60 60 C36 24 8 30 14 52 C18 70 42 70 60 60 Z" fill="#5b8fb9" opacity=".92"/>
  <path d="M60 60 C84 24 112 30 106 52 C102 70 78 70 60 60 Z" fill="#6f9fc4" opacity=".92"/>
  <path d="M60 60 C36 96 8 90 14 68 C18 50 42 50 60 60 Z" fill="#33506e" opacity=".8"/>
  <path d="M60 60 C84 96 112 90 106 68 C102 50 78 50 60 60 Z" fill="#3f6285" opacity=".8"/>
  <path d="M60 44 L60 78" stroke="#26313c" stroke-width="5"/>
  <path d="M58 44 Q48 28 42 28 M62 44 Q72 28 78 28" stroke="#26313c" stroke-width="2" fill="none"/>
  <circle cx="42" cy="28" r="2.5" fill="#26313c"/><circle cx="78" cy="28" r="2.5" fill="#26313c"/>
  <circle cx="32" cy="46" r="6" fill="#c9dced" opacity=".7"/>
  <circle cx="88" cy="46" r="6" fill="#c9dced" opacity=".7"/>
`, '#dfe6ea');

export const PORTRAITS = {
  javier,
  mariana,
  profesor,
  narrador,
  mariposa,
  ledger,
};

export function portraitSVG(who) {
  const draw = PORTRAITS[who] || PORTRAITS.narrador;
  return draw();
}
