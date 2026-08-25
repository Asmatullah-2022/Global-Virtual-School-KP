const Views = {};

// ---------------- HOME ----------------
Views.home = {
  render() {
    return `
    <section class="hero">
      <div class="hero-copy">
        <span class="pill">AI-POWERED DIGITAL EDUCATION</span>
        <h1>Connecting Classrooms,<br><em>Creating Futures.</em></h1>
        <p>Global Virtual School — Government of Khyber Pakhtunkhwa. Gulbahar, Peshawar, Pakistan.</p>
        <div class="actions">
          <button class="primary" data-nav="learn">Start Learning</button>
          <button class="secondary" data-nav="ai">AI Teacher</button>
        </div>
      </div>
      <div class="globe">🌍</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Quick Access</h2></div>
      <div class="grid four">
        <button class="tile" data-nav="learn"><span class="ic">📚</span><b>Courses</b><span>Grades 6–12</span></button>
        <button class="tile" data-nav="classes"><span class="ic">🔴</span><b>Live Classes</b><span>Join sessions</span></button>
        <button class="tile" data-nav="ai"><span class="ic">🤖</span><b>AI Teacher</b><span>Ask & learn</span></button>
        <button class="tile" data-nav="languages"><span class="ic">🌐</span><b>Language Academy</b><span>5 free courses</span></button>
        <button class="tile" data-nav="updates"><span class="ic">📰</span><b>GVS Updates</b><span>Official news</span></button>
        <button class="tile" data-external="admissions"><span class="ic">📝</span><b>Registration</b><span>Apply / Enroll</span></button>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Latest GVS Updates</h2><button class="link-btn" data-nav="updates">See all →</button></div>
      <div id="home-feed" class="feed">${skeletons(2)}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Upcoming Classes</h2><button class="link-btn" data-nav="classes">See all →</button></div>
      <div id="home-classes" class="grid two">${skeletons(2)}</div>
    </section>

    <section class="section">
      <div class="callout">
        <div><span class="pill gold">GVS Digital Learning</span><h2>One app for learning, classes and progress.</h2><p>Connects students to GVS learning services while keeping official announcements in one place.</p></div>
        <button class="primary" data-external="lms">Open LMS</button>
      </div>
    </section>`;
  },
  async afterRender() {
    await FeedWidget.loadInto('#home-feed', { limit: 4 });
    await LiveClassesWidget.loadUpcomingInto('#home-classes', 4);
  },
};

// ---------------- LEARN ----------------
Views.learn = {
  render() {
    const { grade, subjectId } = GVS.learnPath;
    if (grade && subjectId) return this.renderSubject(grade, subjectId);
    if (grade) return this.renderGrade(grade);
    return `
    <section class="section">
      <h2>Learning Hub</h2>
      <p class="muted">Choose your grade to continue learning.</p>
      <div id="grade-grid" class="course-grid">${skeletons(6)}</div>
    </section>`;
  },
  renderGrade(grade) {
    return `
    <section class="section">
      <div class="breadcrumb"><button data-back-learn="root">Learn</button> / Grade ${grade}</div>
      <h2>Grade ${grade} Subjects</h2>
      <div id="subject-grid" class="course-grid">${skeletons(6)}</div>
    </section>`;
  },
  renderSubject(grade, subjectId) {
    return `
    <section class="section">
      <div class="breadcrumb"><button data-back-learn="root">Learn</button> / <button data-back-learn="grade">Grade ${grade}</button> / <span id="subject-name">Subject</span></div>
      <h2 id="subject-title">Subject</h2>
      <div class="grid four">
        <button class="tile"><span class="ic">🎬</span><b>Video Lessons</b><span>Watch & resume</span></button>
        <button class="tile"><span class="ic">📝</span><b>Notes</b><span>Downloadable PDFs</span></button>
        <button class="tile"><span class="ic">❓</span><b>Quiz</b><span>Test yourself</span></button>
        <button class="tile" data-nav="ai"><span class="ic">🤖</span><b>Ask AI Teacher</b><span>Get help now</span></button>
      </div>
      <div class="state-box" style="margin-top:16px">
        <span class="emoji">🚧</span>
        <b>Content coming from GVS LMS</b>
        <p>Video lessons, notes and quizzes for this subject are published by GVS administrators through the admin panel and will appear here once added.</p>
      </div>
    </section>`;
  },
  async afterRender() {
    const { grade, subjectId } = GVS.learnPath;
    try {
      if (!grade) {
        const { grades } = await API.get('/api/content/grades');
        document.querySelector('#grade-grid').innerHTML = grades
          .map((g) => `<button class="course" data-grade="${g.grade}"><span>GRADE ${g.grade}</span><b>Continue Learning</b><small>${g.subjects.length} subjects</small></button>`)
          .join('') || stateBox({ title: 'No grades published yet', body: 'An administrator has not published grade content yet.' });
      } else if (grade && !subjectId) {
        const { grade: g } = await API.get(`/api/content/grades/${grade}`);
        document.querySelector('#subject-grid').innerHTML = g.subjects
          .map((s) => `<button class="course" data-subject="${s.id}"><span>SUBJECT</span><b>${esc(s.name)}</b><small>Videos • Notes • Quiz</small></button>`)
          .join('');
      } else {
        const { grade: g } = await API.get(`/api/content/grades/${grade}`);
        const subj = g.subjects.find((s) => s.id === subjectId);
        if (subj) {
          document.querySelector('#subject-title').textContent = subj.name;
          document.querySelector('#subject-name').textContent = subj.name;
        }
      }
    } catch (e) {
      const target = document.querySelector('#grade-grid') || document.querySelector('#subject-grid');
      if (target) target.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load learning content', body: e.message, retry: true });
    }
  },
};

// ---------------- LIVE CLASSES ----------------
Views.classes = {
  render() {
    return `
    <section class="section">
      <div class="section-head"><h2>Live Classes</h2></div>
      <div class="pill live" style="margin-bottom:14px">🔴 LIVE NOW</div>
      <div id="live-now" class="grid two">${skeletons(1)}</div>
      <div class="section-head" style="margin-top:24px"><h3>Upcoming Classes</h3></div>
      <div id="live-upcoming" class="grid two">${skeletons(2)}</div>
      <div class="section-head" style="margin-top:24px"><h3>Completed Classes</h3></div>
      <div id="live-completed" class="grid two">${skeletons(1)}</div>
    </section>`;
  },
  async afterRender() {
    try {
      const { liveClasses } = await API.get('/api/content/live-classes');
      const groups = { live: [], upcoming: [], completed: [] };
      liveClasses.forEach((c) => groups[c.computedStatus].push(c));
      document.querySelector('#live-now').innerHTML = groups.live.length
        ? groups.live.map(cardFor).join('')
        : stateBox({ emoji: '🔴', title: 'No class is live right now', body: 'Live sessions will appear here automatically at their scheduled time.' });
      document.querySelector('#live-upcoming').innerHTML = groups.upcoming.length
        ? groups.upcoming.map(cardFor).join('')
        : stateBox({ emoji: '🗓️', title: 'No upcoming classes scheduled', body: 'Check back after an administrator schedules the next session.' });
      document.querySelector('#live-completed').innerHTML = groups.completed.length
        ? groups.completed.slice(0, 6).map(cardFor).join('')
        : stateBox({ emoji: '✅', title: 'No completed classes yet', body: 'Past sessions will be listed here.' });
    } catch (e) {
      document.querySelector('#live-now').innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load live classes', body: e.message, retry: true });
    }
    function cardFor(c) {
      return `<div class="card"><span class="pill ${c.computedStatus === 'live' ? 'live' : ''}">${esc(c.subject)} · Grade ${esc(c.grade)}</span>
        <b>${esc(c.teacher || 'GVS Teacher')}</b><span class="muted">${esc(c.date)} · ${esc(c.time)}</span>
        ${c.joinUrl && c.computedStatus !== 'completed' ? `<a class="primary" style="text-align:center;text-decoration:none;margin-top:6px" href="${esc(c.joinUrl)}" target="_blank" rel="noopener">Join</a>` : ''}</div>`;
    }
  },
};

// ---------------- UPDATES ----------------
Views.updates = {
  render() {
    return `
    <section class="section">
      <div class="section-head"><h2>GVS Updates</h2><button class="link-btn" id="refresh-updates">↻ Refresh</button></div>
      <div class="tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${['all', 'announcement', 'course', 'event', 'notice'].map((c) => `<button class="ghost" data-cat="${c}" style="padding:8px 14px">${c === 'all' ? 'Latest' : c[0].toUpperCase() + c.slice(1) + 's'}</button>`).join('')}
      </div>
      <div id="updates-status" class="muted" style="margin-bottom:8px"></div>
      <div id="updates-feed" class="feed">${skeletons(4)}</div>
    </section>`;
  },
  async afterRender() {
    let category = '';
    const load = async (refresh = false) => {
      document.querySelector('#updates-feed').innerHTML = skeletons(4);
      await FeedWidget.loadInto('#updates-feed', { statusEl: '#updates-status', refresh, category });
    };
    document.querySelectorAll('[data-cat]').forEach((btn) =>
      btn.addEventListener('click', () => {
        category = btn.dataset.cat === 'all' ? '' : btn.dataset.cat;
        load();
      })
    );
    document.querySelector('#refresh-updates').addEventListener('click', () => load(true));
    await load();
  },
};

// ---------------- AI TEACHER ----------------
Views.ai = {
  render() {
    return `
    <section class="section">
      <h2>AI Teacher</h2>
      <div class="ai-box">
        <div class="ai-avatar">🤖</div>
        <h3>Ask your AI Teacher</h3>
        <p class="muted">Explain a lesson, practice a topic, or ask a question in English, Urdu or Pashto.</p>
        <div style="display:flex;gap:10px;margin:10px 0;flex-wrap:wrap">
          <select id="ai-lang"><option>English</option><option>Urdu</option><option>Pashto</option></select>
          <select id="ai-grade"><option value="">Any grade</option>${[6, 7, 8, 9, 10, 11, 12].map((g) => `<option value="${g}">Grade ${g}</option>`).join('')}</select>
        </div>
        <div class="ai-quick">
          <button data-q="Explain this topic simply.">Explain simply</button>
          <button data-q="Give me five MCQs about this topic.">5 MCQs</button>
          <button data-q="Quiz me about this topic.">Quiz me</button>
          <button data-q="Give me a hint, not the answer.">Hint</button>
          <button data-q="Summarize this topic in a few sentences.">Summarize</button>
        </div>
        <textarea id="ai-question" placeholder="e.g. Explain photosynthesis"></textarea>
        <button class="primary" id="ai-ask">Ask AI Teacher</button>
        <div id="ai-result"></div>
      </div>
    </section>`;
  },
  afterRender() {
    if (!GVS.isAuthed()) {
      document.querySelector('#ai-result').innerHTML = `<div class="form-error" style="margin-top:14px">Please <button class="link-btn" data-nav="login" style="padding:0">log in</button> to use the AI Teacher.</div>`;
    }
    document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => (document.querySelector('#ai-question').value = b.dataset.q)));
    document.querySelector('#ai-ask').addEventListener('click', async () => {
      const question = document.querySelector('#ai-question').value.trim();
      const resultEl = document.querySelector('#ai-result');
      if (!question) { resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">Please type a question first.</div>`; return; }
      if (!GVS.isAuthed()) { resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">Please log in to use the AI Teacher.</div>`; return; }
      resultEl.innerHTML = `<div class="ai-answer">Thinking…</div>`;
      try {
        const language = document.querySelector('#ai-lang').value;
        const gradeContext = document.querySelector('#ai-grade').value;
        const res = await API.post('/api/ai/ask', { question, language, gradeContext });
        if (res.configured && res.answer) {
          resultEl.innerHTML = `<div class="ai-answer">${esc(res.answer)}</div><div class="ai-disclaimer">${esc(res.disclaimer || '')}</div>`;
        } else {
          const kb = (res.knowledgeBaseMatches || []).map((k) => `<div class="ai-answer">${esc(k.topic)}: ${esc(k.content)}</div>`).join('');
          resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">${esc(res.message || res.error || 'AI Teacher is unavailable right now.')}</div>${kb}`;
        }
      } catch (e) {
        resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">${esc(e.message)}</div>`;
      }
    });
  },
};

// ---------------- LANGUAGE ACADEMY ----------------
Views.languages = {
  render() {
    return `
    <section class="section">
      <h2>GVS Language Academy</h2>
      <p class="muted">Free online language learning.</p>
      <div id="lang-grid" class="course-grid langs">${skeletons(5)}</div>
    </section>`;
  },
  async afterRender() {
    try {
      const { courses } = await API.get('/api/content/language-courses');
      document.querySelector('#lang-grid').innerHTML = courses
        .map((c) => `<button class="course"><span>${c.flag} LANGUAGE COURSE</span><b>${esc(c.name)}</b><small>${esc(c.overview || '')}</small></button>`)
        .join('');
    } catch (e) {
      document.querySelector('#lang-grid').innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load courses', body: e.message, retry: true });
    }
  },
};

// ---------------- PROFILE ----------------
Views.profile = {
  render() {
    if (!GVS.isAuthed()) {
      return `
      <section class="section">
        <div class="state-box">
          <span class="emoji">👤</span>
          <b>You're not signed in</b>
          <p>Log in to see your profile, progress and dashboard.</p>
          <button class="primary" data-nav="login">Log in</button>
          <button class="secondary" data-nav="register" style="margin-top:8px">Create an account</button>
        </div>
      </section>`;
    }
    const u = GVS.user;
    return `
    <section class="section">
      <div class="card" style="align-items:flex-start">
        <b style="font-size:18px">${esc(u.name)}</b>
        <span class="pill">${esc(u.role)}</span>
        ${u.grade ? `<span class="muted">Grade ${esc(u.grade)}</span>` : ''}
        ${u.school ? `<span class="muted">${esc(u.school)}</span>` : ''}
      </div>
      <div class="grid two" style="margin-top:14px">
        <button class="tile" data-nav="dashboard"><span class="ic">📊</span><b>My Dashboard</b><span>Progress & activity</span></button>
        <button class="tile" data-external="lms"><span class="ic">🎓</span><b>Official LMS</b><span>lms.gvskp.org</span></button>
        <button class="tile" data-external="website"><span class="ic">🌐</span><b>Official Website</b><span>gvskp.org</span></button>
        <button class="tile" data-external="facebook"><span class="ic">📘</span><b>GVS Facebook</b><span>Official page</span></button>
        <button class="tile" id="logout-btn"><span class="ic">🚪</span><b>Logout</b><span>End your session</span></button>
      </div>
    </section>`;
  },
  afterRender() {
    const btn = document.querySelector('#logout-btn');
    if (btn) btn.addEventListener('click', () => { GVS.logout(); Router.go('home'); });
  },
};

// ---------------- LOGIN / REGISTER ----------------
Views.login = {
  render() {
    return `
    <section class="section">
      <div class="form-card">
        <h2>Log in</h2>
        <label>Email</label><input type="email" id="login-email" />
        <label>Password</label><input type="password" id="login-password" />
        <button class="primary" id="login-submit" style="width:100%;margin-top:16px">Log in</button>
        <div id="login-msg"></div>
        <p class="muted" style="margin-top:14px">No account? <button class="link-btn" data-nav="register">Register</button></p>
      </div>
    </section>`;
  },
  afterRender() {
    document.querySelector('#login-submit').addEventListener('click', async () => {
      const email = document.querySelector('#login-email').value.trim();
      const password = document.querySelector('#login-password').value;
      const msg = document.querySelector('#login-msg');
      try {
        const res = await API.post('/api/auth/login', { email, password });
        GVS.setSession(res.token, res.user);
        msg.innerHTML = `<div class="form-success">Welcome back, ${esc(res.user.name)}.</div>`;
        setTimeout(() => Router.go('profile'), 400);
      } catch (e) {
        msg.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
      }
    });
  },
};

Views.register = {
  render() {
    return `
    <section class="section">
      <div class="form-card">
        <h2>Create Account</h2>
        <label>Full Name</label><input type="text" id="reg-name" />
        <label>Email</label><input type="email" id="reg-email" />
        <label>Password (min 8 characters)</label><input type="password" id="reg-password" />
        <label>I am a</label>
        <select id="reg-role"><option value="student">Student</option><option value="teacher">Teacher</option><option value="parent">Parent / Guardian</option><option value="school">School Representative</option></select>
        <label>Grade (students only)</label><select id="reg-grade"><option value="">—</option>${[6, 7, 8, 9, 10, 11, 12].map((g) => `<option value="${g}">Grade ${g}</option>`).join('')}</select>
        <button class="primary" id="reg-submit" style="width:100%;margin-top:16px">Create Account</button>
        <div id="reg-msg"></div>
        <p class="muted" style="margin-top:14px">Prefer the official system? <a href="https://gvskp.org/admission" target="_blank" rel="noopener">Register via gvskp.org/admission</a></p>
      </div>
    </section>`;
  },
  afterRender() {
    document.querySelector('#reg-submit').addEventListener('click', async () => {
      const body = {
        name: document.querySelector('#reg-name').value.trim(),
        email: document.querySelector('#reg-email').value.trim(),
        password: document.querySelector('#reg-password').value,
        role: document.querySelector('#reg-role').value,
        grade: document.querySelector('#reg-grade').value || undefined,
      };
      const msg = document.querySelector('#reg-msg');
      try {
        const res = await API.post('/api/auth/register', body);
        GVS.setSession(res.token, res.user);
        msg.innerHTML = `<div class="form-success">Account created. Welcome, ${esc(res.user.name)}.</div>`;
        setTimeout(() => Router.go('profile'), 400);
      } catch (e) {
        msg.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
      }
    });
  },
};

// ---------------- DASHBOARD ----------------
Views.dashboard = {
  render() {
    if (!GVS.isAuthed()) return stateBoxWrap('Please log in to view your dashboard.');
    return `<section class="section"><h2>My Dashboard</h2><div id="dash-body">${skeletons(3)}</div></section>`;
  },
  async afterRender() {
    if (!GVS.isAuthed()) return;
    const role = GVS.user.role;
    const el = document.querySelector('#dash-body');
    try {
      if (role === 'student') {
        const d = await API.get('/api/dashboard/student');
        const p = d.progress;
        el.innerHTML = `
          <p>Welcome, <b>${esc(d.user.name)}</b> — Grade ${esc(d.user.grade || '—')}</p>
          <div class="stat-grid">
            <div class="stat-card"><b>${p.overall || 0}%</b><span>Overall Progress</span></div>
            <div class="stat-card"><b>${(p.completedLessons || []).length}</b><span>Completed Lessons</span></div>
            <div class="stat-card"><b>${p.streakDays || 0}</b><span>Day Streak</span></div>
          </div>
          <div class="section-head" style="margin-top:20px"><h3>Upcoming Classes</h3></div>
          <div class="grid two">${d.upcomingClasses.length ? d.upcomingClasses.map((c) => `<div class="card"><b>${esc(c.subject)}</b><span class="muted">${esc(c.date)} ${esc(c.time)}</span></div>`).join('') : stateBox({ title: 'No upcoming classes', body: 'Nothing scheduled yet.' })}</div>`;
      } else if (role === 'teacher') {
        const d = await API.get('/api/dashboard/teacher');
        el.innerHTML = `<div class="stat-grid"><div class="stat-card"><b>${d.classes.length}</b><span>My Classes</span></div><div class="stat-card"><b>${d.studentCount}</b><span>My Students</span></div></div>
        <div class="section-head" style="margin-top:20px"><h3>AI Teaching Assistant</h3></div>
        <p class="muted">Use the AI Teacher screen to generate lesson plans, MCQs and revision exercises for your classes.</p>
        <button class="primary" data-nav="ai">Open AI Teacher</button>`;
      } else if (role === 'parent') {
        const d = await API.get('/api/dashboard/parent');
        el.innerHTML = d.children.length
          ? d.children.map((c) => `<div class="card"><b>${esc(c.name)}</b><span class="muted">Grade ${esc(c.grade || '—')}</span>${c.progress ? `<div class="progress-bar"><span style="width:${c.progress.overall || 0}%"></span></div>` : ''}</div>`).join('')
          : stateBox({ title: 'No linked children yet', body: 'Ask your school/admin to link your child\'s account to enable the parent dashboard.' });
      } else if (role === 'school' || role === 'admin') {
        const d = await API.get('/api/dashboard/school');
        el.innerHTML = `<div class="stat-grid"><div class="stat-card"><b>${d.totals.students}</b><span>Students</span></div><div class="stat-card"><b>${d.totals.teachers}</b><span>Teachers</span></div><div class="stat-card"><b>${d.totals.classes}</b><span>Classes</span></div></div>`;
      }
    } catch (e) {
      el.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load dashboard', body: e.message, retry: true });
    }
  },
};

function stateBoxWrap(msg) {
  return `<section class="section">${stateBox({ emoji: '🔒', title: 'Sign in required', body: msg })}<button class="primary" data-nav="login" style="margin-top:14px">Log in</button></section>`;
}

// ---------------- Shared Facebook feed widget ----------------
const FeedWidget = {
  async loadInto(selector, { limit, statusEl, refresh, category } = {}) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      const qs = new URLSearchParams();
      if (refresh) qs.set('refresh', '1');
      const [fb, upd] = await Promise.all([
        API.get(`/api/facebook/feed${qs.toString() ? '?' + qs.toString() : ''}`).catch((e) => ({ error: e.message, posts: [] })),
        API.get(`/api/content/updates${category ? `?category=${category}` : ''}`).catch(() => ({ updates: [] })),
      ]);

      if (statusEl) {
        const s = document.querySelector(statusEl);
        if (s) s.textContent = statusLabel(fb);
      }

      const items = [
        ...(upd.updates || []).map((u) => ({
          title: u.title, body: u.body, image: u.imageUrl, date: u.date, link: u.link, source: 'GVS', kind: 'update',
        })),
        ...(fb.posts || []).map((p) => ({
          title: null, body: p.message, image: p.full_picture, date: p.created_time, link: p.permalink_url, source: 'GVS Facebook', kind: 'facebook',
        })),
      ];

      const limited = limit ? items.slice(0, limit) : items;

      if (limited.length === 0) {
        el.innerHTML = renderFeedEmpty(fb);
        return;
      }
      el.innerHTML = limited.map(renderPost).join('');
    } catch (e) {
      el.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load GVS updates.', body: e.message, retry: true });
      const retryBtn = el.querySelector('[data-retry]');
      if (retryBtn) retryBtn.addEventListener('click', () => this.loadInto(selector, { limit, statusEl, refresh: true, category }));
    }
  },
};

function statusLabel(fb) {
  if (!fb.configured) return 'Official Facebook updates will appear here when the GVS Page connection is activated.';
  if (fb.status === 'live') return `Live GVS updates · Last updated: ${fmtDate(fb.updatedAt)}`;
  if (fb.status === 'cache') return `Live GVS updates (cached) · Last updated: ${fmtDate(fb.updatedAt)}`;
  if (fb.status === 'stale_cache') return `Showing recently cached GVS updates · Last updated: ${fmtDate(fb.updatedAt)}`;
  if (fb.status === 'error') return 'Live Facebook updates are temporarily unavailable.';
  return '';
}

function renderFeedEmpty(fb) {
  if (!fb.configured) {
    return stateBox({ emoji: '📘', title: 'GVS Updates', body: 'Official Facebook updates will appear here when the GVS Page connection is activated.' }) +
      `<div style="grid-column:1/-1;text-align:center;margin-top:-10px"><a class="secondary" style="text-decoration:none;display:inline-block;padding:12px 18px;border-radius:13px" href="https://www.facebook.com/profile.php?id=61592435229097" target="_blank" rel="noopener">View GVS Facebook Page</a></div>`;
  }
  return stateBox({ emoji: '📭', title: 'No updates yet', body: fb.message || 'Nothing published yet.', retry: true }) +
    `<div style="grid-column:1/-1;text-align:center;margin-top:-10px"><a class="secondary" style="text-decoration:none;display:inline-block;padding:12px 18px;border-radius:13px" href="https://www.facebook.com/profile.php?id=61592435229097" target="_blank" rel="noopener">Open Facebook</a></div>`;
}

function renderPost(p) {
  return `<article class="post">
    ${p.image ? `<img src="${esc(p.image)}" alt="GVS update" loading="lazy">` : ''}
    <div class="post-body">
      <span class="pill ${p.kind === 'facebook' ? 'gold' : ''}">${p.kind === 'facebook' ? 'GVS Facebook' : 'GVS'}</span>
      <div class="post-date">${fmtDate(p.date)}</div>
      ${p.title ? `<b>${esc(p.title)}</b>` : ''}
      <p>${esc((p.body || '').slice(0, 260))}${(p.body || '').length > 260 ? '…' : ''}</p>
      <div class="post-actions">
        ${p.link ? `<a class="readmore" href="${esc(p.link)}" target="_blank" rel="noopener">Open original →</a>` : ''}
        ${p.link ? `<button data-share="${esc(p.link)}">Share</button>` : ''}
      </div>
    </div>
  </article>`;
}

// ---------------- Shared upcoming live classes widget ----------------
const LiveClassesWidget = {
  async loadUpcomingInto(selector, limit) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      const { liveClasses } = await API.get('/api/content/live-classes?status=upcoming');
      const items = liveClasses.slice(0, limit);
      el.innerHTML = items.length
        ? items.map((c) => `<div class="card"><span class="pill">${esc(c.subject)} · Grade ${esc(c.grade)}</span><b>${esc(c.teacher || 'GVS Teacher')}</b><span class="muted">${esc(c.date)} · ${esc(c.time)}</span></div>`).join('')
        : stateBox({ emoji: '🗓️', title: 'No upcoming classes', body: 'Scheduled sessions will appear here.' });
    } catch (e) {
      el.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load classes', body: e.message, retry: true });
    }
  },
};
