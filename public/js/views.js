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

    <section class="stats">
      <div><b>6–12</b><span>Grades</span></div>
      <div><b>24/7</b><span>AI Teacher</span></div>
      <div><b>5</b><span>Languages</span></div>
      <div><b>KP</b><span>Province-wide</span></div>
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
          <select id="ai-grade"><option value="">Any grade</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => `<option value="${g}">Grade ${g}</option>`).join('')}</select>
        </div>
        <div class="ai-quick">
          <button data-q="Explain this topic simply.">Explain simply</button>
          <button data-q="Give me five MCQs about this topic." data-mode="mcq5">5 MCQs</button>
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
    // Tracks which quick-action button (if any) was last clicked, so its
    // structured `mode` rides along with the next Ask -- set only by a
    // button that declares data-mode (currently just "5 MCQs"; every
    // other quick action has no data-mode and leaves this null, so their
    // requests are byte-identical to before this feature existed).
    // Cleared the moment the student actually types into the textarea
    // (a genuine keystroke fires 'input'; setting .value programmatically
    // via the click handler below does not), since editing the question
    // means they've moved on from the canned MCQ prompt.
    let activeMode = null;
    document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      document.querySelector('#ai-question').value = b.dataset.q;
      activeMode = b.dataset.mode || null;
    }));
    document.querySelector('#ai-question').addEventListener('input', () => { activeMode = null; });
    document.querySelector('#ai-ask').addEventListener('click', async () => {
      const question = document.querySelector('#ai-question').value.trim();
      const resultEl = document.querySelector('#ai-result');
      if (!question) { resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">Please type a question first.</div>`; return; }
      if (!GVS.isAuthed()) { resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">Please log in to use the AI Teacher.</div>`; return; }
      resultEl.innerHTML = `<div class="ai-answer">Thinking…</div>`;
      try {
        const language = document.querySelector('#ai-lang').value;
        const gradeContext = document.querySelector('#ai-grade').value;
        const res = await API.post('/api/ai/ask', { question, language, gradeContext, mode: activeMode });
        if (res.configured && res.answer) {
          // Urdu and Pashto are RTL scripts -- headings/bullets/rules
          // read correctly only when the container itself is marked RTL,
          // not just the text within it.
          const dir = language === 'Urdu' || language === 'Pashto' ? ' dir="rtl"' : '';
          resultEl.innerHTML = `<div class="ai-answer"${dir}>${mdToHtml(res.answer)}</div><div class="ai-disclaimer">${esc(res.disclaimer || '')}</div>`;
        } else {
          const kb = (res.knowledgeBaseMatches || []).map((k) => `<div class="ai-answer">${esc(k.topic)}: ${esc(k.content)}</div>`).join('');
          // res.errorCategory/res.error (when present) come from the AI
          // provider's own error response, never from anything secret --
          // shown here so a failure is diagnosable without opening
          // browser DevTools or needing server log access.
          const detail = res.errorCategory || res.error;
          resultEl.innerHTML = `<div class="form-error" style="margin-top:14px">${esc(res.message || 'AI Teacher is unavailable right now.')}${detail ? `<br><small>${esc(detail)}</small>` : ''}</div>${kb}`;
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
    if (GVS.languageCourseId) {
      return `
      <section class="section">
        <div class="breadcrumb"><button data-back-languages="1">Language Academy</button> / <span id="lang-course-name">Course</span></div>
        <div id="lang-course-body">${skeletons(2)}</div>
      </section>`;
    }
    return `
    <section class="section">
      <h2>GVS Language Academy</h2>
      <p class="muted">Free online language learning.</p>
      <div id="lang-grid" class="course-grid langs">${skeletons(5)}</div>
    </section>`;
  },
  async afterRender() {
    if (GVS.languageCourseId) return this.afterRenderDetail();
    try {
      const { courses } = await API.get('/api/content/language-courses');
      document.querySelector('#lang-grid').innerHTML = courses.length
        ? courses.map((c) => `<button class="course" data-course="${c.id}"><span>${c.flag} LANGUAGE COURSE</span><b>${esc(c.name)}</b><small>${esc(c.overview || '')}</small></button>`).join('')
        : stateBox({ emoji: '🌐', title: 'No language courses yet', body: 'An administrator has not published any courses yet.' });
    } catch (e) {
      document.querySelector('#lang-grid').innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load courses', body: e.message, retry: true });
    }
  },
  async afterRenderDetail() {
    const body = document.querySelector('#lang-course-body');
    try {
      const { course } = await API.get(`/api/content/language-courses/${GVS.languageCourseId}`);
      document.querySelector('#lang-course-name').textContent = course.name;
      body.innerHTML = `
        <div class="ai-box" style="max-width:100%">
          <div class="ai-avatar">${esc(course.flag)}</div>
          <h3>${esc(course.name)}</h3>
          <p class="muted">${esc(course.overview || '')}</p>
          <div class="grid four" style="margin-top:14px">
            <button class="tile"><span class="ic">📖</span><b>Vocabulary</b><span>${(course.lessons || []).length} items</span></button>
            <button class="tile"><span class="ic">🔊</span><b>Pronunciation</b><span>Listen & repeat</span></button>
            <button class="tile"><span class="ic">🎧</span><b>Listening</b><span>Practice audio</span></button>
            <button class="tile"><span class="ic">❓</span><b>Quiz</b><span>Test yourself</span></button>
          </div>
          <div class="progress-bar" style="margin-top:16px"><span style="width:0%"></span></div>
          <p class="muted" style="margin-top:6px">Your progress: 0%</p>
        </div>
        ${(course.lessons || []).length === 0 ? stateBox({ emoji: '🚧', title: 'Lessons coming soon', body: 'An administrator has not published lesson content for this course yet.' }) : ''}`;
    } catch (e) {
      body.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load course', body: e.message, retry: true });
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
        ${u.role === 'admin' ? `<button class="tile" data-nav="admin"><span class="ic">🛠️</span><b>Admin Dashboard</b><span>Manage content</span></button>` : ''}
        <button class="tile" data-external="lms"><span class="ic">🎓</span><b>Official LMS</b><span>lms.gvskp.org</span></button>
        <button class="tile" data-external="website"><span class="ic">🌐</span><b>Official Website</b><span>gvskp.org</span></button>
        <button class="tile" data-external="facebook"><span class="ic">📘</span><b>GVS Facebook</b><span>Official page</span></button>
        <button class="tile" id="logout-btn"><span class="ic">🚪</span><b>Logout</b><span>End your session</span></button>
      </div>
      <div class="section-head" style="margin-top:22px"><h3>Settings</h3></div>
      <div class="card" style="max-width:480px">
        <label style="font-size:12.5px;font-weight:700;color:var(--navy);display:flex;justify-content:space-between;align-items:center">Push notifications <input type="checkbox" id="pref-notify" ${localStorage.getItem('gvs_pref_notify') !== '0' ? 'checked' : ''} /></label>
        <label style="font-size:12.5px;font-weight:700;color:var(--navy);display:flex;justify-content:space-between;align-items:center;margin-top:10px">Low-bandwidth mode <input type="checkbox" id="pref-lowbw" ${localStorage.getItem('gvs_pref_lowbw') === '1' ? 'checked' : ''} /></label>
        <p class="muted" style="margin-top:10px">Preferences are saved on this device. Push delivery requires notification permission and a configured push service (not yet enabled — see README).</p>
      </div>
    </section>`;
  },
  afterRender() {
    const btn = document.querySelector('#logout-btn');
    if (btn) btn.addEventListener('click', () => { GVS.logout(); Router.go('home'); });
    const notify = document.querySelector('#pref-notify');
    if (notify) notify.addEventListener('change', () => localStorage.setItem('gvs_pref_notify', notify.checked ? '1' : '0'));
    const lowbw = document.querySelector('#pref-lowbw');
    if (lowbw) lowbw.addEventListener('change', () => localStorage.setItem('gvs_pref_lowbw', lowbw.checked ? '1' : '0'));
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
        msg.innerHTML = `<div class="form-error">${esc(apiErrorText(e))}</div>`;
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
    const btn = document.querySelector('#reg-submit');
    btn.addEventListener('click', async () => {
      const body = {
        name: document.querySelector('#reg-name').value.trim(),
        email: document.querySelector('#reg-email').value.trim(),
        password: document.querySelector('#reg-password').value,
        role: document.querySelector('#reg-role').value,
        grade: document.querySelector('#reg-grade').value || undefined,
      };
      const msg = document.querySelector('#reg-msg');
      // Visible feedback the instant the button is tapped, and a guard
      // against double-submit while the request is in flight — the
      // previous version gave no indication anything was happening until
      // the request settled, which made a slow/failed request look like
      // the tap did nothing at all.
      btn.disabled = true;
      btn.textContent = 'Creating account…';
      msg.innerHTML = '';
      try {
        const res = await API.post('/api/auth/register', body);
        if (res.token) {
          // The normal path: account created and a session issued in one step.
          GVS.setSession(res.token, res.user);
          msg.innerHTML = `<div class="form-success">Account created. Welcome, ${esc(res.user.name)}.</div>`;
          setTimeout(() => Router.go('profile'), 400);
        } else {
          // The account was still created successfully — the server just
          // couldn't also issue a session token this time (see
          // server/routes/auth.routes.js). Don't treat this as a failure:
          // send them to log in instead of silently doing nothing.
          msg.innerHTML = `<div class="form-success">${esc(res.authWarning || 'Account created. Please log in.')}</div>`;
          setTimeout(() => Router.go('login'), 900);
        }
      } catch (e) {
        msg.innerHTML = `<div class="form-error">${esc(apiErrorText(e))}</div>`;
        btn.disabled = false;
        btn.textContent = 'Create Account';
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

// ---------------- ADMIN DASHBOARD ----------------
Views.admin = {
  render() {
    if (!GVS.isAuthed() || GVS.user.role !== 'admin') {
      return stateBoxWrap('The admin dashboard is only available to GVS administrator accounts.');
    }
    return `
    <section class="section">
      <h2>Admin Dashboard</h2>
      <div class="admin-tabs" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${['overview', 'updates', 'liveClasses', 'languageCourses', 'users'].map((t, i) => `<button class="ghost admin-tab" data-tab="${t}" style="padding:9px 14px${i === 0 ? ';background:var(--green);color:#fff;border-color:var(--green)' : ''}">${adminTabLabel(t)}</button>`).join('')}
      </div>
      <div id="admin-body">${skeletons(3)}</div>
    </section>`;
  },
  afterRender() {
    if (!GVS.isAuthed() || GVS.user.role !== 'admin') return;
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach((btn) =>
      btn.addEventListener('click', () => {
        tabs.forEach((b) => { b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; });
        btn.style.background = 'var(--green)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--green)';
        renderAdminTab(btn.dataset.tab);
      })
    );
    renderAdminTab('overview');
  },
};

function adminTabLabel(t) {
  return { overview: 'Overview', updates: 'Updates', liveClasses: 'Live Classes', languageCourses: 'Language Courses', users: 'Users' }[t];
}

async function renderAdminTab(tab) {
  const body = document.querySelector('#admin-body');
  body.innerHTML = skeletons(3);
  try {
    if (tab === 'overview') return await renderAdminOverview(body);
    if (tab === 'updates') return await renderAdminCollection(body, 'updates', updateFieldSchema());
    if (tab === 'liveClasses') return await renderAdminCollection(body, 'liveClasses', liveClassFieldSchema());
    if (tab === 'languageCourses') return await renderAdminCollection(body, 'languageCourses', languageCourseFieldSchema());
    if (tab === 'users') return await renderAdminUsers(body);
  } catch (e) {
    body.innerHTML = stateBox({ emoji: '⚠️', title: 'Unable to load', body: e.message, retry: true });
    const retry = body.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', () => renderAdminTab(tab));
  }
}

async function renderAdminOverview(body) {
  const [status, analytics] = await Promise.all([API.get('/api/admin/system-status'), API.get('/api/admin/analytics')]);
  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><b>${status.facebook.configured ? '✅' : '⏳'}</b><span>Facebook Feed</span></div>
      <div class="stat-card"><b>${status.facebook.webhookConfigured ? '✅' : '⏳'}</b><span>Facebook Webhooks</span></div>
      <div class="stat-card"><b>${status.aiTeacher.configured ? '✅' : '⏳'}</b><span>AI Teacher (${esc(status.aiTeacher.provider || 'none')})</span></div>
    </div>
    <div class="section-head" style="margin-top:20px"><h3>Analytics</h3></div>
    <div class="stat-grid">
      <div class="stat-card"><b>${analytics.activeUsers}</b><span>Total Users</span></div>
      <div class="stat-card"><b>${analytics.liveClassesScheduled}</b><span>Live Classes</span></div>
      <div class="stat-card"><b>${analytics.languageCourseCount}</b><span>Language Courses</span></div>
    </div>
    <div class="section-head" style="margin-top:20px"><h3>Users by Role</h3></div>
    <div class="grid four">${Object.entries(analytics.byRole).map(([role, n]) => `<div class="card"><b>${n}</b><span class="muted">${esc(role)}</span></div>`).join('') || '<span class="muted">No users yet.</span>'}</div>
    <p class="muted" style="margin-top:16px">Environment: ${esc(status.environment)} · ${status.facebook.cachedPosts} cached Facebook posts</p>`;
}

async function renderAdminUsers(body) {
  const { users } = await API.get('/api/admin/users');
  body.innerHTML = users.length
    ? `<div style="overflow-x:auto"><table class="admin-table" style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line)"><th style="padding:8px">Name</th><th style="padding:8px">Email</th><th style="padding:8px">Role</th><th style="padding:8px">Grade</th><th style="padding:8px">School</th></tr></thead>
        <tbody>${users.map((u) => `<tr style="border-bottom:1px solid var(--line)"><td style="padding:8px">${esc(u.name)}</td><td style="padding:8px">${esc(u.email)}</td><td style="padding:8px">${esc(u.role)}</td><td style="padding:8px">${esc(u.grade || '—')}</td><td style="padding:8px">${esc(u.school || '—')}</td></tr>`).join('')}</tbody>
      </table></div>`
    : stateBox({ emoji: '👥', title: 'No users yet', body: 'Registered students, teachers, parents and schools will appear here.' });
}

function updateFieldSchema() {
  return [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'body', label: 'Body', type: 'textarea', required: true },
    { key: 'category', label: 'Category', type: 'select', options: ['announcement', 'course', 'event', 'notice'] },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'expiresAt', label: 'Expires At (optional)', type: 'date' },
    { key: 'imageUrl', label: 'Image URL (optional)', type: 'text' },
    { key: 'link', label: 'Link (optional)', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'] },
  ];
}
function liveClassFieldSchema() {
  return [
    { key: 'subject', label: 'Subject', type: 'text', required: true },
    { key: 'grade', label: 'Grade', type: 'select', options: ['6', '7', '8', '9', '10', '11', '12'], required: true },
    { key: 'teacher', label: 'Teacher', type: 'text' },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'time', label: 'Time', type: 'time', required: true },
    { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number' },
    { key: 'joinUrl', label: 'Join URL (admin-provided meeting link)', type: 'text' },
  ];
}
function languageCourseFieldSchema() {
  return [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'flag', label: 'Flag emoji', type: 'text' },
    { key: 'overview', label: 'Overview', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: ['published', 'unpublished'] },
  ];
}

async function renderAdminCollection(body, collection, schema) {
  const { items } = await API.get(`/api/admin/collections/${collection}`);
  body.innerHTML = `
    <button class="primary" id="admin-add-btn" style="margin-bottom:14px">+ Add New</button>
    <div id="admin-form-wrap"></div>
    <div id="admin-list" class="grid two">${items.length ? items.map((it) => adminItemCard(it, collection, schema)).join('') : stateBox({ emoji: '📭', title: 'Nothing here yet', body: 'Use "Add New" to publish the first item.' })}</div>`;

  document.querySelector('#admin-add-btn').addEventListener('click', () => {
    document.querySelector('#admin-form-wrap').innerHTML = adminForm(schema, {});
    bindAdminForm(collection, schema, null, body);
  });
  body.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const item = items.find((i) => i.id === btn.dataset.edit);
      document.querySelector('#admin-form-wrap').innerHTML = adminForm(schema, item);
      bindAdminForm(collection, schema, item.id, body);
    })
  );
  body.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this item? This cannot be undone.')) return;
      await API.del(`/api/admin/collections/${collection}/${btn.dataset.delete}`);
      renderAdminCollection(body, collection, schema);
    })
  );
}

function adminItemCard(item, collection, schema) {
  const primary = item.title || item.subject || item.name || item.id;
  const secondary = item.status || item.computedStatus || item.category || '';
  return `<div class="card">
    <b>${esc(primary)}</b><span class="pill">${esc(secondary)}</span>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="secondary" style="padding:8px 12px" data-edit="${item.id}">Edit</button>
      <button class="ghost" style="padding:8px 12px" data-delete="${item.id}">Delete</button>
    </div>
  </div>`;
}

function adminForm(schema, values) {
  const fields = schema
    .map((f) => {
      const val = esc(values[f.key] ?? '');
      if (f.type === 'textarea') return `<label>${f.label}</label><textarea data-field="${f.key}" style="width:100%;min-height:80px">${val}</textarea>`;
      if (f.type === 'select') return `<label>${f.label}</label><select data-field="${f.key}">${f.options.map((o) => `<option value="${o}" ${values[f.key] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      return `<label>${f.label}</label><input type="${f.type}" data-field="${f.key}" value="${val}" />`;
    })
    .join('');
  return `<div class="form-card" style="max-width:520px;margin:0 0 16px">
    ${fields}
    <button class="primary" id="admin-form-save" style="width:100%;margin-top:14px">Save</button>
    <div id="admin-form-msg"></div>
  </div>`;
}

function bindAdminForm(collection, schema, editId, body) {
  document.querySelector('#admin-form-save').addEventListener('click', async () => {
    const payload = {};
    schema.forEach((f) => {
      const el = document.querySelector(`[data-field="${f.key}"]`);
      payload[f.key] = f.type === 'number' ? Number(el.value) : el.value;
    });
    const msg = document.querySelector('#admin-form-msg');
    try {
      if (editId) await API.put(`/api/admin/collections/${collection}/${editId}`, payload);
      else await API.post(`/api/admin/collections/${collection}`, payload);
      document.querySelector('#admin-form-wrap').innerHTML = '';
      renderAdminCollection(body, collection, schema);
    } catch (e) {
      msg.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
    }
  });
}

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
          title: null, body: p.message, image: p.full_picture, date: p.created_time, link: p.permalink_url,
          source: p.isDemo ? 'Demo Content' : 'GVS Facebook', kind: p.isDemo ? 'demo' : 'facebook',
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
  if (fb.status === 'demo') return '🧪 Demo Content — real GVS Facebook updates will replace this once the Page connection is activated.';
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
  const badge = p.kind === 'demo' ? 'Demo Content' : p.kind === 'facebook' ? 'GVS Facebook' : 'GVS';
  const badgeClass = p.kind === 'facebook' ? 'gold' : p.kind === 'demo' ? 'live' : '';
  return `<article class="post ${p.kind === 'demo' ? 'post-demo' : ''}">
    ${p.image ? `<img src="${esc(p.image)}" alt="GVS update" loading="lazy">` : ''}
    <div class="post-body">
      <span class="pill ${badgeClass}">${esc(badge)}</span>
      <div class="post-date">${fmtDate(p.date)}</div>
      ${p.title ? `<b>${esc(p.title)}</b>` : ''}
      <p>${esc((p.body || '').slice(0, 260))}${(p.body || '').length > 260 ? '…' : ''}</p>
      <div class="post-actions">
        ${p.link ? `<a class="readmore" href="${esc(p.link)}" target="_blank" rel="noopener">Open original →</a>` : ''}
        ${p.link && p.kind !== 'demo' ? `<button data-share="${esc(p.link)}">Share</button>` : ''}
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
