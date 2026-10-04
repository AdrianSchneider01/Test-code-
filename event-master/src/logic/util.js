let counter = 0;

export function uid(prefix = 'id') {
  counter = (counter + 1) % 100000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function money(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const neg = n < 0;
  const v = Math.abs(round2(n));
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return `${neg ? '−' : ''}$${s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export { MONTHS };

// Dates are stored as 'YYYY-MM-DD' strings so they never shift with time zones.
export function toISODate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseISODate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function todayISO(now = new Date()) {
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDate(s, { withYear = true } = {}) {
  const p = parseISODate(s);
  if (!p) return 'Date not set';
  return `${p.d} ${MONTHS[p.m]}${withYear ? ` ${p.y}` : ''}`;
}

export function pluralise(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}
