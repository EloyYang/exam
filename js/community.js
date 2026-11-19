/*
 * 스터디 라운지 — 시험별 게시판·댓글·실시간 채팅 (Firestore)
 *   community/{exam}/posts/{id}               { uid, name, cat, title, body, t, nc }
 *   community/{exam}/posts/{id}/comments/{id} { uid, name, body, t }
 *   community/{exam}/chat/{id}                { uid, name, text, t }
 *   profiles/{uid}                            { name, t }        내 닉네임 (글·댓글·채팅에 쓰임)
 *   nicknames/{소문자 닉네임}                  { uid, name, t }   닉네임 중복 방지용 예약
 *   reports/{id}                              { uid, path, why, t }
 *   권한은 firestore.rules. 관리자는 admins/{uid} 문서가 있는 계정.
 */
(function () {
  const EXAMS = { history: '한능검', fire: '소방', gtelp: '지텔프' };
  const CATS = ['질문', '정보', '스터디 모집', '합격 후기', '잡담'];
  const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
  const RESERVED = ['관리자', '운영자', 'admin', '시험준비노트', '스터디라운지'];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);
  let exam = EXAMS[qs.get('exam')] ? qs.get('exam') : (localStorage.getItem('cm.exam') || 'history');
  let tab = qs.get('tab') === 'chat' ? 'chat' : 'board';
  let cat = '전체';
  let FB, me = null, myName = null, profileLoaded = false, isAdmin = false;
  let unsubChat = null, unsubBoard = null, unsubProfile = null, posts = [];

  /* ── 표시 도우미 ── */
  const pad = (n) => String(n).padStart(2, '0');
  const toDate = (ts) => (ts && ts.toDate ? ts.toDate() : new Date());
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function shortTime(ts) { // 목록: 오늘이면 시:분, 올해면 월.일
    const d = toDate(ts), now = new Date(), s = (now - d) / 1000;
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (sameDay(d, now)) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  const fullTime = (ts) => { const d = toDate(ts); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const clock = (ts) => { const d = toDate(ts), h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`; };
  const dayLabel = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
  const isNew = (ts) => ts && ts.toDate && Date.now() - ts.toDate() < 864e5;
  function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  const avatar = (name, uid, cls = '') => `<span class="cm-av ${cls}" style="--h:${hue(uid || name)}" aria-hidden="true">${esc(String(name || '?').slice(0, 1))}</span>`;
  const catTag = (c) => `<span class="cm-cat" data-c="${esc(c)}">${esc(c)}</span>`;

  const col = (...p) => FB.F.collection(FB.db, 'community', exam, ...p);
  const canDel = (x) => me && (x.uid === me.uid || isAdmin);

  /* ── 닉네임 ── */
  function renderMe() {
    const el = $('#cm-me');
    if (!FB) { el.innerHTML = ''; return; }
    if (!me) {
      el.innerHTML = `<div class="cm-me-txt">읽기는 누구나 할 수 있어요. 글쓰기·댓글·채팅은 오른쪽 위 <b>Google 로그인</b> 뒤에 닉네임을 정하면 할 수 있어요.</div>`;
      return;
    }
    if (!profileLoaded) { el.innerHTML = '<div class="cm-me-txt">닉네임 확인 중…</div>'; return; }
    el.innerHTML = myName
      ? `${avatar(myName, me.uid)}<div class="cm-me-txt"><b>${esc(myName)}</b><small>스터디 라운지 닉네임</small></div><button type="button" class="cm-btn ghost" data-act="nick">닉네임 변경</button>`
      : `<div class="cm-me-txt"><b>닉네임을 정해 주세요</b><small>글·댓글·채팅에는 닉네임만 보여요. 이메일·실명은 공개되지 않아요.</small></div><button type="button" class="cm-btn" data-act="nick">닉네임 정하기</button>`;
  }
  function openNick() {
    if (!me) { alert('먼저 오른쪽 위 Google 로그인을 해 주세요.'); return; }
    const dlg = $('#cm-nick'), f = $('form', dlg);
    f.nick.value = myName || localStorage.getItem('cm.nick') || '';
    $('.cm-nick-err', dlg).textContent = '';
    $('h2', dlg).textContent = myName ? '닉네임 변경' : '닉네임 정하기';
    dlg.showModal(); f.nick.focus(); f.nick.select();
  }
  function needNick() { if (myName) return true; openNick(); return false; }
  async function saveNick(n) {
    const { F, db } = FB;
    if (!NICK_RE.test(n)) throw new Error('한글·영문·숫자·밑줄(_)로 2~12자만 쓸 수 있어요.');
    if (RESERVED.includes(n.toLowerCase())) throw new Error('쓸 수 없는 닉네임이에요.');
    if (n === myName) return;
    const key = n.toLowerCase(), ref = F.doc(db, 'nicknames', key);
    const s = await F.getDoc(ref);
    if (s.exists() && s.data().uid !== me.uid) throw new Error('이미 다른 분이 쓰고 있는 닉네임이에요.');
    const b = F.writeBatch(db);
    if (myName && myName.toLowerCase() !== key) b.delete(F.doc(db, 'nicknames', myName.toLowerCase()));
    b.set(ref, { uid: me.uid, name: n, t: F.serverTimestamp() });
    b.set(F.doc(db, 'profiles', me.uid), { name: n, t: F.serverTimestamp() });
    await b.commit();
    localStorage.setItem('cm.nick', n);
    if (window.track) window.track('community_nick');
  }
  function watchProfile() {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    myName = null; profileLoaded = !me;
    if (!me) return;
    const { F, db } = FB;
    unsubProfile = F.onSnapshot(F.doc(db, 'profiles', me.uid), (s) => {
      const first = !profileLoaded;
      myName = s.exists() ? s.data().name : null; profileLoaded = true;
      renderMe(); setUI();
      if (first && location.hash === '#nick') { history.replaceState(null, '', location.pathname + location.search); openNick(); }
      if (tab === 'board') rerenderBoardBits(); else $('#cm-chat-form').hidden = !myName;
    }, () => { profileLoaded = true; renderMe(); });
  }

  function setUI() {
    document.querySelectorAll('.cm-exams button').forEach((b) => b.classList.toggle('on', b.dataset.exam === exam));
    document.querySelectorAll('.cm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#cm-board').hidden = tab !== 'board'; $('#cm-chat').hidden = tab !== 'chat';
    $('#cm-chat-title').textContent = `${EXAMS[exam]} 채팅방`;
    $('#cm-chat-form').hidden = !(me && myName);
    $('#cm-chat-hint').hidden = !!(me && myName);
    $('#cm-chat-hint').innerHTML = !me ? '채팅은 로그인 후 할 수 있어요.' : profileLoaded ? '<button type="button" class="cm-link" data-act="nick">닉네임을 정하면</button> 채팅에 참여할 수 있어요.' : '';
    const h = location.hash === '#nick' ? '' : location.hash;
    history.replaceState(null, '', `?exam=${exam}${tab === 'chat' ? '&tab=chat' : ''}${h}`);
    localStorage.setItem('cm.exam', exam);
  }

  /* ── 게시판: 목록 ── */
  function listRows() {
    const rows = cat === '전체' ? posts : posts.filter((p) => p.cat === cat);
    if (!rows.length) return `<li class="cm-empty">${posts.length ? `'${esc(cat)}' 말머리 글이 아직 없어요.` : `아직 글이 없어요. ${EXAMS[exam]} 준비하는 분들께 첫 인사를 남겨 보세요!`}</li>`;
    return rows.map((x) => `<li><a class="cm-row" href="#post=${x.id}">
      <span class="cm-row-cat">${catTag(x.cat)}</span>
      <span class="cm-row-title"><span class="cm-title-txt">${esc(x.title)}</span>${x.nc ? `<b class="cm-nc">[${x.nc}]</b>` : ''}${isNew(x.t) ? '<i class="cm-newb">N</i>' : ''}</span>
      <span class="cm-row-name">${esc(x.name)}</span>
      <span class="cm-row-time">${shortTime(x.t)}</span>
    </a></li>`).join('');
  }
  function listBoard() {
    if (unsubBoard) unsubBoard();
    const el = $('#cm-board');
    el.innerHTML = `<div class="cm-board-head">
        <div class="cm-cats">${['전체', ...CATS].map((c) => `<button type="button" data-cat="${c}" class="${c === cat ? 'on' : ''}">${c}</button>`).join('')}</div>
        <button type="button" class="cm-btn cm-write" data-act="write">✏️ 글쓰기</button>
      </div>
      <div class="cm-table"><div class="cm-thead" aria-hidden="true"><span>말머리</span><span>제목</span><span>글쓴이</span><span>작성일</span></div>
      <ul class="cm-list"><li class="cm-empty">불러오는 중…</li></ul></div>`;
    const { F } = FB;
    unsubBoard = F.onSnapshot(F.query(col('posts'), F.orderBy('t', 'desc'), F.limit(100)), (snap) => {
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const ul = $('.cm-list', el); if (ul) ul.innerHTML = listRows();
    }, (e) => { const ul = $('.cm-list', el); if (ul) ul.innerHTML = `<li class="cm-empty">불러오지 못했어요 (${esc(e.code || e.message)})</li>`; });
  }

  /* ── 게시판: 글쓰기 ── */
  function writeForm() {
    if (unsubBoard) { unsubBoard(); unsubBoard = null; }
    $('#cm-board').innerHTML = `<form class="cm-card cm-form">
      <div class="cm-card-head"><h2>${EXAMS[exam]} 게시판 글쓰기</h2><span class="cm-by">${avatar(myName, me.uid, 'sm')}${esc(myName)}</span></div>
      <div class="cm-form-row"><select name="cat" aria-label="말머리">${CATS.map((c) => `<option${c === cat ? ' selected' : ''}>${c}</option>`).join('')}</select>
      <input name="title" maxlength="100" placeholder="제목을 입력하세요" required></div>
      <textarea name="body" maxlength="5000" rows="14" placeholder="내용을 입력하세요 (5000자까지)&#10;&#10;욕설·광고·개인정보·문제 유출 글은 지워질 수 있어요." required></textarea>
      <div class="cm-actions"><a class="cm-btn ghost" href="#">취소</a><button class="cm-btn">등록</button></div></form>`;
    $('#cm-board input[name=title]').focus();
  }

  /* ── 게시판: 글 보기 ── */
  let curPost = null;
  function commentForm() {
    if (!me) return '<p class="cm-cmt-login">댓글은 로그인 후 쓸 수 있어요.</p>';
    if (!myName) return '<p class="cm-cmt-login"><button type="button" class="cm-link" data-act="nick">닉네임을 정하면</button> 댓글을 쓸 수 있어요.</p>';
    return `<form class="cm-cform" data-post="${curPost.id}"><div class="cm-cform-who">${esc(myName)}</div>
      <textarea name="body" maxlength="1000" rows="3" placeholder="댓글을 남겨 보세요" required></textarea>
      <div class="cm-cform-foot"><button class="cm-btn sm">등록</button></div></form>`;
  }
  async function showPost(id) {
    if (unsubBoard) { unsubBoard(); unsubBoard = null; }
    const { F } = FB, el = $('#cm-board');
    const ref = F.doc(FB.db, 'community', exam, 'posts', id);
    el.innerHTML = '<p class="cm-empty">불러오는 중…</p>';
    const s = await F.getDoc(ref).catch(() => null);
    if (!s || !s.exists()) { el.innerHTML = '<div class="cm-card"><p class="cm-empty">지워졌거나 없는 글이에요.</p><a class="cm-btn ghost" href="#">목록으로</a></div>'; return; }
    const x = curPost = { id, ...s.data() };
    el.innerHTML = `<article class="cm-card cm-post">
        <p class="cm-crumb">${EXAMS[exam]} 게시판 › ${esc(x.cat)}</p>
        <h2 class="cm-post-title">${catTag(x.cat)} ${esc(x.title)}</h2>
        <div class="cm-author">${avatar(x.name, x.uid)}<div><b>${esc(x.name)}</b><small>${fullTime(x.t)}</small></div><span class="cm-author-nc">댓글 <b class="cm-ncount">${x.nc || 0}</b></span></div>
        <div class="cm-body">${esc(x.body)}</div>
        <div class="cm-post-tools">
          <a class="cm-btn ghost sm" href="#">목록</a>
          <span class="cm-grow"></span>
          ${me && x.uid !== me.uid ? `<button type="button" class="cm-txtbtn cm-report" data-path="${ref.path}">신고</button>` : ''}
          ${canDel(x) ? `<button type="button" class="cm-txtbtn cm-del" data-path="${ref.path}">삭제</button>` : ''}
        </div>
      </article>
      <section class="cm-card cm-cmts"><h3>댓글 <b class="cm-ncount">${x.nc || 0}</b></h3><ul class="cm-comments"></ul><div class="cm-cform-slot">${commentForm()}</div></section>`;
    unsubBoard = F.onSnapshot(F.query(F.collection(ref, 'comments'), F.orderBy('t')), (snap) => {
      const ul = $('.cm-comments', el); if (!ul) return;
      el.querySelectorAll('.cm-ncount').forEach((b) => { b.textContent = snap.size; });
      ul.innerHTML = snap.docs.map((d) => { const c = d.data(); return `<li>${avatar(c.name, c.uid, 'sm')}<div class="cm-cmt">
          <div class="cm-cmt-head"><b>${esc(c.name)}</b>${c.uid === x.uid ? '<span class="cm-op">작성자</span>' : ''}</div>
          <p>${esc(c.body)}</p>
          <div class="cm-cmt-foot"><span>${fullTime(c.t)}</span>${me && c.uid !== me.uid ? `<button type="button" class="cm-txtbtn cm-report" data-path="${d.ref.path}">신고</button>` : ''}${canDel(c) ? `<button type="button" class="cm-txtbtn cm-del" data-path="${d.ref.path}">삭제</button>` : ''}</div>
        </div></li>`; }).join('') || '<li class="cm-empty">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</li>';
    });
  }
  function rerenderBoardBits() { // 닉네임이 바뀌거나 처음 정해졌을 때
    const slot = $('.cm-cform-slot'); if (slot && curPost) slot.innerHTML = commentForm();
    if (location.hash === '#write' && myName && !$('.cm-form')) writeForm();
  }
  function route() {
    curPost = null;
    const m = location.hash.match(/^#post=([\w-]+)$/);
    if (location.hash === '#write' && me && myName) writeForm(); else if (m) showPost(m[1]); else listBoard();
  }

  /* ── 채팅 ── */
  function chatHTML(docs) {
    let out = '', prev = null;
    docs.forEach((d, i) => {
      const x = d.data(), dt = toDate(x.t), next = docs[i + 1] && docs[i + 1].data();
      const mine = me && x.uid === me.uid;
      if (!prev || !sameDay(toDate(prev.t), dt)) out += `<div class="cm-day"><span>${dayLabel(dt)}</span></div>`;
      const first = !prev || prev.uid !== x.uid || !sameDay(toDate(prev.t), dt) || dt - toDate(prev.t) > 5 * 60e3;
      const last = !next || next.uid !== x.uid || clock(next.t) !== clock(x.t);
      const del = canDel(x) ? `<button type="button" class="cm-msg-del cm-del" data-path="${d.ref.path}" title="지우기">×</button>` : '';
      out += `<div class="cm-msg${mine ? ' me' : ''}${first ? ' first' : ''}">
        ${mine ? '' : first ? avatar(x.name, x.uid) : '<span class="cm-av-gap"></span>'}
        <div class="cm-msg-col">${!mine && first ? `<span class="cm-msg-name">${esc(x.name)}</span>` : ''}
          <div class="cm-msg-line"><p>${esc(x.text)}</p><span class="cm-msg-meta">${del}${last ? `<time>${clock(x.t)}</time>` : ''}</span></div>
        </div></div>`;
      prev = x;
    });
    return out;
  }
  function startChat() {
    if (unsubChat) return;
    const { F } = FB, box = $('#cm-msgs');
    box.innerHTML = '<p class="cm-empty">불러오는 중…</p>';
    unsubChat = F.onSnapshot(F.query(col('chat'), F.orderBy('t', 'desc'), F.limit(100)), (snap) => {
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      const docs = snap.docs.slice().reverse();
      box.innerHTML = docs.length ? chatHTML(docs) : `<p class="cm-empty">${EXAMS[exam]} 채팅방이에요. 먼저 인사해 보세요 👋</p>`;
      if (near || snap.docChanges().length === snap.size || snap.docChanges().some((c) => c.type === 'added' && me && c.doc.data().uid === me.uid)) box.scrollTop = box.scrollHeight;
    });
  }
  function stopChat() { if (unsubChat) { unsubChat(); unsubChat = null; } }

  function refresh() {
    setUI(); stopChat();
    if (tab === 'chat') startChat(); else { if (unsubBoard) { unsubBoard(); unsubBoard = null; } route(); }
  }

  /* ── 이벤트 ── */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b || !FB) return;
    const { F } = FB;
    if (b.dataset.act === 'nick') { openNick(); return; }
    if (b.dataset.act === 'nick-cancel') { $('#cm-nick').close(); return; }
    if (b.dataset.exam) { exam = b.dataset.exam; history.replaceState(null, '', location.pathname + location.search); refresh(); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; refresh(); return; }
    if (b.dataset.cat) { cat = b.dataset.cat; document.querySelectorAll('.cm-cats button').forEach((x) => x.classList.toggle('on', x === b)); const ul = $('.cm-list'); if (ul) ul.innerHTML = listRows(); return; }
    if (b.dataset.act === 'write') {
      if (!me) { alert('글쓰기는 오른쪽 위 Google 로그인 뒤에 할 수 있어요.'); return; }
      if (needNick()) location.hash = '#write';
      return;
    }
    if (b.classList.contains('cm-del')) {
      if (!confirm('지울까요? 되돌릴 수 없어요.')) return;
      await F.deleteDoc(F.doc(FB.db, b.dataset.path)).catch((err) => alert('지우지 못했어요: ' + err.code));
      if (/\/posts\/[^/]+$/.test(b.dataset.path)) location.hash = '';
      return;
    }
    if (b.classList.contains('cm-report')) {
      const why = prompt('신고 이유를 짧게 적어 주세요 (욕설·광고·개인정보 등)'); if (!why) return;
      await F.addDoc(F.collection(FB.db, 'reports'), { uid: me.uid, path: b.dataset.path, why: why.slice(0, 200), t: F.serverTimestamp() })
        .then(() => alert('신고했어요. 확인 후 조치할게요.')).catch((err) => alert('신고하지 못했어요: ' + err.code));
    }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (!f.closest('#cm')) return;
    e.preventDefault(); if (!FB || !me) return;
    const { F } = FB, btn = f.querySelector('button:not([type=button])');
    if (f.id === 'cm-nick-form') {
      const err = $('.cm-nick-err'); err.textContent = ''; btn.disabled = true;
      try { await saveNick(f.nick.value.trim()); $('#cm-nick').close(); }
      catch (x) { err.textContent = x.code ? '저장하지 못했어요 (' + x.code + ')' : x.message; }
      finally { btn.disabled = false; }
      return;
    }
    if (!needNick()) return;
    const name = myName;
    btn.disabled = true;
    try {
      if (f.classList.contains('cm-form')) {
        const r = await F.addDoc(col('posts'), { uid: me.uid, name, cat: f.cat.value, title: f.title.value.trim(), body: f.body.value.trim(), t: F.serverTimestamp(), nc: 0 });
        if (window.track) window.track('community_post', { exam });
        location.hash = '#post=' + r.id;
      } else if (f.classList.contains('cm-cform')) {
        const pref = F.doc(FB.db, 'community', exam, 'posts', f.dataset.post);
        await F.addDoc(F.collection(pref, 'comments'), { uid: me.uid, name, body: f.body.value.trim(), t: F.serverTimestamp() });
        await F.updateDoc(pref, { nc: F.increment(1) }).catch(() => {});
        f.reset();
      } else if (f.id === 'cm-chat-form') {
        const text = f.text.value.trim(); if (!text) return;
        f.text.value = '';
        await F.addDoc(col('chat'), { uid: me.uid, name, text, t: F.serverTimestamp() });
        if (window.track) window.track('community_chat', { exam });
      }
    } catch (err) { alert('올리지 못했어요: ' + (err.code || err.message)); }
    finally { btn.disabled = false; if (f.id === 'cm-chat-form') f.text.focus(); }
  });
  // 채팅 입력: Enter 보내기, Shift+Enter 줄바꿈
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('#cm-chat-form textarea') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); }
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#nick') { history.replaceState(null, '', location.pathname + location.search); openNick(); return; }
    if (tab === 'board') { if (unsubBoard) { unsubBoard(); unsubBoard = null; } route(); }
  });

  document.addEventListener('fb-ready', () => {
    FB = window.FB;
    FB.A.onAuthStateChanged(FB.auth, async (u) => {
      me = u ? { uid: u.uid } : null; isAdmin = false;
      if (u) isAdmin = await FB.F.getDoc(FB.F.doc(FB.db, 'admins', u.uid)).then((s) => s.exists()).catch(() => false);
      watchProfile(); renderMe();
      refresh();
    });
  });
})();
