/* ── Smash Studio — Shared Utilities (ESM) ─────────────────── */

/** Returns today's date as 'YYYY-MM-DD' in PH time. */
export function getTodayPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** Returns current PH time as decimal hour (e.g. 13.5 = 1:30 PM). */
export function getNowHPH() {
  const ph = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return ph.getHours() + ph.getMinutes() / 60;
}

/** Returns a Date object's date as 'YYYY-MM-DD' in PH time. */
export function getPhDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** True if the given Date object represents today in PH time. */
export function isToday(d) {
  if (!d) return false;
  return getPhDate(d) === getTodayPH();
}

/** Parse any time string to a decimal hour. Returns -1 if unparseable. */
export function parseHourStr(t) {
  if (!t) return -1;
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    return h + m / 60;
  }
  const parts = s.replace(/\s*(AM|PM)/i, '').trim().split(':');
  let h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  if (/PM/i.test(s) && h !== 12) h += 12;
  if (/AM/i.test(s) && h === 12) h = 0;
  return h + m / 60;
}

/** Convert a PostgreSQL time string '08:00:00' → TIMES key e.g. '8AM'. */
export function pgTimeToLabel(pg) {
  const parts = pg.split(':');
  let h = parseInt(parts[0]);
  const m = parseInt(parts[1]) || 0;
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m > 0 ? `${h}:${String(m).padStart(2, '0')}${suffix}` : `${h}${suffix}`;
}

/** Convert any slot time string to a TIMES/DZ_TIMES key. */
export function slotTimeToKey(t) {
  if (!t) return '';
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return pgTimeToLabel(s);
  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h   = parseInt(ampmMatch[1]);
    const m = parseInt(ampmMatch[2]) || 0;
    const suffix = ampmMatch[3].toUpperCase();
    return m > 0 ? `${h}:${String(m).padStart(2, '0')}${suffix}` : `${h}${suffix}`;
  }
  return s.replace(/\s+/g, '');
}

/** Convert decimal hour to 'HH:MM' 24h string. */
export function fhToTime(fh) {
  const h = Math.floor(fh);
  const m = Math.round((fh - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** Create a stable Date object for 'YYYY-MM-DD' in PH time. */
export function phDateObj(ymdStr) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
}

/** Add n days to 'YYYY-MM-DD' and return new 'YYYY-MM-DD'. */
export function addDaysPH(ymdStr, n) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 4, 0, 0));
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

// ── Re-expose as globals for inline scripts still using them ──
window.getTodayPH   = getTodayPH;
window.getNowHPH    = getNowHPH;
window.getPhDate    = getPhDate;
window.isToday      = isToday;
window.parseHourStr = parseHourStr;
window.pgTimeToLabel= pgTimeToLabel;
window.slotTimeToKey= slotTimeToKey;
window.fhToTime     = fhToTime;
window.phDateObj    = phDateObj;
window.addDaysPH    = addDaysPH;
