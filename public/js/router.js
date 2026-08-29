const Router = {
  routes: ['home', 'learn', 'classes', 'updates', 'ai', 'languages', 'profile', 'login', 'register', 'dashboard', 'admin'],
  bottomNavViews: ['home', 'learn', 'classes', 'updates', 'profile'],

  go(view) {
    if (!this.routes.includes(view)) view = 'home';
    if (view !== 'learn') GVS.learnPath = { grade: null, subjectId: null, section: null };
    if (view !== 'languages') GVS.languageCourseId = null;
    location.hash = `#/${view}`;
  },

  async render() {
    const hash = location.hash.replace(/^#\//, '') || 'home';
    const [view, a, b, c] = hash.split('/');
    const resolvedView = this.routes.includes(view) ? view : 'home';

    if (resolvedView === 'learn') {
      // section is the 4th path segment -- 'videos' | 'notes' | 'quiz' --
      // selected from the subject page's three cards; null on the plain
      // grade/subject pages, same as subjectId is null on the plain
      // grade page.
      GVS.learnPath = { grade: a || null, subjectId: b || null, section: c || null };
    }
    if (resolvedView === 'languages') {
      GVS.languageCourseId = a || null;
    }

    GVS.view = resolvedView;
    const main = document.querySelector('#main');
    const impl = Views[resolvedView] || Views.home;
    main.innerHTML = impl.render();
    this.updateBottomNav();
    if (impl.afterRender) await impl.afterRender();
  },

  // Event delegation: one listener attached once to the stable #main
  // container (never itself replaced — only its innerHTML changes) rather
  // than binding each [data-*] element individually at render time. Views
  // like Learn/Languages inject their real content (grade cards, subject
  // cards, language course cards, share buttons) asynchronously inside
  // afterRender(), *after* the initial render() call — attaching listeners
  // to a point-in-time querySelectorAll() snapshot missed anything added
  // later. Delegation on the container fixes that for all current and
  // future dynamically-injected content, with no per-render rebinding.
  initDelegatedEvents() {
    document.querySelector('#main').addEventListener('click', (event) => {
      const el = event.target.closest(
        '[data-nav],[data-external],[data-grade],[data-subject],[data-section],[data-back-learn],[data-course],[data-back-languages],[data-share],[data-retry]'
      );
      if (!el) return;

      if (el.dataset.nav !== undefined) { this.go(el.dataset.nav); return; }
      if (el.dataset.external !== undefined) {
        const map = { website: GVS.config?.website, admissions: GVS.config?.admissions, lms: GVS.config?.lms, facebook: GVS.config?.facebookUrl };
        const url = map[el.dataset.external];
        if (url) window.open(url, '_blank', 'noopener');
        return;
      }
      // Not this.go() — go() validates against the flat `routes` list
      // (bare names like "learn"), so a compound path like "learn/6"
      // would fail that check and silently fall back to home. Set the
      // hash directly instead, same as the subject/course handlers below.
      if (el.dataset.grade !== undefined) { location.hash = `#/learn/${el.dataset.grade}`; return; }
      if (el.dataset.subject !== undefined) { location.hash = `#/learn/${GVS.learnPath.grade}/${el.dataset.subject}`; return; }
      if (el.dataset.section !== undefined) { location.hash = `#/learn/${GVS.learnPath.grade}/${GVS.learnPath.subjectId}/${el.dataset.section}`; return; }
      if (el.dataset.backLearn !== undefined) {
        location.hash =
          el.dataset.backLearn === 'root' ? '#/learn'
          : el.dataset.backLearn === 'grade' ? `#/learn/${GVS.learnPath.grade}`
          : `#/learn/${GVS.learnPath.grade}/${GVS.learnPath.subjectId}`; // 'subject' -- back from a video/notes/quiz section
        return;
      }
      if (el.dataset.course !== undefined) { location.hash = `#/languages/${el.dataset.course}`; return; }
      if (el.dataset.backLanguages !== undefined) { location.hash = '#/languages'; return; }
      if (el.dataset.share !== undefined) {
        const url = el.dataset.share;
        (async () => {
          if (navigator.share) { try { await navigator.share({ url }); return; } catch { /* cancelled */ } }
          try { await navigator.clipboard.writeText(url); el.textContent = 'Link copied'; } catch { window.open(url, '_blank', 'noopener'); }
        })();
        return;
      }
      if (el.dataset.retry !== undefined) { this.render(); }
    });
  },

  updateBottomNav() {
    document.querySelectorAll('.bottom button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === GVS.view || (btn.dataset.view === 'learn' && GVS.view === 'learn'));
    });
  },
};
