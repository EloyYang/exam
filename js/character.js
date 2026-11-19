/*
 * 캐릭터 꾸미기 화면 (character.html)
 *   고르는 즉시 저장한다(AVATAR.save → UserStore 'study.avatar', 로그인·닉네임이 있으면 라운지 프로필에도).
 *   아이템마다 필요한 레벨이 있고, 레벨은 js/xp.js 의 경험치로 정해진다.
 */
(function () {
  const A = window.AVATAR, X = window.XP, S = window.UserStore;
  const root = document.getElementById('ch');
  if (!A || !X || !root) return;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cfg = A.load(), cat = 'h', msg = '';

  function render() {
    const s = X.summary(), lv = s.lv;
    const c = A.CATS.find((x) => x.key === cat);
    const next = A.CATS.flatMap((k) => k.items.filter((i) => i.lv > lv).map((i) => ({ ...i, cat: k.name }))).sort((a, b) => a.lv - b.lv).slice(0, 4);
    const own = A.CATS.reduce((n, k) => n + k.items.filter((i) => i.lv <= lv).length, 0), all = A.CATS.reduce((n, k) => n + k.items.length, 0);
    root.innerHTML = `<div class="ch-wrap">
      <section class="ch-side">
        <div class="ch-stage">${A.svg(cfg, 220)}</div>
        <div class="ch-who"><b>Lv.${lv} ${esc(s.title)}</b><small>${s.cur.toLocaleString()} / ${s.need.toLocaleString()} XP · 아이템 ${own}/${all}개 열림</small>
          <div class="xp-bar"><i style="width:${s.pct}%"></i></div></div>
        <div class="ch-btns"><button type="button" class="ch-btn" data-act="rand">🎲 랜덤 조합</button><button type="button" class="ch-btn ghost" data-act="reset">기본으로</button></div>
        <p class="ch-msg" role="status">${msg}</p>
        ${next.length ? `<div class="ch-next"><h3>다음에 열리는 아이템</h3><ul>${next.map((i) => `<li><span class="ch-lvtag">Lv.${i.lv}</span>${esc(i.name)} <small>${esc(i.cat)}</small></li>`).join('')}</ul><a href="index.html">문제 풀고 경험치 모으기 →</a></div>` : '<div class="ch-next"><h3>모든 아이템이 열렸어요! 🎉</h3></div>'}
      </section>
      <section class="ch-main">
        <nav class="ch-tabs">${A.CATS.map((k) => `<button type="button" data-cat="${k.key}" class="${k.key === cat ? 'on' : ''}">${k.name}</button>`).join('')}</nav>
        <div class="ch-grid">${c.items.map((it) => {
          const lock = it.lv > lv, on = cfg[cat] === it.id;
          return `<button type="button" class="ch-item${on ? ' on' : ''}${lock ? ' lock' : ''}" data-id="${it.id}" aria-pressed="${on}" title="${lock ? `Lv.${it.lv}에 열려요` : esc(it.name)}">
            ${A.svg(Object.assign({}, cfg, { [cat]: it.id }), 84)}
            <span class="ch-name">${esc(it.name)}</span>
            ${lock ? `<span class="ch-lock">🔒 Lv.${it.lv}</span>` : it.lv > 1 ? `<span class="ch-lvtag">Lv.${it.lv}</span>` : ''}
          </button>`; }).join('')}</div>
        <p class="ch-hint">고르면 바로 저장돼요. ${S && S.user ? '스터디 라운지 게시글·댓글·채팅에서도 이 캐릭터가 보여요.' : '로그인하고 라운지 닉네임을 정하면 게시글·댓글·채팅에서도 이 캐릭터가 보여요.'}</p>
      </section></div>`;
  }
  function set(next, text) { cfg = A.norm(next); A.save(cfg); msg = text || '저장했어요 ✓'; render(); }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const lv = X.summary().lv;
    if (b.dataset.cat) { cat = b.dataset.cat; msg = ''; render(); return; }
    if (b.dataset.id) {
      const it = A.item(cat, b.dataset.id);
      if (it.lv > lv) { msg = `🔒 '${esc(it.name)}'은(는) Lv.${it.lv}에 열려요. 지금 Lv.${lv} — 문제를 풀어 경험치를 모아 보세요!`; render(); return; }
      set(Object.assign({}, cfg, { [cat]: it.id }), `'${esc(it.name)}' 착용 ✓`);
      return;
    }
    if (b.dataset.act === 'rand') {
      const r = {}; A.CATS.forEach((k) => { const ok = k.items.filter((i) => i.lv <= lv); r[k.key] = ok[Math.floor(Math.random() * ok.length)].id; });
      set(r, '🎲 랜덤 조합을 입었어요 ✓');
    }
    if (b.dataset.act === 'reset') set(A.DEF, '기본 모습으로 돌아왔어요 ✓');
  });
  // 다른 기기에서 맞춰지거나 경험치 환산이 끝나면 다시 그린다
  if (S) S.onChange(() => { cfg = A.load(); render(); });
  render();
})();
