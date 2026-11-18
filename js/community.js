/*
 * 스터디 라운지 — 시험별 게시판·댓글·실시간 채팅 (Firestore)
 *   community/{exam}/posts/{id}            { uid, name, cat, title, body, t, nc }
 *   community/{exam}/posts/{id}/comments/{id} { uid, name, body, t }
 *   community/{exam}/chat/{id}             { uid, name, text, t }
 *   reports/{id}                           { uid, path, t }
 *   권한은 firestore.rules. 관리자는 admins/{uid} 문서가 있는 계정.
 */
(function () {
  const EXAMS = { history: '한능검', fire: '소방', gtelp: '지텔프' };
  const CATS = ['질문', '정보', '스터디 모집', '합격 후기', '잡담'];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);
  let exam = EXAMS[qs.get('exam')] ? qs.get('exam') : (localStorage.getItem('cm.exam') || 'history');
  let tab = qs.get('tab') === 'chat' ? 'chat' : 'board';
  let FB, me = null, isAdmin = false, unsubChat = null, unsubBoard = null;

  const when = (ts) => {
    if (!ts || !ts.toDate) return '방금';
    const d = ts.toDate(), s = (Date.now() - d) / 1000;
    if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  function nick() {
    let n = localStorage.getItem('cm.nick');
    if (n) return n;
    n = (prompt('라운지에서 쓸 닉네임 (2~12자)', '수험생' + (me ? me.uid.slice(0, 4) : '')) || '').trim().slice(0, 12);
    if (n.length < 2) return null;
    localStorage.setItem('cm.nick', n); return n;
  }
  const col = (...p) => FB.F.collection(FB.db, 'community', exam, ...p);
  const canDel = (x) => me && (x.uid === me.uid || isAdmin);

  function setUI() {
    document.querySelectorAll('.cm-exams button').forEach((b) => b.classList.toggle('on', b.dataset.exam === exam));
    document.querySelectorAll('.cm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#cm-board').hidden = tab !== 'board'; $('#cm-chat').hidden = tab !== 'chat';
    $('#cm-login').hidden = !!me;
    $('#cm-chat-form').hidden = !me;
    history.replaceState(null, '', `?exam=${exam}${tab === 'chat' ? '&tab=chat' : ''}${location.hash}`);
    localStorage.setItem('cm.exam', exam);
  }

  // ── 게시판 ──
  function listBoard() {
    if (unsubBoard) unsubBoard();
    const el = $('#cm-board');
    el.innerHTML = `${me ? '<button class="cm-new">✏️ 글쓰기</button>' : ''}<ul class="cm-list"><li class="cm-empty">불러오는 중…</li></ul>`;
    const { F } = FB;
    unsubBoard = F.onSnapshot(F.query(col('posts'), F.orderBy('t', 'desc'), F.limit(50)), (snap) => {
      const ul = $('.cm-list', el); if (!ul) return;
      if (snap.empty) { ul.innerHTML = `<li class="cm-empty">아직 글이 없어요. ${EXAMS[exam]} 준비하는 분들께 첫 인사를 남겨 보세요!</li>`; return; }
      ul.innerHTML = snap.docs.map((d) => { const x = d.data(); return `<li><a href="#post=${d.id}"><span class="cm-cat">${esc(x.cat)}</span> ${esc(x.title)}${x.nc ? ` <b class="cm-nc">[${x.nc}]</b>` : ''}<small>${esc(x.name)} · ${when(x.t)}</small></a></li>`; }).join('');
    }, (e) => { $('.cm-list', el).innerHTML = `<li class="cm-empty">불러오지 못했어요 (${esc(e.code || e.message)})</li>`; });
  }
  function writeForm() {
    if (unsubBoard) { unsubBoard(); unsubBoard = null; }
    $('#cm-board').innerHTML = `<form class="cm-form"><select name="cat">${CATS.map((c) => `<option>${c}</option>`).join('')}</select>
      <input name="title" maxlength="100" placeholder="제목" required><textarea name="body" maxlength="5000" rows="10" placeholder="내용 (5000자)" required></textarea>
      <div class="cm-actions"><a href="#">취소</a><button>올리기</button></div></form>`;
  }
  async function showPost(id) {
    if (unsubBoard) { unsubBoard(); unsubBoard = null; }
    const { F } = FB, el = $('#cm-board');
    const ref = F.doc(FB.db, 'community', exam, 'posts', id);
    const s = await F.getDoc(ref).catch(() => null);
    if (!s || !s.exists()) { el.innerHTML = '<p class="cm-empty">지워졌거나 없는 글이에요. <a href="#">목록으로</a></p>'; return; }
    const x = s.data();
    el.innerHTML = `<article class="cm-post"><p class="cm-meta"><span class="cm-cat">${esc(x.cat)}</span> ${esc(x.name)} · ${when(x.t)}</p><h2>${esc(x.title)}</h2><div class="cm-body">${esc(x.body)}</div>
      <p class="cm-tools"><a href="#">← 목록</a>${canDel(x) ? ` <button class="cm-del" data-path="${ref.path}">삭제</button>` : ''}${me && x.uid !== me.uid ? ` <button class="cm-report" data-path="${ref.path}">신고</button>` : ''}</p></article>
      <h3>댓글</h3><ul class="cm-comments"></ul>
      ${me ? `<form class="cm-cform" data-post="${id}"><textarea name="body" maxlength="1000" rows="3" placeholder="댓글 (1000자)" required></textarea><button>댓글 달기</button></form>` : ''}`;
    unsubBoard = F.onSnapshot(F.query(F.collection(ref, 'comments'), F.orderBy('t')), (snap) => {
      const ul = $('.cm-comments', el); if (!ul) return;
      ul.innerHTML = snap.docs.map((d) => { const c = d.data(); return `<li><b>${esc(c.name)}</b> <small>${when(c.t)}</small>${canDel(c) ? ` <button class="cm-del" data-path="${d.ref.path}">삭제</button>` : ''}<p>${esc(c.body)}</p></li>`; }).join('') || '<li class="cm-empty">첫 댓글을 남겨 주세요.</li>';
    });
  }
  function route() {
    const m = location.hash.match(/^#post=([\w-]+)$/);
    if (location.hash === '#write' && me) writeForm(); else if (m) showPost(m[1]); else listBoard();
  }

  // ── 채팅 ──
  function startChat() {
    if (unsubChat) return;
    const { F } = FB, box = $('#cm-msgs');
    box.innerHTML = '<p class="cm-empty">불러오는 중…</p>';
    unsubChat = F.onSnapshot(F.query(col('chat'), F.orderBy('t', 'desc'), F.limit(80)), (snap) => {
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = snap.docs.slice().reverse().map((d) => { const x = d.data(); const mine = me && x.uid === me.uid;
        return `<div class="cm-msg${mine ? ' me' : ''}"><small>${mine ? '' : esc(x.name) + ' · '}${when(x.t)}${canDel(x) ? ` <button class="cm-del" data-path="${d.ref.path}">×</button>` : ''}</small><p>${esc(x.text)}</p></div>`; }).join('') || `<p class="cm-empty">${EXAMS[exam]} 채팅방이에요. 먼저 인사해 보세요 👋</p>`;
      if (near || snap.docChanges().some((c) => c.type === 'added' && me && c.doc.data().uid === me.uid)) box.scrollTop = box.scrollHeight;
    });
  }
  function stopChat() { if (unsubChat) { unsubChat(); unsubChat = null; } }

  function refresh() {
    setUI(); stopChat();
    if (tab === 'chat') startChat(); else route();
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b || !FB) return;
    const { F } = FB;
    if (b.dataset.exam) { exam = b.dataset.exam; location.hash = ''; refresh(); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; refresh(); return; }
    if (b.classList.contains('cm-new')) { location.hash = '#write'; return; }
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
    e.preventDefault(); if (!FB || !me) return;
    const f = e.target, { F } = FB, name = nick(); if (!name) return;
    const btn = f.querySelector('button'); btn.disabled = true;
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
    finally { btn.disabled = false; }
  });
  window.addEventListener('hashchange', () => { if (tab === 'board') route(); });

  document.addEventListener('fb-ready', () => {
    FB = window.FB;
    FB.A.onAuthStateChanged(FB.auth, async (u) => {
      me = u ? { uid: u.uid } : null; isAdmin = false;
      if (u) isAdmin = await FB.F.getDoc(FB.F.doc(FB.db, 'admins', u.uid)).then((s) => s.exists()).catch(() => false);
      refresh();
    });
  });
})();
