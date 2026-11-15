(function () {
  const S = window.UserStore;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function stats(ex) {
    const A = window.ATTEMPTS_FOR(ex.id);
    const list = A.all();
    const keys = (window.QUIZ_KEYS || {})[ex.id] || {};
    const rounds = Object.keys(keys).length;
    const last = list.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    const wrong = list.reduce((a, l) => a + l.wrong.length, 0);
    const done = (S.get(A.key('mastered'), []) || []).length;
    return { rounds, solved: list.length, last, wrong, done };
  }

  /* ── 시험일 D-day: { 시험id: 'YYYY-MM-DD' } (study.* 라서 로그인하면 계정에 동기화) ── */
  const DDAY = 'study.dday';
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  function dday(id) {
    const v = (S.get(DDAY, {}) || {})[id];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return null;
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    const left = Math.round((date - today()) / 864e5);
    return { value: v, left, text: `${+m[1]}.${+m[2]}.${+m[3]}` };
  }
  function ddayHtml(ex) {
    const d = dday(ex.id);
    const label = !d ? '＋ 시험일 설정' : d.left > 0 ? `<b>D-${d.left}</b> ${d.text}` : d.left === 0 ? `<b>D-DAY</b> 오늘 시험` : `시험일 지남 · 다시 설정`;
    const cls = !d ? ' empty' : d.left < 0 ? ' past' : d.left <= 7 ? ' soon' : '';
    return `<label class="h-dday${cls}" title="시험일을 정하면 남은 날을 보여 줘요">${label}<input type="date" data-dday="${esc(ex.id)}" value="${d ? d.value : ''}" aria-label="${esc(ex.name)} 시험일"></label>`;
  }
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-dday]'); if (!el) return;
    const all = { ...(S.get(DDAY, {}) || {}) };
    if (el.value) all[el.dataset.dday] = el.value; else delete all[el.dataset.dday];
    S.set(DDAY, all); render();
  });
  // 바탕(글자) 부분을 눌러도 날짜 고르기가 열리도록
  document.addEventListener('click', (e) => {
    const lb = e.target.closest('.h-dday'); if (!lb) return;
    const el = lb.querySelector('input'); if (!el || !el.showPicker) return;
    try { el.showPicker(); e.preventDefault(); } catch (err) { /* 지원하지 않으면 기본 동작 */ }
  });

  function render() {
    const u = S.user;
    const cards = window.EXAMS.map((ex) => {
      const s = ex.stats ? null : stats(ex);
      const st = ex.stats ? ex.stats(S) : [[`${s.solved}</b> / ${s.rounds}<b>`, '푼 회차'], [s.last && s.last.score != null ? s.last.score + '점' : '-', s.last ? `최근 ${esc(s.last.round)}회` : '최근 점수'], [s.wrong, '틀린 문항'], [s.done, '외운 문항']];
      const links = ex.links || [{ href: `quiz.html?exam=${ex.id}`, label: '기출 풀기', main: true }, { href: `review.html?exam=${ex.id}`, label: '오답 노트' }].concat(ex.pages || []);
      return `
        <article class="h-card" style="--c:${ex.color}">
          <div class="h-head"><span class="h-mark">${esc(ex.mark)}</span><div><h2>${esc(ex.name)}${ex.level ? ` <small>${esc(ex.level)}</small>` : ''}</h2><p>${esc(ex.desc)}</p></div></div>
          ${ddayHtml(ex)}
          <ul class="h-stats">${st.map(([v, l]) => `<li><b>${v}</b><span>${l}</span></li>`).join('')}</ul>
          <div class="h-links">
            ${links.map((p) => `<a class="h-btn${p.main ? ' main' : ''}" href="${p.href}"${p.note ? ` title="${esc(p.note)}"` : ''}>${esc(p.label)}</a>`).join('')}
          </div>
        </article>`;
    }).join('');

    document.getElementById('home').innerHTML = `
      <section class="h-hero">
        <h2>기출로 시작하는 시험 준비</h2>
        <p>실제 기출 문제를 풀고, 틀린 문제만 모아 다시 보고, 부족한 개념을 정리해요.</p>
        <ol class="h-steps">
          <li><b>기출 풀기</b><span>회차별·과목별로 풀고 바로 채점</span></li>
          <li><b>오답 노트</b><span>틀린 문제와 헷갈린 문제만 다시</span></li>
          <li><b>개념 정리</b><span>자주 나오는 포인트를 모아 암기</span></li>
        </ol>
      </section>
      <section class="h-hello">
        ${u ? `<p><b>${esc(u.name || u.email)}</b>님, 준비 기록이 계정에 저장되고 있어요.</p>`
          : S.configured ? '<p>구글로 로그인하면 풀이 기록·오답·외운 문항이 계정에 저장돼 휴대폰과 컴퓨터에서 이어 볼 수 있어요. 로그인하지 않으면 이 브라우저에만 저장돼요.</p>'
            : '<p>지금은 기록이 이 브라우저에만 저장돼요. (구글 로그인 준비 중)</p>'}
      </section>
      <h2 class="r-h">준비할 시험 선택</h2>
      <div class="h-grid">
        ${cards}
        <article class="h-card h-add">
          <div class="h-head"><span class="h-mark">＋</span><div><h2>다른 시험도 준비 중</h2><p>기출이 공개된 시험부터 기출 풀기·오답 노트를 차례로 추가할 예정이에요.</p></div></div>
        </article>
      </div>`;
  }

  S.onChange(render);
  render();
})();
