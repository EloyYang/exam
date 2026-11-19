/*
 * 경험치·레벨
 *   문제를 풀 때마다 경험치(XP)가 쌓이고, 일정량이 모이면 레벨이 오른다.
 *   저장: UserStore 'study.xp' (로그인하면 계정에 동기화)
 *     { base: {x, n, c},                 처음 켰을 때 그동안의 풀이 기록을 환산한 값 (한 번만)
 *       '<기기id>|<YYYY-MM-DD>': {x, n, c} } 기기·날짜별로 쌓인 값
 *   기기·날짜별로 칸을 나눠 두면, 두 기기에서 따로 풀어도 동기화할 때 겹치지 않고 합쳐진다(userstore.js merge).
 *   풀이 화면은 window.XP.add({ n: 푼 문항 수, c: 맞힌 수, kind }) 만 부르면 된다.
 */
(function () {
  const S = window.UserStore; if (!S) return;
  const KEY = 'study.xp';
  // 종류별 점수: 문항마다 per, 맞히면 ok 를 더 준다
  const PTS = { q: { per: 5, ok: 5 }, v: { per: 1, ok: 2 }, t: { per: 1, ok: 1 } };
  const TITLES = [[1, '새내기 수험생'], [3, '성실한 수험생'], [6, '기출 탐험가'], [10, '오답 사냥꾼'], [15, '개념 수집가'], [20, '합격 예비생'], [30, '시험 고수'], [40, '기출 달인'], [50, '합격의 전설']];
  const need = (lv) => 100 + 50 * (lv - 1); // lv → lv+1 에 필요한 XP
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const pts = (kind, n, c) => { const p = PTS[kind] || PTS.q; return n * p.per + c * p.ok; };
  function dev() {
    let d = null; try { d = localStorage.getItem('xp.dev'); } catch (e) { /* 무시 */ }
    if (!d) { d = Math.random().toString(36).slice(2, 8); try { localStorage.setItem('xp.dev', d); } catch (e) { /* 무시 */ } }
    return d;
  }
  const data = () => S.get(KEY, {}) || {};

  function levelOf(total) {
    let lv = 1, x = Math.max(0, Math.floor(total));
    while (x >= need(lv)) { x -= need(lv); lv++; }
    let title = TITLES[0][1]; TITLES.forEach(([l, t]) => { if (lv >= l) title = t; });
    const next = TITLES.find(([l]) => l > lv);
    return { lv, cur: x, need: need(lv), pct: Math.round((x / need(lv)) * 100), title, next: next ? { lv: next[0], title: next[1] } : null };
  }
  function summary() {
    const d = data(), t = today(); let x = 0, n = 0, c = 0, tx = 0, tn = 0;
    Object.entries(d).forEach(([k, v]) => {
      if (!v || typeof v !== 'object') return;
      x += v.x || 0; n += v.n || 0; c += v.c || 0;
      if (k.endsWith('|' + t)) { tx += v.x || 0; tn += v.n || 0; }
    });
    return { total: x, n, c, today: tx, todayN: tn, ...levelOf(x) };
  }

  /* ── 그동안의 기록을 한 번 환산 ── */
  function computeBase() {
    let x = 0, n = 0, c = 0;
    const add = (kind, nn, cc) => { nn = Math.max(0, nn | 0); cc = Math.max(0, Math.min(nn, cc | 0)); n += nn; c += cc; x += pts(kind, nn, cc); };
    const len = (o) => Object.keys(o || {}).length;
    // 한국사 회차(50문항)·문항 세트
    (S.get('khmap.quizLog', []) || []).forEach((a) => add('q', 50, 50 - (a.wrong || []).length));
    (S.get('khmap.setLog', []) || []).forEach((a) => { const t = (a.items || []).length || len(a.answers); add('q', t, t - (a.wrong || []).length); });
    // 소방: 문항별 푼 횟수·틀린 횟수
    Object.values(S.get('study.fire.q', {}) || {}).forEach((o) => add('q', o.t || 0, (o.t || 0) - (o.w || 0)));
    // 지텔프: 모의고사·독해·청취·문법·단어
    (S.get('study.gtelp.quizLog', []) || []).forEach((a) => { const p = a.picks || {}; const t = len(p); add('q', t, t - (a.wrong || []).filter((w) => p[w] != null).length); });
    ['reading', 'listening'].forEach((k) => Object.values(S.get('study.gtelp.' + k, {}) || {}).forEach((o) => {
      const p = (o.picks || []).filter((v) => v != null).length; add('q', p, Math.round(((o.score || 0) / 100) * (o.picks || []).length));
    }));
    add('q', len(S.get('study.gtelp.grammar', {})), 0);
    const v = S.get('study.gtelp.vocab', {}) || {}; add('v', (v.known || []).length, (v.known || []).length);
    // 오답 다시 풀기 (시험별)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^(khmap|study\.\w+)\.retry$/.test(k)) Object.values(S.get(k, {}) || {}).forEach((o) => add('q', (o.ok || 0) + (o.no || 0), o.ok || 0));
      }
    } catch (e) { /* 무시 */ }
    // 타자 연습
    Object.values(S.get('study.typing.rec', {}) || {}).forEach((o) => add('t', o.t || 0, (o.t || 0) - (o.w || 0)));
    return { x, n, c, at: Date.now() };
  }
  let baseDone = false;
  function ensureBase() {
    if (baseDone) return; baseDone = true;
    const d = data(); if (d.base) return;
    const b = computeBase();
    S.set(KEY, Object.assign(data(), { base: b }));
    draw();
  }
  // 로그인했으면 서버와 맞춘 뒤에, 아니면 바로 환산한다
  S.onChange((type) => { if (type === 'sync' || type === 'auth') ensureBase(); draw(); });
  window.addEventListener('load', () => { if (!S.configured) ensureBase(); setTimeout(() => { if (!S.user) ensureBase(); }, 6000); });

  /* ── 경험치 더하기 ── */
  function add(o) {
    const n = Math.max(0, (o && o.n) | 0); if (!n) return 0;
    const c = Math.max(0, Math.min(n, (o.c | 0))), kind = (o && o.kind) || 'q';
    const gain = pts(kind, n, c);
    const before = summary().lv;
    const d = data(), k = dev() + '|' + today(), e = d[k] || { x: 0, n: 0, c: 0 };
    e.x += gain; e.n += n; e.c += c; d[k] = e;
    S.set(KEY, d);
    const s = summary();
    toast(gain, s, s.lv > before);
    draw();
    if (window.track) { if (s.lv > before) window.track('level_up', { level: s.lv }); }
    return gain;
  }

  /* ── 화면 ── */
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function chip() {
    const nav = document.querySelector('.top-links'); if (!nav) return;
    let b = document.getElementById('xp-chip');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'xp-chip'; b.className = 'top-link xp-chip';
      b.addEventListener('click', openPanel);
      nav.insertBefore(b, nav.firstChild);
    }
    const s = summary();
    b.title = `${s.title} · 다음 레벨까지 ${fmt(s.need - s.cur)} XP`;
    b.innerHTML = `<span class="xp-lv">Lv.${s.lv}</span><span class="xp-mini" aria-hidden="true"><i style="width:${s.pct}%"></i></span>`;
  }
  function cardHTML(s, big) {
    return `<div class="xp-card${big ? ' big' : ''}">
      <div class="xp-badge"><small>Lv</small>${s.lv}</div>
      <div class="xp-main">
        <div class="xp-row"><b class="xp-title">${esc(s.title)}</b><span class="xp-num">${fmt(s.cur)} / ${fmt(s.need)} XP</span></div>
        <div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.need}" aria-valuenow="${s.cur}"><i style="width:${s.pct}%"></i></div>
        <div class="xp-sub"><span>오늘 <b>+${fmt(s.today)} XP</b>${s.todayN ? ` (${fmt(s.todayN)}문항)` : ''}</span><span>지금까지 ${fmt(s.n)}문항 · 누적 ${fmt(s.total)} XP</span></div>
      </div></div>`;
  }
  function home() {
    if (!document.body.classList.contains('home-page')) return;
    const main = document.getElementById('home'); if (!main) return;
    let el = document.getElementById('xp-home');
    if (!el) { el = document.createElement('section'); el.id = 'xp-home'; el.className = 'review xp-home'; main.parentNode.insertBefore(el, main); el.addEventListener('click', openPanel); }
    el.innerHTML = cardHTML(summary(), true);
  }
  function draw() { chip(); home(); const p = document.getElementById('xp-dlg'); if (p && p.open) fillPanel(p); }

  function fillPanel(dlg) {
    const s = summary();
    dlg.querySelector('.xp-dlg-body').innerHTML = `${cardHTML(s, true)}
      <p class="xp-next">다음 레벨까지 <b>${fmt(s.need - s.cur)} XP</b> · ${s.next ? `Lv.${s.next.lv}이 되면 <b>${esc(s.next.title)}</b> 칭호를 받아요` : '최고 칭호에 도달했어요! 🎉'}</p>
      <h3>경험치 얻는 법</h3>
      <ul class="xp-how">
        <li><b>기출·모의고사·문항 세트 채점</b><span>문항마다 5 XP, 맞히면 +5 XP</span></li>
        <li><b>오답 다시 풀기 · 지텔프 문법·독해·청취</b><span>문항마다 5 XP, 맞히면 +5 XP</span></li>
        <li><b>지텔프 단어 퀴즈</b><span>문항마다 1 XP, 맞히면 +2 XP</span></li>
        <li><b>타자 연습</b><span>한 문제마다 1 XP, 맞히면 +1 XP</span></li>
      </ul>
      <p class="xp-note">레벨이 오를수록 다음 레벨까지 필요한 경험치가 50 XP씩 늘어나요. 처음 켰을 때 그동안 풀어 둔 기록도 경험치로 환산했어요. 로그인하면 다른 기기와 합쳐져요.</p>`;
  }
  function openPanel() {
    let dlg = document.getElementById('xp-dlg');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'xp-dlg'; dlg.className = 'xp-dlg';
      dlg.innerHTML = '<div class="xp-dlg-head"><h2>내 레벨</h2><button type="button" class="xp-x" aria-label="닫기">×</button></div><div class="xp-dlg-body"></div>';
      dlg.querySelector('.xp-x').addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    fillPanel(dlg); dlg.showModal();
  }
  let tt = null;
  function toast(gain, s, up) {
    let el = document.getElementById('xp-toast');
    if (!el) { el = document.createElement('div'); el.id = 'xp-toast'; el.className = 'xp-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.classList.toggle('up', up);
    el.innerHTML = up
      ? `<b>🎉 레벨 업! Lv.${s.lv}</b><span>${esc(s.title)} · +${fmt(gain)} XP</span>`
      : `<b>+${fmt(gain)} XP</b><span>Lv.${s.lv} · 다음 레벨까지 ${fmt(s.need - s.cur)} XP</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), up ? 4500 : 2600);
  }

  // 상단 메뉴는 페이지마다 나중에 다시 그려지기도 해서, 칩이 사라지면 다시 넣는다
  function watchNav() {
    draw();
    const bar = document.querySelector('.topbar'); if (!bar || !window.MutationObserver) return;
    new MutationObserver(() => { if (!document.getElementById('xp-chip')) chip(); }).observe(bar, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchNav); else watchNav();

  window.XP = { add, summary, levelOf, open: openPanel };
})();
