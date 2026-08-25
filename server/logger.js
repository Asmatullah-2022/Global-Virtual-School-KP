// Minimal structured logger. Replace with a proper logging/audit pipeline in production.
function line(level, msg, meta) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  const out = JSON.stringify(entry);
  if (level === 'error') console.error(out);
  else console.log(out);
}

export const logger = {
  info: (msg, meta) => line('info', msg, meta),
  warn: (msg, meta) => line('warn', msg, meta),
  error: (msg, meta) => line('error', msg, meta),
  audit: (action, meta) => line('audit', action, meta),
};

export default logger;
