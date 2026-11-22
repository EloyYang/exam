/*
 * 스터디 라운지 — 시험별 게시판·채팅, 친구, 스터디 그룹(단체톡·그룹 게시판) (Firestore)
 *   community/{exam}/posts/{id}(/comments/{id}), community/{exam}/chat/{id}
 *   profiles/{uid}           { name, t, exam }   내 닉네임 · 지금 준비하는 시험(랜덤 추천용)
 *   nicknames/{소문자 닉네임}  { uid, name, t }    닉네임 중복 방지
 *   friendReqs/{from_to}     { from, to, fromName, toName, t }
 *   friends/{작은uid_큰uid}   { uids, names, t }
 *   groups/{gid}             { name, desc, exam, open, owner, members, names, max, t }
 *   groups/{gid}/chat, groups/{gid}/posts(/comments)  멤버만 읽고 쓴다
 *   groupInvites/{gid_uid}   { gid, uid, from, fromName, gname, exam, t }
 *   reports/{id}             { uid, path, why, t }
 *   권한은 firestore.rules. 관리자는 admins/{uid} 문서가 있는 계정.
 */
(function () {
  const EXAMS = { history: '한능검', fire: '소방', gtelp: '지텔프' };
  const CATS = ['질문', '정보', '스터디 모집', '합격 후기', '잡담'];
  const GCATS = ['자유', '공지', '질문', '자료'];
  const TABS = ['board', 'chat', 'groups', 'friends'];
  const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
  const RESERVED = ['관리자', '운영자', 'admin', '시험준비노트', '스터디라운지'];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);
  let exam = EXAMS[qs.get('exam')] ? qs.get('exam') : (localStorage.getItem('cm.exam') || 'history');
  if (!EXAMS[exam]) exam = 'history';
  let tab = TABS.includes(qs.get('tab')) ? qs.get('tab') : 'board';
  let FB, me = null, myName = null, myExam = null, profileLoaded = false, isAdmin = false, unsubProfile = null;
  let view = [], viewTok = 0, soc = [];
  const S = { friends: [], reqIn: [], reqOut: [], invites: [], groups: [] };
  const G = {};
  let curGroup = null, openGroups = [], found = null;
  let canDel = () => false;

  /* ── 표시 도우미 ── */
  const pad = (n) => String(n).padStart(2, '0');
  const toDate = (ts) => (ts && ts.toDate ? ts.toDate() : new Date());
  const tms = (ts) => (ts && ts.toMillis ? ts.toMillis() : Date.now());
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function shortTime(ts) {
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
  // 캐릭터·레벨은 일단 글자·빈칸으로 그려 두고, fillProfiles() 가 profiles/{uid} 의 av·lv 로 채운다
  const avatar = (name, uid, cls = '') => `<span class="cm-av ${cls}" data-avu="${uid || ''}" style="--h:${hue(uid || name)}" aria-hidden="true">${esc(String(name || '?').slice(0, 1))}</span>`;
  const lvTag = (uid) => (uid ? `<span class="cm-lv" data-lvu="${uid}"></span>` : '');
  const catTag = (c) => `<span class="cm-cat" data-c="${esc(c)}">${esc(c)}</span>`;
  const box = (html) => `<div class="cm-card cm-center">${html}</div>`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pairId = (a, b) => [a, b].sort().join('_');
  const D = (p) => FB.F.doc(FB.db, p);
  const C = (p) => FB.F.collection(FB.db, p);
  const clearView = () => { view.forEach((f) => f()); view = []; viewTok++; };
  const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

  /* ── 닉네임 ── */
  function renderMe() {
    const el = $('#cm-me');
    if (!FB) { el.innerHTML = ''; return; }
    if (!me) { el.innerHTML = '<div class="cm-me-txt">읽기는 누구나 할 수 있어요. 글쓰기·채팅·친구·스터디 그룹은 오른쪽 위 <b>Google 로그인</b> 뒤에 닉네임을 정하면 쓸 수 있어요.</div>'; return; }
    if (!profileLoaded) { el.innerHTML = '<div class="cm-me-txt">닉네임 확인 중…</div>'; return; }
    el.innerHTML = myName
      ? `${avatar(myName, me.uid)}<div class="cm-me-txt"><b>${esc(myName)} ${lvTag(me.uid)}</b><small>스터디 라운지 닉네임 · 캐릭터와 레벨이 글·채팅에 함께 보여요</small></div><a class="cm-btn ghost sm" href="character.html">🎨 캐릭터</a><button type="button" class="cm-btn ghost sm" data-act="nick">닉네임 변경</button>`
      : '<div class="cm-me-txt"><b>닉네임을 정해 주세요</b><small>글·댓글·채팅·친구 목록에는 닉네임만 보여요. 이메일·실명은 공개되지 않아요.</small></div><button type="button" class="cm-btn" data-act="nick">닉네임 정하기</button>';
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
  function needLogin() { if (!me) { alert('먼저 오른쪽 위 Google 로그인을 해 주세요.'); return false; } return needNick(); }
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
    b.set(F.doc(db, 'profiles', me.uid), { name: n, t: F.serverTimestamp(), exam }, { merge: true });
    await b.commit();
    localStorage.setItem('cm.nick', n);
    if (window.track) window.track('community_nick');
  }
  function watchProfile() {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    myName = null; myExam = null; profileLoaded = !me;
    if (!me) return;
    unsubProfile = FB.F.onSnapshot(D('profiles/' + me.uid), (s) => {
      const first = !profileLoaded, had = !!myName, d = s.exists() ? s.data() : {};
      myName = d.name || null; myExam = d.exam || null; profileLoaded = true;
      renderMe();
      if (first && location.hash === '#nick') { clearHash(); openNick(); }
      if (first || had !== !!myName) render();
      syncExam();
    }, () => { profileLoaded = true; renderMe(); });
  }
  // 랜덤 친구 추천에 쓰도록 지금 보고 있는 시험을 프로필에 적어 둔다
  function syncExam() {
    if (me && myName && myExam !== exam) FB.F.setDoc(D('profiles/' + me.uid), { exam, t: FB.F.serverTimestamp() }, { merge: true }).catch(() => {});
  }

  /* ── 친구·초대 실시간 목록 ── */
  function watchSocial() {
    soc.forEach((f) => f()); soc = [];
    Object.assign(S, { friends: [], reqIn: [], reqOut: [], invites: [], groups: [] });
    if (!me) { drawSocial(); return; }
    const { F } = FB;
    const on = (q, k) => soc.push(F.onSnapshot(q, (s) => {
      S[k] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (k === 'groups') S.groups.forEach((g) => { G[g.id] = g; });
      drawSocial();
    }, () => {}));
    on(F.query(C('friends'), F.where('uids', 'array-contains', me.uid)), 'friends');
    on(F.query(C('friendReqs'), F.where('to', '==', me.uid)), 'reqIn');
    on(F.query(C('friendReqs'), F.where('from', '==', me.uid)), 'reqOut');
    on(F.query(C('groupInvites'), F.where('uid', '==', me.uid)), 'invites');
    on(F.query(C('groups'), F.where('members', 'array-contains', me.uid)), 'groups');
  }
  const other = (f) => f.uids.find((u) => u !== me.uid);
  const friendList = () => S.friends.map((f) => ({ id: f.id, uid: other(f), name: f.names[other(f)] })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  function rel(uid) {
    if (!me) return 'none';
    if (uid === me.uid) return 'me';
    if (S.friends.some((f) => f.uids.includes(uid))) return 'friend';
    if (S.reqIn.some((r) => r.from === uid)) return 'in';
    if (S.reqOut.some((r) => r.to === uid)) return 'out';
    return 'none';
  }
  function relBtn(uid, name) {
    switch (rel(uid)) {
      case 'me': return '<span class="cm-tag">나</span>';
      case 'friend': return '<span class="cm-tag">친구</span>';
      case 'out': return '<span class="cm-tag">신청함</span>';
      case 'in': return `<button type="button" class="cm-btn sm" data-act="accept-req" data-id="${uid}_${me.uid}">수락</button>`;
      default: return `<button type="button" class="cm-btn sm" data-act="friend-req" data-uid="${uid}" data-name="${esc(name)}">친구 신청</button>`;
    }
  }
  const person = (uid, name, tags, actions) => `<li class="cm-person">${avatar(name, uid)}<span class="cm-pname"><b>${esc(name)}</b>${lvTag(uid)}${tags || ''}</span><span class="cm-pact">${actions || ''}</span></li>`;
  const examTag = (e) => (EXAMS[e] ? `<span class="cm-tag soft">${EXAMS[e]}</span>` : '');
  function badge(t, n) { const b = $(`.cm-tabs [data-tab="${t}"] .cm-badge`); if (b) { b.textContent = n || ''; b.hidden = !n; } }

  function drawSocial() {
    const reqIn = S.reqIn.filter((r) => rel(r.from) !== 'friend');
    badge('friends', reqIn.length); badge('groups', S.invites.length);
    let x;
    if ((x = $('#cm-invites'))) {
      $('#cm-inv-sec').hidden = !S.invites.length;
      x.innerHTML = S.invites.map((i) => `<div class="cm-gcard"><span class="cm-gicon" style="--h:${hue(i.gid)}">${esc(i.gname.slice(0, 1))}</span>
        <span class="cm-ginfo"><b>${esc(i.gname)}</b><small>${esc(i.fromName)}님이 초대했어요 · ${EXAMS[i.exam] || ''}</small></span>
        <span class="cm-gbtns"><button type="button" class="cm-btn sm" data-act="join" data-gid="${i.gid}">참여</button><button type="button" class="cm-btn ghost sm" data-act="decline-inv" data-id="${i.id}">거절</button></span></div>`).join('');
    }
    if ((x = $('#cm-mygroups'))) {
      x.innerHTML = S.groups.length ? S.groups.slice().sort((a, b) => tms(b.t) - tms(a.t)).map(groupCard).join('')
        : '<p class="cm-empty">아직 참여한 그룹이 없어요. 아래 공개 그룹에 참여하거나 새로 만들어 보세요.</p>';
    }
    if ((x = $('#cm-reqin'))) {
      $('#cm-reqin-sec').hidden = !reqIn.length;
      x.innerHTML = reqIn.map((r) => person(r.from, r.fromName, '<small>님이 친구 신청을 보냈어요</small>',
        `<button type="button" class="cm-btn sm" data-act="accept-req" data-id="${r.id}">수락</button><button type="button" class="cm-btn ghost sm" data-act="del-req" data-id="${r.id}">거절</button>`)).join('');
    }
    if ((x = $('#cm-reqout'))) {
      const out = S.reqOut.filter((r) => rel(r.to) !== 'friend');
      $('#cm-reqout-sec').hidden = !out.length;
      x.innerHTML = out.map((r) => person(r.to, r.toName, '<small>수락을 기다리는 중</small>', `<button type="button" class="cm-txtbtn" data-act="del-req" data-id="${r.id}">취소</button>`)).join('');
    }
    if ((x = $('#cm-friends'))) {
      const fl = friendList();
      $('#cm-fcount').textContent = fl.length || '';
      x.innerHTML = fl.length ? fl.map((f) => person(f.uid, f.name, '', `<button type="button" class="cm-txtbtn" data-act="unfriend" data-id="${f.id}" data-name="${esc(f.name)}">삭제</button>`)).join('')
        : '<li class="cm-empty">아직 친구가 없어요. 닉네임으로 찾거나 랜덤 추천을 받아 보세요.</li>';
    }
    if ((x = $('#cm-found')) && found) x.innerHTML = foundHTML();
    if ((x = $('#cm-ginv')) && curGroup) x.innerHTML = ginvHTML(curGroup);
  }

  /* ── 탭·화면 ── */
  function setUI() {
    document.querySelectorAll('.cm-exams button').forEach((b) => b.classList.toggle('on', b.dataset.exam === exam));
    document.querySelectorAll('.cm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const h = location.hash === '#nick' ? '' : location.hash;
    history.replaceState(null, '', `?exam=${exam}${tab !== 'board' ? '&tab=' + tab : ''}${h}`);
    localStorage.setItem('cm.exam', exam);
  }
  function render() {
    if (!FB) return;
    setUI(); clearView(); curGroup = null;
    canDel = (x) => me && (x.uid === me.uid || isAdmin);
    const el = $('#cm-view');
    if (tab === 'chat') chatView(el, { base: `community/${exam}`, title: `${EXAMS[exam]} 채팅방`, sub: `${EXAMS[exam]} 준비하는 모두의 채팅방 · 최근 100개`, max: 300, empty: `${EXAMS[exam]} 채팅방이에요. 먼저 인사해 보세요 👋` });
    else if (tab === 'groups') groupsRoute(el);
    else if (tab === 'friends') friendsView(el);
    else loungeBoard(el);
    drawSocial();
  }

  /* ── 게시판 (라운지·그룹 공용) ── */
  function boardList(el, o) {
    let rows = [], c = '전체';
    el.innerHTML = `<div class="cm-board-head"><div class="cm-cats">${['전체', ...o.cats].map((x) => `<button type="button" data-c="${x}"${x === c ? ' class="on"' : ''}>${x}</button>`).join('')}</div>
      <button type="button" class="cm-btn cm-write" data-go="${o.writeHref}">✏️ 글쓰기</button></div>
      <div class="cm-table"><div class="cm-thead" aria-hidden="true"><span>말머리</span><span>제목</span><span>글쓴이</span><span>작성일</span></div>
      <ul class="cm-list"><li class="cm-empty">불러오는 중…</li></ul></div>`;
    const ul = $('.cm-list', el);
    const row = (x) => `<li><a class="cm-row" href="${o.postHref}${x.id}">
      <span class="cm-row-cat">${catTag(x.cat)}</span>
      <span class="cm-row-title"><span class="cm-title-txt">${esc(x.title)}</span>${x.nc ? `<b class="cm-nc">[${x.nc}]</b>` : ''}${isNew(x.t) ? '<i class="cm-newb">N</i>' : ''}</span>
      <span class="cm-row-name">${avatar(x.name, x.uid, 'xs')}${lvTag(x.uid)}<span class="cm-row-nick">${esc(x.name)}</span></span><span class="cm-row-time">${shortTime(x.t)}</span></a></li>`;
    const draw = () => {
      const r = c === '전체' ? rows : rows.filter((x) => x.cat === c);
      ul.innerHTML = r.length ? r.map(row).join('') : `<li class="cm-empty">${rows.length ? `'${esc(c)}' 말머리 글이 아직 없어요.` : o.empty}</li>`;
    };
    $('.cm-cats', el).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      c = b.dataset.c; el.querySelectorAll('.cm-cats button').forEach((x) => x.classList.toggle('on', x === b)); draw();
    });
    const { F } = FB;
    view.push(F.onSnapshot(F.query(C(`${o.base}/posts`), F.orderBy('t', 'desc'), F.limit(100)),
      (s) => { rows = s.docs.map((d) => ({ id: d.id, ...d.data() })); draw(); },
      (e) => { ul.innerHTML = `<li class="cm-empty">불러오지 못했어요 (${esc(e.code || e.message)})</li>`; }));
  }
  function writeView(el, o) {
    el.innerHTML = `<form class="cm-card cm-form cm-post-form" data-base="${o.base}" data-post-href="${o.postHref}">
      <div class="cm-card-head"><h2>${esc(o.title)}</h2><span class="cm-by">${avatar(myName, me.uid, 'sm')}${esc(myName)}</span></div>
      <div class="cm-form-row"><select name="cat" aria-label="말머리">${o.cats.map((c) => `<option>${c}</option>`).join('')}</select>
      <input name="title" maxlength="100" placeholder="제목을 입력하세요" required></div>
      <textarea name="body" maxlength="5000" rows="14" placeholder="내용을 입력하세요 (5000자까지)&#10;&#10;욕설·광고·개인정보·문제 유출 글은 지워질 수 있어요." required></textarea>
      <div class="cm-actions"><a class="cm-btn ghost" href="${o.back}">취소</a><button class="cm-btn">등록</button></div></form>`;
    $('input[name=title]', el).focus();
  }
  function commentForm(path) {
    if (!me) return '<p class="cm-cmt-login">댓글은 로그인 후 쓸 수 있어요.</p>';
    if (!profileLoaded) return '';
    if (!myName) return '<p class="cm-cmt-login"><button type="button" class="cm-link" data-act="nick">닉네임을 정하면</button> 댓글을 쓸 수 있어요.</p>';
    return `<form class="cm-cform" data-post="${path}"><div class="cm-cform-who">${esc(myName)}</div>
      <textarea name="body" maxlength="1000" rows="3" placeholder="댓글을 남겨 보세요" required></textarea>
      <div class="cm-cform-foot"><button class="cm-btn sm">등록</button></div></form>`;
  }
  async function postView(el, o) {
    const { F } = FB, path = `${o.base}/posts/${o.id}`, tok = viewTok;
    el.innerHTML = '<p class="cm-empty">불러오는 중…</p>';
    const s = await F.getDoc(D(path)).catch(() => null);
    if (tok !== viewTok) return;
    if (!s || !s.exists()) { el.innerHTML = box(`<p>지워졌거나 없는 글이에요.</p><a class="cm-btn ghost sm" href="${o.back}">목록으로</a>`); return; }
    const x = { id: o.id, ...s.data() };
    el.innerHTML = `<article class="cm-card cm-post">
        <p class="cm-crumb">${esc(o.crumb)} › ${esc(x.cat)}</p>
        <h2 class="cm-post-title">${catTag(x.cat)} ${esc(x.title)}</h2>
        <div class="cm-author">${avatar(x.name, x.uid, 'lg')}<div><b>${esc(x.name)} ${lvTag(x.uid)}</b><small>${fullTime(x.t)}</small></div><span class="cm-author-nc">댓글 <b class="cm-ncount">${x.nc || 0}</b></span></div>
        <div class="cm-body">${esc(x.body)}</div>
        <div class="cm-post-tools"><a class="cm-btn ghost sm" href="${o.back}">목록</a><span class="cm-grow"></span>
          ${me && x.uid !== me.uid ? `<button type="button" class="cm-txtbtn cm-report" data-path="${path}">신고</button>` : ''}
          ${canDel(x) ? `<button type="button" class="cm-txtbtn cm-del" data-path="${path}" data-back="${o.back}">삭제</button>` : ''}</div>
      </article>
      <section class="cm-card cm-cmts"><h3>댓글 <b class="cm-ncount">${x.nc || 0}</b></h3><ul class="cm-comments"></ul>${commentForm(path)}</section>`;
    view.push(F.onSnapshot(F.query(C(`${path}/comments`), F.orderBy('t')), (snap) => {
      const ul = $('.cm-comments', el); if (!ul) return;
      el.querySelectorAll('.cm-ncount').forEach((b) => { b.textContent = snap.size; });
      ul.innerHTML = snap.docs.map((d) => { const c = d.data(); return `<li>${avatar(c.name, c.uid, 'sm')}<div class="cm-cmt">
          <div class="cm-cmt-head"><b>${esc(c.name)}</b>${lvTag(c.uid)}${c.uid === x.uid ? '<span class="cm-op">작성자</span>' : ''}</div>
          <p>${esc(c.body)}</p>
          <div class="cm-cmt-foot"><span>${fullTime(c.t)}</span>${me && c.uid !== me.uid ? `<button type="button" class="cm-txtbtn cm-report" data-path="${d.ref.path}">신고</button>` : ''}${canDel(c) ? `<button type="button" class="cm-txtbtn cm-del" data-path="${d.ref.path}">삭제</button>` : ''}</div>
        </div></li>`; }).join('') || '<li class="cm-empty">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</li>';
    }));
  }
  function loungeBoard(el) {
    const h = location.hash, m = h.match(/^#post=([\w-]+)$/), base = `community/${exam}`;
    if (h === '#write' && me && myName) writeView(el, { base, cats: CATS, title: `${EXAMS[exam]} 게시판 글쓰기`, back: '#', postHref: '#post=' });
    else if (m) postView(el, { base, id: m[1], back: '#', crumb: `${EXAMS[exam]} 게시판` });
    else boardList(el, { base, cats: CATS, postHref: '#post=', writeHref: '#write', empty: `아직 글이 없어요. ${EXAMS[exam]} 준비하는 분들께 첫 인사를 남겨 보세요!` });
  }

  /* ── 채팅 (라운지·그룹 단체톡 공용) ── */
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
        <div class="cm-msg-col">${!mine && first ? `<span class="cm-msg-name">${esc(x.name)} ${lvTag(x.uid)}</span>` : ''}
          <div class="cm-msg-line"><p>${esc(x.text)}</p><span class="cm-msg-meta">${del}${last ? `<time>${clock(x.t)}</time>` : ''}</span></div>
        </div></div>`;
      prev = x;
    });
    return out;
  }
  function chatView(el, o) {
    const hint = !me ? '채팅은 로그인 후 할 수 있어요.' : !profileLoaded ? '' : '<button type="button" class="cm-link" data-act="nick">닉네임을 정하면</button> 채팅에 참여할 수 있어요.';
    el.innerHTML = `<div class="cm-chat"><div class="cm-chat-head"><b>${esc(o.title)}</b><small>${esc(o.sub || '')}</small></div>
      <div class="cm-msgs" aria-live="polite"><p class="cm-empty">불러오는 중…</p></div>
      ${me && myName ? `<form class="cm-chat-form" data-base="${o.base}"><textarea name="text" rows="1" maxlength="${o.max}" placeholder="메시지를 입력하세요 (Enter 보내기 · Shift+Enter 줄바꿈)" autocomplete="off"></textarea><button>전송</button></form>`
        : `<p class="cm-chat-hint">${hint}</p>`}</div>`;
    const msgs = $('.cm-msgs', el), { F } = FB;
    view.push(F.onSnapshot(F.query(C(`${o.base}/chat`), F.orderBy('t', 'desc'), F.limit(100)), (snap) => {
      const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
      const docs = snap.docs.slice().reverse();
      msgs.innerHTML = docs.length ? chatHTML(docs) : `<p class="cm-empty">${o.empty}</p>`;
      if (near || snap.docChanges().length === snap.size || snap.docChanges().some((c) => c.type === 'added' && me && c.doc.data().uid === me.uid)) msgs.scrollTop = msgs.scrollHeight;
    }, (e) => { msgs.innerHTML = `<p class="cm-empty">불러오지 못했어요 (${esc(e.code || e.message)})</p>`; }));
  }

  /* ── 스터디 그룹 ── */
  function groupCard(g) {
    const mem = !!(me && g.members.includes(me.uid)), full = g.members.length >= g.max;
    const btn = mem ? `<a class="cm-btn ghost sm" href="#g=${g.id}">들어가기</a>`
      : full ? '<span class="cm-tag">정원 마감</span>'
      : g.open ? `<button type="button" class="cm-btn sm" data-act="join" data-gid="${g.id}">참여</button>` : '';
    return `<div class="cm-gcard"><a class="cm-gmain" href="#g=${g.id}">
        <span class="cm-gicon" style="--h:${hue(g.id)}">${esc(g.name.slice(0, 1))}</span>
        <span class="cm-ginfo"><b>${esc(g.name)}${g.open ? '' : ' <i class="cm-lock" title="비공개 그룹">🔒</i>'}</b>
          <small>${esc(g.desc || '소개가 없어요')}</small>
          <small class="cm-gmeta">${EXAMS[g.exam] || ''} · 멤버 ${g.members.length}/${g.max} · 방장 ${esc((g.names || {})[g.owner] || '')}</small></span></a>
      <span class="cm-gbtns">${btn}</span></div>`;
  }
  function groupsRoute(el) {
    const h = location.hash, m = h.match(/^#g=([\w-]+)(?:\/(.*))?$/);
    if (h === '#new' && me && myName) groupCreate(el);
    else if (m) groupPage(el, m[1], m[2] || '');
    else groupsHome(el);
  }
  function groupsHome(el) {
    el.innerHTML = `${me ? '' : box('스터디 그룹은 로그인하면 만들거나 참여할 수 있어요. 공개 그룹 목록은 누구나 볼 수 있어요.')}
      <section class="cm-sec" id="cm-inv-sec" hidden><div class="cm-sec-head"><h3>받은 그룹 초대</h3></div><div class="cm-glist" id="cm-invites"></div></section>
      ${me ? `<section class="cm-sec"><div class="cm-sec-head"><h3>내 스터디 그룹</h3><button type="button" class="cm-btn sm" data-go="#new">+ 새 그룹 만들기</button></div><div class="cm-glist" id="cm-mygroups"></div></section>` : ''}
      <section class="cm-sec"><div class="cm-sec-head"><h3>${EXAMS[exam]} 공개 그룹</h3><button type="button" class="cm-btn ghost sm" data-act="rand-group">🎲 랜덤 참여</button></div>
        <div class="cm-glist" id="cm-open"><p class="cm-empty">불러오는 중…</p></div></section>`;
    const { F } = FB, list = $('#cm-open', el);
    openGroups = [];
    view.push(F.onSnapshot(F.query(C('groups'), F.where('open', '==', true), F.where('exam', '==', exam), F.limit(50)), (s) => {
      openGroups = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      openGroups.forEach((g) => { G[g.id] = g; });
      openGroups.sort((a, b) => (b.members.length - a.members.length) || (tms(b.t) - tms(a.t)));
      list.innerHTML = openGroups.length ? openGroups.map(groupCard).join('') : `<p class="cm-empty">아직 ${EXAMS[exam]} 공개 그룹이 없어요. 첫 그룹을 만들어 보세요!</p>`;
    }, (e) => { list.innerHTML = `<p class="cm-empty">불러오지 못했어요 (${esc(e.code || e.message)})</p>`; }));
  }
  const maxOpts = (sel) => [4, 6, 8, 10, 15, 20, 30, 50].map((n) => `<option value="${n}"${n === sel ? ' selected' : ''}>${n}명</option>`).join('');
  function groupCreate(el) {
    el.innerHTML = `<form class="cm-card cm-form" id="cm-gform">
      <div class="cm-card-head"><h2>새 스터디 그룹 만들기</h2></div>
      <label class="cm-field"><span>그룹 이름</span><input name="name" maxlength="30" required placeholder="예: 81회 한능검 심화 같이 준비해요"></label>
      <label class="cm-field"><span>소개 <small>(선택)</small></span><textarea name="desc" maxlength="200" rows="3" placeholder="목표, 공부 방식, 인증 규칙 등을 적어 주세요"></textarea></label>
      <div class="cm-form-row">
        <label class="cm-field"><span>시험</span><select name="exam">${Object.entries(EXAMS).map(([k, v]) => `<option value="${k}"${k === exam ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="cm-field"><span>정원</span><select name="max">${maxOpts(10)}</select></label>
      </div>
      <fieldset class="cm-radio"><legend>공개 범위</legend>
        <label><input type="radio" name="open" value="1" checked> <b>공개</b> — 누구나 목록에서 찾아 참여할 수 있어요</label>
        <label><input type="radio" name="open" value="0"> <b>비공개</b> — 초대받은 친구만 참여할 수 있어요</label></fieldset>
      <div class="cm-actions"><a class="cm-btn ghost" href="#">취소</a><button class="cm-btn">만들기</button></div></form>`;
    $('input[name=name]', el).focus();
  }
  function groupHead(g, mem, sub) {
    const boardish = sub === 'board' || sub === 'write' || sub.startsWith('post=');
    return `<a class="cm-back" href="#">← 그룹 목록</a>
      <div class="cm-gtitle"><span class="cm-gicon lg" style="--h:${hue(g.id)}">${esc(g.name.slice(0, 1))}</span>
        <div><h2>${esc(g.name)}</h2><p class="cm-gmeta">${EXAMS[g.exam] || ''} · ${g.open ? '공개' : '🔒 비공개'} 그룹 · 멤버 ${g.members.length}/${g.max} · 방장 ${esc(g.names[g.owner] || '')}</p></div></div>
      ${g.desc ? `<p class="cm-gdesc">${esc(g.desc)}</p>` : ''}
      ${mem ? `<nav class="cm-gtabs"><a href="#g=${g.id}" class="${sub === '' ? 'on' : ''}">💬 단체톡</a><a href="#g=${g.id}/board" class="${boardish ? 'on' : ''}">📋 게시판</a><a href="#g=${g.id}/members" class="${sub === 'members' ? 'on' : ''}">👥 멤버 ${g.members.length}</a></nav>` : ''}`;
  }
  function groupPage(el, gid, sub) {
    el.innerHTML = '<div class="cm-card cm-ghead"><p class="cm-empty">불러오는 중…</p></div><div class="cm-gbody"></div>';
    const head = $('.cm-ghead', el), body = $('.cm-gbody', el), { F } = FB;
    let state = null;
    view.push(F.onSnapshot(D('groups/' + gid), (s) => {
      if (!s.exists()) { head.innerHTML = '<p class="cm-empty">없어졌거나 볼 수 없는 그룹이에요.</p><a class="cm-btn ghost sm" href="#">그룹 목록</a>'; body.innerHTML = ''; curGroup = null; return; }
      const g = curGroup = G[gid] = { id: gid, ...s.data() };
      const mem = !!(me && g.members.includes(me.uid)), st = mem ? 'member' : 'guest';
      canDel = (x) => me && (x.uid === me.uid || g.owner === me.uid);
      head.innerHTML = groupHead(g, mem, sub);
      if (state && state !== st) { render(); return; } // 참여·나가기 뒤 다시 그린다
      if (!state) { state = st; groupBody(body, g, mem, sub); } else if (sub === 'members' && mem) updateMembers(g);
    }, () => {
      head.innerHTML = '<p class="cm-empty">볼 수 없는 그룹이에요. 비공개 그룹은 초대를 받아야 볼 수 있어요.</p><a class="cm-btn ghost sm" href="#">그룹 목록</a>';
      body.innerHTML = '';
    }));
  }
  function groupBody(body, g, mem, sub) {
    if (!mem) {
      const invited = S.invites.some((i) => i.gid === g.id), full = g.members.length >= g.max;
      body.innerHTML = box(`<p>${g.open || invited ? '참여하면 멤버끼리 단체톡과 그룹 게시판을 쓸 수 있어요.' : '비공개 그룹이에요. 멤버에게 초대받아야 참여할 수 있어요.'}</p>
        ${full ? '<p><b>정원이 다 찼어요.</b></p>' : (g.open || invited) ? `<button type="button" class="cm-btn" data-act="join" data-gid="${g.id}">그룹 참여하기</button>` : ''}`)
        + `<section class="cm-card"><h3>멤버 ${g.members.length}/${g.max}</h3><ul class="cm-people">${g.members.map((u) => person(u, g.names[u], u === g.owner ? '<span class="cm-op">방장</span>' : '')).join('')}</ul></section>`;
      return;
    }
    const base = `groups/${g.id}`, pre = `#g=${g.id}`;
    if (sub === 'board' || (sub === 'write' && !myName)) boardList(body, { base, cats: GCATS, postHref: `${pre}/post=`, writeHref: `${pre}/write`, empty: '아직 글이 없어요. 공지나 공부 계획을 남겨 보세요!' });
    else if (sub === 'write') writeView(body, { base, cats: GCATS, title: `${g.name} 글쓰기`, back: `${pre}/board`, postHref: `${pre}/post=` });
    else if (sub.startsWith('post=')) postView(body, { base, id: sub.slice(5), back: `${pre}/board`, crumb: `${g.name} 게시판` });
    else if (sub === 'members') membersView(body, g);
    else chatView(body, { base, title: '단체톡', sub: '그룹 멤버끼리만 보여요 · 최근 100개', max: 1000, empty: '그룹 단체톡이에요. 오늘 공부 계획을 공유해 보세요 ✍️' });
  }
  function memberListHTML(g) {
    const owner = me && g.owner === me.uid;
    return g.members.map((u) => person(u, g.names[u],
      (u === g.owner ? '<span class="cm-op">방장</span>' : '') + (me && u === me.uid ? '<span class="cm-tag">나</span>' : ''),
      (me && u !== me.uid ? relBtn(u, g.names[u]) : '') + (owner && u !== me.uid ? `<button type="button" class="cm-txtbtn cm-danger" data-act="kick" data-uid="${u}">내보내기</button>` : ''))).join('');
  }
  function ginvHTML(g) {
    if (g.members.length >= g.max) return '<p class="cm-hint">정원이 다 찼어요.</p>';
    const fl = friendList().filter((f) => !g.members.includes(f.uid));
    if (!S.friends.length) return '<p class="cm-hint">아직 친구가 없어요. <button type="button" class="cm-link" data-tab="friends">친구 탭</button>에서 친구를 추가해 보세요.</p>';
    if (!fl.length) return '<p class="cm-hint">친구가 모두 이 그룹에 있어요.</p>';
    return `<ul class="cm-people">${fl.map((f) => person(f.uid, f.name, '', `<button type="button" class="cm-btn ghost sm" data-act="invite" data-uid="${f.uid}">초대</button>`)).join('')}</ul>`;
  }
  function membersView(body, g) {
    const owner = me && g.owner === me.uid;
    body.innerHTML = `<section class="cm-card"><h3>멤버 <b id="cm-mcount">${g.members.length}/${g.max}</b></h3><ul class="cm-people" id="cm-mlist">${memberListHTML(g)}</ul></section>
      <section class="cm-card"><h3>친구 초대</h3><div id="cm-ginv">${ginvHTML(g)}</div></section>
      ${owner ? `<form class="cm-card cm-form" id="cm-gset"><h3>그룹 설정</h3>
        <label class="cm-field"><span>그룹 이름</span><input name="name" maxlength="30" required value="${esc(g.name)}"></label>
        <label class="cm-field"><span>소개</span><textarea name="desc" maxlength="200" rows="3">${esc(g.desc)}</textarea></label>
        <label class="cm-field"><span>정원</span><select name="max">${maxOpts(g.max)}</select></label>
        <fieldset class="cm-radio"><legend>공개 범위</legend>
          <label><input type="radio" name="open" value="1"${g.open ? ' checked' : ''}> <b>공개</b> — 누구나 찾아 참여</label>
          <label><input type="radio" name="open" value="0"${g.open ? '' : ' checked'}> <b>비공개</b> — 초대받은 사람만</label></fieldset>
        <div class="cm-actions"><button class="cm-btn">저장</button></div></form>` : ''}
      <section class="cm-card cm-danger-zone">${owner
        ? '<button type="button" class="cm-btn ghost danger" data-act="del-group">그룹 삭제</button><small>방장은 그룹을 나갈 수 없어요. 그룹을 지우면 단체톡과 게시글도 더 볼 수 없어요.</small>'
        : '<button type="button" class="cm-btn ghost danger" data-act="leave">그룹 나가기</button>'}</section>`;
  }
  function updateMembers(g) {
    const l = $('#cm-mlist'); if (l) l.innerHTML = memberListHTML(g);
    const c = $('#cm-mcount'); if (c) c.textContent = `${g.members.length}/${g.max}`;
    const i = $('#cm-ginv'); if (i) i.innerHTML = ginvHTML(g);
  }
  async function joinGroup(gid) {
    const { F, db } = FB, b = F.writeBatch(db);
    b.update(D('groups/' + gid), { members: F.arrayUnion(me.uid), ['names.' + me.uid]: myName });
    if (S.invites.some((i) => i.gid === gid)) b.delete(D(`groupInvites/${gid}_${me.uid}`));
    await b.commit();
    if (window.track) window.track('group_join');
    if (location.hash === '#g=' + gid) render(); else location.hash = '#g=' + gid;
  }

  /* ── 친구 ── */
  function friendsView(el) {
    if (!me) { el.innerHTML = box('친구 기능은 로그인 후 쓸 수 있어요.'); return; }
    if (!profileLoaded) { el.innerHTML = '<p class="cm-empty">불러오는 중…</p>'; return; }
    if (!myName) { el.innerHTML = box('<button type="button" class="cm-link" data-act="nick">닉네임을 정하면</button> 친구를 찾고 추가할 수 있어요.'); return; }
    found = null;
    el.innerHTML = `<section class="cm-card"><h3>친구 찾기</h3>
        <form class="cm-fsearch" id="cm-fsearch"><input name="q" maxlength="12" placeholder="닉네임으로 검색" autocomplete="off"><button class="cm-btn">검색</button><button type="button" class="cm-btn ghost" data-act="rand-friends">🎲 랜덤 추천</button></form>
        <p class="cm-hint">랜덤 추천은 지금 <b>${EXAMS[exam]}</b> 준비하는 사람 중에서 골라 줘요. 위에서 시험을 바꾸면 다른 시험 준비생을 추천해요.</p>
        <ul class="cm-people" id="cm-found"></ul></section>
      <section class="cm-card" id="cm-reqin-sec" hidden><h3>받은 친구 신청</h3><ul class="cm-people" id="cm-reqin"></ul></section>
      <section class="cm-card"><h3>내 친구 <b id="cm-fcount"></b></h3><ul class="cm-people" id="cm-friends"></ul></section>
      <section class="cm-card" id="cm-reqout-sec" hidden><h3>보낸 친구 신청</h3><ul class="cm-people" id="cm-reqout"></ul></section>`;
  }
  function foundHTML() {
    if (found.loading) return '<li class="cm-empty">찾는 중…</li>';
    if (!found.list.length) return `<li class="cm-empty">${found.empty}</li>`;
    return found.list.map((p) => person(p.uid, p.name, examTag(p.exam), relBtn(p.uid, p.name))).join('');
  }
  async function searchPeople(q) {
    const { F } = FB;
    found = { loading: true }; drawSocial();
    const s = await F.getDocs(F.query(C('profiles'), F.orderBy('name'), F.startAt(q), F.endAt(q + ''), F.limit(20)));
    found = { list: s.docs.map((d) => ({ uid: d.id, ...d.data() })), empty: `'${esc(q)}'(으)로 시작하는 닉네임이 없어요.` };
    drawSocial();
  }
  async function randomPeople() {
    const { F } = FB;
    found = { loading: true }; drawSocial();
    const s = await F.getDocs(F.query(C('profiles'), F.where('exam', '==', exam), F.limit(100)));
    const list = shuffle(s.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => p.name && rel(p.uid) === 'none')).slice(0, 6);
    found = { list, empty: `지금 추천할 ${EXAMS[exam]} 준비생이 없어요. 조금 뒤에 다시 눌러 보세요.` };
    drawSocial();
  }

  /* ── 캐릭터·레벨 채우기 ── */
  const PROF = {}; // uid → { lv, av } | null (프로필 없음)
  const pend = new Set(); let fetching = false;
  const myProf = () => ({ lv: window.XP ? window.XP.summary().lv : null, av: window.AVATAR ? window.AVATAR.encode(window.AVATAR.load()) : null });
  function fillProfiles() {
    const root = $('#cm'); if (!root) return;
    root.querySelectorAll('[data-avu]:not([data-f]), [data-lvu]:not([data-f])').forEach((el) => {
      const u = el.dataset.avu || el.dataset.lvu; if (!u) { el.dataset.f = '1'; return; }
      const p = me && u === me.uid ? myProf() : PROF[u];
      if (p === undefined) { pend.add(u); return; }
      el.dataset.f = '1';
      if (!p) return;
      if (el.dataset.avu && p.av && window.AVATAR) { el.innerHTML = window.AVATAR.svg(p.av, 64, 'face'); el.classList.add('has-svg'); }
      if (el.dataset.lvu && p.lv) { el.textContent = 'Lv.' + p.lv; el.dataset.tier = Math.min(5, Math.floor(p.lv / 10)); }
    });
    if (pend.size && !fetching && FB) fetchProfiles();
  }
  async function fetchProfiles() {
    fetching = true;
    const ids = [...pend]; pend.clear();
    const { F } = FB;
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      try {
        const s = await F.getDocs(F.query(C('profiles'), F.where(F.documentId(), 'in', chunk)));
        chunk.forEach((u) => { PROF[u] = null; });
        s.forEach((d) => { const x = d.data(); PROF[d.id] = { lv: x.lv || null, av: x.av || null }; });
      } catch (e) { chunk.forEach((u) => { PROF[u] = null; }); }
    }
    fetching = false;
    fillProfiles();
  }
  // 화면이 다시 그려질 때마다(채팅 새 메시지 등) 캐시에서 바로 채운다
  new MutationObserver(fillProfiles).observe($('#cm'), { childList: true, subtree: true });

  /* ── 버튼 동작 ── */
  const ACTS = {
    nick: () => openNick(),
    'nick-cancel': () => $('#cm-nick').close(),
    async join(b) { if (needLogin()) await joinGroup(b.dataset.gid); },
    async 'rand-group'() {
      if (!needLogin()) return;
      const c = openGroups.filter((g) => !g.members.includes(me.uid) && g.members.length < g.max);
      if (!c.length) { alert(`지금 참여할 수 있는 ${EXAMS[exam]} 공개 그룹이 없어요. 새 그룹을 만들어 보세요!`); return; }
      const g = c[Math.floor(Math.random() * c.length)];
      if (confirm(`🎲 '${g.name}' 그룹 (멤버 ${g.members.length}/${g.max})\n${g.desc || ''}\n\n이 그룹에 참여할까요?`)) await joinGroup(g.id);
    },
    async 'decline-inv'(b) { await FB.F.deleteDoc(D('groupInvites/' + b.dataset.id)); },
    async leave() {
      if (!confirm(`'${curGroup.name}' 그룹에서 나갈까요?`)) return;
      const { F } = FB;
      await F.updateDoc(D('groups/' + curGroup.id), { members: F.arrayRemove(me.uid), ['names.' + me.uid]: F.deleteField() });
      location.hash = '';
    },
    async kick(b) {
      const u = b.dataset.uid, { F } = FB;
      if (!confirm(`${curGroup.names[u]}님을 그룹에서 내보낼까요?`)) return;
      await F.updateDoc(D('groups/' + curGroup.id), { members: F.arrayRemove(u), ['names.' + u]: F.deleteField() });
    },
    async 'del-group'() {
      if (!confirm(`'${curGroup.name}' 그룹을 지울까요? 단체톡과 게시글도 더 볼 수 없게 되고 되돌릴 수 없어요.`)) return;
      await FB.F.deleteDoc(D('groups/' + curGroup.id));
      location.hash = '';
    },
    async invite(b) {
      const u = b.dataset.uid, g = curGroup, { F } = FB;
      b.disabled = true;
      try {
        await F.setDoc(D(`groupInvites/${g.id}_${u}`), { gid: g.id, uid: u, from: me.uid, fromName: myName, gname: g.name, exam: g.exam, t: F.serverTimestamp() });
        b.textContent = '초대함';
      } catch (err) { b.textContent = '초대함'; if (err.code !== 'permission-denied') throw err; }
    },
    async 'friend-req'(b) {
      if (!needLogin()) return;
      const u = b.dataset.uid, { F } = FB;
      if (rel(u) === 'in') return ACTS['accept-req']({ dataset: { id: `${u}_${me.uid}` } });
      b.disabled = true;
      await F.setDoc(D(`friendReqs/${me.uid}_${u}`), { from: me.uid, to: u, fromName: myName, toName: b.dataset.name, t: F.serverTimestamp() });
      if (window.track) window.track('friend_request');
    },
    async 'accept-req'(b) {
      const r = S.reqIn.find((x) => x.id === b.dataset.id); if (!r) return;
      const { F, db } = FB, pid = pairId(r.from, me.uid), w = F.writeBatch(db);
      if (!S.friends.some((f) => f.id === pid)) w.set(D('friends/' + pid), { uids: [r.from, me.uid], names: { [r.from]: r.fromName, [me.uid]: myName }, t: F.serverTimestamp() });
      w.delete(D('friendReqs/' + r.id));
      const mine = S.reqOut.find((x) => x.to === r.from); if (mine) w.delete(D('friendReqs/' + mine.id));
      await w.commit();
    },
    async 'del-req'(b) { await FB.F.deleteDoc(D('friendReqs/' + b.dataset.id)); },
    async unfriend(b) { if (confirm(`${b.dataset.name}님을 친구에서 삭제할까요?`)) await FB.F.deleteDoc(D('friends/' + b.dataset.id)); },
    'rand-friends': () => randomPeople(),
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b || !FB || !b.closest('#cm')) return;
    const { F } = FB;
    try {
      if (b.dataset.act && ACTS[b.dataset.act]) { await ACTS[b.dataset.act](b); return; }
      if (b.dataset.exam) { exam = b.dataset.exam; clearHash(); syncExam(); render(); return; }
      if (b.dataset.tab) { tab = b.dataset.tab; clearHash(); render(); return; }
      if (b.dataset.go) { if (needLogin()) location.hash = b.dataset.go; return; }
      if (b.classList.contains('cm-del')) {
        if (!confirm('지울까요? 되돌릴 수 없어요.')) return;
        await F.deleteDoc(D(b.dataset.path));
        if (/\/posts\/[^/]+$/.test(b.dataset.path)) location.hash = b.dataset.back || '';
        return;
      }
      if (b.classList.contains('cm-report')) {
        const why = prompt('신고 이유를 짧게 적어 주세요 (욕설·광고·개인정보 등)'); if (!why) return;
        await F.addDoc(C('reports'), { uid: me.uid, path: b.dataset.path, why: why.slice(0, 200), t: F.serverTimestamp() });
        alert('신고했어요. 확인 후 조치할게요.');
      }
    } catch (err) { alert('처리하지 못했어요: ' + (err.code || err.message)); }
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
      if (f.id === 'cm-fsearch') {
        const q = f.q.value.trim(); if (q) await searchPeople(q);
      } else if (f.id === 'cm-gform' || f.id === 'cm-gset') {
        const el = f.elements, d = { name: el.name.value.trim(), desc: el.desc.value.trim(), open: el.open.value === '1', max: +el.max.value };
        if (d.name.length < 2) { alert('그룹 이름은 2자 이상으로 적어 주세요.'); return; }
        if (f.id === 'cm-gset') {
          if (d.max < curGroup.members.length) { alert(`지금 멤버가 ${curGroup.members.length}명이라 정원을 그보다 줄일 수 없어요.`); return; }
          await F.updateDoc(D('groups/' + curGroup.id), d);
          alert('저장했어요.');
        } else {
          const r = await F.addDoc(C('groups'), { ...d, exam: el.exam.value, owner: me.uid, members: [me.uid], names: { [me.uid]: name }, t: F.serverTimestamp() });
          if (window.track) window.track('group_create', { exam: el.exam.value });
          location.hash = '#g=' + r.id;
        }
      } else if (f.classList.contains('cm-post-form')) {
        const r = await F.addDoc(C(`${f.dataset.base}/posts`), { uid: me.uid, name, cat: f.cat.value, title: f.title.value.trim(), body: f.body.value.trim(), t: F.serverTimestamp(), nc: 0 });
        if (window.track) window.track('community_post', { exam, group: f.dataset.base.startsWith('groups/') });
        if (window.GAME) window.GAME.bump('social');
        location.hash = f.dataset.postHref + r.id;
      } else if (f.classList.contains('cm-cform')) {
        const pref = D(f.dataset.post);
        await F.addDoc(F.collection(pref, 'comments'), { uid: me.uid, name, body: f.body.value.trim(), t: F.serverTimestamp() });
        await F.updateDoc(pref, { nc: F.increment(1) }).catch(() => {});
        f.reset();
        if (window.GAME) window.GAME.bump('social');
      } else if (f.classList.contains('cm-chat-form')) {
        const text = f.text.value.trim(); if (!text) return;
        f.text.value = '';
        await F.addDoc(C(`${f.dataset.base}/chat`), { uid: me.uid, name, text, t: F.serverTimestamp() });
        if (window.track) window.track('community_chat', { exam, group: f.dataset.base.startsWith('groups/') });
        if (window.GAME) window.GAME.bump('social');
      }
    } catch (err) { alert('처리하지 못했어요: ' + (err.code || err.message)); }
    finally { btn.disabled = false; if (f.classList.contains('cm-chat-form') && f.text) f.text.focus(); }
  });
  // 채팅 입력: Enter 보내기, Shift+Enter 줄바꿈
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('.cm-chat-form textarea') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); }
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#nick') { clearHash(); openNick(); return; }
    render();
  });

  document.addEventListener('fb-ready', () => {
    FB = window.FB;
    FB.A.onAuthStateChanged(FB.auth, async (u) => {
      me = u ? { uid: u.uid } : null; isAdmin = false;
      if (u) isAdmin = await FB.F.getDoc(D('admins/' + u.uid)).then((s) => s.exists()).catch(() => false);
      watchProfile(); watchSocial(); renderMe();
      render(); fillProfiles();
    });
  });
})();
