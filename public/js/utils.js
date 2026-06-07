/* ─── SMASH STUDIO — Shared Utilities ─────────────────────────
   Loaded before main.js and booking.js.
   All timezone logic is Philippines (Asia/Manila, UTC+8).
   ─────────────────────────────────────────────────────────── */

// ── Timezone ─────────────────────────────────────────────────

/** Returns today's date as 'YYYY-MM-DD' in PH time. */
function getTodayPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** Returns current PH time as a decimal hour (e.g. 13.5 = 1:30 PM). */
function getNowHPH() {
  const ph = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return ph.getHours() + ph.getMinutes() / 60;
}

/** Returns a Date object's date as 'YYYY-MM-DD' in PH time. */
function getPhDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** True if the given Date object represents today in PH time. */
function isToday(d) {
  if (!d) return false;
  return getPhDate(d) === getTodayPH();
}

// ── Time string parsing ───────────────────────────────────────

/**
 * Parse any time string to a decimal hour.
 * Handles:
 *   '08:00:00' | '13:30:00'   (DB 24h)
 *   '8 AM' | '1 PM' | '8:30 AM' | '1:30 PM'  (booking labels, space)
 *   '8AM'  | '1PM'  | '8:30AM'               (main.js TIMES keys, no space)
 * Returns -1 if unparseable.
 */
function parseHourStr(t) {
  if (!t) return -1;
  const s = String(t).trim();
  // 24h format: '08:00:00' or '8:30'
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    return h + m / 60;
  }
  // AM/PM format (with or without space)
  const parts = s.replace(/\s*(AM|PM)/i, '').trim().split(':');
  let h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  if (/PM/i.test(s) && h !== 12) h += 12;
  if (/AM/i.test(s) && h === 12) h = 0;
  return h + m / 60;
}

/**
 * Convert a PostgreSQL time string '08:00:00' or '08:30:00' → TIMES/DZ_TIMES key.
 * Supports half-hours: '08:30:00' → '8:30AM', '13:30:00' → '1:30PM'.
 */
function pgTimeToLabel(pg) {
  const parts = pg.split(':');
  let h = parseInt(parts[0]);
  const m = parseInt(parts[1]) || 0;
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m > 0 ? `${h}:${String(m).padStart(2,'0')}${suffix}` : `${h}${suffix}`;
}

/**
 * Convert any slot time string to a TIMES/DZ_TIMES key.
 *
 * Handles:
 *   '08:00:00' | '08:30:00'         DB 24-hour (with or without seconds)
 *   '8:00 AM'  | '8:30 AM'          booking.js HOURS_30MIN labels (space before AM/PM)
 *   '8 AM'     | '1 PM'             booking.js HOURS_1HR labels
 *   '8AM'      | '8:30AM' | '1PM'   already-clean TIMES/DZ_TIMES keys
 *
 * Returns keys like '8AM', '8:30AM', '1PM', '1:30PM'.
 */
function slotTimeToKey(t) {
  if (!t) return '';
  const s = String(t).trim();

  // ── DB 24h format: '08:00:00' or '8:30' ─────────────────────
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return pgTimeToLabel(s);

  // ── AM/PM format: parse hour + optional minutes ──────────────
  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h   = parseInt(ampmMatch[1]);
    const m = parseInt(ampmMatch[2]) || 0;
    const suffix = ampmMatch[3].toUpperCase();
    return m > 0 ? `${h}:${String(m).padStart(2,'0')}${suffix}` : `${h}${suffix}`;
  }

  // ── Already a clean key — strip any internal spaces ──────────
  return s.replace(/\s+/g, '');
}

/** Convert decimal hour to 'HH:MM' 24h string (e.g. 13.5 → '13:30'). */
function fhToTime(fh) {
  const h = Math.floor(fh);
  const m = Math.round((fh - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Create a Date object for a given 'YYYY-MM-DD' string that reliably
 * represents that calendar day in PH time, regardless of browser timezone.
 * Uses UTC noon (04:00 UTC = 12:00 PH) to stay clear of all DST/offset edges.
 */
function phDateObj(ymdStr) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // UTC 04:00 = PH 12:00
}

/**
 * Add n days to a 'YYYY-MM-DD' string and return the new 'YYYY-MM-DD'.
 * Safe across any browser timezone.
 */
function addDaysPH(ymdStr, n) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 4, 0, 0));
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}
