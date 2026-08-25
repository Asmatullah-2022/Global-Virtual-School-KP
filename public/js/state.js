const GVS = {
  user: null,
  config: null,
  view: 'home',
  learnPath: { grade: null, subjectId: null },

  loadUser() {
    const raw = localStorage.getItem('gvs_user');
    this.user = raw ? JSON.parse(raw) : null;
    return this.user;
  },
  setSession(token, user) {
    localStorage.setItem('gvs_token', token);
    localStorage.setItem('gvs_user', JSON.stringify(user));
    this.user = user;
  },
  logout() {
    localStorage.removeItem('gvs_token');
    localStorage.removeItem('gvs_user');
    this.user = null;
  },
  isAuthed() {
    return Boolean(localStorage.getItem('gvs_token'));
  },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}
function skeletons(n = 4) {
  return Array.from({ length: n }).map(() => `<div class="skeleton-card"><div class="skel-line w60"></div><div class="skel-line w80"></div><div class="skel-line w40"></div></div>`).join('');
}
function stateBox({ emoji = '📭', title, body, retry }) {
  return `<div class="state-box"><span class="emoji">${emoji}</span><b>${esc(title)}</b><p>${esc(body)}</p>${retry ? `<button class="secondary" data-retry="1">Try Again</button>` : ''}</div>`;
}
