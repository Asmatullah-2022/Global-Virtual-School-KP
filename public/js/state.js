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

// Minimal, dependency-free Markdown -> HTML renderer for AI Teacher
// answers. Not a full CommonMark implementation -- covers exactly what
// the AI provider's responses actually use: headings, bold, bullet and
// numbered lists, horizontal rules, and paragraph/line-break spacing.
// Every line is escaped via esc() before any markdown syntax is turned
// into tags, so raw AI output can never inject markup -- only the
// literal '**'/'#'/'*'/'-'/digit-dot syntax we explicitly recognize ever
// becomes an HTML tag.
function mdInline(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function mdToHtml(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null; // { tag: 'ul'|'ol', items: [] }

  function flushPara() {
    if (para.length) blocks.push(`<p>${para.map(mdInline).join('<br>')}</p>`);
    para = [];
  }
  function flushList() {
    if (list) {
      // start=N (only needed/emitted for 'ol') keeps a numbered list's
      // visible number correct even when it was re-opened as a fresh
      // single-item <ol> -- e.g. each MCQ question is its own <ol>
      // because the answer-option lines between them aren't list syntax,
      // so without this every question would render as "1." instead of
      // counting 1-5.
      const startAttr = list.tag === 'ol' && list.start != null ? ` start="${list.start}"` : '';
      blocks.push(`<${list.tag}${startAttr}>${list.items.map((it) => `<li>${mdInline(it)}</li>`).join('')}</${list.tag}>`);
    }
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) { flushPara(); flushList(); continue; }

    // Horizontal rule: a line made up of 3+ of the same '*', '-', or '_'
    // (optionally space-separated), and nothing else -- checked before
    // headings/bullets since "***" or "* * *" would otherwise look like
    // a malformed bullet/heading rather than a rule.
    if (/^(\*\s*){3,}$/.test(line) || /^(-\s*){3,}$/.test(line) || /^(_\s*){3,}$/.test(line)) {
      flushPara(); flushList(); blocks.push('<hr>'); continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${mdInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [], start: Number(numbered[1]) }; }
      list.items.push(numbered[2]);
      continue;
    }

    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks.join('');
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
// For a 500, the server includes a safe category + short request ID (no
// message/stack/paths — see server/middleware/errorHandler.js) so a
// failure can be reported and diagnosed without needing host log access.
function apiErrorText(e) {
  const category = e?.data?.category;
  const requestId = e?.data?.requestId;
  if (category && requestId) return `${e.message} (${category}, ref: ${requestId})`;
  return e?.message || 'Something went wrong.';
}
