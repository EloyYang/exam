/*
 * 내 캐릭터 — 수험 RPG 용사 (SVG)
 *   설정(착용): UserStore 'study.avatar' = { h, hc, f, s, w, hd, ar, cp, pt, sc }
 *     꾸미기: h 헤어 · hc 머리색 · f 표정 · s 피부          → 레벨이 되면 자동으로 열린다
 *     장비:   w 무기 · hd 머리 · ar 갑옷 · cp 망토 · pt 펫 · sc 배경 → 가지고 있어야(js/game.js 인벤토리) 하고, 레벨이 돼야 낀다
 *   공개: profiles/{uid}.av = ORDER 순서로 점으로 이은 문자열 (스터디 라운지에서 보임)
 *   그림 크기: viewBox 0 0 120 150 (전신). mode 'face' 는 얼굴·상반신만 잘라 보여 준다(작은 아이콘용).
 */
(function () {
  const KEY = 'study.avatar';
  const RARITY = {
    c: { name: '일반', color: '#9aa0a6' }, u: { name: '고급', color: '#3fae54' }, r: { name: '희귀', color: '#3c8de0' },
    e: { name: '영웅', color: '#9b59d6' }, l: { name: '전설', color: '#f0a020' },
  };
  const SKIN = { s1: '#fde3c8', s2: '#f5c9a0', s3: '#e2a97c', s4: '#c48659', s5: '#8f5b3a' };
  const HAIRC = { k: '#2e2420', b: '#6b4226', y: '#e0b048', r: '#c2412f', g: '#4fae68', p: '#ef8fc0', u: '#4f7fe6', w: '#eeeae2' };

  // [id, 이름, 필요 레벨, 등급, 전투력]
  const CATS = [
    { key: 'w', name: '무기', gear: true, items: [['stick', '나뭇가지', 1, 'c', 5], ['pencil', '연필 검', 1, 'c', 12], ['ruler', '자 레이피어', 4, 'u', 28], ['iron', '강철 검', 8, 'u', 45], ['marker', '형광펜 대검', 12, 'r', 75], ['brush', '먹물 붓 창', 16, 'r', 95], ['axe', '소방 도끼', 22, 'e', 150], ['staff', '지혜의 지팡이', 26, 'e', 170], ['flame', '불꽃 검', 30, 'e', 200], ['pen', '전설의 만년필 검', 40, 'l', 320]] },
    { key: 'hd', name: '머리', gear: true, items: [['none', '없음', 1, 'c', 0], ['band', '집중 머리띠', 1, 'c', 6], ['horn', '뿔 투구', 6, 'u', 22], ['wizard', '마법사 모자', 10, 'r', 40], ['grad', '학사모', 15, 'r', 55], ['fire', '소방 헬멧', 20, 'e', 85], ['knight', '기사 투구', 24, 'e', 100], ['crown', '왕관', 35, 'l', 160], ['halo', '천사의 고리', 45, 'l', 200]] },
    { key: 'ar', name: '갑옷', gear: true, items: [['tunic', '수련생 튜닉', 1, 'c', 8], ['gym', '체육복', 1, 'c', 10], ['leather', '가죽 갑옷', 5, 'u', 30], ['iron', '강철 갑옷', 10, 'r', 60], ['robe', '현자의 로브', 14, 'r', 70], ['firesuit', '방화복', 18, 'e', 110], ['knight', '기사단 갑옷', 25, 'e', 140], ['dragon', '용비늘 갑옷', 38, 'l', 240], ['gold', '황금 갑옷', 48, 'l', 280]] },
    { key: 'cp', name: '망토', gear: true, items: [['none', '없음', 1, 'c', 0], ['red', '모험가 망토', 3, 'u', 15], ['blue', '푸른 망토', 7, 'u', 18], ['purple', '마법 망토', 13, 'r', 40], ['star', '별빛 망토', 23, 'e', 90], ['phoenix', '불사조 망토', 42, 'l', 180]] },
    { key: 'pt', name: '펫', gear: true, items: [['none', '없음', 1, 'c', 0], ['chick', '병아리', 2, 'c', 8], ['slime', '말랑 슬라임', 5, 'u', 20], ['cat', '고양이', 9, 'u', 25], ['owl', '지혜 부엉이', 15, 'r', 50], ['dragon', '아기 용', 27, 'e', 110], ['fox', '구미호', 44, 'l', 190]] },
    { key: 'sc', name: '배경', gear: true, items: [['field', '초원', 1, 'c', 0], ['library', '도서관', 1, 'c', 0], ['class', '교실', 4, 'u', 5], ['night', '별밤', 11, 'r', 15], ['volcano', '화산', 21, 'e', 30], ['castle', '천공의 성', 29, 'e', 35], ['galaxy', '은하', 46, 'l', 60]] },
    { key: 'h', name: '헤어', items: [['short', '짧은 머리', 1], ['bob', '단발', 1], ['long', '긴 머리', 2], ['spiky', '삐죽 머리', 5], ['pony', '포니테일', 8], ['bun', '똥머리', 12], ['curly', '곱슬머리', 16]] },
    { key: 'hc', name: '머리색', items: [['k', '흑갈색', 1], ['b', '갈색', 1], ['y', '금발', 4], ['r', '빨강', 9], ['g', '초록', 13], ['p', '분홍', 17], ['u', '파랑', 22], ['w', '은발', 33]] },
    { key: 'f', name: '표정', items: [['smile', '미소', 1], ['happy', '활짝', 1], ['wink', '윙크', 3], ['cool', '여유', 7], ['fire', '불타는 의지', 11], ['star', '반짝 눈', 17]] },
    { key: 's', name: '피부', items: [['s1', '피부 1', 1], ['s2', '피부 2', 1], ['s3', '피부 3', 1], ['s4', '피부 4', 1], ['s5', '피부 5', 1]] },
  ].map((c) => ({ ...c, items: c.items.map(([id, name, lv, rar, pow]) => ({ id, name, lv, rar: rar || 'c', pow: pow || 0, key: c.key, gear: !!c.gear })) }));
  const ORDER = ['h', 'hc', 'f', 's', 'w', 'hd', 'ar', 'cp', 'pt', 'sc'];
  const DEF = { h: 'short', hc: 'k', f: 'smile', s: 's2', w: 'pencil', hd: 'none', ar: 'tunic', cp: 'none', pt: 'none', sc: 'field' };
  const ALL = CATS.flatMap((c) => c.items);
  const item = (key, id) => ALL.find((x) => x.key === key && x.id === id);
  // 처음부터 가지고 있는 장비: 일반 등급 + '없음'
  const STARTER = ALL.filter((x) => x.gear && (x.rar === 'c' || x.id === 'none')).map((x) => `${x.key}:${x.id}`);

  function norm(c) {
    const o = Object.assign({}, DEF);
    if (c && typeof c === 'object') {
      ORDER.forEach((k) => { if (c[k] && item(k, c[k])) o[k] = c[k]; });
      if (c.hat && !c.hd && item('hd', c.hat === 'helmet' ? 'fire' : c.hat)) o.hd = c.hat === 'helmet' ? 'fire' : c.hat; // 예전 설정 옮기기
    }
    return o;
  }
  const encode = (c) => ORDER.map((k) => norm(c)[k]).join('.');
  function decode(s) { if (typeof s !== 'string') return null; const p = s.split('.'); const o = {}; ORDER.forEach((k, i) => { o[k] = p[i]; }); return norm(o); }
  const load = () => norm(window.UserStore ? window.UserStore.get(KEY, null) : null);
  function save(c) { if (window.UserStore) window.UserStore.set(KEY, norm(c)); window.dispatchEvent(new Event('xp-profile')); }
  const power = (c, lv) => (lv || 1) * 12 + ORDER.reduce((s, k) => s + ((item(k, norm(c)[k]) || {}).pow || 0), 0);
  const unlockedBetween = (a, b) => ALL.filter((x) => !x.gear && x.lv > a && x.lv <= b);

  /* ── 그리기 ── */
  let seq = 0;
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); const ch = (v) => Math.max(0, Math.min(255, Math.round(v + (f < 0 ? v * f : (255 - v) * f))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(ch).map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function scene(id, u) {
    const g = (a, b) => `<defs><linearGradient id="sc${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="150" fill="url(#sc${u})"/>`;
    switch (id) {
      case 'library': return g('#f3e6cf', '#e3cfa9') + [10, 34, 86, 108].map((x, i) => `<rect x="${x - 8}" y="18" width="18" height="86" fill="#8a5a36"/>${[0, 1, 2, 3].map((r) => [0, 1, 2].map((b) => `<rect x="${x - 6 + b * 5}" y="${24 + r * 20}" width="4" height="15" fill="${['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad'][(i + r + b) % 5]}"/>`).join('')).join('')}`).join('') + '<rect y="104" width="120" height="46" fill="#b88a5c"/>';
      case 'class': return g('#e8f1e4', '#d5e5cf') + '<rect x="14" y="16" width="92" height="44" rx="3" fill="#2f5d46" stroke="#8a5a36" stroke-width="3"/><text x="60" y="36" font-size="9" fill="#fff" text-anchor="middle" font-weight="700">합격까지 D-30</text><path d="M24 46 h20 M52 46 h30" stroke="#e8f1e4" stroke-width="1.5" opacity=".7"/><rect y="108" width="120" height="42" fill="#c9a77c"/>';
      case 'night': return g('#1d2552', '#3b3f7a') + [[12, 14], [30, 30], [98, 18], [80, 40], [16, 60], [104, 70], [58, 12]].map(([x, y], i) => `<circle class="tw" style="animation-delay:${i * 0.4}s" cx="${x}" cy="${y}" r="${i % 2 ? 1 : 1.6}" fill="#fff7c2"/>`).join('') + '<path d="M100 26a9 9 0 1 1-8-12 7 7 0 0 0 8 12z" fill="#ffe58a"/><path d="M0 118 Q30 104 60 114 T120 110 V150 H0Z" fill="#232a55"/>';
      case 'volcano': return g('#3a1414', '#7a2a12') + '<path d="M10 120 L46 52 L58 60 L74 50 L110 120Z" fill="#2a1a14"/><path d="M50 56 Q60 40 70 54 L64 70 L58 62 L54 72Z" fill="#ff6a1f"/><circle class="tw" cx="60" cy="40" r="3" fill="#ffb347"/><circle class="tw" style="animation-delay:.6s" cx="54" cy="30" r="2" fill="#ff8c3a"/><rect y="118" width="120" height="32" fill="#4a1f12"/><path d="M0 128 Q20 124 40 130 T80 128 T120 130" stroke="#ff6a1f" stroke-width="2" fill="none" opacity=".7"/>';
      case 'castle': return g('#bfe3ff', '#eaf6ff') + '<ellipse cx="60" cy="102" rx="46" ry="10" fill="#fff" opacity=".9"/><path d="M34 98 V60 h8 v-6 h4 v6 h6 V44 l8 -10 8 10 v16 h6 v-6 h4 v6 h8 V98Z" fill="#dfe6f2" stroke="#9fb0cc" stroke-width="1"/><path d="M58 98 v-12 a4 4 0 0 1 8 0 v12" fill="#9fb0cc"/><path d="M60 34 v-8 l8 3 -8 3" fill="#e35d6a"/><ellipse cx="20" cy="30" rx="12" ry="5" fill="#fff"/><ellipse cx="98" cy="22" rx="14" ry="5" fill="#fff"/><rect y="118" width="120" height="32" fill="#cfe8ff"/>';
      case 'galaxy': return g('#0d0b2b', '#2b1857') + '<ellipse cx="60" cy="50" rx="50" ry="16" fill="#8f6bff" opacity=".25" transform="rotate(-18 60 50)"/><ellipse cx="60" cy="50" rx="30" ry="8" fill="#ff9be6" opacity=".25" transform="rotate(-18 60 50)"/>' + [[10, 20], [26, 70], [44, 14], [90, 30], [104, 84], [72, 76], [16, 104], [100, 112]].map(([x, y], i) => `<path class="tw" style="animation-delay:${i * 0.3}s" d="M${x} ${y - 3}l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff"/>`).join('') + '<circle cx="96" cy="58" r="7" fill="#ffcf6b"/><ellipse cx="96" cy="58" rx="12" ry="3" fill="none" stroke="#ffe7a8" stroke-width="1.4"/>';
      default: return g('#bfe6ff', '#e6f6ff') + '<ellipse cx="24" cy="24" rx="12" ry="5" fill="#fff"/><ellipse cx="92" cy="16" rx="14" ry="5" fill="#fff"/><path d="M0 104 Q30 92 60 100 T120 96 V150 H0Z" fill="#7ccf6a"/><path d="M0 116 Q40 108 80 118 T120 114 V150 H0Z" fill="#5fb653"/><circle cx="100" cy="120" r="2" fill="#fff"/><circle cx="18" cy="128" r="2" fill="#ffe14d"/>';
    }
  }
  function cape(id) {
    const C = { red: ['#d9433a', '#a82e27'], blue: ['#3b7dd8', '#28589c'], purple: ['#8e5bd6', '#5f3a9e'], star: ['#27306b', '#141a45'], phoenix: ['#ff8a2a', '#d6331f'] }[id];
    if (!C) return '';
    let s = `<g class="h-cape"><path d="M42 80 Q60 76 78 80 L96 134 Q88 130 82 136 Q74 130 66 137 Q60 132 54 137 Q46 130 38 136 Q32 130 24 134 Z" fill="${C[1]}"/><path d="M44 80 Q60 77 76 80 L90 128 Q60 122 30 128 Z" fill="${C[0]}"/>`;
    if (id === 'star') s += [[44, 100], [70, 108], [56, 92], [80, 120], [38, 118]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff6b0"/>`).join('');
    if (id === 'phoenix') s += '<path d="M26 132 q-6 -10 2 -16 q-2 8 6 8z M94 132 q6 -10 -2 -16 q2 8 -6 8z" fill="#ffd34a" class="flk"/>';
    return s + '</g>';
  }
  function armor(id, skin, u) {
    // 다리·신발 + 몸통 + 팔(소매 색) 을 함께 정한다
    const A = {
      tunic: { body: '#5f9b4a', trim: '#3f6e30', pants: '#6b4a32', boot: '#4a3020', sleeve: '#5f9b4a' },
      gym: { body: '#3a6fd8', trim: '#ffffff', pants: '#2b56ad', boot: '#f2f2f2', sleeve: '#3a6fd8' },
      leather: { body: '#9a6237', trim: '#6b4022', pants: '#5a3d28', boot: '#3d2817', sleeve: '#8a5530' },
      iron: { body: '#a9b3bf', trim: '#6f7b8a', pants: '#596472', boot: '#3e4651', sleeve: '#8f9aa8' },
      robe: { body: '#6a46b8', trim: '#f2c24f', pants: '#6a46b8', boot: '#3b2a63', sleeve: '#6a46b8' },
      firesuit: { body: '#2f3d5c', trim: '#f2d33b', pants: '#2f3d5c', boot: '#1d2130', sleeve: '#2f3d5c' },
      knight: { body: '#c7d0dc', trim: '#2f5fb3', pants: '#7d8896', boot: '#4a5260', sleeve: '#aab4c2' },
      dragon: { body: '#1f8a7a', trim: '#f2c24f', pants: '#16675b', boot: '#0f4a41', sleeve: '#1f8a7a' },
      gold: { body: '#f2c24f', trim: '#c9871a', pants: '#b8862a', boot: '#7a5418', sleeve: '#e8b23a' },
    }[id] || {};
    const legs = `<rect x="49" y="106" width="9" height="24" rx="4" fill="${A.pants}"/><rect x="62" y="106" width="9" height="24" rx="4" fill="${A.pants}"/><rect x="46.5" y="126" width="13" height="8" rx="3.5" fill="${A.boot}"/><rect x="60.5" y="126" width="13" height="8" rx="3.5" fill="${A.boot}"/>`;
    const torso = 'M43 80 Q60 73 77 80 L81 110 Q60 116 39 110 Z';
    let det = '';
    switch (id) {
      case 'gym': det = `<path d="M44 84 L41 108 M76 84 L79 108" stroke="#fff" stroke-width="2.4"/><path d="M53 78 L60 86 L67 78" fill="none" stroke="#fff" stroke-width="2"/>`; break;
      case 'leather': det = `<path d="M46 92 h28 M46 100 h28" stroke="${A.trim}" stroke-width="1.2" stroke-dasharray="2 2"/><ellipse cx="44" cy="82" rx="7" ry="5" fill="${A.trim}"/><ellipse cx="76" cy="82" rx="7" ry="5" fill="${A.trim}"/>`; break;
      case 'iron': det = `<defs><linearGradient id="ir${u}" x1="0" x2="1"><stop offset="0" stop-color="#d9e0e8"/><stop offset=".5" stop-color="#a9b3bf"/><stop offset="1" stop-color="#7f8a98"/></linearGradient></defs><path d="${torso}" fill="url(#ir${u})"/><path d="M60 80 v30 M47 94 q13 6 26 0" stroke="${A.trim}" stroke-width="1.3" fill="none"/><ellipse cx="43" cy="82" rx="8" ry="6" fill="#c7cfd8" stroke="${A.trim}"/><ellipse cx="77" cy="82" rx="8" ry="6" fill="#c7cfd8" stroke="${A.trim}"/>`; break;
      case 'robe': det = `<path d="M39 110 L36 134 H84 L81 110 Z" fill="${A.body}"/><path d="M60 80 V134" stroke="${A.trim}" stroke-width="2"/><path d="M50 78 L60 92 L70 78" fill="none" stroke="${A.trim}" stroke-width="2"/><path d="M36 133 H84" stroke="${A.trim}" stroke-width="2"/>`; break;
      case 'firesuit': det = `<rect x="40" y="96" width="40" height="4" fill="${A.trim}"/><rect x="40" y="100" width="40" height="1.5" fill="#cfd6e0"/><path d="M53 78 L60 84 L67 78" fill="none" stroke="${A.trim}" stroke-width="2"/><rect x="64" y="85" width="8" height="5" rx="1" fill="#c0392b"/>`; break;
      case 'knight': det = `<path d="M50 80 L60 76 L70 80 L68 112 L52 112 Z" fill="${A.trim}"/><path d="M60 88 l4 4 -4 6 -4 -6z" fill="#f2c24f"/><ellipse cx="43" cy="82" rx="8.5" ry="6" fill="#dfe5ee" stroke="#8a95a5"/><ellipse cx="77" cy="82" rx="8.5" ry="6" fill="#dfe5ee" stroke="#8a95a5"/>`; break;
      case 'dragon': det = [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `<path d="M${44 + c * 7 + (r % 2) * 3.5} ${84 + r * 6} q3.5 4 7 0" fill="none" stroke="#7fe0c8" stroke-width="1"/>`).join('')).join('') + `<path d="M39 110 Q60 116 81 110" stroke="${A.trim}" stroke-width="2" fill="none"/><path d="M38 82 l-6 -6 8 1z M82 82 l6 -6 -8 1z" fill="${A.trim}"/>`; break;
      case 'gold': det = `<defs><linearGradient id="gd${u}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#f2c24f"/><stop offset="1" stop-color="#c9871a"/></linearGradient></defs><path d="${torso}" fill="url(#gd${u})"/><circle cx="60" cy="92" r="4" fill="#e0475a" stroke="#fff3c4"/><path d="M46 104 h28" stroke="${A.trim}" stroke-width="1.5"/><ellipse cx="43" cy="82" rx="8.5" ry="6" fill="#ffe08a" stroke="${A.trim}"/><ellipse cx="77" cy="82" rx="8.5" ry="6" fill="#ffe08a" stroke="${A.trim}"/>`; break;
      default: det = `<path d="M53 78 L60 86 L67 78" fill="none" stroke="${A.trim}" stroke-width="2"/>`;
    }
    const belt = id === 'robe' ? '' : `<rect x="40" y="103" width="40" height="5" rx="1.5" fill="${shade(A.pants, -0.25)}"/><rect x="57" y="102.5" width="6" height="6" rx="1" fill="#f2c24f"/>`;
    return { legs, body: `<path d="${torso}" fill="${A.body}"/>${det}${belt}`, sleeve: A.sleeve, skin };
  }
  // 무기: 손잡이가 (0,0) 이고 위(-y)로 뻗는다
  function weapon(id) {
    switch (id) {
      case 'stick': return '<path d="M0 6 L1 -34" stroke="#8a5a36" stroke-width="3.5" stroke-linecap="round"/><path d="M0.6 -20 l6 -6" stroke="#8a5a36" stroke-width="2" stroke-linecap="round"/><ellipse cx="7" cy="-27" rx="3" ry="1.8" fill="#6fbf5a"/>';
      case 'pencil': return '<rect x="-3.5" y="-34" width="7" height="40" fill="#f5c542"/><rect x="-3.5" y="-34" width="2.3" height="40" fill="#e8b02a"/><rect x="-3.5" y="2" width="7" height="6" fill="#e88"/><rect x="-3.5" y="0" width="7" height="2.5" fill="#bbb"/><path d="M-3.5 -34 L0 -44 L3.5 -34Z" fill="#f2d6a8"/><path d="M-1.2 -40.5 L0 -44 L1.2 -40.5Z" fill="#333"/>';
      case 'ruler': return '<rect x="-2.5" y="-46" width="5" height="50" fill="#e9eef5" stroke="#8aa0b8" stroke-width=".8"/>' + Array.from({ length: 9 }, (_, i) => `<path d="M-2.5 ${-42 + i * 5} h${i % 2 ? 2 : 3.5}" stroke="#5a6b80" stroke-width=".8"/>`).join('') + '<path d="M-7 2 h14" stroke="#c9871a" stroke-width="3" stroke-linecap="round"/>';
      case 'iron': return '<path d="M-3.5 -4 L-3.5 -40 L0 -47 L3.5 -40 L3.5 -4Z" fill="#dfe6ee" stroke="#8a95a5" stroke-width=".8"/><path d="M0 -42 V-5" stroke="#aab4c2" stroke-width="1"/><path d="M-9 -3 h18" stroke="#c9871a" stroke-width="3.5" stroke-linecap="round"/><rect x="-1.8" y="-2" width="3.6" height="8" fill="#6b4022"/><circle cx="0" cy="7" r="2.4" fill="#c9871a"/>';
      case 'marker': return '<path d="M-6 -6 L-6 -40 L0 -50 L6 -40 L6 -6Z" fill="#7ef07a" stroke="#2fa33a" stroke-width="1"/><path d="M-6 -16 h12" stroke="#2fa33a" stroke-width="1.2"/><rect x="-6.5" y="-6" width="13" height="12" rx="2" fill="#2fa33a"/><path d="M-2 -44 L0 -48 L2 -44" fill="#ffffff" opacity=".7"/>';
      case 'brush': return '<path d="M0 10 L0 -36" stroke="#7a4e2c" stroke-width="3" stroke-linecap="round"/><rect x="-2.6" y="-40" width="5.2" height="6" fill="#c9871a"/><path d="M-4 -40 Q0 -60 4 -40Z" fill="#1d1d1f"/><path d="M-1 -44 q1 -8 2 0" stroke="#555" stroke-width=".8" fill="none"/>';
      case 'axe': return '<path d="M0 8 L0 -38" stroke="#5a3a22" stroke-width="3.2" stroke-linecap="round"/><path d="M0 -38 Q16 -40 18 -26 Q10 -26 0 -24Z" fill="#d9433a" stroke="#8f241d" stroke-width="1"/><path d="M0 -36 l-6 -4 l1 8z" fill="#c9d0da"/><path d="M14 -34 l3 8" stroke="#fff" stroke-width="1" opacity=".7"/>';
      case 'staff': return '<path d="M0 10 L0 -36" stroke="#6b4022" stroke-width="3.2" stroke-linecap="round"/><path d="M0 -36 q-7 -2 -6 -9 M0 -36 q7 -2 6 -9" stroke="#6b4022" stroke-width="2" fill="none"/><circle class="orb" cx="0" cy="-45" r="6" fill="#7fd8ff" stroke="#e8fbff" stroke-width="1.2"/><circle cx="-2" cy="-47" r="1.8" fill="#fff" opacity=".9"/>';
      case 'flame': return '<path d="M-4 -4 L-4 -38 L0 -48 L4 -38 L4 -4Z" fill="#ff7a2a" stroke="#c4341b" stroke-width="1"/><path class="flk" d="M-4 -12 q-7 -8 -1 -16 q-1 6 3 8 M4 -20 q7 -8 1 -18 q1 7 -3 10 M-4 -30 q-5 -6 0 -12" fill="#ffd34a"/><path d="M-9 -3 h18" stroke="#5a1d12" stroke-width="3.5" stroke-linecap="round"/><rect x="-1.8" y="-2" width="3.6" height="8" fill="#5a1d12"/>';
      case 'pen': return '<g class="glow"><path d="M-5 -4 L-5 -32 Q0 -36 5 -32 L5 -4Z" fill="#1d2b5c"/><path d="M-5 -32 L0 -52 L5 -32Z" fill="#f2c24f" stroke="#c9871a" stroke-width=".8"/><path d="M0 -50 V-36" stroke="#7a5418" stroke-width=".9"/><circle cx="0" cy="-37" r="1.4" fill="#7a5418"/><path d="M-5 -14 h10 M-5 -12 h10" stroke="#f2c24f" stroke-width="1"/><path d="M-10 -3 h20" stroke="#f2c24f" stroke-width="3.5" stroke-linecap="round"/><rect x="-2" y="-2" width="4" height="8" fill="#1d2b5c"/><circle cx="0" cy="7.5" r="2.6" fill="#f2c24f"/></g>';
      default: return '';
    }
  }
  function pet(id) {
    const ink = '#2a2a2a';
    switch (id) {
      case 'chick': return '<ellipse cx="22" cy="132" rx="9" ry="8" fill="#ffd84a"/><circle cx="22" cy="122" r="6" fill="#ffd84a"/><circle cx="20" cy="121" r="1.1" fill="#222"/><circle cx="24.5" cy="121" r="1.1" fill="#222"/><path d="M21 124 l1.3 1.6 1.3 -1.6z" fill="#ff8a2a"/><path d="M22 116 q-1 -3 1 -4" stroke="#ffd84a" stroke-width="1.5" fill="none"/>';
      case 'slime': return '<path d="M10 140 Q8 122 22 118 Q36 122 34 140Z" fill="#6fd0ff" opacity=".9"/><ellipse cx="17" cy="124" rx="3" ry="2" fill="#fff" opacity=".7"/><circle cx="18" cy="131" r="1.4" fill="#16466a"/><circle cx="26" cy="131" r="1.4" fill="#16466a"/><path d="M20 135 q2 2 4 0" stroke="#16466a" stroke-width="1" fill="none"/>';
      case 'cat': return '<ellipse cx="22" cy="134" rx="10" ry="7" fill="#f0a64a"/><circle cx="22" cy="122" r="7" fill="#f0a64a"/><path d="M16 118 l1 -7 5 5z M28 118 l-1 -7 -5 5z" fill="#f0a64a"/><circle cx="19.5" cy="122" r="1.2" fill="#222"/><circle cx="24.5" cy="122" r="1.2" fill="#222"/><path d="M21 125 q1 1 2 0" stroke="#222" stroke-width=".8" fill="none"/><path d="M32 134 q8 -2 6 -10" stroke="#f0a64a" stroke-width="3" fill="none" stroke-linecap="round"/>';
      case 'owl': return '<ellipse cx="22" cy="130" rx="10" ry="11" fill="#8a6a4a"/><ellipse cx="22" cy="134" rx="6.5" ry="6" fill="#d9c3a0"/><circle cx="18" cy="125" r="4" fill="#fff"/><circle cx="26" cy="125" r="4" fill="#fff"/><circle cx="18" cy="125" r="2" fill="#222"/><circle cx="26" cy="125" r="2" fill="#222"/><path d="M21 128 l1 2 1 -2z" fill="#f0a020"/><path d="M13 120 l2 -5 3 4z M31 120 l-2 -5 -3 4z" fill="#8a6a4a"/><rect x="15" y="111" width="14" height="3" fill="#22252c"/><path d="M22 109 l8 3 -8 3 -8 -3z" fill="#2c3038"/>';
      case 'dragon': return `<path d="M30 134 q12 0 10 -12" stroke="#4fbf8a" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="132" rx="10" ry="8" fill="#4fbf8a"/><circle cx="22" cy="120" r="8" fill="#4fbf8a"/><path d="M12 124 q-8 -6 -2 -12 q2 6 6 6z" fill="#8fe0b8" class="flap"/><path d="M17 113 l-1 -5 3 3z M27 113 l1 -5 -3 3z" fill="#f2c24f"/><circle cx="19" cy="120" r="1.4" fill="${ink}"/><circle cx="25" cy="120" r="1.4" fill="${ink}"/><ellipse cx="22" cy="125" rx="3" ry="1.6" fill="#3a9a6c"/><ellipse cx="22" cy="134" rx="5" ry="4" fill="#bff0d4"/>`;
      case 'fox': return '<g class="tails">' + [-40, -20, 0, 20, 40].map((a) => `<path d="M30 134 q14 -6 12 -22" transform="rotate(${a} 30 134)" stroke="#ff9a3c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>`).join('') + '</g><ellipse cx="22" cy="133" rx="10" ry="7" fill="#ffb256"/><circle cx="22" cy="121" r="7.5" fill="#ffb256"/><path d="M15 117 l0 -8 6 5z M29 117 l0 -8 -6 5z" fill="#ffb256"/><path d="M16 123 q6 6 12 0 q-6 3 -12 0z" fill="#fff4e6"/><path d="M18 120 q1.5 -1.5 3 0 M23 120 q1.5 -1.5 3 0" stroke="#222" stroke-width="1" fill="none"/><circle cx="22" cy="124" r="1" fill="#222"/>';
      default: return '';
    }
  }
  // ── 얼굴 쪽은 예전 좌표(머리 중심 50,45 반지름 22)로 그린 뒤 크기를 맞춘다 ──
  function hairBack(id, c) {
    switch (id) {
      case 'long': return `<path d="M26 44 C24 22 38 16 50 16 C62 16 76 22 74 44 L77 76 C71 79 65 75 64 68 L36 68 C35 75 29 79 23 76 Z" fill="${c}"/>`;
      case 'bob': return `<path d="M26 46 C24 22 38 17 50 17 C62 17 76 22 74 46 L75 62 C70 64 66 60 66 56 L34 56 C34 60 30 64 25 62 Z" fill="${c}"/>`;
      case 'pony': return `<path class="h-pony" d="M68 30 C88 30 90 56 80 68 C79 56 75 46 66 40Z" fill="${c}"/><circle cx="70" cy="31" r="3" fill="#e35d6a"/>`;
      case 'bun': return `<circle cx="50" cy="17" r="9.5" fill="${c}"/>`;
      case 'curly': return [[29, 46], [27, 56], [73, 46], [74, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`).join('');
      default: return '';
    }
  }
  function hairFront(id, c) {
    const d = shade(c, -0.2), hl = shade(c, 0.35);
    switch (id) {
      case 'spiky': return `<path d="M27 44 L25 28 L34 31 L35 16 L44 26 L50 12 L56 26 L65 16 L66 31 L75 28 L73 44 C66 34 58 31 50 31 C42 31 34 34 27 44Z" fill="${c}"/><path d="M44 26 l3 -6" stroke="${hl}" stroke-width="1.5"/>`;
      case 'curly': return `<g fill="${c}">${[[30, 38], [33, 28], [41, 21], [50, 19], [59, 21], [67, 28], [70, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join('')}<circle cx="44" cy="31" r="6"/><circle cx="56" cy="31" r="6"/></g>`;
      case 'long': case 'bob': return `<path d="M27 46 C25 24 38 18 50 18 C62 18 75 24 73 46 C70 38 64 33 56 32 C52 37 44 38 38 36 C33 38 29 42 27 46Z" fill="${c}"/><path d="M50 19 q-2 8 -10 15" stroke="${d}" stroke-width="1.2" fill="none"/><path d="M58 22 q6 3 9 10" stroke="${hl}" stroke-width="1.6" fill="none" opacity=".7"/>`;
      default: return `<path d="M27 45 C26 25 38 19 50 19 C63 19 74 26 73 45 C69 36 61 31 50 32 C42 31 33 35 27 45Z" fill="${c}"/><path d="M47 21 q-3 7 -12 11" stroke="${d}" stroke-width="1.2" fill="none"/><path d="M58 23 q6 3 9 10" stroke="${hl}" stroke-width="1.6" fill="none" opacity=".7"/>`;
    }
  }
  function face(id) {
    const ink = '#2b1d18';
    const eye = (x) => `<g class="h-eye"><ellipse cx="${x}" cy="47" rx="3.3" ry="4.2" fill="${ink}"/><ellipse cx="${x}" cy="48.2" rx="2.3" ry="2.6" fill="#5a3a8a"/><circle cx="${x + 1.1}" cy="45.6" r="1.3" fill="#fff"/><circle cx="${x - 1}" cy="49.4" r=".6" fill="#fff"/></g>`;
    const eyes = eye(42) + eye(58);
    const blush = '<ellipse cx="36" cy="54" rx="3.6" ry="2.2" fill="#ff8a8a" opacity=".4"/><ellipse cx="64" cy="54" rx="3.6" ry="2.2" fill="#ff8a8a" opacity=".4"/>';
    const arc = (x) => `<path d="M${x - 3.4} 48 Q${x} 43.5 ${x + 3.4} 48" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    switch (id) {
      case 'happy': return `${arc(42)}${arc(58)}<path d="M44.5 54 Q50 62 55.5 54 Z" fill="#b8434a"/><path d="M47 57.5 q3 2 6 0" fill="#ff8a95"/>${blush}`;
      case 'wink': return `${eye(42)}${arc(58)}<path d="M45 55 Q50 59 55 55" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M63 40 l2 -2 M65 43 l3 -1" stroke="#f2c24f" stroke-width="1.2"/>${blush}`;
      case 'cool': return `<path d="M38.5 47 h7 M54.5 47 h7" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M38 42.5 l7 1 M62 42.5 l-7 1" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/><path d="M45 56 Q51 58 56 54" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'fire': return `${eyes}<path d="M37.5 41.5 l7.5 2.5 M62.5 41.5 l-7.5 2.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M45 56 h10" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/><path class="flk" d="M67 37 q3 -5 1 -9 q5 3 3 9 q-2 2 -4 0z" fill="#ff7a3d"/>`;
      case 'star': { const st = (x) => `<path d="M${x} 42.8l1.5 3 3.2.5-2.3 2.2.6 3.2-3-1.6-3 1.6.6-3.2-2.3-2.2 3.2-.5z" fill="#ffcf2a" stroke="${ink}" stroke-width=".7"/>`; return `${st(42)}${st(58)}<path d="M44.5 54 Q50 62 55.5 54 Z" fill="#b8434a"/>${blush}`; }
      default: return `${eyes}<path d="M45.5 55 Q50 59 54.5 55" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>${blush}`;
    }
  }
  function helm(id) {
    switch (id) {
      case 'band': return '<path d="M28 36 C34 25 66 25 72 36" fill="none" stroke="#e35d6a" stroke-width="4" stroke-linecap="round"/><path d="M71 33 q8 0 10 6 q-6 -1 -10 -2z" fill="#e35d6a"/><text x="50" y="32.5" font-size="5" font-weight="900" fill="#fff" text-anchor="middle">합격</text>';
      case 'horn': return '<path d="M27 38 C27 16 73 16 73 38 Z" fill="#9aa6b4"/><rect x="25" y="35" width="50" height="6" rx="3" fill="#7d8896"/><path d="M29 30 Q16 24 18 10 Q24 22 33 24Z M71 30 Q84 24 82 10 Q76 22 67 24Z" fill="#f4ecd8" stroke="#c9bfa3" stroke-width=".8"/><circle cx="50" cy="27" r="2.5" fill="#e0475a"/>';
      case 'wizard': return '<path d="M24 36 Q50 30 76 36 L70 40 Q50 36 30 40Z" fill="#4a2f8a"/><path d="M32 37 Q40 20 52 6 Q58 2 60 8 Q56 12 58 22 L68 37 Q50 33 32 37Z" fill="#6a46b8"/><path d="M33 34 Q50 30 67 34" stroke="#f2c24f" stroke-width="2.4" fill="none"/><path d="M50 20 l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#ffe14d"/>';
      case 'grad': return '<path d="M33 30 h34 v8 q-17 6 -34 0z" fill="#22252c"/><path d="M50 16 L80 26 L50 36 L20 26 Z" fill="#2c3038"/><path class="h-tassel" d="M50 26 L72 30 v12" fill="none" stroke="#f2c24f" stroke-width="1.5"/><circle cx="72" cy="43" r="2.4" fill="#f2c24f"/>';
      case 'fire': return '<path d="M25 40 C25 13 75 13 75 40 Z" fill="#f2c62f"/><path d="M20 40 h60 q2 4 -2 5 h-56 q-4 -1 -2 -5z" fill="#d9ab1a"/><path d="M50 16 v24" stroke="#d9ab1a" stroke-width="3"/><path d="M46 26 h8 v7 l-4 3 -4 -3z" fill="#c0392b"/>';
      case 'knight': return '<path d="M24 46 C22 14 78 14 76 46 L72 50 L72 40 Q50 34 28 40 L28 50Z" fill="#c7d0dc" stroke="#7d8896" stroke-width="1"/><path d="M50 14 Q60 4 66 10 Q58 12 54 18Z" fill="#d9433a"/><path d="M28 40 Q50 34 72 40" stroke="#7d8896" stroke-width="2" fill="none"/><path d="M50 18 V38" stroke="#aab4c2" stroke-width="2"/>';
      case 'crown': return '<path class="glow" d="M30 33 L32 13 L41 24 L50 8 L59 24 L68 13 L70 33 Z" fill="#f5c542" stroke="#d49a1c" stroke-width="1.2"/><circle cx="50" cy="25" r="2.8" fill="#e0475a"/><circle cx="38" cy="28" r="1.9" fill="#3c8de0"/><circle cx="62" cy="28" r="1.9" fill="#3c8de0"/><circle cx="32" cy="13" r="1.6" fill="#fff3c4"/><circle cx="50" cy="8" r="1.6" fill="#fff3c4"/><circle cx="68" cy="13" r="1.6" fill="#fff3c4"/>';
      case 'halo': return '<ellipse class="h-halo" cx="50" cy="12" rx="17" ry="5" fill="none" stroke="#ffe680" stroke-width="3.5"/><ellipse class="h-halo" cx="50" cy="12" rx="17" ry="5" fill="none" stroke="#fffbe0" stroke-width="1.2"/>';
      default: return '';
    }
  }
  const HEAD = 'translate(60 52) scale(1.18) translate(-50 -45)';

  function svg(cfg, size, mode) {
    const c = typeof cfg === 'string' ? decode(cfg) : norm(cfg);
    const u = 'h' + (++seq), skin = SKIN[c.s], hc = HAIRC[c.hc];
    const A = armor(c.ar, skin, u);
    const wp = item('w', c.w), lg = [c.w, c.hd, c.ar, c.cp, c.pt].some((v, i) => (item(['w', 'hd', 'ar', 'cp', 'pt'][i], v) || {}).rar === 'l');
    const fm = mode === 'face';
    const vb = fm ? '18 10 84 84' : '0 0 120 150';
    const w = size || 120, h = fm ? w : Math.round(w * 1.25);
    return `<svg class="avatar-svg hero${fm ? ' face' : ''}${lg ? ' hero-legend' : ''}" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-label="캐릭터" xmlns="http://www.w3.org/2000/svg">
      ${scene(c.sc, u)}
      ${fm ? '' : '<ellipse cx="60" cy="136" rx="30" ry="4.5" fill="#000" opacity=".18"/>'}
      ${lg && !fm ? '<ellipse class="aura" cx="60" cy="88" rx="44" ry="56" fill="#ffd34a" opacity=".16"/>' : ''}
      ${fm ? '' : `<g class="h-pet">${pet(c.pt)}</g>`}
      <g class="h-bob">
        ${cape(c.cp)}
        <g transform="${HEAD}">${hairBack(c.h, hc)}</g>
        ${A.legs}
        <path d="M44 84 Q36 94 35 104" stroke="${A.sleeve}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="35" cy="106" r="5" fill="${skin}"/>
        ${A.body}
        <path d="M54 74 h12 v6 q-6 4 -12 0z" fill="${shade(skin, -0.12)}"/>
        <g class="h-arm"><path d="M76 84 Q84 92 88 100" stroke="${A.sleeve}" stroke-width="9" stroke-linecap="round" fill="none"/>
          <g transform="translate(89 102) rotate(28)">${weapon(c.w)}</g><circle cx="89" cy="102" r="5" fill="${skin}"/></g>
        <g transform="${HEAD}">
          <circle cx="28" cy="48" r="4.2" fill="${skin}"/><circle cx="72" cy="48" r="4.2" fill="${skin}"/>
          <circle cx="50" cy="45" r="22" fill="${skin}"/>
          ${face(c.f)}${hairFront(c.h, hc)}${helm(c.hd)}
        </g>
      </g>
      ${wp && wp.rar === 'l' && !fm ? '<g class="spark"><path d="M100 70 l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#fff6b0"/></g>' : ''}
    </svg>`;
  }

  window.AVATAR = { CATS, ALL, ORDER, DEF, KEY, RARITY, STARTER, load, save, norm, encode, decode, svg, item, power, unlockedBetween };
})();
