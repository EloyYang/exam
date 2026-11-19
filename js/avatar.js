/*
 * 내 캐릭터 (SVG로 그리는 수험생 캐릭터)
 *   설정: UserStore 'study.avatar' = { s, h, hc, f, t, hat, g, i, bg }  (로그인하면 계정에 동기화)
 *   공개: profiles/{uid}.av = 'h.hc.f.t.hat.g.i.bg.s' 처럼 점으로 이은 짧은 문자열 (스터디 라운지에서 보임)
 *   아이템마다 lv 가 있고, 내 레벨(js/xp.js)이 그보다 낮으면 잠겨 있다.
 */
(function () {
  const KEY = 'study.avatar';
  const SKIN = { s1: '#fbe0c4', s2: '#f3c79f', s3: '#e2a97c', s4: '#c48659', s5: '#8f5b3a' };
  const HAIRC = { k: '#2e2420', b: '#6b4226', y: '#d9a441', r: '#b5432f', p: '#e08bb8', u: '#4f7fd6', g: '#5aa36b', w: '#ebe7df' };
  const BG = { cream: ['#f6eedf', '#efe2c8'], mint: ['#d8f0e3', '#bfe3cf'], sky: ['#d9e9fb', '#bcd6f4'], peach: ['#fde0d2', '#f8c6ad'], lilac: ['#e7defa', '#d2c3f2'], night: ['#24305e', '#151c3d'], rainbow: ['#ffd6d6', '#d6e8ff'], gold: ['#ffe9a8', '#f2c24f'] };

  const CATS = [
    { key: 'h', name: '헤어', items: [['short', '짧은 머리', 1], ['bob', '단발', 1], ['long', '긴 머리', 2], ['spiky', '삐죽 머리', 5], ['pony', '포니테일', 8], ['bun', '똥머리', 12], ['curly', '곱슬머리', 16]] },
    { key: 'hc', name: '머리색', items: [['k', '흑갈색', 1], ['b', '갈색', 1], ['y', '금발', 4], ['r', '빨강', 9], ['g', '초록', 13], ['p', '분홍', 17], ['u', '파랑', 22], ['w', '은발', 33]] },
    { key: 'f', name: '표정', items: [['smile', '미소', 1], ['happy', '활짝', 1], ['wink', '윙크', 3], ['cool', '여유', 7], ['fire', '불타는 의지', 11], ['star', '반짝 눈', 17]] },
    { key: 't', name: '옷', items: [['tee', '티셔츠', 1], ['stripe', '줄무늬 티', 2], ['hoodie', '후드티', 6], ['gym', '체육복', 10], ['fire', '소방 활동복', 13], ['school', '교복', 19], ['suit', '정장', 25], ['hanbok', '한복', 30], ['gown', '학위복', 45]] },
    { key: 'hat', name: '모자', items: [['none', '없음', 1], ['band', '머리띠', 3], ['beanie', '비니', 7], ['phones', '헤드폰', 10], ['cap', '야구모자', 15], ['grad', '학사모', 20], ['helmet', '소방 헬멧', 28], ['crown', '왕관', 50]] },
    { key: 'g', name: '안경', items: [['none', '없음', 1], ['round', '동그란 안경', 5], ['half', '반테 안경', 11], ['sun', '선글라스', 18], ['goggle', '고글', 26]] },
    { key: 'i', name: '손 아이템', items: [['none', '없음', 1], ['pencil', '연필', 2], ['book', '단어장', 4], ['marker', '형광펜', 7], ['watch', '스톱워치', 12], ['flag', '합격 깃발', 24], ['trophy', '트로피', 40]] },
    { key: 'bg', name: '배경', items: [['cream', '크림', 1], ['mint', '민트', 1], ['sky', '하늘', 1], ['peach', '복숭아', 2], ['lilac', '라일락', 5], ['night', '별밤', 18], ['rainbow', '무지개', 35], ['gold', '금빛', 48]] },
    { key: 's', name: '피부', items: [['s1', '피부 1', 1], ['s2', '피부 2', 1], ['s3', '피부 3', 1], ['s4', '피부 4', 1], ['s5', '피부 5', 1]] },
  ].map((c) => ({ ...c, items: c.items.map(([id, name, lv]) => ({ id, name, lv })) }));
  const ORDER = ['h', 'hc', 'f', 't', 'hat', 'g', 'i', 'bg', 's'];
  const DEF = { h: 'short', hc: 'k', f: 'smile', t: 'tee', hat: 'none', g: 'none', i: 'none', bg: 'cream', s: 's2' };
  const item = (key, id) => { const c = CATS.find((x) => x.key === key); return c && c.items.find((x) => x.id === id); };

  function norm(c) {
    const o = Object.assign({}, DEF);
    if (c && typeof c === 'object') ORDER.forEach((k) => { if (c[k] && item(k, c[k])) o[k] = c[k]; });
    return o;
  }
  const encode = (c) => ORDER.map((k) => norm(c)[k]).join('.');
  function decode(s) { if (typeof s !== 'string') return null; const p = s.split('.'); const o = {}; ORDER.forEach((k, i) => { o[k] = p[i]; }); return norm(o); }
  const load = () => norm(window.UserStore ? window.UserStore.get(KEY, null) : null);
  function save(c) { if (window.UserStore) window.UserStore.set(KEY, norm(c)); window.dispatchEvent(new Event('xp-profile')); }
  const locked = (key, id, lv) => { const it = item(key, id); return !!it && it.lv > (lv || 1); };
  // 레벨이 a 초과 b 이하에서 새로 열리는 아이템
  const unlockedBetween = (a, b) => CATS.flatMap((c) => c.items.filter((x) => x.lv > a && x.lv <= b).map((x) => ({ ...x, cat: c.name })));

  /* ── 그리기 (viewBox 0 0 100 100) ── */
  let seq = 0;
  function shade(hex, f) { // 색을 f 만큼 어둡게(-)·밝게(+)
    const n = parseInt(hex.slice(1), 16); const ch = (v) => Math.max(0, Math.min(255, Math.round(v + (f < 0 ? v * f : (255 - v) * f))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(ch).map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function bgSvg(id, u) {
    const [a, b] = BG[id] || BG.cream;
    let s = `<defs><linearGradient id="bg${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#bg${u})"/>`;
    if (id === 'night') s += [[14, 16], [84, 12], [76, 30], [20, 36], [90, 52], [8, 60]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1.2 : 1.8}" fill="#fff7c2"/>`).join('') + '<path d="M80 18a7 7 0 1 1-6-9 5.5 5.5 0 0 0 6 9z" fill="#ffe58a"/>';
    if (id === 'rainbow') s += ['#ff8a8a', '#ffc46b', '#fff07a', '#8de08d', '#7fb8ff', '#b892ff'].map((c, i) => `<path d="M${-6 + i * 4} 100 A${56 - i * 4} ${56 - i * 4} 0 0 1 ${106 - i * 4} 100" fill="none" stroke="${c}" stroke-width="4" opacity=".55"/>`).join('');
    if (id === 'gold') s += [[16, 20], [84, 24], [12, 70], [88, 66]].map(([x, y]) => `<path d="M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff" opacity=".8"/>`).join('');
    return s;
  }
  const BODY = 'M16 100 C16 82 30 73 50 73 C70 73 84 82 84 100 Z';
  function topSvg(id, u, skin) {
    const clip = `<clipPath id="tc${u}"><path d="${BODY}"/></clipPath>`;
    const neck = `<path d="M43 64 h14 v11 q-7 5 -14 0z" fill="${shade(skin, -0.12)}"/>`;
    const base = (c) => `<path d="${BODY}" fill="${c}"/>`;
    const vneck = (shirt, coat) => `${base(coat)}<path d="M41 74 L50 92 L59 74 Z" fill="${shirt}"/>`;
    switch (id) {
      case 'stripe': return `${neck}<defs>${clip}</defs>${base('#fbfbf7')}<g clip-path="url(#tc${u})">${[80, 87, 94].map((y) => `<rect x="0" y="${y}" width="100" height="3.5" fill="#2f4f8a"/>`).join('')}</g><path d="M42 74 q8 6 16 0" fill="none" stroke="#2f4f8a" stroke-width="2"/>`;
      case 'hoodie': return `<path d="M30 78 q20 -16 40 0 l-4 8 q-16 -10 -32 0z" fill="#6f58b8"/>${neck}${base('#8a6fd1')}<path d="M46 76 v10 M54 76 v10" stroke="#f1ecff" stroke-width="1.6" stroke-linecap="round"/><path d="M38 92 h24 v8 h-24z" fill="#7b62c4"/>`;
      case 'gym': return `${neck}${base('#2f8f5b')}<path d="M24 86 L30 77 M76 86 L70 77" stroke="#fff" stroke-width="3"/><path d="M43 74 L50 82 L57 74" fill="none" stroke="#fff" stroke-width="2"/><path d="M50 82 v18" stroke="#1f6b42" stroke-width="1.5"/>`;
      case 'fire': return `${neck}<defs>${clip}</defs>${base('#2c3a5c')}<g clip-path="url(#tc${u})"><rect x="0" y="88" width="100" height="4" fill="#f2d33b"/><rect x="0" y="92" width="100" height="1.5" fill="#cfd6e0"/></g><path d="M43 74 L50 80 L57 74" fill="none" stroke="#f2d33b" stroke-width="2"/><rect x="58" y="80" width="10" height="6" rx="1" fill="#c0392b"/>`;
      case 'school': return `${neck}${vneck('#ffffff', '#24345e')}<path d="M48 76 h4 l1.5 4 -3.5 12 -3.5 -12z" fill="#b8323a"/><path d="M41 74 L46 84 M59 74 L54 84" stroke="#1a2647" stroke-width="1.5"/>`;
      case 'suit': return `${neck}${vneck('#ffffff', '#3a3d45')}<path d="M48.5 76 h3 l1.2 3 -2.7 13 -2.7 -13z" fill="#2c5aa0"/><path d="M41 74 L47 88 M59 74 L53 88" stroke="#26282e" stroke-width="1.6"/>`;
      case 'hanbok': return `${neck}${base('#f6a5b8')}<path d="M40 74 L58 90 M60 74 L46 86" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M53 88 q4 2 3 10 M53 88 q-2 4 -6 9" fill="none" stroke="#c4314b" stroke-width="2.4" stroke-linecap="round"/><path d="M16 100 C16 90 20 84 26 80 L28 100Z M84 100 C84 90 80 84 74 80 L72 100Z" fill="#8fc7e8"/>`;
      case 'gown': return `${neck}${base('#24262d')}<path d="M36 76 q14 14 28 0 l-3 -3 q-11 9 -22 0z" fill="#d4a63a"/><path d="M46 80 v20 M54 80 v20" stroke="#3a3d47" stroke-width="1.2"/>`;
      default: return `${neck}${base('#5b8def')}<path d="M42 74 q8 6 16 0" fill="none" stroke="#3f6fcf" stroke-width="2"/>`;
    }
  }
  function hairBack(id, c) {
    switch (id) {
      case 'long': return `<path d="M26 44 C24 22 38 16 50 16 C62 16 76 22 74 44 L77 80 C71 83 65 79 64 71 L36 71 C35 79 29 83 23 80 Z" fill="${c}"/>`;
      case 'bob': return `<path d="M26 46 C24 22 38 17 50 17 C62 17 76 22 74 46 L75 62 C70 64 66 60 66 56 L34 56 C34 60 30 64 25 62 Z" fill="${c}"/>`;
      case 'pony': return `<path d="M68 30 C88 30 90 56 80 68 C79 56 75 46 66 40Z" fill="${c}"/><circle cx="70" cy="31" r="3" fill="#e35d6a"/>`;
      case 'bun': return `<circle cx="50" cy="17" r="9.5" fill="${c}"/><circle cx="50" cy="17" r="9.5" fill="none" stroke="${shade(c, -0.25)}" stroke-width="1"/>`;
      case 'curly': return [[29, 46], [27, 56], [73, 46], [74, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`).join('');
      default: return '';
    }
  }
  function hairFront(id, c) {
    const d = shade(c, -0.2);
    switch (id) {
      case 'spiky': return `<path d="M27 44 L25 28 L34 31 L35 16 L44 26 L50 12 L56 26 L65 16 L66 31 L75 28 L73 44 C66 34 58 31 50 31 C42 31 34 34 27 44Z" fill="${c}"/>`;
      case 'curly': return `<g fill="${c}">${[[30, 38], [33, 28], [41, 21], [50, 19], [59, 21], [67, 28], [70, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join('')}<circle cx="44" cy="31" r="6"/><circle cx="56" cy="31" r="6"/></g>`;
      case 'long': case 'bob': return `<path d="M27 46 C25 24 38 18 50 18 C62 18 75 24 73 46 C70 38 64 33 56 32 C52 37 44 38 38 36 C33 38 29 42 27 46Z" fill="${c}"/><path d="M50 19 q-2 8 -10 15" stroke="${d}" stroke-width="1.2" fill="none"/>`;
      default: return `<path d="M27 45 C26 25 38 19 50 19 C63 19 74 26 73 45 C69 36 61 31 50 32 C42 31 33 35 27 45Z" fill="${c}"/><path d="M47 21 q-3 7 -12 11" stroke="${d}" stroke-width="1.2" fill="none"/>`;
    }
  }
  function faceSvg(id) {
    const ink = '#3b2a22';
    const eyes = `<ellipse cx="42" cy="47" rx="2.4" ry="3" fill="${ink}"/><ellipse cx="58" cy="47" rx="2.4" ry="3" fill="${ink}"/><circle cx="42.8" cy="46" r=".8" fill="#fff"/><circle cx="58.8" cy="46" r=".8" fill="#fff"/>`;
    const blush = '<circle cx="36" cy="53" r="3.2" fill="#f28b8b" opacity=".35"/><circle cx="64" cy="53" r="3.2" fill="#f28b8b" opacity=".35"/>';
    const arc = (x) => `<path d="M${x - 3} 48 Q${x} 44 ${x + 3} 48" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
    switch (id) {
      case 'happy': return `${arc(42)}${arc(58)}<path d="M44 54 Q50 62 56 54 Z" fill="#b8434a"/>${blush}`;
      case 'wink': return `<ellipse cx="42" cy="47" rx="2.4" ry="3" fill="${ink}"/><circle cx="42.8" cy="46" r=".8" fill="#fff"/>${arc(58)}<path d="M45 55 Q50 59 55 55" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>${blush}`;
      case 'cool': return `<path d="M39 47 h6 M55 47 h6" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M38 43 l7 1 M62 43 l-7 1" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/><path d="M45 56 Q51 58 56 54" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'fire': return `${eyes}<path d="M38 42 l7 2 M62 42 l-7 2" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M45 56 h10" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M66 36 q3 -4 1 -8 q4 3 3 8 q-2 2 -4 0z" fill="#ff7a3d"/>`;
      case 'star': { const st = (x) => `<path d="M${x} 43.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#f5b400" stroke="${ink}" stroke-width=".6"/>`; return `${st(42)}${st(58)}<path d="M44 54 Q50 62 56 54 Z" fill="#b8434a"/>${blush}`; }
      default: return `${eyes}<path d="M45 55 Q50 59 55 55" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>${blush}`;
    }
  }
  function glassesSvg(id) {
    switch (id) {
      case 'round': return '<g fill="none" stroke="#3a3a3a" stroke-width="1.4"><circle cx="42" cy="47" r="6"/><circle cx="58" cy="47" r="6"/><path d="M48 47 h4 M36 46 l-7 -2 M64 46 l7 -2"/></g>';
      case 'half': return '<g fill="none" stroke="#7a4a2a" stroke-width="1.8"><path d="M35.5 46 h13 q0 7 -6.5 7 q-6.5 0 -6.5 -7z M51.5 46 h13 q0 7 -6.5 7 q-6.5 0 -6.5 -7z"/><path d="M48.5 46 h3"/></g>';
      case 'sun': return '<g><rect x="34.5" y="42" width="14" height="10" rx="4" fill="#1f1f24"/><rect x="51.5" y="42" width="14" height="10" rx="4" fill="#1f1f24"/><path d="M48.5 45 h3" stroke="#1f1f24" stroke-width="1.6"/><path d="M37 44.5 l4 0" stroke="#fff" stroke-width="1" opacity=".6"/></g>';
      case 'goggle': return '<g><path d="M26 45 h48" stroke="#3a6ea5" stroke-width="3.5"/><circle cx="42" cy="46" r="7.5" fill="#bfe3ff" stroke="#3a6ea5" stroke-width="2"/><circle cx="58" cy="46" r="7.5" fill="#bfe3ff" stroke="#3a6ea5" stroke-width="2"/><path d="M38 43 q2 -2 4 -2" stroke="#fff" stroke-width="1.2" fill="none"/></g>';
      default: return '';
    }
  }
  function hatSvg(id) {
    switch (id) {
      case 'band': return '<path d="M28 36 C34 24 66 24 72 36" fill="none" stroke="#e35d6a" stroke-width="4" stroke-linecap="round"/><path d="M64 26 l7 -4 -1 8z M64 26 l8 4 -6 3z" fill="#e35d6a"/><circle cx="65" cy="27" r="2" fill="#c43e4c"/>';
      case 'beanie': return '<path d="M26 40 C26 16 74 16 74 40 Z" fill="#d9534f"/><rect x="24" y="36" width="52" height="8" rx="4" fill="#b8403c"/><circle cx="50" cy="15" r="5" fill="#f7f1e8"/>';
      case 'phones': return '<path d="M25 46 C25 14 75 14 75 46" fill="none" stroke="#33363d" stroke-width="4"/><rect x="20" y="40" width="9" height="15" rx="4" fill="#4f7fd6"/><rect x="71" y="40" width="9" height="15" rx="4" fill="#4f7fd6"/>';
      case 'cap': return '<path d="M27 38 C27 18 73 18 73 38 Z" fill="#2c6fbb"/><path d="M27 38 h50 q8 0 10 4 h-60z" fill="#245c9c"/><circle cx="50" cy="21" r="2" fill="#245c9c"/><path d="M44 30 h12" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
      case 'grad': return '<path d="M33 30 h34 v8 q-17 6 -34 0z" fill="#22252c"/><path d="M50 16 L80 26 L50 36 L20 26 Z" fill="#2c3038"/><path d="M50 26 L72 30 v12" fill="none" stroke="#f2c24f" stroke-width="1.5"/><circle cx="72" cy="43" r="2.4" fill="#f2c24f"/>';
      case 'helmet': return '<path d="M25 40 C25 13 75 13 75 40 Z" fill="#f2c62f"/><path d="M20 40 h60 q2 4 -2 5 h-56 q-4 -1 -2 -5z" fill="#d9ab1a"/><path d="M50 16 v24" stroke="#d9ab1a" stroke-width="3"/><path d="M46 26 h8 v7 l-4 3 -4 -3z" fill="#c0392b"/>';
      case 'crown': return '<path d="M30 33 L32 15 L41 25 L50 11 L59 25 L68 15 L70 33 Z" fill="#f5c542" stroke="#d49a1c" stroke-width="1.2"/><circle cx="50" cy="26" r="2.6" fill="#e0475a"/><circle cx="38" cy="28" r="1.8" fill="#3c8de0"/><circle cx="62" cy="28" r="1.8" fill="#3c8de0"/>';
      default: return '';
    }
  }
  function handSvg(id, skin) {
    const hand = `<circle cx="78" cy="88" r="5" fill="${skin}" stroke="${shade(skin, -0.2)}" stroke-width=".8"/>`;
    switch (id) {
      case 'pencil': return `<g transform="rotate(-35 80 80)"><rect x="77" y="62" width="6" height="26" fill="#f5c542"/><rect x="77" y="62" width="6" height="4" fill="#e88"/><path d="M77 88 h6 l-3 6z" fill="#f2d6a8"/><path d="M79.3 92.5 l.7 1.5 .7 -1.5z" fill="#333"/></g>${hand}`;
      case 'book': return `<rect x="68" y="72" width="20" height="16" rx="2" fill="#3c8de0"/><rect x="70" y="74" width="16" height="12" fill="#fff" opacity=".9"/><path d="M73 77 h10 M73 80 h8 M73 83 h9" stroke="#3c8de0" stroke-width="1"/><text x="78" y="72" font-size="6" font-weight="700" text-anchor="middle" fill="#3c8de0">ABC</text>${hand}`;
      case 'marker': return `<g transform="rotate(-30 80 80)"><rect x="76" y="64" width="8" height="22" rx="2" fill="#7ee08a"/><rect x="76" y="64" width="8" height="7" rx="2" fill="#3fae54"/><path d="M77 86 h6 l-1 4 h-4z" fill="#3fae54"/></g>${hand}`;
      case 'watch': return `<circle cx="80" cy="78" r="9" fill="#fff" stroke="#555" stroke-width="2"/><rect x="78" y="66" width="4" height="3" fill="#555"/><path d="M80 78 v-6 M80 78 l4 2" stroke="#e35d6a" stroke-width="1.5" stroke-linecap="round"/>${hand}`;
      case 'flag': return `<path d="M76 92 V58" stroke="#7a5a3a" stroke-width="2"/><path d="M77 58 h18 l-4 6 4 6 h-18z" fill="#e35d6a"/><text x="85" y="67.5" font-size="7" font-weight="900" text-anchor="middle" fill="#fff">합격</text>${hand}`;
      case 'trophy': return `<path d="M72 66 h16 v6 q0 8 -8 8 q-8 0 -8 -8z" fill="#f5c542" stroke="#d49a1c" stroke-width="1"/><path d="M72 68 q-5 0 -4 4 q1 3 5 3 M88 68 q5 0 4 4 q-1 3 -5 3" fill="none" stroke="#d49a1c" stroke-width="1.4"/><rect x="78" y="80" width="4" height="5" fill="#d49a1c"/><rect x="74" y="85" width="12" height="3" rx="1" fill="#8a6a3a"/>${hand}`;
      default: return '';
    }
  }
  function svg(cfg, size, extra) {
    const c = typeof cfg === 'string' ? decode(cfg) : norm(cfg);
    const u = 'av' + (++seq), skin = SKIN[c.s], hc = HAIRC[c.hc];
    return `<svg class="avatar-svg${extra ? ' ' + extra : ''}" viewBox="0 0 100 100" width="${size || 100}" height="${size || 100}" role="img" aria-label="캐릭터" xmlns="http://www.w3.org/2000/svg">
      ${bgSvg(c.bg, u)}${hairBack(c.h, hc)}${topSvg(c.t, u, skin)}
      <circle cx="28" cy="48" r="4" fill="${skin}"/><circle cx="72" cy="48" r="4" fill="${skin}"/>
      <circle cx="50" cy="45" r="22" fill="${skin}"/>
      ${faceSvg(c.f)}${hairFront(c.h, hc)}${glassesSvg(c.g)}${hatSvg(c.hat)}${handSvg(c.i, skin)}</svg>`;
  }

  window.AVATAR = { CATS, ORDER, DEF, KEY, load, save, norm, encode, decode, svg, item, locked, unlockedBetween };
})();
