/*
 * 내 캐릭터 화면 (character.html) — 장비 · 꾸미기 · 보물상자 · 퀘스트
 *   장비는 가지고 있어야(GAME.owns) 하고 레벨이 돼야(item.lv) 낄 수 있다. 꾸미기는 레벨만 되면 된다.
 *   고르는 즉시 저장한다(AVATAR.save → study.avatar, 라운지 프로필).
 */
(function () {
  const A = window.AVATAR, X = window.XP, G = window.GAME, S = window.UserStore;
  const root = document.getElementById('ch');
  if (!A || !X || !G || !root) return;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const TABS = [['gear', '⚔ 장비'], ['look', '🎨 꾸미기'], ['chest', '🎁 보물상자'], ['quest', '📜 퀘스트']];
  let cfg = A.load(), tab = TABS.some(([t]) => '#' + t === location.hash) ? location.hash.slice(1) : 'gear', slot = 'w', look = 'h', msg = '', opening = false, last = null;

  const slotsOf = (gear) => A.CATS.filter((c) => !!c.gear === gear);
  function side(s) {
    const pow = A.power(cfg, s.lv), n = G.chests();
    const owned = A.ALL.filter((x) => x.gear && G.owns(x.key, x.id)).length, total = A.ALL.filter((x) => x.gear).length;
    return `<section class="ch-side">
      <div class="ch-stage">${A.svg(cfg, 230)}</div>
      <div class="ch-who"><div class="ch-lvrow"><span class="ch-lvbadge">Lv.${s.lv}</span><b>${esc(s.title)}</b></div>
        <div class="ch-pow">⚔ 전투력 <b>${fmt(pow)}</b></div>
        <div class="xp-bar"><i style="width:${s.pct}%"></i></div><small>${fmt(s.cur)} / ${fmt(s.need)} XP · 다음 레벨까지 ${fmt(s.need - s.cur)} XP</small></div>
      <div class="ch-gearlist">${slotsOf(true).map((c) => { const it = A.item(c.key, cfg[c.key]); return `<button type="button" class="ch-slot r-${it.rar}" data-goslot="${c.key}" title="${c.name}: ${esc(it.name)}"><small>${c.name}</small><b>${esc(it.name)}</b></button>`; }).join('')}</div>
      <p class="ch-coll">📖 장비 도감 ${owned}/${total}</p>
      ${n ? `<button type="button" class="ch-btn chest-cta" data-tab="chest">🎁 열지 않은 상자 ${n}개</button>` : ''}
      <p class="ch-msg" role="status">${msg}</p>
    </section>`;
  }
  function gearTab(s) {
    const c = A.CATS.find((x) => x.key === slot);
    return `<nav class="ch-sub">${slotsOf(true).map((k) => `<button type="button" data-slot="${k.key}" class="${k.key === slot ? 'on' : ''}">${k.name} <small>${k.items.filter((i) => G.owns(k.key, i.id)).length}/${k.items.length}</small></button>`).join('')}</nav>
      <div class="ch-grid">${c.items.map((it) => {
        const own = G.owns(it.key, it.id), lock = it.lv > s.lv, on = cfg[slot] === it.id;
        const state = !own ? '<span class="ch-st q">❔ 상자에서 획득</span>' : lock ? `<span class="ch-st lk">🔒 Lv.${it.lv}부터 착용</span>` : on ? '<span class="ch-st on">착용 중</span>' : '<span class="ch-st ok">착용 가능</span>';
        return `<button type="button" class="ch-item r-${it.rar}${on ? ' on' : ''}${!own ? ' unknown' : lock ? ' lock' : ''}" data-gear="${it.id}">
          ${A.svg(Object.assign({}, cfg, { [slot]: it.id }), 92, slot === 'hd' ? 'face' : '')}
          <span class="ch-name">${esc(it.name)}</span>
          <span class="ch-meta">${G.rarTag(it)}${it.pow ? ` <em>+${it.pow}</em>` : ''}</span>${state}</button>`; }).join('')}</div>
      <p class="ch-hint">장비는 <b>보물상자</b>에서 얻어요. 레벨이 낮아도 상자에서 미리 얻을 수 있지만, 착용은 그 레벨이 되어야 해요. 등급: ${Object.entries(A.RARITY).map(([k, r]) => `<span class="g-rar r-${k}">${r.name}</span>`).join(' ')}</p>`;
  }
  function lookTab(s) {
    const c = A.CATS.find((x) => x.key === look);
    return `<nav class="ch-sub">${slotsOf(false).map((k) => `<button type="button" data-look="${k.key}" class="${k.key === look ? 'on' : ''}">${k.name}</button>`).join('')}</nav>
      <div class="ch-grid">${c.items.map((it) => {
        const lock = it.lv > s.lv, on = cfg[look] === it.id;
        return `<button type="button" class="ch-item${on ? ' on' : ''}${lock ? ' lock' : ''}" data-look-id="${it.id}">
          ${A.svg(Object.assign({}, cfg, { [look]: it.id }), 92, 'face')}<span class="ch-name">${esc(it.name)}</span>
          ${lock ? `<span class="ch-st lk">🔒 Lv.${it.lv}</span>` : on ? '<span class="ch-st on">착용 중</span>' : ''}</button>`; }).join('')}</div>
      <p class="ch-hint">꾸미기는 레벨이 오르면 자동으로 열려요.</p>`;
  }
  function chestTab() {
    const n = G.chests();
    const res = last ? (last.item ? `<div class="ch-reveal">${G.itemCard(last.item, `<div class="ch-reveal-btns">${G.canWear(last.item.key, last.item.id) ? `<button type="button" class="ch-btn" data-wear="${last.item.key}:${last.item.id}">바로 착용</button>` : `<span class="ch-st lk">🔒 Lv.${last.item.lv}부터 착용</span>`}</div>`)}</div>`
      : '<div class="ch-reveal"><div class="g-card r-l"><b>+100 XP</b><small>얻을 수 있는 장비를 모두 모았어요!</small></div></div>') : '';
    return `<div class="ch-chest-wrap">
      <button type="button" class="ch-chest${n ? '' : ' empty'}${opening ? ' shake' : ''}" data-open ${n && !opening ? '' : 'disabled'} aria-label="보물상자 열기">
        <svg viewBox="0 0 120 100" width="170" height="142"><ellipse cx="60" cy="92" rx="44" ry="6" fill="#000" opacity=".18"/>
          <path d="M14 46 h92 v38 a6 6 0 0 1 -6 6 h-80 a6 6 0 0 1 -6 -6z" fill="#a8652e"/><path d="M14 58 h92 M14 74 h92" stroke="#7a4518" stroke-width="2"/>
          <path class="lid" d="M14 46 q0 -26 46 -26 q46 0 46 26z" fill="#c47a3a"/><path d="M14 46 h92" stroke="#f2c24f" stroke-width="5"/>
          <rect x="52" y="40" width="16" height="22" rx="3" fill="#f2c24f" stroke="#c9871a"/><circle cx="60" cy="52" r="3" fill="#7a4518"/>
          <path d="M20 46 v40 M100 46 v40" stroke="#f2c24f" stroke-width="5"/></svg>
        <span class="ch-chest-n">${n ? `남은 상자 ${n}개` : '상자가 없어요'}</span></button>
      ${res}
      <ul class="ch-odds"><li><b>상자를 얻는 법</b></li><li>레벨업 할 때마다 1개</li><li>오늘의 퀘스트 1개 완료마다 1개 · 3개 모두 완료하면 보너스 1개</li><li>7일 연속 공부하면 출석 상자 1개</li></ul>
      <p class="ch-hint">상자에서는 내 레벨 +10 까지의 장비가 나와요. 확률: 일반 45% · 고급 30% · 희귀 17% · 영웅 7% · 전설 1%. 이미 가진 장비는 나오지 않아요.</p></div>`;
  }
  function questTab() {
    const sk = G.streak();
    return `${G.questHTML(false)}
      <div class="ch-streak"><b>🔥 ${sk.days}일 연속 공부 중</b><small>${sk.todayDone ? '오늘도 출석 완료!' : '오늘 한 문제라도 풀면 이어져요.'} 7일마다 출석 보물상자를 받아요.</small>
        <div class="ch-days">${Array.from({ length: 7 }, (_, i) => `<span class="${i < (sk.days % 7 || (sk.days ? 7 : 0)) ? 'on' : ''}">${i + 1}</span>`).join('')}</div></div>
      <div class="ch-ms"><h3>레벨 달성 보상</h3><ul>${Object.entries(G.MILESTONE).map(([l, ref]) => { const [k, id] = ref.split(':'); const it = A.item(k, id); const got = X.summary().lv >= +l; return `<li class="${got ? 'got' : ''}"><span class="ch-lvbadge">Lv.${l}</span>${esc(it.name)} ${G.rarTag(it)}${got ? ' ✔' : ''}</li>`; }).join('')}</ul></div>`;
  }
  function render() {
    const s = X.summary();
    root.innerHTML = `<div class="ch-wrap">${side(s)}<section class="ch-main">
      <nav class="ch-tabs">${TABS.map(([t, n]) => `<button type="button" data-tab="${t}" class="${t === tab ? 'on' : ''}">${n}${t === 'chest' && G.chests() ? ` <i class="cm-badge">${G.chests()}</i>` : ''}</button>`).join('')}</nav>
      ${tab === 'look' ? lookTab(s) : tab === 'chest' ? chestTab() : tab === 'quest' ? questTab() : gearTab(s)}</section></div>`;
  }
  function wear(key, id, text) { cfg = A.norm(Object.assign({}, cfg, { [key]: id })); A.save(cfg); msg = text; render(); }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const s = X.summary();
    if (b.dataset.tab) { tab = b.dataset.tab; msg = ''; history.replaceState(null, '', '#' + tab); render(); return; }
    if (b.dataset.goslot) { tab = 'gear'; slot = b.dataset.goslot; msg = ''; render(); return; }
    if (b.dataset.slot) { slot = b.dataset.slot; render(); return; }
    if (b.dataset.look) { look = b.dataset.look; render(); return; }
    if (b.dataset.gear) {
      const it = A.item(slot, b.dataset.gear);
      if (!G.owns(slot, it.id)) { msg = `❔ '${esc(it.name)}'은(는) 보물상자에서 얻을 수 있어요.`; render(); return; }
      if (it.lv > s.lv) { msg = `🔒 '${esc(it.name)}'은(는) Lv.${it.lv}부터 착용할 수 있어요. 지금 Lv.${s.lv}!`; render(); return; }
      wear(slot, it.id, `⚔ '${esc(it.name)}' 장착! 전투력 ${fmt(A.power(Object.assign({}, cfg, { [slot]: it.id }), s.lv))}`); return;
    }
    if (b.dataset.lookId) {
      const it = A.item(look, b.dataset.lookId);
      if (it.lv > s.lv) { msg = `🔒 '${esc(it.name)}'은(는) Lv.${it.lv}에 열려요.`; render(); return; }
      wear(look, it.id, `'${esc(it.name)}' 적용 ✓`); return;
    }
    if (b.dataset.wear) { const [k, id] = b.dataset.wear.split(':'); const it = A.item(k, id); wear(k, id, `⚔ '${esc(it.name)}' 장착!`); return; }
    if (b.hasAttribute('data-open')) {
      opening = true; last = null; render();
      setTimeout(() => {
        last = G.openChest(); opening = false;
        if (last && last.item) msg = `${last.item.rar === 'l' ? '🌟 전설 등급!! ' : last.item.rar === 'e' ? '✨ 영웅 등급! ' : ''}'${esc(last.item.name)}' 획득!`;
        render(); X.redraw && X.redraw();
      }, 900);
    }
  });
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.some(([x]) => x === t)) { tab = t; render(); } });
  if (S) S.onChange(() => { if (!opening) { cfg = A.load(); render(); } });
  G.onRedraw(() => { if (!opening) render(); });
  render();
})();
