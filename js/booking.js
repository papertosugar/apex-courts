/* ─── APEX COURTS — Booking System JS ─── */

// ─── AUTH GUARD ───
(function() {
  const user = sessionStorage.getItem('apexUser');
  if (!user) {
    window.location.href = 'login.html?redirect=book.html';
  }
})();

const state = {
  sport: 'pickleball',
  selectedDate: null,
  selectedTime: null,
  duration: 1,
  court: null,
  extras: new Set(),
  dateOffset: 0,
};

const PRICING = {
  // Court hourly rate (PHP) — drill zone uses block pricing below
  court: 600,
  drillZone: { base: 400, perBlock: 300 }, // 400 first 30min, +300 each additional 30min
  extras: {
    racket: { name: 'Racket Rental', desc: 'Premium Wilson racket', price: 50 },
    shoes:  { name: 'Court Shoes',   desc: 'Clean court-approved footwear', price: 50 },
  }
};

// Drill zone price: ₱400 first 30min, +₱300 per additional 30min block
function drillZonePrice(durationHrs) {
  const blocks = Math.round(durationHrs * 2); // 0.5hr = 1 block
  return PRICING.drillZone.base + Math.max(0, blocks - 1) * PRICING.drillZone.perBlock;
}

function courtPrice(durationHrs) {
  return state.sport === 'drill' ? drillZonePrice(durationHrs) : PRICING.court * durationHrs;
}

const COURT_COUNT = { pickleball: 4, badminton: 4, drill: 1 };

// 07:00 – 23:00 (last slot starts 23:00, ends midnight)
const HOURS = [
  '7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
  '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM',
  '7:00 PM','8:00 PM','9:00 PM','10:00 PM','11:00 PM'
];

// ─── DATES ───
function getDateRange(offset = 0) {
  const dates = [];
  const base = new Date();
  base.setDate(base.getDate() + offset);
  for (let i = 0; i < 10; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatDow(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function renderDates() {
  const strip = document.getElementById('dateStrip');
  const label = document.getElementById('dateRangeLabel');
  if (!strip) return;
  const dates = getDateRange(state.dateOffset);
  label.textContent = `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;

  strip.innerHTML = '';
  dates.forEach(d => {
    const chip = document.createElement('div');
    chip.className = 'date-chip' + (isToday(d) ? ' today' : '') + (state.selectedDate && d.toDateString() === state.selectedDate.toDateString() ? ' selected' : '');
    chip.innerHTML = `<div class="dc-dow">${formatDow(d)}</div>
      <div class="dc-day">${d.getDate()}</div>
      <div class="dc-mon">${formatDate(d).split(' ')[0]}</div>`;
    chip.addEventListener('click', () => {
      state.selectedDate = d;
      renderDates();
      renderTimes();
      renderCourts();
      updateSummary();
    });
    strip.appendChild(chip);
  });

  if (!state.selectedDate) { state.selectedDate = dates[0]; renderDates(); }
}

function shiftDates(n) {
  state.dateOffset = Math.max(0, state.dateOffset + n);
  renderDates();
}

// ─── TIMES ───
function getSlotStatus(hour, courtNum) {
  if (!state.selectedDate) return 'open';
  const seed = state.selectedDate.getDate() + courtNum * 17 + hour * 3;
  const rng = Math.sin(seed) * 10000;
  const r = rng - Math.floor(rng);
  if (r < 0.35) return 'taken';
  return 'open';
}

function renderTimes() {
  const grid = document.getElementById('timeGrid');
  if (!grid) return;
  const nowHour = new Date().getHours();
  grid.innerHTML = '';
  HOURS.forEach((t, i) => {
    const hour = 7 + i;
    const isPast = isToday(state.selectedDate) && hour <= nowHour;
    const isTaken = !isPast && getSlotStatus(i, 1) === 'taken';
    const chip = document.createElement('div');
    chip.className = 'time-chip' + (isPast || isTaken ? ' taken' : '') + (state.selectedTime === t ? ' selected' : '');
    chip.textContent = t;
    if (!isPast && !isTaken) {
      chip.addEventListener('click', () => {
        state.selectedTime = t;
        renderTimes();
        renderCourts();
        updateSummary();
        markStep(2);
      });
    }
    grid.appendChild(chip);
  });
}

function selectDuration(hrs, el) {
  state.duration = hrs;
  document.querySelectorAll('.dur-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  updateSummary();
}

// ─── COURTS ───
function renderCourts() {
  const grid = document.getElementById('courtGrid');
  if (!grid) return;
  const count = COURT_COUNT[state.sport] || 1;
  const label = state.sport === 'pickleball' ? 'PB' : state.sport === 'badminton' ? 'BD' : 'DZ';
  grid.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const unavail = state.selectedTime && getSlotStatus(HOURS.indexOf(state.selectedTime), i) === 'taken';
    const chip = document.createElement('div');
    chip.className = 'court-chip' + (unavail ? ' unavail' : '') + (state.court === i ? ' selected' : '');
    chip.innerHTML = `<div class="cc-name">${label} ${i}</div>
      <div class="cc-status ${unavail ? 'taken' : 'open'}">${unavail ? '● Taken' : '● Open'}</div>`;
    if (!unavail) {
      chip.addEventListener('click', () => {
        state.court = i;
        renderCourts();
        updateSummary();
        markStep(3);
      });
    }
    grid.appendChild(chip);
  }
  // Animate
  grid.querySelectorAll('.court-chip').forEach((c, i) => {
    c.style.opacity = '0'; c.style.transform = 'scale(0.8)';
    setTimeout(() => {
      c.style.transition = 'opacity 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
      c.style.opacity = '1'; c.style.transform = 'scale(1)';
    }, i * 40);
  });
}

// ─── SPORT ───
function selectSport(sport, el) {
  state.sport = sport;
  state.court = null;
  document.querySelectorAll('.sport-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  renderCourts();
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
  const body = document.getElementById('summaryContent');
  const totalEl = document.getElementById('totalAmount');
  const btn = document.getElementById('confirmBtn');
  if (!body) return;

  const courtCost = courtPrice(state.duration);
  let extrasCost = 0;
  state.extras.forEach(k => extrasCost += PRICING.extras[k].price);
  const total = state.court && state.selectedTime ? courtCost + extrasCost : 0;

  if (!state.selectedTime || !state.court) {
    body.innerHTML = '<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:16px 0">Select a time and court to see your total</p>';
    totalEl.textContent = '₱0';
    if (btn) btn.disabled = true;
    return;
  }

  const sportName = state.sport === 'drill' ? 'Drill Zone' : state.sport.charAt(0).toUpperCase() + state.sport.slice(1);
  const courtLabel = state.sport === 'pickleball' ? 'PB' : state.sport === 'badminton' ? 'BD' : 'DZ';
  const dateStr = state.selectedDate ? state.selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

  let rows = `
    <div class="summary-row"><span class="label">Sport</span><span class="value">${sportName}</span></div>
    <div class="summary-row"><span class="label">Date</span><span class="value">${dateStr}</span></div>
    <div class="summary-row"><span class="label">Time</span><span class="value">${state.selectedTime}</span></div>
    <div class="summary-row"><span class="label">Duration</span><span class="value">${state.duration >= 1 ? state.duration + ' hr' + (state.duration > 1 ? 's' : '') : '30 min'}</span></div>
    <div class="summary-row"><span class="label">Court</span><span class="value">${courtLabel} ${state.sport === 'drill' ? 'Zone' : 'Court'} ${state.court}</span></div>
    <div class="summary-row"><span class="label">Court fee</span><span class="value">₱${courtCost.toLocaleString()}</span></div>`;

  state.extras.forEach(k => {
    rows += `<div class="summary-row"><span class="label">${PRICING.extras[k].name}</span><span class="value">₱${PRICING.extras[k].price}</span></div>`;
  });

  body.innerHTML = rows;
  totalEl.textContent = '₱' + total.toLocaleString();

  // Animate total
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
function confirmBooking() {
  const first = document.getElementById('firstName')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  if (!first || !email) {
    document.getElementById('firstName').focus();
    document.getElementById('firstName').style.borderColor = 'rgba(239,68,68,0.6)';
    setTimeout(() => { document.getElementById('firstName').style.borderColor = ''; }, 2000);
    return;
  }
  // Show payment modal
  const total = courtPrice(state.duration) + Array.from(state.extras).reduce((s,k)=>s+PRICING.extras[k].price,0);
  const payTotal = document.getElementById('payModalTotal');
  if (payTotal) payTotal.textContent = '₱' + total.toLocaleString();
  document.getElementById('paymentModal').classList.add('open');
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

function finalizePayment() {
  const method = document.getElementById('payConfirmBtn').dataset.method || 'gcash';
  const code = 'APX-' + Math.floor(1000 + Math.random() * 9000);

  // Save booking to localStorage
  const bookings = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  const dateStr = state.selectedDate ? state.selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const user = sessionStorage.getItem('apexUser') || document.getElementById('firstName')?.value || 'Guest';
  const courtCost = courtPrice(state.duration);
  const extrasCost = Array.from(state.extras).reduce((s,k)=>s+PRICING.extras[k].price,0);
  bookings.push({
    id: code,
    userName: user,
    sport: state.sport,
    date: dateStr,
    time: state.selectedTime,
    duration: state.duration,
    court: state.court,
    extras: Array.from(state.extras),
    totalAmount: courtCost + extrasCost,
    status: 'confirmed',
    paymentMethod: method,
    createdAt: new Date().toISOString(),
    createdBy: 'online',
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
  state.court = null; state.selectedTime = null; state.extras.clear();
  renderCourts(); renderTimes(); renderExtras(); updateSummary();
}

// ─── URL PARAMS ───
function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('sport')) {
    state.sport = p.get('sport');
    const el = document.getElementById('opt-' + state.sport);
    if (el) { document.querySelectorAll('.sport-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); }
  }
  if (p.get('time')) {
    state.selectedTime = p.get('time');
  }
  if (p.get('court')) {
    state.court = parseInt(p.get('court'));
  }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  applyUrlParams();
  renderDates();
  renderTimes();
  renderCourts();
  renderExtras();
  updateSummary();

  // Scroll-reveal for booking panels
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; } });
  }, { threshold: 0.05 });
  document.querySelectorAll('.book-panel').forEach((p, i) => {
    p.style.opacity = '0'; p.style.transform = 'translateY(20px)';
    p.style.transition = `opacity 0.5s ${i*0.1}s, transform 0.5s ${i*0.1}s cubic-bezier(0.25,0.46,0.45,0.94)`;
    obs.observe(p);
  });
});
