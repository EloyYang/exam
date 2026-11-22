/*
 * 수험 RPG — 장비 인벤토리 · 보물상자 · 오늘의 퀘스트 · 연속 출석 · 레벨업 연출
 *   저장: UserStore 'study.inv' (로그인하면 계정에 동기화). 두 기기의 값을 키 단위로 합치므로 키를 겹치지 않게 나눈다.
 *     'it:<칸>:<id>': 1        가진 장비 (처음부터 가진 일반 장비는 AVATAR.STARTER)
 *     'cb:<이유>': 1           받은 보물상자 한 개 (이유가 같으면 한 번만: lv:20, q:2026-11-22:a, sk:2026-11-22, welcome:1 …)
 *     'op|<기기>': n           그 기기에서 연 상자 수        → 남은 상자 = cb 개수 − op 합
 *     'qd:<날짜>:<퀘스트>': 1   퀘스트 보상을 받음
 *     'qc|<기기>|<날짜>': {retry, social, big}  퀘스트용 카운터
 *     'ms:<레벨>': 1           레벨 달성 보상 장비를 받음
 *   경험치·레벨은 js/xp.js, 그림·장비 목록은 js/avatar.js.
 */
(function () {
  const S = window.UserStore, AV = window.AVATAR;
  if (!S || !AV) return;
  const KEY = 'study.inv';
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dstr(new Date());
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const rel = () => (/\/study\//.test(location.pathname) ? '../' : '');
  function dev() { let d = null; try { d = localStorage.getItem('xp.dev'); } catch (e) { /* 무시 */ } return d || 'x'; }
  const inv = () => S.get(KEY, {}) || {};
  function put(patch) { S.set(KEY, Object.assign(inv(), patch)); }
  const lv = () => (window.XP ? window.XP.summary().lv : 1);

  // 레벨 달성 보상 (반드시 받는 장비)
  const MILESTONE = { 5: 'w:ruler', 10: 'cp:red', 15: 'pt:owl', 20: 'hd:grad', 25: 'ar:knight', 30: 'w:flame', 35: 'hd:crown', 40: 'w:pen', 45: 'pt:fox', 50: 'ar:gold' };
  const WEIGHT = { c: 45, u: 30, r: 17, e: 7, l: 1 };

  /* ── 인벤토리 ── */
  const owns = (key, id) => AV.STARTER.includes(`${key}:${id}`) || !!inv()[`it:${key}:${id}`];
  function chests() {
    const v = inv(); let got = 0, open = 0;
    Object.entries(v).forEach(([k, x]) => { if (k.startsWith('cb:')) got++; else if (k.startsWith('op|')) open += +x || 0; });
    return Math.max(0, got - open);
  }
  function giveChest(reason) { const k = 'cb:' + reason; if (inv()[k]) return false; put({ [k]: 1 }); return true; }
  // 착용 가능: 꾸미기는 레벨만, 장비는 가지고 있고 레벨도 돼야 한다
  function canWear(key, id, L) {
    const it = AV.item(key, id); if (!it) return false;
    return it.lv <= (L || lv()) && (!it.gear || owns(key, id));
  }
  function openChest() {
    if (chests() < 1) return null;
    const L = lv();
    const pool = AV.ALL.filter((x) => x.gear && !owns(x.key, x.id) && x.lv <= L + 10);
    const v = inv(), k = 'op|' + dev();
    const patch = { [k]: (+v[k] || 0) + 1 };
    if (!pool.length) { put(patch); if (window.XP) window.XP.add({ bonus: 100, src: 'chest' }); return { xp: 100 }; }
    const rars = Object.keys(WEIGHT).filter((r) => pool.some((x) => x.rar === r));
    let roll = Math.random() * rars.reduce((s, r) => s + WEIGHT[r], 0), rar = rars[0];
    for (const r of rars) { roll -= WEIGHT[r]; if (roll <= 0) { rar = r; break; } }
    const cand = pool.filter((x) => x.rar === rar), it = cand[Math.floor(Math.random() * cand.length)];
    patch[`it:${it.key}:${it.id}`] = 1;
    put(patch);
    if (window.track) window.track('chest_open', { rarity: it.rar });
    return { item: it };
  }

  /* ── 오늘 기록 (study.xp 에서) ── */
  function dayStats(date) {
    const d = S.get('study.xp', {}) || {}; let n = 0, c = 0, x = 0;
    Object.entries(d).forEach(([k, v]) => { if (k.endsWith('|' + date) && v) { n += v.n || 0; c += v.c || 0; x += v.x || 0; } });
    return { n, c, x };
  }
  function counters(date) {
    const o = { retry: 0, social: 0, big: 0 };
    Object.entries(inv()).forEach(([k, v]) => { if (k.startsWith('qc|') && k.endsWith('|' + date) && v) Object.keys(o).forEach((f) => { o[f] += v[f] || 0; }); });
    return o;
  }
  function bump(field, by) {
    const k = `qc|${dev()}|${today()}`, v = inv(), o = Object.assign({ retry: 0, social: 0, big: 0 }, v[k]);
    o[field] = (o[field] || 0) + (by || 1); put({ [k]: o }); check();
  }
  function streak() {
    const d = S.get('study.xp', {}) || {}, days = new Set();
    Object.entries(d).forEach(([k, v]) => { const m = k.match(/\|(\d{4}-\d\d-\d\d)$/); if (m && v && v.n > 0) days.add(m[1]); });
    const cur = new Date(); if (!days.has(dstr(cur))) cur.setDate(cur.getDate() - 1);
    let s = 0; while (days.has(dstr(cur))) { s++; cur.setDate(cur.getDate() - 1); }
    return { days: s, todayDone: days.has(today()) };
  }

  /* ── 오늘의 퀘스트 (날짜마다 3개) ── */
  function hash(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function quests(date) {
    date = date || today();
    const h = hash(date), st = dayStats(date), ct = counters(date);
    const A = [15, 20, 30][h % 3], B = [8, 12, 18][(h >> 3) % 3];
    const extra = [
      { id: 'x', t: '경험치 300 XP 모으기', goal: 300, val: st.x, xp: 60 },
      { id: 'g', t: '한 번에 20문항 이상 채점하기', goal: 1, val: ct.big, xp: 80 },
      { id: 'r', t: '오답 다시 풀기 5문항', goal: 5, val: ct.retry, xp: 60 },
      { id: 's', t: '스터디 라운지에 글·댓글·채팅 남기기', goal: 1, val: ct.social, xp: 40 },
    ][(h >> 6) % 4];
    const v = inv();
    return [
      { id: 'a', t: `문제 ${A}개 풀기`, goal: A, val: st.n, xp: A * 3 },
      { id: 'b', t: `정답 ${B}개 맞히기`, goal: B, val: st.c, xp: B * 5 },
      extra,
    ].map((q) => ({ ...q, val: Math.min(q.goal, q.val), done: q.val >= q.goal, got: !!v[`qd:${date}:${q.id}`] }));
  }
  let checking = false;
  function check() {
    if (checking || !window.XP) return; checking = true;
    try {
      const date = today(), list = quests(date), msgs = [];
      list.forEach((q) => {
        if (!q.done || q.got) return;
        put({ [`qd:${date}:${q.id}`]: 1 }); giveChest(`q:${date}:${q.id}`);
        msgs.push({ t: `✅ 퀘스트 완료! ${q.t}`, s: `보물상자 +1 · +${q.xp} XP` });
        window.XP.add({ bonus: q.xp, src: 'quest', quiet: true });
      });
      if (list.every((q) => q.done) && giveChest(`qall:${date}`)) msgs.push({ t: '🏆 오늘의 퀘스트 올클리어!', s: '보너스 보물상자 +1' });
      const sk = streak();
      if (sk.todayDone && sk.days > 0 && sk.days % 7 === 0 && giveChest(`sk:${date}`)) msgs.push({ t: `🔥 ${sk.days}일 연속 출석!`, s: '보너스 보물상자 +1' });
      msgs.forEach((m, i) => setTimeout(() => notice(m.t, m.s), 900 + i * 2600));
      if (msgs.length) redraw();
    } finally { checking = false; }
  }

  /* ── 레벨 달성 보상 · 처음 시작 선물 ── */
  function grantMilestones(L) {
    const v = inv(), patch = {}, got = [];
    Object.entries(MILESTONE).forEach(([l, ref]) => {
      if (+l > L || v['ms:' + l]) return;
      const [key, id] = ref.split(':'); patch['ms:' + l] = 1; patch[`it:${key}:${id}`] = 1; got.push(AV.item(key, id));
    });
    if (got.length) put(patch);
    return got;
  }
  let welcomed = false;
  function welcome() {
    if (welcomed || !window.XP) return; welcomed = true;
    const v = inv(); if (v.welcome) { grantMilestones(lv()); return; }
    put({ welcome: 1 }); [1, 2, 3].forEach((i) => giveChest('welcome:' + i));
    grantMilestones(lv());
    redraw();
    setTimeout(() => notice('🎁 모험 시작 선물 도착!', `보물상자 3개를 받았어요 · <a href="${rel()}character.html#chest">열러 가기 →</a>`, 6000), 1200);
  }
  S.onChange((type) => { if (type === 'sync' || type === 'auth') setTimeout(welcome, 300); redraw(); });
  window.addEventListener('load', () => { if (!S.configured) setTimeout(welcome, 300); setTimeout(() => { if (!S.user) welcome(); }, 6500); });

  /* ── 경험치가 들어올 때 ── */
  window.addEventListener('xp-gain', (e) => {
    const d = e.detail || {};
    if (d.src === 'retry') bump('retry', d.n);
    if (d.kind === 'q' && d.n >= 20 && d.src !== 'retry') bump('big', 1);
    if (d.after > d.before) {
      const items = [];
      for (let l = d.before + 1; l <= d.after; l++) giveChest('lv:' + l);
      items.push(...grantMilestones(d.after));
      celebrate(d.before, d.after, items);
    }
    check(); redraw();
  });

  /* ── 화면 조각 ── */
  function notice(title, sub, ms) {
    let box = document.getElementById('g-notes');
    if (!box) { box = document.createElement('div'); box.id = 'g-notes'; box.className = 'g-notes'; document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'g-note'; el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    box.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, ms || 3800);
  }
  const rarTag = (it) => `<span class="g-rar r-${it.rar}">${AV.RARITY[it.rar].name}</span>`;
  function itemCard(it, extra) {
    const prev = Object.assign(AV.load(), { [it.key]: it.id });
    return `<div class="g-card r-${it.rar}">${AV.svg(prev, 110, it.key === 'sc' || it.key === 'pt' || it.key === 'cp' || it.key === 'ar' || it.key === 'w' ? '' : 'face')}<b>${esc(it.name)}</b><small>${rarTag(it)} · ${AV.CATS.find((c) => c.key === it.key).name} · 전투력 +${it.pow}</small>${extra || ''}</div>`;
  }
  function celebrate(from, to, items) {
    if (window.track) window.track('level_up', { level: to });
    const s = window.XP.summary(), unlocked = AV.unlockedBetween(from, to);
    const old = document.getElementById('g-lvup'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'g-lvup'; el.className = 'g-lvup'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '레벨 업');
    const conf = Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 12) * 0.08}s;background:${['#ffcf2a', '#ff6a8a', '#5ad1ff', '#7ef07a', '#b892ff'][i % 5]}"></i>`).join('');
    el.innerHTML = `<div class="g-conf">${conf}</div><div class="g-lv-card">
      <div class="g-rays"></div>
      <p class="g-lv-kicker">LEVEL UP!</p>
      <div class="g-lv-hero">${AV.svg(AV.load(), 150)}</div>
      <p class="g-lv-num"><span>Lv.${from}</span> → <b>Lv.${to}</b></p>
      <p class="g-lv-title">${esc(s.title)} · 전투력 ${fmt(AV.power(AV.load(), to))}</p>
      <ul class="g-lv-rw"><li>🎁 보물상자 ×${to - from}</li>${items.filter(Boolean).map((it) => `<li class="r-${it.rar}">⚔ 달성 보상: <b>${esc(it.name)}</b> ${rarTag(it)}</li>`).join('')}${unlocked.length ? `<li>🎨 새 꾸미기: ${unlocked.map((x) => esc(x.name)).join(', ')}</li>` : ''}</ul>
      <div class="g-lv-btns"><a class="g-btn" href="${rel()}character.html#chest">🎁 상자 열러 가기</a><button type="button" class="g-btn ghost" data-close>계속 공부하기</button></div></div>`;
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === el) el.remove(); });
    document.body.appendChild(el);
  }
  function questHTML(compact) {
    const list = quests(), sk = streak(), n = chests();
    return `<div class="g-quests${compact ? ' compact' : ''}">
      <div class="g-q-head"><b>📜 오늘의 퀘스트</b><span class="g-streak${sk.todayDone ? ' on' : ''}" title="문제를 푼 날이 이어진 일수">🔥 ${sk.days}일 연속</span></div>
      <ul>${list.map((q) => `<li class="${q.got ? 'got' : ''}"><span class="g-q-chk">${q.got ? '✔' : ''}</span><span class="g-q-t">${esc(q.t)}<small>보상 🎁 +1 · ${q.xp} XP</small></span><span class="g-q-p"><i style="width:${Math.round((q.val / q.goal) * 100)}%"></i><em>${fmt(q.val)}/${fmt(q.goal)}</em></span></li>`).join('')}</ul>
      <p class="g-q-foot">3개 모두 끝내면 보너스 상자 · 7일 연속이면 출석 상자${n ? ` · <a href="${rel()}character.html#chest" class="g-chest-link">🎁 열지 않은 상자 ${n}개</a>` : ''}</p></div>`;
  }
  function homeHTML(s) {
    const cfg = AV.load(), n = chests();
    return `<div class="g-home">
      <a class="g-home-hero" href="${rel()}character.html">${AV.svg(cfg, 116)}<span class="g-home-lv">Lv.${s.lv}</span>${n ? `<span class="g-home-box">🎁 ${n}</span>` : ''}</a>
      <div class="g-home-main">
        <div class="xp-row"><b class="xp-title">${esc(s.title)}</b><span class="g-pow">⚔ 전투력 ${fmt(AV.power(cfg, s.lv))}</span></div>
        <div class="xp-bar"><i style="width:${s.pct}%"></i></div>
        <div class="xp-sub"><span>${fmt(s.cur)} / ${fmt(s.need)} XP · 오늘 <b>+${fmt(s.today)} XP</b></span><a href="${rel()}character.html">⚔ 장비·상자 →</a></div>
        ${questHTML(true)}
      </div></div>`;
  }
  let hooks = [];
  function redraw() { hooks.forEach((f) => { try { f(); } catch (e) { /* 무시 */ } }); if (window.XP && window.XP.redraw) window.XP.redraw(); }

  window.GAME = { owns, chests, canWear, openChest, quests, streak, bump, check, questHTML, homeHTML, itemCard, rarTag, celebrate, notice, onRedraw: (f) => hooks.push(f), MILESTONE, inv };
})();
