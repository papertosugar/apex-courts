/* ─── SMASH STUDIO — Booking System JS ─────────────────────────
   ESM: utils/supabase imported by src/pages/book.js entry.
   globals (getTodayPH etc.) are exposed on window by src/utils.js
   ─────────────────────────────────────────────────────────── */

// ─── AUTH GUARD ───
(function() {
  const user = localStorage.getItem('apexUser');
  if (!user) {
    window.location.href = 'login.html?redirect=book.html';
  }
})();

// ─── STATE ───
// selectedSlots: [{ dateKey, date (Date), court, idx, label }]
const state = {
  sport: 'pickleball',
  selectedDate: null,
  selectedSlots: [],   // multi-slot, multi-date
  extras: new Set(),
  dateOffset: 0,
};

const PRICING = {
  court: 600,              // ₱600 / hr (peak)
  courtOffPeak: 480,       // ₱480 / hr (20% off, 7 AM–2 PM)
  drillZone: { base: 400, perBlock: 300 },          // peak
  drillZoneOffPeak: { base: 320, perBlock: 240 },   // 20% off, 7 AM–2 PM
  extras: {
    racket: { name: 'Racket Rental', desc: 'Premium Wilson racket', price: 50 },
    shoes:  { name: 'Court Shoes',   desc: 'Clean court-approved footwear', price: 50 },
  }
};

// 7:00 AM – 2:00 PM (14:00) is the off-peak morning window
const OFF_PEAK_START = 7;
const OFF_PEAK_END   = 14;

/** True if the decimal hour falls in the off-peak morning window. */
function isOffPeak(h) {
  return h >= OFF_PEAK_START && h < OFF_PEAK_END;
}

/** Court rate for a given slot label (e.g. '9 AM', '3 PM'). */
function courtRate(label) {
  return isOffPeak(parseHourStr(label)) ? PRICING.courtOffPeak : PRICING.court;
}

/** Drill zone tiered pricing for one continuous session block. */
function drillZonePrice(blocks, offPeak) {
  const rates = offPeak ? PRICING.drillZoneOffPeak : PRICING.drillZone;
  return rates.base + Math.max(0, blocks - 1) * rates.perBlock;
}

// Cost across all selected slots
function totalCourtCost() {
  if (!state.selectedSlots.length) return 0;
  const step = getSlotStep();
  if (state.sport !== 'drill') {
    // Price each court slot individually by its time
    return state.selectedSlots.reduce((sum, s) => sum + courtRate(s.label) * step, 0);
  }
  // Drill: group by date, then price each 30-min block by its own time
  return state.selectedSlots.reduce((sum, s) => {
    const h    = parseHourStr(s.label);
    const rates = isOffPeak(h) ? PRICING.drillZoneOffPeak : PRICING.drillZone;
    return sum + rates.base; // each block priced individually (no tiering complexity)
  }, 0);
}

/** Returns { full, discount, final } for summary display. */
function courtCostBreakdown() {
  if (!state.selectedSlots.length) return { full: 0, discount: 0, final: 0 };
  const step = getSlotStep();
  if (state.sport !== 'drill') {
    const full  = state.selectedSlots.reduce((s, sl) => s + PRICING.court * step, 0);
    const final = state.selectedSlots.reduce((s, sl) => s + courtRate(sl.label) * step, 0);
    return { full, discount: full - final, final };
  }
  const full  = state.selectedSlots.reduce((s, sl) => s + PRICING.drillZone.base, 0);
  const final = state.selectedSlots.reduce((s, sl) => {
    return s + (isOffPeak(parseHourStr(sl.label)) ? PRICING.drillZoneOffPeak.base : PRICING.drillZone.base);
  }, 0);
  return { full, discount: full - final, final };
}

function totalDuration() {
  return state.selectedSlots.length * getSlotStep();
}

const COURT_COUNT = { pickleball: 4, badminton: 4, drill: 1 };

const HOURS_1HR = [
  '7 AM','8 AM','9 AM','10 AM','11 AM','12 PM',
  '1 PM','2 PM','3 PM','4 PM','5 PM','6 PM',
  '7 PM','8 PM','9 PM','10 PM','11 PM'
];
const HOURS_30MIN = [
  '8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM',
  '7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM'
];

function getSlots() {
  return state.sport === 'drill' ? HOURS_30MIN : HOURS_1HR;
}
function getSlotStep() {
  return state.sport === 'drill' ? 0.5 : 1;
}

// parseHourStr and fhToTime are in utils.js
const parseSlotHours = parseHourStr; // alias for legacy call sites

// ─── SLOT HELPERS ───
function isSlotSelected(date, court, idx) {
  const dk = getPhDate(date); // YYYY-MM-DD in PH time — matches renderDates dk
  return state.selectedSlots.some(s => s.dateKey === dk && s.court === court && s.idx === idx);
}

function toggleSlot(date, court, idx, label) {
  const dk = getPhDate(date); // YYYY-MM-DD in PH time
  const pos = state.selectedSlots.findIndex(s => s.dateKey === dk && s.court === court && s.idx === idx);
  if (pos >= 0) {
    state.selectedSlots.splice(pos, 1);
  } else {
    state.selectedSlots.push({ dateKey: dk, date: new Date(date), court, idx, label });
  }
}

function clearAllSlots() {
  state.selectedSlots = [];
}

// ─── DATES ───
const BOOKING_WINDOW_DAYS = 7;

function getBookingMaxDate() {
  // Returns a timezone-safe Date for the last bookable day in PH time
  return phDateObj(addDaysPH(getTodayPH(), BOOKING_WINDOW_DAYS - 1));
}

function getDateRange() {
  const dates = [];
  // Start from today in Philippines time.
  // Use phDateObj() (UTC 04:00 = PH noon) so Date objects are timezone-safe
  // regardless of the browser's local timezone.
  const todayStr = getTodayPH(); // 'YYYY-MM-DD'
  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    dates.push(phDateObj(addDaysPH(todayStr, i)));
  }
  return dates;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}
function formatDow(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Manila' });
}
// isToday(d) is in utils.js

function renderDates() {
  const strip = document.getElementById('dateStrip');
  const label = document.getElementById('dateRangeLabel');
  if (!strip) return;
  const dates = getDateRange();
  label.textContent = `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;

  const windowBadge = document.getElementById('bookWindowBadge');
  if (windowBadge) {
    windowBadge.textContent = `Bookings open ${BOOKING_WINDOW_DAYS} days in advance · Next slot opens tomorrow`;
  }

  strip.innerHTML = '';
  dates.forEach(d => {
    const dPhStr = getPhDate(d); // 'YYYY-MM-DD' in PH time — timezone-safe key
    const dk = dPhStr;
    const hasSelection = state.selectedSlots.some(s => s.dateKey === dk);
    const selPhStr = state.selectedDate ? getPhDate(state.selectedDate) : null;
    const isSelected = selPhStr === dPhStr;

    const chip = document.createElement('div');
    const isChipToday = dPhStr === getTodayPH();
    chip.className = 'date-chip' + (isChipToday ? ' today' : '') + (isSelected ? ' selected' : '');
    const dayNum = parseInt(dPhStr.split('-')[2]);
    const dotEl = hasSelection
      ? `<div style="width:6px;height:6px;border-radius:50%;background:var(--gold);margin:2px auto 0;flex-shrink:0"></div>`
      : `<div style="width:6px;height:6px;margin:2px auto 0"></div>`;
    chip.innerHTML = isChipToday
      ? `<div class="dc-dow">TODAY</div><div class="dc-day">${dayNum}</div><div class="dc-mon">${formatDate(d).split(' ')[0]}</div>${dotEl}`
      : `<div class="dc-dow">${formatDow(d)}</div><div class="dc-day">${dayNum}</div><div class="dc-mon">${formatDate(d).split(' ')[0]}</div>${dotEl}`;

    chip.addEventListener('click', () => {
      // Switch view only — don't clear selections
      state.selectedDate = d;
      renderDates();
      renderAvailGrid();
      updateSummary();
    });
    strip.appendChild(chip);
  });

  if (!state.selectedDate) { state.selectedDate = dates[0]; renderDates(); }
}

function jumpToCalendarDate(isoStr) {
  if (!isoStr) return;
  const todayStr = getTodayPH();
  const maxStr   = getPhDate(getBookingMaxDate());
  if (isoStr < todayStr || isoStr > maxStr) return;
  state.selectedDate = phDateObj(isoStr); // timezone-safe Date object
  renderDates(); renderAvailGrid(); updateSummary();
}

// ─── CUSTOM CALENDAR POPUP ─────────────────────────────────────
let calPopupMonth = null;

function toggleCalPopup() {
  const popup = document.getElementById('calPopup');
  if (!popup) return;
  if (popup.style.display === 'none' || !popup.style.display) {
    const d = state.selectedDate || new Date();
    calPopupMonth = { year: d.getFullYear(), month: d.getMonth() };
    renderCalPopup();
    popup.style.display = 'block';
    setTimeout(() => {
      document.addEventListener('click', closeCalPopupOutside, { once: true, capture: true });
    }, 10);
  } else {
    popup.style.display = 'none';
  }
}

function closeCalPopupOutside(e) {
  const popup = document.getElementById('calPopup');
  const btn   = document.getElementById('calPickerBtn');
  if (popup && !popup.contains(e.target) && btn && !btn.contains(e.target)) {
    popup.style.display = 'none';
  } else if (popup && popup.style.display !== 'none') {
    setTimeout(() => {
      document.addEventListener('click', closeCalPopupOutside, { once: true, capture: true });
    }, 10);
  }
}

function renderCalPopup() {
  const popup = document.getElementById('calPopup');
  if (!popup || !calPopupMonth) return;
  const { year, month } = calPopupMonth;
  // Use PH date strings for all comparisons — no Date object timezone issues
  const todayStr  = getTodayPH();
  const maxStr    = getPhDate(getBookingMaxDate());
  const selPhStr  = state.selectedDate ? getPhDate(state.selectedDate) : null;

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<div class="cal-popup">
    <div class="cal-header">
      <button class="cal-nav-btn" onclick="calNavMonth(-1)" aria-label="Previous month">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-month-label">${MONTH_NAMES[month]} ${year}</span>
      <button class="cal-nav-btn" onclick="calNavMonth(1)" aria-label="Next month">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="cal-grid" role="grid">`;

  DOW.forEach(d => { html += `<div class="cal-dow" role="columnheader">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day cal-day-empty" role="gridcell"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isoStr    = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast    = isoStr < todayStr;
    const isFuture  = isoStr > maxStr;
    const isBlocked = isPast || isFuture;
    const isToday_  = isoStr === todayStr;
    const isSel     = selPhStr === isoStr;
    let cls = 'cal-day';
    if (isPast)    cls += ' cal-day-disabled';
    if (isFuture)  cls += ' cal-day-future';
    if (isToday_)  cls += ' cal-day-today';
    if (isSel)     cls += ' cal-day-selected';
    const clickStr = isBlocked ? '' : `onclick="calPickDate('${isoStr}')"`;
    const title    = isFuture ? `Opens in ${BOOKING_WINDOW_DAYS} days` : '';
    html += `<div class="${cls}" role="gridcell" aria-label="${MONTH_NAMES[month]} ${d}, ${year}" ${clickStr} ${title ? `title="${title}"` : ''}>${d}</div>`;
  }

  html += `</div></div>`;
  popup.innerHTML = html;
}

function calNavMonth(dir) {
  if (!calPopupMonth) return;
  let { year, month } = calPopupMonth;
  month += dir;
  if (month < 0)  { month = 11; year--; }
  if (month > 11) { month = 0;  year++; }
  calPopupMonth = { year, month };
  renderCalPopup();
}

function calPickDate(isoStr) {
  document.getElementById('calPopup').style.display = 'none';
  jumpToCalendarDate(isoStr);
}

// ─── 예약 직전 실시간 충돌 체크 ───
// 선택된 슬롯들을 Supabase + localStorage 양쪽에서 재확인
// 충돌 있으면 충돌 슬롯 label 반환, 없으면 null
async function checkConflictsBeforeBook() {
  const step = getSlotStep();

  // 1) localStorage 체크
  const localBookings = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  for (const s of state.selectedSlots) {
    const dateStr = getPhDate(s.date);
    const slotH   = parseSlotHours(s.label);
    const slotEnd = slotH + step;

    const cSport2 = (state.sport || '').toLowerCase();
    const conflict = localBookings.some(b => {
      if (b.status === 'cancelled') return false;
      const bSport2 = (b.sport || '').toLowerCase();
      if (!bSport2 || bSport2 !== cSport2) return false;
      return (b.slots || []).some(ls => {
        if (ls.date !== dateStr || Number(ls.court) !== s.court) return false;
        const bH = parseSlotHours(ls.time);
        return bH < slotEnd && (bH + step) > slotH;
      });
    });
    if (conflict) return `${s.label} · Court ${s.court} (${dateStr})`;
  }

  // 2) Supabase 체크 (연결된 경우)
  if (window.apexDB) {
    try {
      const dates = [...new Set(state.selectedSlots.map(s => getPhDate(s.date)))];
      for (const dateStr of dates) {
        const { data } = await window.apexDB
          .from('bookings')
          .select('court_number, start_time, end_time, sport')
          .eq('booking_date', dateStr)
          .eq('sport', state.sport)
          .neq('status', 'cancelled');

        if (!data) continue;
        for (const s of state.selectedSlots) {
          if (getPhDate(s.date) !== dateStr) continue;
          const slotH   = parseSlotHours(s.label);
          const slotEnd = slotH + step;
          const startT  = fhToTime(slotH);
          const endT    = fhToTime(slotEnd);

          const conflict = data.some(b =>
            Number(b.court_number) === s.court &&
            b.start_time < endT &&
            b.end_time   > startT
          );
          if (conflict) return `${s.label} · Court ${s.court} (${dateStr})`;
        }
      }
    } catch (_) { /* Supabase 오류는 무시 — localStorage 체크로 충분 */ }
  }

  return null;
}

// ─── SLOT STATUS ───
function getSlotStatus(slotIdx, courtNum) {
  if (!state.selectedDate) return 'open';

  const dateStr  = getPhDate(state.selectedDate); // PH date, timezone-safe
  const slots    = getSlots();
  const label    = slots[slotIdx];   // e.g. "8 AM"
  const slotH    = parseSlotHours(label);
  const slotEnd  = slotH + getSlotStep();

  // Read confirmed bookings from localStorage
  const bookings = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  const cSport = (state.sport || '').toLowerCase();
  const taken = bookings.some(b => {
    if (b.status === 'cancelled') return false;
    // sport가 없는(undefined/null) 레거시 항목은 다른 스포츠로 취급해 무시
    const bSport = (b.sport || '').toLowerCase();
    if (!bSport || bSport !== cSport) return false;
    return (b.slots || []).some(s => {
      if (s.date !== dateStr) return false;
      // 슬롯에 sport 필드가 있으면 이중 검증 (없으면 부킹 레벨 검증으로 충분)
      if (s.sport && s.sport.toLowerCase() !== cSport) return false;
      if (Number(s.court) !== courtNum) return false;
      // Parse the booked slot time
      const bH = parseSlotHours(s.time);
      // Overlap check: booked slot overlaps this slot
      return bH < slotEnd && (bH + getSlotStep()) > slotH;
    });
  });

  return taken ? 'taken' : 'open';
}

// ─── AVAILABILITY GRID ───────────────────────────────────────────
function renderAvailGrid() {
  const grid = document.getElementById('availGrid');
  if (!grid) return;

  const slots  = getSlots();
  const count  = COURT_COUNT[state.sport] || 1;
  const label  = state.sport === 'pickleball' ? 'PB' : state.sport === 'badminton' ? 'BD' : 'DZ';
  const colW   = `52px repeat(${count}, 1fr)`;
  const nowH   = Math.floor(getNowHPH());
  const nowM   = Math.round((getNowHPH() % 1) * 60);

  // Hint text
  const hint = document.getElementById('gridHint');
  if (hint) {
    const n = state.selectedSlots.length;
    hint.textContent = n === 0
      ? 'Click slots to select · Multiple dates supported'
      : `${n} slot${n > 1 ? 's' : ''} selected · Click again to deselect`;
  }

  // Hide skeleton, show grid
  const gridSkel = document.getElementById('gridSkeleton');
  if (gridSkel) gridSkel.style.display = 'none';
  grid.style.display = '';

  grid.innerHTML = '';

  // ── header ──
  const header = document.createElement('div');
  header.className = 'ag-header';
  header.style.gridTemplateColumns = colW;
  header.innerHTML = `<div class="ag-header-time">Time</div>`;
  for (let c = 1; c <= count; c++) {
    header.innerHTML += `<div class="ag-header-court">${label}${c}</div>`;
  }
  grid.appendChild(header);

  // ── rows ──
  slots.forEach((timeLabel, si) => {
    const slotTotalH = parseHourStr(timeLabel);
    // Hide past slots entirely when viewing today
    if (isToday(state.selectedDate) && slotTotalH <= getNowHPH()) return;

    const row = document.createElement('div');
    row.className = 'ag-row';
    row.style.gridTemplateColumns = colW;
    row.setAttribute('role', 'row');

    const timeCell = document.createElement('div');
    timeCell.className = 'ag-time';
    timeCell.textContent = timeLabel;
    row.appendChild(timeCell);

    for (let c = 1; c <= count; c++) {
      const rawStatus = getSlotStatus(si, c);
      const cell = document.createElement('div');
      cell.className = 'ag-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${label}${c} at ${timeLabel}`);

      const inner = document.createElement('div');
      inner.className = 'ag-cell-inner';

      const selected = state.selectedDate && isSlotSelected(state.selectedDate, c, si);

      if (rawStatus === 'taken') {
        cell.classList.add('booked');
        cell.setAttribute('aria-disabled', 'true');

      } else if (selected) {
        // ── Selected slot — shows check, click to deselect ──
        cell.classList.add('selected-start');
        inner.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        cell.appendChild(inner);
        cell.setAttribute('aria-selected', 'true');
        cell.addEventListener('click', () => {
          toggleSlot(state.selectedDate, c, si, timeLabel);
          renderAvailGrid();
          renderDates();
          updateSummary();
        });

      } else if (rawStatus === 'open-session') {
        cell.classList.add('open-session');
        cell.setAttribute('aria-label', `${label}${c} at ${timeLabel} — Open Session`);
        cell.addEventListener('click', () => {
          toggleSlot(state.selectedDate, c, si, timeLabel);
          renderAvailGrid();
          renderDates();
          updateSummary();
          markStep(2);
        });

      } else {
        // ── Available — click to add to selection ──
        cell.classList.add('available');
        cell.appendChild(inner);
        cell.addEventListener('click', () => {
          toggleSlot(state.selectedDate, c, si, timeLabel);
          renderAvailGrid();
          renderDates();
          updateSummary();
          markStep(2);
        });
      }

      row.appendChild(cell);
    }
    grid.appendChild(row);
  });
}

function renderTimes()  { renderAvailGrid(); }
function renderCourts() { renderAvailGrid(); }

// ─── SPORT ───
function selectSport(sport, el) {
  state.sport = sport;
  clearAllSlots();
  document.querySelectorAll('.sport-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  const normalRow = document.getElementById('durationRow');
  const dzRow = document.getElementById('dzDurationRow');
  if (normalRow && dzRow) {
    normalRow.style.display = sport === 'drill' ? 'none' : 'flex';
    dzRow.style.display = sport === 'drill' ? 'flex' : 'none';
  }

  renderAvailGrid();
  renderDates();
  updateSummary();
  markStep(1);
}

// ─── EXTRAS ───
function renderExtras() {
  const list = document.getElementById('extrasList');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(PRICING.extras).forEach(([key, extra]) => {
    const item = document.createElement('div');
    item.className = 'extra-item' + (state.extras.has(key) ? ' selected' : '');
    item.innerHTML = `
      <div class="extra-left">
        <div><div class="extra-name">${extra.name}</div><div class="extra-desc">${extra.desc}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="extra-price">+₱${extra.price}</div>
        <div class="extra-check">${state.extras.has(key) ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      </div>`;
    item.addEventListener('click', () => {
      if (state.extras.has(key)) state.extras.delete(key);
      else state.extras.add(key);
      renderExtras();
      updateSummary();
    });
    list.appendChild(item);
  });
}

// ─── SUMMARY ───
function updateSummary() {
  const body    = document.getElementById('summaryContent');
  const totalEl = document.getElementById('totalAmount');
  const btn     = document.getElementById('confirmBtn');
  if (!body) return;

  let extrasCost = 0;
  state.extras.forEach(k => extrasCost += PRICING.extras[k].price);
  const breakdown = courtCostBreakdown();
  const courtCost = breakdown.final;
  const total = courtCost + extrasCost;

  if (!state.selectedSlots.length) {
    body.innerHTML = '<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:16px 0">Select time slots to see your total</p>';
    totalEl.textContent = '₱0';
    if (btn) btn.disabled = true;
    return;
  }

  const sportName   = state.sport === 'drill' ? 'Drill Zone' : state.sport.charAt(0).toUpperCase() + state.sport.slice(1);
  const courtLabel  = state.sport === 'pickleball' ? 'PB' : state.sport === 'badminton' ? 'BD' : 'DZ';
  const step        = getSlotStep();
  const dur         = totalDuration();
  const durStr      = dur >= 1 ? dur + ' hr' + (dur > 1 ? 's' : '') : (dur * 60) + ' min';

  // Group slots by date for display
  const byDate = {};
  state.selectedSlots.forEach(s => {
    if (!byDate[s.dateKey]) byDate[s.dateKey] = { date: s.date, slots: [] };
    byDate[s.dateKey].slots.push(s);
  });

  let rows = `<div class="summary-row"><span class="label">Sport</span><span class="value">${sportName}</span></div>`;
  rows += `<div class="summary-row"><span class="label">Duration</span><span class="value">${durStr}</span></div>`;

  // Per-date rows
  Object.values(byDate).forEach(({ date, slots }) => {
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    // Sort by time index, group by court
    const byCourt = {};
    slots.forEach(s => {
      if (!byCourt[s.court]) byCourt[s.court] = [];
      byCourt[s.court].push(s);
    });
    Object.entries(byCourt).forEach(([court, cs]) => {
      cs.sort((a,b) => a.idx - b.idx);
      const startLabel = cs[0].label;
      const lastSlot   = cs[cs.length - 1];
      const endFH      = parseSlotHours(lastSlot.label) + step;
      const endHour    = Math.floor(endFH);
      const endMin     = Math.round((endFH - endHour) * 60);
      const ampm       = endHour >= 12 ? 'PM' : 'AM';
      const dH         = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
      const endLabel   = endMin ? `${dH}:${String(endMin).padStart(2,'0')} ${ampm}` : `${dH} ${ampm}`;
      rows += `<div class="summary-row"><span class="label">${dateStr}</span><span class="value">${courtLabel}${court} · ${startLabel}–${endLabel}</span></div>`;
    });
  });

  // Court fee row — show original + discount if applicable
  if (breakdown.discount > 0) {
    rows += `<div class="summary-row">
      <span class="label">Court fee <span style="font-size:10px;color:var(--gold);font-weight:700;margin-left:4px">MORNING RATE</span></span>
      <span class="value"><span style="text-decoration:line-through;opacity:0.4;font-size:12px;margin-right:4px">₱${breakdown.full.toLocaleString()}</span>₱${courtCost.toLocaleString()}</span>
    </div>
    <div class="summary-row" style="color:#4ade80;font-size:12px">
      <span class="label">Morning discount (20% off)</span>
      <span class="value">−₱${breakdown.discount.toLocaleString()}</span>
    </div>`;
  } else {
    rows += `<div class="summary-row"><span class="label">Court fee</span><span class="value">₱${courtCost.toLocaleString()}</span></div>`;
  }
  state.extras.forEach(k => {
    rows += `<div class="summary-row"><span class="label">${PRICING.extras[k].name}</span><span class="value">₱${PRICING.extras[k].price}</span></div>`;
  });

  body.innerHTML = rows;
  totalEl.textContent = '₱' + total.toLocaleString();

  totalEl.style.transform = 'scale(1.15)';
  setTimeout(() => { totalEl.style.transition = 'transform 0.2s'; totalEl.style.transform = 'scale(1)'; }, 50);

  if (btn) btn.disabled = false;
}

// ─── STEP MARKS ───
function markStep(num) {
  for (let i = 1; i < num; i++) {
    const sp = document.getElementById('sp' + i);
    if (sp) { sp.classList.remove('active'); sp.classList.add('done'); sp.querySelector('.sp-circle').textContent = '✓'; }
  }
  const current = document.getElementById('sp' + num);
  if (current) current.classList.add('active');
}

// ─── CONFIRM BOOKING ───
async function confirmBooking() {
  if (!state.selectedSlots.length) {
    showBookingError('Please select at least one time slot.');
    return;
  }

  // Availability re-check before payment modal
  if (window.ApexCourts) {
    const btn = document.getElementById('confirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking availability…'; }
    try {
      // Group by date for check
      const byDate = {};
      state.selectedSlots.forEach(s => {
        if (!byDate[s.dateKey]) byDate[s.dateKey] = { date: s.date, slots: [] };
        byDate[s.dateKey].slots.push(s);
      });
      for (const { date, slots } of Object.values(byDate)) {
        const dateStr = getPhDate(date); // PH date string, timezone-safe
        const avail   = await ApexCourts.getAvailability(state.sport, dateStr);
        const totalCourts = state.sport === 'drillzone' ? 1 : 4;
        for (const s of slots) {
          const fh     = parseSlotHours(s.label);
          const start  = fhToTime(fh);
          const end    = fhToTime(fh + getSlotStep());
          const taken  = avail.filter(a => a.booking_id && a.start_time <= start && a.end_time >= end);
          if (taken.length >= totalCourts) {
            showBookingError(`${s.label} on ${date.toLocaleDateString('en-US',{month:'short',day:'numeric'})} was just taken. Please remove it.`);
            if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Pay'; }
            renderAvailGrid();
            return;
          }
        }
      }
    } catch(e) {
      console.warn('[Booking] Availability check failed:', e.message);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Pay'; }
  }

  const total   = courtCostBreakdown().final + Array.from(state.extras).reduce((s,k) => s + PRICING.extras[k].price, 0);
  const payTotal = document.getElementById('payModalTotal');
  if (payTotal) payTotal.textContent = '₱' + total.toLocaleString();
  document.getElementById('paymentModal').classList.add('open');
}

function showBookingError(msg) {
  let el = document.getElementById('bookingErrorMsg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bookingErrorMsg';
    el.style.cssText = 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fca5a5;margin-bottom:16px';
    const summary = document.querySelector('.booking-summary');
    if (summary) summary.prepend(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
}

function selectPayMethod(method, el) {
  document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const gcashFields = document.getElementById('gcashFields');
  const cardFields  = document.getElementById('cardFields');
  if (gcashFields) gcashFields.style.display = method === 'gcash' ? 'block' : 'none';
  if (cardFields)  cardFields.style.display  = method === 'card'  ? 'block' : 'none';
  el.dataset.method = method;
  document.getElementById('payConfirmBtn').dataset.method = method;
}

async function finalizePayment() {
  const method     = document.getElementById('payConfirmBtn').dataset.method || 'gcash';
  const code       = 'APX-' + Math.floor(1000 + Math.random() * 9000);
  const courtCost  = courtCostBreakdown().final;
  const extrasCost = Array.from(state.extras).reduce((s,k) => s + PRICING.extras[k].price, 0);
  const step       = getSlotStep();

  const btn = document.getElementById('payConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Checking availability…';

  // ── Step 1: 예약 직전 실시간 중복 체크 ────────────────────────
  const conflictSlot = await checkConflictsBeforeBook();
  if (conflictSlot) {
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
    document.getElementById('paymentModal').classList.remove('open');
    showBookingError(`이미 예약된 시간입니다: ${conflictSlot}. 다른 시간을 선택해주세요.`);
    renderAvailGrid();
    return;
  }

  btn.textContent = 'Saving…';

  // ── Step 2: Supabase에 저장 ───────────────────────────────────
  let supabaseSaved = false;
  if (window.ApexCourts) {
    try {
      let courts = [];
      try { courts = await ApexCourts.getCourts(state.sport); } catch(_) {}

      const byDateCourt = {};
      state.selectedSlots.forEach(s => {
        const key = s.dateKey + '_' + s.court;
        if (!byDateCourt[key]) byDateCourt[key] = { date: s.date, court: s.court, slots: [] };
        byDateCourt[key].slots.push(s);
      });

      const userName = localStorage.getItem('apexUser') || 'Guest';

      for (const block of Object.values(byDateCourt)) {
        block.slots.sort((a,b) => a.idx - b.idx);
        const dateStr  = getPhDate(block.date);
        const startFH  = parseSlotHours(block.slots[0].label);
        const endFH    = parseSlotHours(block.slots[block.slots.length-1].label) + step;
        const dur      = block.slots.length * step;
        const courtRow = courts.find(c => c.court_number === block.court);

        await ApexCourts.createBooking({
          courtId:       courtRow?.id || null,
          date:          dateStr,
          startTime:     fhToTime(startFH),
          endTime:       fhToTime(endFH),
          durationMins:  Math.round(dur * 60),
          playerCount:   2,
          notes:         `Extras: ${Array.from(state.extras).join(', ') || 'none'} | Pay: ${method}`,
          userName,
          paymentMethod: method,
          totalAmount:   courtCost + extrasCost,
          sport:         state.sport,
          courtNum:      block.court,
          bookingCode:   code,
        });
      }
      supabaseSaved = true;
    } catch (e) {
      // 동시 예약 충돌 (unique constraint 위반)
      if (e.message?.includes('unique') || e.code === '23505') {
        btn.disabled = false;
        btn.textContent = 'Confirm Booking';
        document.getElementById('paymentModal').classList.remove('open');
        showBookingError('방금 다른 분이 같은 시간을 예약했습니다. 다른 슬롯을 선택해주세요.');
        renderAvailGrid();
        return;
      }
      console.error('[Booking] Supabase save failed:', e.message);
      // DB 오류는 localStorage fallback으로 계속 진행
    }
  }

  btn.disabled = false;
  btn.textContent = 'Confirm Booking';

  // ── localStorage fallback ────────────────────────────────────
  const bookings = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  const user = localStorage.getItem('apexUser') || document.getElementById('firstName')?.value || 'Guest';
  bookings.push({
    id: code, userName: user, sport: state.sport,
    userId: localStorage.getItem('apexUserId') || null,
    slots: state.selectedSlots.map(s => ({
      date: getPhDate(s.date), court: s.court, time: s.label,
      sport: state.sport,  // 슬롯별 sport 이중 저장 — PB/BD 혼동 방지
    })),
    duration: totalDuration(),
    extras: Array.from(state.extras),
    totalAmount: courtCost + extrasCost,
    status: 'confirmed', paymentMethod: method,
    createdAt: new Date().toISOString(), createdBy: 'online',
    source: 'local',
  });
  localStorage.setItem('apexBookings', JSON.stringify(bookings));

  document.getElementById('paymentModal').classList.remove('open');
  document.getElementById('bookingCode').textContent = code;
  document.getElementById('confirmModal').classList.add('open');
  for (let i = 1; i <= 5; i++) markStep(i + 1);
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('open');
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('open');
  clearAllSlots();
  state.extras.clear();
  renderDates();
  renderAvailGrid();
  renderExtras();
  updateSummary();
}

// ─── URL PARAMS ───
// 홈 그리드 클릭 시 sport/date 자동 선택
function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);

  // sport — 'drillzone' → 'drill' 정규화
  let sport = p.get('sport') || '';
  if (sport === 'drillzone') sport = 'drill';
  if (sport) {
    state.sport = sport;
    const el = document.getElementById('opt-' + sport);
    if (el) {
      document.querySelectorAll('.sport-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
    }
  }

  // 홈에서 클릭하면 오늘 날짜 자동 선택
  if (p.get('sport') || p.get('time')) {
    state.selectedDate = phDateObj(getTodayPH()); // timezone-safe
    state.dateOffset   = 0;
  }
}

// ─── INIT ───
// ── Expose to window so onclick attributes work after Vite build ──
window.selectSport        = selectSport;
window.toggleCalPopup     = toggleCalPopup;
window.calNavMonth        = calNavMonth;
window.calPickDate        = calPickDate;
window.confirmBooking     = confirmBooking;
window.selectPayMethod    = selectPayMethod;
window.finalizePayment    = finalizePayment;
window.closePaymentModal  = closePaymentModal;
window.closeModal         = closeModal;

document.addEventListener('DOMContentLoaded', () => {
  applyUrlParams();
  renderDates();
  renderTimes();
  renderCourts();
  renderExtras();
  updateSummary();

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; } });
  }, { threshold: 0.05 });
  document.querySelectorAll('.book-panel').forEach((p, i) => {
    p.style.opacity = '0'; p.style.transform = 'translateY(20px)';
    p.style.transition = `opacity 0.5s ${i*0.1}s, transform 0.5s ${i*0.1}s cubic-bezier(0.25,0.46,0.45,0.94)`;
    obs.observe(p);
  });

  // ─── SUPABASE REALTIME — sync grid across devices ─────────────────
  // Listens for INSERT/UPDATE/DELETE on bookings table and refreshes
  // the availability grid in real time without a full page reload.
  (function initRealtime() {
    const db = window.apexDB;
    if (!db) return;

    db.channel('bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => refreshBookingsFromDB()
      )
      .subscribe();

    async function refreshBookingsFromDB() {
      try {
        const todayStr = getTodayPH();
        const endDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        endDate.setDate(endDate.getDate() + 14);
        const toISO = d => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        const { data, error } = await db
          .from('bookings')
          .select('court_number,booking_date,start_time,sport,status')
          .gte('booking_date', todayStr)
          .lte('booking_date', toISO(endDate))
          .neq('status', 'cancelled');

        if (error || !data) return;

        // Merge into localStorage cache (don't overwrite locally-created bookings)
        const existing = JSON.parse(localStorage.getItem('apexBookings') || '[]');

        // Keep all local bookings (source:'local'); strip out previous db-sourced entries
        const ownLocal = existing.filter(b => b.source !== 'db');

        // Normalise DB rows into the same {slots:[]} structure used by getSlotStatus()
        // DB sport: 'drillzone' → booking.js state key: 'drill'
        const dbNorm = data.map(b => ({
          id:     `db-${b.court_number}-${b.booking_date}-${b.start_time}`,
          sport:  b.sport === 'drillzone' ? 'drill' : b.sport,
          status: b.status,
          source: 'db',
          // slots[] format expected by getSlotStatus() and main.js buildSlotMapFromLocal()
          slots: [{
            date:  b.booking_date,                    // 'YYYY-MM-DD'
            court: Number(b.court_number),
            time:  b.start_time,                      // '08:00:00' — parseSlotHours handles 24h
            sport: b.sport === 'drillzone' ? 'drill' : (b.sport || ''), // 슬롯별 sport 이중 저장
          }],
        }));

        localStorage.setItem('apexBookings', JSON.stringify([...ownLocal, ...dbNorm]));

        // Refresh grid if it's visible
        renderAvailGrid();
      } catch(e) { /* silent — realtime is best-effort */ }
    }
  })();
});
