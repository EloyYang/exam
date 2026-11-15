/*
 * 이용 기록(로그) — Google 애널리틱스 4. 설정은 js/firebase-config.js 의 window.ANALYTICS, 보는 법은 ANALYTICS.md
 *   - 누가 어디서 왔고(유입), 어떤 시험의 어떤 기능을 쓰고(이용), 끝까지 푸는지(완료)를 본다.
 *   - 이름·이메일·계정 ID·답안 내용은 보내지 않는다. 시험 종류, 회차, 점수 같은 숫자만 보낸다.
 *   - 각 화면 코드를 고치지 않도록, 학습 기록이 저장되는 순간(UserStore.setItem)을 보고 이벤트를 만든다.
 *   - 끄기: 주소 뒤에 ?notrack=1 (다시 켜기 ?notrack=0) 또는 개인정보처리방침의 버튼. 운영자 본인 기기에서 켜 두면 통계가 깨끗해진다.
 *   - 확인: 주소 뒤에 ?track_debug=1 을 붙이면 보내는 이벤트를 콘솔에 찍는다 (window.__trackLog 에도 쌓임).
 */
(function () {
  const A = window.ANALYTICS || {};
  const ID = /^G-[A-Z0-9]{6,}$/.test(A.measurementId || '') ? A.measurementId : '';
  const OFF = 'analytics.off';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } };

  const qs = new URLSearchParams(location.search);
  if (qs.get('notrack') === '1') lsSet(OFF, '1');
  if (qs.get('notrack') === '0') lsSet(OFF, null);
  if (qs.get('track_debug') === '1') { try { sessionStorage.setItem('analytics.debug', '1'); } catch (e) { /* 무시 */ } }
  let debug = false; try { debug = sessionStorage.getItem('analytics.debug') === '1'; } catch (e) { /* 무시 */ }

  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const optedOut = () => lsGet(OFF) === '1';
  // 실제로 보내는 조건: 켜져 있고, 측정 ID가 있고, 방문자가 끄지 않았고, 개발용 주소가 아닐 때
  const live = () => !!(A.enabled !== false && ID && !optedOut() && !local);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  let loaded = false;
  function load() {
    if (loaded || !live()) return; loaded = true;
    gtag('js', new Date());
    gtag('config', ID, {
      send_page_view: false, // 화면 전환(#탭)까지 직접 센다
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }

  /* ---------- 공통 값 ---------- */
  const page = () => (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  // 지금 보고 있는 시험 (처음 화면·방침 등은 빈 값)
  function examId() {
    const p = page();
    if (p === 'fire') return 'fire-' + (qs.get('kind') === 'car' ? 'car' : 'open');
    if (p === 'gtelp') return 'gtelp';
    if (p === 'history' || p === 'typing') return 'history';
    if (p === 'quiz' || p === 'review') return qs.get('exam') || 'history';
    return '';
  }
  const examName = (id) => { const e = (window.EXAMS || []).find((x) => x.id === id); return e ? `${e.name} ${e.level || ''}`.trim() : ''; };
  const screen = () => (location.hash || '').replace(/^#/, '').split(/[/?=]/)[0].slice(0, 40);
  const read = (k, d) => { const v = lsGet(k); if (v == null) return d; try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
  // 시험일까지 남은 날 (처음 화면에서 시험일을 정한 경우만)
  function daysLeft(id) {
    const v = (read('study.dday', {}) || {})[id]; if (!v) return undefined;
    const d = new Date(v + 'T00:00:00'); if (isNaN(d)) return undefined;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  const clean = (o) => { const out = {}; Object.keys(o).forEach((k) => { const v = o[k]; if (v !== undefined && v !== null && v !== '') out[k] = typeof v === 'string' ? v.slice(0, 100) : v; }); return out; };

  const log = (window.__trackLog = window.__trackLog || []);
  function track(name, params) {
    const ex = (params && params.exam) || examId();
    const p = clean(Object.assign({ exam: ex, exam_name: examName(ex), content_group: examName(ex) || '공통', page_name: page(), days_to_exam: daysLeft(ex) }, params || {}));
    log.push([name, p]); if (log.length > 200) log.shift();
    if (debug) console.log('[track]', name, p);
    if (!live()) return;
    load();
    gtag('event', name, p);
  }
  // 한 번 방문(탭)에 한 번만 보내는 이벤트
  function once(key, name, params) {
    const k = 'analytics.once.' + key;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { /* 무시 */ }
    track(name, params);
  }
  window.track = track;

  /* ---------- 화면 보기 ---------- */
  let lastView = '';
  function pageView() {
    const key = location.pathname + location.search + location.hash;
    if (key === lastView) return; lastView = key;
    track('page_view', { page_title: document.title, page_location: location.href.split('?')[0] + (qs.get('kind') ? '?kind=' + qs.get('kind') : qs.get('exam') ? '?exam=' + qs.get('exam') : '') + location.hash, screen: screen() });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pageView); else pageView();
  window.addEventListener('hashchange', pageView);

  /* ---------- 학습 기록 저장 → 이벤트 ---------- */
  const parse = (v) => { if (v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const minutes = (ms) => (ms > 0 ? Math.round(ms / 60000) : undefined);

  function onSave(k, before, after) {
    let m;
    const a = parse(after), b = parse(before);

    // 한국사(khmap.*)와 새 시험(study.<id>.*)의 회차 채점
    if ((m = /^(?:khmap|study\.([\w-]+))\.quizLog$/.exec(k))) {
      const exam = m[1] || 'history';
      arr(a).forEach((x) => {
        if (x.src === 'claude') return;
        const old = arr(b).find((y) => y.round === x.round);
        if (old && JSON.stringify(old) === JSON.stringify(x)) return;
        track('quiz_complete', { exam, quiz_type: exam === 'gtelp' ? 'mock' : 'round', quiz_id: String(x.mock || x.round), score: x.score, wrong_count: arr(x.wrong).length, minutes: x.time || minutes(x.total * 1000), retake: old ? 1 : 0 });
      });
      return;
    }
    if ((m = /^(?:khmap|study\.([\w-]+))\.setLog$/.exec(k))) {
      const exam = m[1] || 'history';
      arr(a).forEach((x) => {
        if (arr(b).some((y) => y.id === x.id && y.date === x.date && y.score === x.score)) return;
        track('quiz_complete', { exam, quiz_type: 'custom_set', quiz_id: String(x.kind || 'set'), score: x.score, max_score: x.max, wrong_count: arr(x.wrong).length, minutes: minutes(x.total * 1000) });
      });
      return;
    }
    if ((m = /^(?:khmap|study\.([\w-]+))\.quizDraft\.(\w+)$/.exec(k))) {
      if (a && !b) track('quiz_start', { exam: m[1] || 'history', quiz_type: /^\d+$/.test(m[2]) ? 'round' : 'custom_set', quiz_id: /^\d+$/.test(m[2]) ? m[2] : 'set' });
      return;
    }
    if ((m = /^(?:khmap|study\.([\w-]+))\.quizSets$/.exec(k))) {
      if (Object.keys(obj(a)).length > Object.keys(obj(b)).length) track('set_create', { exam: m[1] || 'history' });
      return;
    }
    if ((m = /^(?:khmap|study\.([\w-]+))\.mastered$/.exec(k))) {
      if (arr(a).length > arr(b).length) once('mastered.' + (m[1] || 'history'), 'wrong_mastered', { exam: m[1] || 'history' });
      return;
    }
    if ((m = /^(?:khmap|study\.([\w-]+))\.retry$/.exec(k))) { once('retry.' + (m[1] || 'history'), 'practice', { exam: m[1] || 'history', section: 'wrong_retry' }); return; }
    if ((m = /^(?:khmap|study\.([\w-]+))\.(memo|weakMemo|myWeak)(?:\.\w+)?$/.exec(k))) { once('memo.' + (m[1] || 'history'), 'note_write', { exam: m[1] || 'history', section: m[2] }); return; }
    if ((m = /^(?:khmap|study\.([\w-]+))\.flag\.\d+$/.exec(k))) { once('flag.' + (m[1] || 'history'), 'flag_question', { exam: m[1] || 'history' }); return; }

    // 소방공무원
    if ((m = /^study\.fire\.draft\.(open|car)$/.exec(k))) {
      if (a && !b) track('quiz_start', { exam: 'fire-' + m[1], quiz_type: 'past_exam', quiz_id: a.title, question_count: arr(a.keys).length });
      return;
    }
    if (k === 'study.fire.log') {
      // 최근 80개만 남기므로 길이가 아니라 마지막 기록이 바뀌었는지로 본다 (기록 지우기는 길이가 줄어든다)
      if (arr(a).length && arr(a).length >= arr(b).length && JSON.stringify(arr(a).slice(-1)) !== JSON.stringify(arr(b).slice(-1))) {
        const x = arr(a)[arr(a).length - 1];
        track('quiz_complete', { exam: 'fire-' + (x.kind === 'car' ? 'car' : 'open'), quiz_type: 'past_exam', quiz_id: x.title, score: x.score, question_count: x.total, wrong_count: x.total - x.correct, minutes: x.min });
      }
      return;
    }
    if (k === 'study.fire.flags') { once('flag.fire', 'flag_question', {}); return; }

    // 지텔프
    if (k === 'study.gtelp.mockDraft') { if (a && !b) track('quiz_start', { exam: 'gtelp', quiz_type: 'mock', quiz_id: String(a.id) }); return; }
    if (k === 'study.gtelp.plan') { if (a && a.start) track('plan_start', { exam: 'gtelp' }); return; }
    if (k === 'study.gtelp.grammar') { if (Object.keys(obj(a)).length > Object.keys(obj(b)).length) once('gt.grammar', 'practice', { exam: 'gtelp', section: 'grammar' }); return; }
    if (k === 'study.gtelp.vocab') { once('gt.vocab', 'practice', { exam: 'gtelp', section: 'vocab' }); return; }
    if ((m = /^study\.gtelp\.(reading|listening)$/.exec(k))) {
      Object.keys(obj(a)).forEach((id) => {
        if (JSON.stringify(obj(b)[id]) === JSON.stringify(a[id])) return;
        track('passage_complete', { exam: 'gtelp', section: m[1], quiz_id: String(id), score: a[id] && a[id].score });
      });
      return;
    }
    if (k === 'study.gtelp.flags') { once('flag.gtelp', 'flag_question', { exam: 'gtelp' }); return; }

    // 타자 연습
    if (k === 'study.typing.rec') { once('typing', 'practice', { exam: 'history', section: 'typing' }); return; }

    // 시험일(D-day)
    if (k === 'study.dday') {
      Object.keys(obj(a)).forEach((id) => { if (obj(b)[id] !== a[id]) track('dday_set', { exam: id, days_to_exam: daysLeft(id) }); });
    }
  }

  const S = window.UserStore;
  if (S && !S._tracked) {
    S._tracked = true;
    const set = S.setItem;
    S.setItem = function (k, v) {
      const before = lsGet(k);
      const r = set.apply(this, arguments);
      try { if (before !== v) onSave(k, before, v); } catch (e) { if (debug) console.warn('[track] 실패', k, e); }
      return r;
    };
    // 로그인 여부 (계정 정보는 보내지 않는다)
    let signed = null;
    S.onChange((type) => {
      if (type !== 'auth' && type !== 'sync') return;
      const now = !!S.user; if (now === signed) return; signed = now;
      if (live()) { load(); gtag('set', 'user_properties', { signed_in: now ? 'yes' : 'no' }); }
    });
  }

  /* ---------- 오류 (어디서 깨지는지) ---------- */
  let errs = 0;
  window.addEventListener('error', (e) => {
    if (!e || !e.message || errs >= 3) return; errs++;
    track('js_error', { message: String(e.message).slice(0, 100), source: String(e.filename || '').split('/').slice(-2).join('/') + ':' + (e.lineno || 0) });
  });

  /* ---------- 방문자가 직접 끄기 (개인정보처리방침의 버튼) ---------- */
  function paintToggle() {
    document.querySelectorAll('[data-analytics-toggle]').forEach((b) => {
      b.textContent = optedOut() ? '이용 기록 수집 다시 켜기' : '이 브라우저에서 이용 기록 수집 끄기';
      const st = document.querySelector('[data-analytics-state]');
      if (st) st.textContent = optedOut() ? '지금은 이 브라우저의 이용 기록을 보내지 않고 있어요.' : '';
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-analytics-toggle]'); if (!b) return;
    lsSet(OFF, optedOut() ? null : '1');
    if (ID) window['ga-disable-' + ID] = optedOut();
    paintToggle();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintToggle); else paintToggle();
  if (ID && optedOut()) window['ga-disable-' + ID] = true;

  window.Analytics = { track, live, id: ID };
})();
