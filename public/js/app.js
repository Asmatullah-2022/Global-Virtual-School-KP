(async function init() {
  GVS.loadUser();

  // --- Splash screen ---
  const splash = document.querySelector('#splash');
  const appEl = document.querySelector('#app');
  setTimeout(() => {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity .35s ease';
    setTimeout(() => splash.classList.add('hidden'), 350);
    appEl.classList.remove('hidden');
  }, 1100);

  // --- Load public config (page id, official links, facebook status) ---
  try {
    GVS.config = await API.get('/api/facebook/config');
  } catch {
    GVS.config = { website: 'https://gvskp.org/', admissions: 'https://gvskp.org/admission', lms: 'https://lms.gvskp.org/login', facebookUrl: 'https://www.facebook.com/profile.php?id=61592435229097' };
  }

  // --- Bottom nav ---
  document.querySelectorAll('.bottom button[data-view]').forEach((btn) => btn.addEventListener('click', () => Router.go(btn.dataset.view)));

  // --- Search overlay ---
  const searchOverlay = document.querySelector('#searchOverlay');
  document.querySelector('#searchBtn').addEventListener('click', () => {
    searchOverlay.classList.remove('hidden');
    document.querySelector('#searchInput').focus();
  });
  document.querySelector('#searchClose').addEventListener('click', () => searchOverlay.classList.add('hidden'));
  let searchTimer;
  document.querySelector('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(async () => {
      const resultsEl = document.querySelector('#searchResults');
      if (!q) { resultsEl.innerHTML = ''; return; }
      resultsEl.innerHTML = skeletons(3);
      try {
        const { results } = await API.get(`/api/content/search?q=${encodeURIComponent(q)}`);
        resultsEl.innerHTML = results.length
          ? results.map((r) => `<a class="result" href="#/${r.path.split('/')[0] === 'learn' ? r.path : r.path.split('/')[0]}"><small>${r.type.replace('-', ' ')}</small>${esc(r.title)}</a>`).join('')
          : stateBox({ emoji: '🔎', title: 'No results', body: `Nothing matched "${q}".` });
      } catch (e2) {
        resultsEl.innerHTML = stateBox({ emoji: '⚠️', title: 'Search unavailable', body: e2.message });
      }
    }, 300);
  });

  // --- Side menu ---
  const menuOverlay = document.querySelector('#menuOverlay');
  document.querySelector('#menuBtn').addEventListener('click', () => {
    renderMenu();
    menuOverlay.classList.remove('hidden');
  });
  document.querySelector('#menuClose').addEventListener('click', () => menuOverlay.classList.add('hidden'));
  function renderMenu() {
    const items = GVS.isAuthed()
      ? [
          { label: 'My Dashboard', nav: 'dashboard' },
          { label: 'Profile', nav: 'profile' },
          { label: 'About GVS', href: GVS.config?.website },
          { label: 'Official LMS', href: GVS.config?.lms },
          { label: 'GVS Facebook Page', href: GVS.config?.facebookUrl },
          { label: 'Logout', action: 'logout' },
        ]
      : [
          { label: 'Log in', nav: 'login' },
          { label: 'Student Registration', href: GVS.config?.admissions },
          { label: 'School Registration', href: GVS.config?.admissions },
          { label: 'About GVS', href: GVS.config?.website },
          { label: 'Official LMS', href: GVS.config?.lms },
          { label: 'GVS Facebook Page', href: GVS.config?.facebookUrl },
        ];
    const nav = document.querySelector('#menuNav');
    nav.innerHTML = items
      .map((it) => (it.href ? `<a href="${it.href}" target="_blank" rel="noopener">${it.label}</a>` : `<button data-menu-action="${it.nav || it.action}">${it.label}</button>`))
      .join('');
    nav.querySelectorAll('[data-menu-action]').forEach((btn) =>
      btn.addEventListener('click', () => {
        menuOverlay.classList.add('hidden');
        if (btn.dataset.menuAction === 'logout') { GVS.logout(); Router.go('home'); }
        else Router.go(btn.dataset.menuAction);
      })
    );
  }

  // --- Network / offline status ---
  const netStatus = document.querySelector('#netStatus');
  function updateNetStatus() {
    if (navigator.onLine) {
      netStatus.classList.add('hidden');
    } else {
      netStatus.textContent = '⚠ Offline — showing cached content where available.';
      netStatus.className = 'net-status offline';
      netStatus.classList.remove('hidden');
    }
  }
  window.addEventListener('online', () => { updateNetStatus(); Router.render(); });
  window.addEventListener('offline', updateNetStatus);
  updateNetStatus();

  // --- Router wiring ---
  window.addEventListener('hashchange', () => Router.render());
  if (!location.hash) location.hash = '#/home';
  await Router.render();

  // --- Service worker for app-shell offline caching ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
