const Router = {
  routes: ['home', 'learn', 'classes', 'updates', 'ai', 'languages', 'profile', 'login', 'register', 'dashboard'],
  bottomNavViews: ['home', 'learn', 'classes', 'updates', 'profile'],

  go(view) {
    if (!this.routes.includes(view)) view = 'home';
    if (view !== 'learn') GVS.learnPath = { grade: null, subjectId: null };
    location.hash = `#/${view}`;
  },

  async render() {
    const hash = location.hash.replace(/^#\//, '') || 'home';
    const [view, a, b] = hash.split('/');
    const resolvedView = this.routes.includes(view) ? view : 'home';

    if (resolvedView === 'learn') {
      GVS.learnPath = { grade: a || null, subjectId: b || null };
    }

    GVS.view = resolvedView;
    const main = document.querySelector('#main');
    const impl = Views[resolvedView] || Views.home;
    main.innerHTML = impl.render();
    this.bindGlobalActions(main);
    this.updateBottomNav();
    if (impl.afterRender) await impl.afterRender();
  },

  bindGlobalActions(scope) {
    scope.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => this.go(el.dataset.nav)));
    scope.querySelectorAll('[data-external]').forEach((el) =>
      el.addEventListener('click', () => {
        const map = { website: GVS.config?.website, admissions: GVS.config?.admissions, lms: GVS.config?.lms, facebook: GVS.config?.facebookUrl };
        const url = map[el.dataset.external];
        if (url) window.open(url, '_blank', 'noopener');
      })
    );
    scope.querySelectorAll('[data-grade]').forEach((el) => el.addEventListener('click', () => this.go(`learn/${el.dataset.grade}`)));
    scope.querySelectorAll('[data-subject]').forEach((el) =>
      el.addEventListener('click', () => {
        location.hash = `#/learn/${GVS.learnPath.grade}/${el.dataset.subject}`;
      })
    );
    scope.querySelectorAll('[data-back-learn]').forEach((el) =>
      el.addEventListener('click', () => {
        if (el.dataset.backLearn === 'root') location.hash = '#/learn';
        else location.hash = `#/learn/${GVS.learnPath.grade}`;
      })
    );
    scope.querySelectorAll('[data-share]').forEach((el) =>
      el.addEventListener('click', async () => {
        const url = el.dataset.share;
        if (navigator.share) { try { await navigator.share({ url }); return; } catch { /* cancelled */ } }
        try { await navigator.clipboard.writeText(url); el.textContent = 'Link copied'; } catch { window.open(url, '_blank', 'noopener'); }
      })
    );
    scope.querySelectorAll('[data-retry]').forEach((el) => el.addEventListener('click', () => this.render()));
  },

  updateBottomNav() {
    document.querySelectorAll('.bottom button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === GVS.view || (btn.dataset.view === 'learn' && GVS.view === 'learn'));
    });
  },
};
