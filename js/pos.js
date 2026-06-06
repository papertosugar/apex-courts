/* ─── SMASH STUDIO — POS System JS ─── */

// ─── STUDIO CONFIG (edit these placeholders) ───
const STUDIO_CONFIG = {
  name:      'SMASH STUDIO',
  tagline:   'Court Lab & Sports Center',
  address1:  '[Street Address]',
  address2:  '[City, Province]',
  phone:     '[+63 XXX XXX XXXX]',
  website:   '[yourwebsite.com]',
  instagram: '[@YourHandle]',
  wifi_ssid: '[WiFi Network Name]',
  wifi_pass: '[WiFi Password]',
  hours:     'Mon – Sun   7:00 AM – 10:00 PM',
  qr_url:    'https://yourwebsite.com/book',
  vat_rate:  12, // % inclusive in price
};

// ─── AUTH GUARD ───
(function() {
  const role = localStorage.getItem('apexRole');
  if (!role) { window.location.href = '../index.html'; return; }
  const user = localStorage.getItem('apexUser') || 'Staff';
  const el = document.getElementById('posUserLabel');
  if (el) el.textContent = user.split(' ')[0] + ' (' + role + ')';

  const adminBtn = document.getElementById('adminDashBtn');
  if (adminBtn && (role === 'Admin' || role === 'admin')) {
    adminBtn.style.display = 'inline-flex';
  }

  // Today's Revenue visible to Admin only
  const revPanel = document.getElementById('revenuePanel');
  if (revPanel) {
    revPanel.style.display = (role === 'Admin' || role === 'admin') ? 'block' : 'none';
  }
})();

// ─── CLOCK ───
function updateClock() {
  const el = document.getElementById('posTime');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Show float badge on load
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('posFloatBadge');
  if (badge) {
    badge.style.display = 'block';
    updateFloatIndicator();
  }
});

// ─── DATA LAYER ───
function getBookings()    { return JSON.parse(localStorage.getItem('apexBookings')    || '[]'); }
function saveBookings(b)  { localStorage.setItem('apexBookings', JSON.stringify(b)); }
function getActivityLog() { return JSON.parse(localStorage.getItem('apexActivityLog') || '[]'); }
function logActivity(action, bookingId, details) {
  const log = getActivityLog();
  log.unshift({ id: 'LOG-' + Date.now(), action, bookingId,
    staffName: localStorage.getItem('apexUser') || 'Staff',
    details, timestamp: new Date().toISOString() });
  localStorage.setItem('apexActivityLog', JSON.stringify(log.slice(0, 200)));
}

// ─── PRODUCTS CATALOG ───
const PRODUCTS = [
  { id: 'racket',    cat: 'rental',     icon: '🏸', name: 'Racket',         sub: 'Per session',   price: 50  },
  { id: 'shoes',     cat: 'rental',     icon: '👟', name: 'Shoes',          sub: 'Per session',   price: 50  },
  { id: 'balls',     cat: 'rental',     icon: '🟡', name: 'Ball Pack',      sub: '6 balls',       price: 120 },
  { id: 'towel',     cat: 'rental',     icon: '🛁', name: 'Towel',          sub: 'Fresh daily',   price: 50  },
  { id: 'grip',      cat: 'rental',     icon: '🎁', name: 'Grip Tape',      sub: 'Overgrip',      price: 80  },
  { id: 'water',     cat: 'fb',         icon: '💧', name: 'Water',          sub: '500ml',         price: 60  },
  { id: 'pocari',    cat: 'fb',         icon: '🥤', name: 'Pocari Sweat',   sub: '500ml isotonic',price: 75  },
  { id: 'coke-zero', cat: 'fb',         icon: '🥫', name: 'Coke Zero',      sub: '330ml',         price: 60  },
  { id: 'energy',    cat: 'fb',         icon: '⚡', name: 'Energy Drink',   sub: 'Red Bull 250ml',price: 120 },
  { id: 'snack',     cat: 'fb',         icon: '🍫', name: 'Snack Bar',      sub: 'Protein bar',   price: 80  },
];

// Equipment items (those that need return tracking)
const EQUIPMENT_IDS = ['racket', 'shoes', 'balls', 'towel', 'grip'];
const EQUIP_PRICES = { racket: 50, shoes: 50, balls: 120, towel: 50 };

// ─── WALK-IN TIME CALCULATION ───
// Policy: walk-in runs from now until a selected hour boundary.
// Court: ₱600/hr proportional for first partial hour, then ₱600 per full hour.
// Drill Zone: ₱400 base (covers first 30 min), +₱300 per additional 30-min block.

const COURT_CLOSE_HOUR = 22; // 10 PM

function fmt12(h24) {
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  return `${h12}:00 ${period}`;
}

function calcCourtCost(sport, totalMins) {
  const minsToFirst = 60 - new Date().getMinutes(); // mins to next hour
  if (sport === 'drill') {
    const blocks = Math.ceil(totalMins / 30);
    return 400 + Math.max(0, blocks - 1) * 300;
  }
  const partial = Math.round(600 * Math.min(totalMins, minsToFirst) / 60);
  const fullHours = Math.max(0, Math.floor((totalMins - minsToFirst) / 60));
  const remainder = Math.max(0, (totalMins - minsToFirst) % 60);
  return partial + fullHours * 600 + (remainder > 0 ? Math.round(600 * remainder / 60) : 0);
}

function getFirstBlockedHour(sport, courtNum) {
  const today = new Date().toISOString().split('T')[0];
  const nowH  = new Date().getHours();
  const bkgs  = getBookings().filter(b =>
    b.sport === sport && b.court === courtNum &&
    b.date === today && b.status !== 'cancelled'
  );
  let first = null;
  bkgs.forEach(b => {
    const [tp, period] = (b.time || '').split(' ');
    if (!tp) return;
    const [hh] = tp.split(':').map(Number);
    let h24 = hh;
    if (period === 'PM' && hh !== 12) h24 += 12;
    if (period === 'AM' && hh === 12) h24 = 0;
    if (h24 > nowH && (first === null || h24 < first)) first = h24;
  });
  return first;
}

let selectedWalkInOption = null; // { endHour, endLabel, totalMins, cost }

function buildWalkInOptions(sport, courtNum) {
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();
  const minsToNext = 60 - m;
  const firstBlocked = getFirstBlockedHour(sport, courtNum);
  const options = [];

  for (let extra = 0; extra <= 5; extra++) {
    const endHour  = h + 1 + extra;
    if (endHour > COURT_CLOSE_HOUR) break;
    const totalMins = minsToNext + extra * 60;
    const cost      = calcCourtCost(sport, totalMins);
    const hrs  = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const durLabel = hrs > 0 ? `${hrs}h${mins ? ' ' + mins + 'm' : ''}` : `${mins} min`;
    const blocked  = firstBlocked !== null && endHour > firstBlocked;
    const blockReason = blocked ? `Booking at ${fmt12(firstBlocked)}` : '';
    options.push({ endHour, endLabel: fmt12(endHour), totalMins, cost, durLabel, blocked, blockReason });
  }
  return options;
}

function renderWalkInOptions(sport, courtNum) {
  const container = document.getElementById('nsDurationOptions');
  if (!container) return;
  const options = buildWalkInOptions(sport, courtNum);
  // Default to first available option
  selectedWalkInOption = options.find(o => !o.blocked) || options[0];
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ns-dur-btn' + (opt === selectedWalkInOption ? ' selected' : '') + (opt.blocked ? ' blocked' : '');
    btn.disabled = opt.blocked;
    btn.innerHTML = `
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700;color:${opt.blocked ? 'var(--text-dim)' : 'var(--text)'}">Until ${opt.endLabel}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${opt.durLabel}</div>
      </div>
      <div style="text-align:right">
        ${opt.blocked
          ? `<div style="font-size:11px;color:#f87171">⛔ ${opt.blockReason}</div>`
          : `<div style="font-size:16px;font-weight:800;color:var(--gold)">₱${opt.cost.toLocaleString()}</div>`}
      </div>`;
    if (!opt.blocked) {
      btn.onclick = () => {
        selectedWalkInOption = opt;
        container.querySelectorAll('.ns-dur-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateNsTotal();
      };
    }
    container.appendChild(btn);
  });
  updateNsTotal();
}

function updateNsTotal() {
  if (!selectedWalkInOption) return;
  let equipCost = 0;
  ['racket','shoes','balls','towel'].forEach(e => {
    if (document.getElementById('equip-'+e)?.checked) equipCost += EQUIP_PRICES[e];
  });
  const subtotal  = selectedWalkInOption.cost + equipCost;
  const afterDisc = Math.max(0, subtotal - nsDiscount);
  const totalEl   = document.getElementById('nsTotal');
  const afterEl   = document.getElementById('nsAfterDiscount');
  if (totalEl) totalEl.textContent = '₱' + subtotal.toLocaleString();
  if (afterEl) afterEl.textContent = '₱' + afterDisc.toLocaleString();
  updateNsChange();
}

// ─── PAYMENT METHOD HELPERS ───
function _setPayBtns(prefix, method) {
  ['cash','gcash','card'].forEach(m => {
    const btn = document.getElementById(`${prefix}-pm-${m}`);
    if (btn) btn.classList.toggle('selected', m === method);
  });
}

function selectNsPayMethod(m) {
  nsPayMethod = m;
  _setPayBtns('ns', m);
  const cashWrap  = document.getElementById('nsCashWrap');
  const splitWrap = document.getElementById('nsSplitWrap');
  if (cashWrap)  cashWrap.style.display  = m === 'cash' ? 'block' : 'none';
  if (splitWrap) splitWrap.style.display = m !== 'cash' ? 'block' : 'none';
  const cashIn = document.getElementById('nsCashReceived');
  if (cashIn) cashIn.value = '';
  document.getElementById('nsChangeRow')?.style && (document.getElementById('nsChangeRow').style.display = 'none');
}

function updateNsChange() {
  const total    = _nsGrandTotal();
  const received = parseFloat(document.getElementById('nsCashReceived')?.value || '0');
  const changeRow = document.getElementById('nsChangeRow');
  const changeAmt = document.getElementById('nsChangeAmt');
  if (!changeRow || !changeAmt) return;
  if (received > 0 && total > 0 && received >= total) {
    changeRow.style.display = 'flex';
    changeAmt.textContent   = '₱' + (received - total).toLocaleString();
  } else {
    changeRow.style.display = 'none';
  }
}

function applyNsDiscount() {
  const raw   = document.getElementById('nsDiscountCode')?.value.trim() || '';
  if (!raw) return;
  const base  = selectedWalkInOption?.cost || 0;
  // Numeric = flat amount; string ending in digits = % off
  if (/^\d+$/.test(raw)) {
    nsDiscount = Math.min(parseInt(raw), base);
  } else {
    const pct = parseInt(raw.match(/\d+$/)?.[0] || '0');
    nsDiscount = pct > 0 ? Math.round(base * pct / 100) : 0;
  }
  const row    = document.getElementById('nsDiscountRow');
  const label  = document.getElementById('nsDiscountLabel');
  const amt    = document.getElementById('nsDiscountAmt');
  const afterRow = document.getElementById('nsAfterDiscountRow');
  if (nsDiscount > 0) {
    if (row)   { row.style.display = 'flex'; }
    if (label) label.textContent = `Discount (${raw})`;
    if (amt)   amt.textContent   = `-₱${nsDiscount.toLocaleString()}`;
    if (afterRow) afterRow.style.display = 'flex';
  }
  updateNsTotal();
}

function _nsGrandTotal() {
  if (!selectedWalkInOption) return 0;
  let equip = 0;
  ['racket','shoes','balls','towel'].forEach(e => {
    if (document.getElementById('equip-'+e)?.checked) equip += EQUIP_PRICES[e];
  });
  const split = parseFloat(document.getElementById('nsSplitCash')?.value || 0);
  return Math.max(0, selectedWalkInOption.cost + equip - nsDiscount) + (nsPayMethod !== 'cash' ? split : 0);
}

function selectCaPayMethod(m) {
  caPayMethod = m;
  _setPayBtns('ca', m);
  const cw = document.getElementById('caCashWrap');
  if (cw) cw.style.display = m === 'cash' ? 'block' : 'none';
}

function updateCaChange() {
  const total    = caCartItems.reduce((s,i) => s + i.price * i.qty, 0);
  const received = parseFloat(document.getElementById('caCashReceived')?.value || '0');
  const row = document.getElementById('caChangeRow');
  const amt = document.getElementById('caChangeAmt');
  if (!row || !amt) return;
  if (received > 0 && total > 0 && received >= total) {
    row.style.display = 'flex'; amt.textContent = '₱' + (received - total).toLocaleString();
  } else row.style.display = 'none';
}

function selectBevPayMethod(m) {
  bevPayMethod = m;
  _setPayBtns('bev', m);
  const cw = document.getElementById('bevCashWrap');
  if (cw) cw.style.display = m === 'cash' ? 'block' : 'none';
}

function updateBevChange() {
  const total    = Object.entries(bevCart).reduce((s,[id,q]) => s+(PRODUCTS.find(p=>p.id===id)?.price||0)*q, 0);
  const received = parseFloat(document.getElementById('bevCashReceived')?.value || '0');
  const row = document.getElementById('bevChangeRow');
  const amt = document.getElementById('bevChangeAmt');
  if (!row || !amt) return;
  if (received > 0 && total > 0 && received >= total) {
    row.style.display = 'flex'; amt.textContent = '₱' + (received - total).toLocaleString();
  } else row.style.display = 'none';
}

function toggleEquipStyle(cb) {
  const wrap = document.getElementById('equip-' + cb.value + '-wrap');
  if (wrap) {
    wrap.style.borderColor = cb.checked ? 'var(--gold)' : 'var(--border)';
    wrap.style.background  = cb.checked ? 'rgba(0,194,168,0.08)' : 'var(--surface-3)';
  }
  updateNsTotal();
}

// ─── COURT DATA ───
const COURT_DATA = {
  pickleball: [
    { num: 1, status: 'occupied', player: 'Sarah K.',    startTime: Date.now() - 45*60000, duration: 60,  booking: 'APX-1241', equipment: ['racket'] },
    { num: 2, status: 'occupied', player: 'Marcus T.',   startTime: Date.now() - 20*60000, duration: 90,  booking: 'APX-1242', equipment: ['shoes', 'balls'] },
    { num: 3, status: 'available', equipment: [] },
    { num: 4, status: 'occupied', player: 'David H.',    startTime: Date.now() - 55*60000, duration: 60,  booking: 'APX-1243', equipment: [] },
  ],
  badminton: [
    { num: 1, status: 'occupied', player: 'Jennifer L.', startTime: Date.now() - 30*60000, duration: 60,  booking: 'APX-1244', equipment: ['racket', 'racket'] },
    { num: 2, status: 'available', equipment: [] },
    { num: 3, status: 'available', equipment: [] },
    { num: 4, status: 'occupied', player: 'Tom W.',      startTime: Date.now() - 10*60000, duration: 120, booking: 'APX-1245', equipment: ['towel'] },
  ],
  drill: [
    { num: 1, status: 'available', equipment: [] },
  ],
};

const courtTimers = {};
const alarmFired  = {};

// ─── COURT DATA PERSISTENCE ───
function saveCourtData() {
  localStorage.setItem('apexCourtData', JSON.stringify(COURT_DATA));
}
function loadCourtData() {
  try {
    const raw = localStorage.getItem('apexCourtData');
    if (!raw) return;
    const saved = JSON.parse(raw);
    const now   = Date.now();
    Object.keys(saved).forEach(sport => {
      if (!COURT_DATA[sport]) return;
      saved[sport].forEach((c, i) => {
        if (!COURT_DATA[sport][i]) return;
        // Auto-expire sessions whose time has passed
        if (c.status === 'occupied' && c.startTime + c.duration * 60000 < now) {
          c.status = 'available'; c.equipment = [];
          delete c.player; delete c.startTime; delete c.booking; delete c.duration;
        }
        Object.assign(COURT_DATA[sport][i], c);
      });
    });
  } catch(e) { /* ignore corrupt data */ }
}

// ─── PAYMENT STATE ───
let nsPayMethod  = 'cash';   // new session
let nsDiscount   = 0;        // flat discount amount
let caPayMethod  = 'cash';   // court action items
let bevPayMethod = 'cash';   // beverages

// ─── ACTIVE COURT ACTION STATE ───
let activeCourtAction = null;
let caCartItems       = [];

// ═══════════════════════════════════════
//  VIEWS
// ═══════════════════════════════════════
function showView(view, sidebarEl) {
  document.querySelectorAll('#posMainContent > div').forEach(v => v.style.display = 'none');
  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';
  if (sidebarEl) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    sidebarEl.classList.add('active');
  }
  if (view === 'courts')    renderCourtsView();
  if (view === 'bookings')  renderBookings();
  if (view === 'beverages') renderBevView();
  if (view === 'checkin')   renderCheckIn();
}

// ═══════════════════════════════════════
//  COURT STATUS VIEW (DEFAULT)
// ═══════════════════════════════════════
function renderCourtsView() {
  const sportConfig = [
    { key: 'pickleball', containerId: 'pickleballCourts', abbr: 'PB' },
    { key: 'badminton',  containerId: 'badmintonCourts',  abbr: 'BD' },
    { key: 'drill',      containerId: 'drillCourts',      abbr: 'DZ' },
  ];

  sportConfig.forEach(({ key, containerId, abbr }) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    COURT_DATA[key].forEach(court => {
      const card = document.createElement('div');
      card.className = 'court-card ' + court.status;
      card.id = `court-${key}-${court.num}`;
      card.style.position = 'relative';

      if (court.status === 'occupied') {
        const endTime  = court.startTime + court.duration * 60000;
        const remaining = endTime - Date.now();
        const isUrgent  = remaining < 10 * 60000;
        const hasEquip  = court.equipment && court.equipment.length > 0;

        card.innerHTML = `
          <div class="cc-header">
            <div class="cc-name">${abbr} ${key==='drill'?'Zone':'Court'} ${court.num}</div>
            <div style="display:flex;gap:6px;align-items:center">
              ${hasEquip ? `<div style="font-size:9px;padding:2px 7px;border-radius:100px;background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.3);color:#fb923c;font-weight:700">EQUIP</div>` : ''}
              <div class="cc-badge occupied">In Play</div>
              ${isUrgent ? '<div class="alarm-indicator" title="⏰ Less than 10 min!"></div>' : ''}
            </div>
          </div>
          <div class="cc-info">
            <div style="font-weight:700;font-size:14px;color:var(--text)">${court.player}</div>
            ${hasEquip ? `<div style="font-size:11px;color:#fb923c;margin-top:2px">🏸 ${court.equipment.join(', ')}</div>` : ''}
          </div>
          <div class="cc-timer">
            <div>
              <div style="font-size:10px;color:var(--text-muted);letter-spacing:0.05em;text-transform:uppercase">Time Left</div>
              <div class="cc-timer-time ${isUrgent?'urgent':''}" id="timer-${key}-${court.num}">--:--</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text-muted)">Tap for</div>
              <div style="font-size:11px;font-weight:600;color:var(--gold)">Extend / Items</div>
            </div>
          </div>`;

        // Click → open action modal
        card.addEventListener('click', () => openCourtActionModal(key, court.num));

        // Start live timer
        const timerId = `${key}-${court.num}`;
        if (courtTimers[timerId]) clearInterval(courtTimers[timerId]);
        courtTimers[timerId] = setInterval(() => {
          const timerEl = document.getElementById(`timer-${timerId}`);
          if (!timerEl) { clearInterval(courtTimers[timerId]); return; }
          const ref = COURT_DATA[key][court.num - 1];
          const rem = Math.max(0, ref.startTime + ref.duration * 60000 - Date.now());
          const mins = Math.floor(rem / 60000);
          const secs = Math.floor((rem % 60000) / 1000);
          timerEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
          if (rem < 10 * 60000 && rem > 0 && !alarmFired[timerId]) {
            alarmFired[timerId] = true;
            timerEl.classList.add('urgent');
            const cardEl = document.getElementById(`court-${timerId}`);
            if (cardEl) { cardEl.style.boxShadow='0 0 0 3px rgba(239,68,68,0.6)'; setTimeout(()=>{if(cardEl)cardEl.style.boxShadow='';},3000); }
            showToast(`⏰ ${abbr} ${key==='drill'?'Zone':'Court'} ${court.num} — ${ref.player} has less than 10 min left!`);
          }
          if (rem <= 0) { timerEl.textContent = '00:00'; clearInterval(courtTimers[timerId]); }
        }, 1000);

      } else if (court.status === 'maintenance') {
        card.innerHTML = `
          <div class="cc-header">
            <div class="cc-name">${abbr} ${key==='drill'?'Zone':'Court'} ${court.num}</div>
            <div class="cc-badge maintenance">Maintenance</div>
          </div>
          <div class="cc-info" style="color:#fb923c;font-size:13px;margin-top:8px">🔧 Court unavailable</div>
          <div style="margin-top:14px;padding:8px 10px;border-radius:8px;background:rgba(251,146,60,0.06);border:1px dashed rgba(251,146,60,0.2);text-align:center;font-size:11px;color:rgba(251,146,60,0.6)">
            Tap to mark available
          </div>`;
        card.addEventListener('click', () => toggleMaintenanceDirect(key, court.num));
      } else {
        // Available court
        card.innerHTML = `
          <div class="cc-header">
            <div class="cc-name">${abbr} ${key==='drill'?'Zone':'Court'} ${court.num}</div>
            <div class="cc-badge available">Available</div>
          </div>
          <div class="cc-info" style="color:var(--text-muted);font-size:13px">Ready · tap to book</div>
          <div style="margin-top:14px;padding:10px;border-radius:8px;background:rgba(34,197,94,0.05);border:1px dashed rgba(34,197,94,0.2);text-align:center;font-size:12px;color:rgba(74,222,128,0.5)">
            + New Session
          </div>`;
        card.addEventListener('click', () => openNewSessionModal(key, court.num));
      }
      container.appendChild(card);
    });
  });

  // Stagger card animations
  document.querySelectorAll('.court-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 35}ms`;
  });

  // Update count badges with bounce animation
  const allCourts = [...COURT_DATA.pickleball, ...COURT_DATA.badminton, ...COURT_DATA.drill];
  const occ = allCourts.filter(c => c.status === 'occupied').length;
  const avl = allCourts.length - occ;

  function animateStat(el, val) {
    if (!el) return;
    const prev = el.textContent;
    el.textContent = val;
    if (prev !== String(val)) {
      el.classList.remove('stat-bounce');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('stat-bounce');
      setTimeout(() => el.classList.remove('stat-bounce'), 400);
    }
  }

  animateStat(document.getElementById('countOccupied'), occ);
  animateStat(document.getElementById('countAvail'), avl);
  animateStat(document.getElementById('occupiedCount'), occ);
}

// ═══════════════════════════════════════
//  NEW SESSION MODAL  (empty court click)
// ═══════════════════════════════════════
function openNewSessionModal(sport, courtNum) {
  const abbr = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const title = document.getElementById('nsModalTitle');
  if (title) title.textContent = `New Session — ${abbr} ${sport === 'drill' ? 'Zone' : 'Court'} ${courtNum}`;

  const modal = document.getElementById('newSessionModal');
  if (modal) { modal.dataset.sport = sport; modal.dataset.court = courtNum; }

  clearMemberSearch();
  ['racket','shoes','balls','towel'].forEach(e => {
    const cb = document.getElementById('equip-' + e);
    if (cb) { cb.checked = false; toggleEquipStyle(cb); }
  });
  // Reset payment state
  nsPayMethod = 'cash'; nsDiscount = 0;
  _setPayBtns('ns','cash');
  const cw = document.getElementById('nsCashWrap');
  const sw = document.getElementById('nsSplitWrap');
  if (cw) cw.style.display = 'block';
  if (sw) sw.style.display = 'none';
  ['nsCashReceived','nsDiscountCode','nsSplitCash'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['nsChangeRow','nsDiscountRow','nsAfterDiscountRow'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });

  renderWalkInOptions(sport, courtNum);
  modal?.classList.add('open');
}

function closeNewSession() {
  document.getElementById('newSessionModal')?.classList.remove('open');
}

function confirmNewSession() {
  if (!selectedWalkInOption) return;
  const modal    = document.getElementById('newSessionModal');
  const sport    = modal?.dataset.sport || 'pickleball';
  const courtNum = parseInt(modal?.dataset.court || '1');
  const first    = document.getElementById('wi-first')?.value.trim() || 'Walk-In';
  const last     = document.getElementById('wi-last')?.value.trim()  || 'Guest';
  const fullName = `${first} ${last}`.trim();

  const equipment = [];
  ['racket', 'shoes', 'balls', 'towel'].forEach(e => {
    if (document.getElementById('equip-' + e)?.checked) equipment.push(e);
  });

  const { totalMins, cost: courtCost, endLabel } = selectedWalkInOption;
  const equipCost = equipment.reduce((s, e) => s + (EQUIP_PRICES[e] || 0), 0);
  const splitCash = nsPayMethod !== 'cash' ? parseFloat(document.getElementById('nsSplitCash')?.value || 0) : 0;
  const total     = Math.max(0, courtCost + equipCost - nsDiscount);

  const id    = 'APX-W' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date().toISOString().split('T')[0];
  const abbr  = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const now   = new Date();
  const sh = now.getHours(); const sm = now.getMinutes();
  const sp = sh >= 12 ? 'PM' : 'AM'; const sh12 = sh > 12 ? sh - 12 : sh === 0 ? 12 : sh;
  const timeSlot = `${sh12}:${String(sm).padStart(2,'0')} ${sp}`;

  const bookings = getBookings();
  bookings.unshift({
    id, userName: fullName, sport, date: today, time: timeSlot,
    duration: +(totalMins / 60).toFixed(2),
    court: courtNum, extras: equipment,
    totalAmount: total, discount: nsDiscount, status: 'walkin',
    paymentMethod: nsPayMethod, splitCash, createdAt: new Date().toISOString(), createdBy: 'staff',
  });
  saveBookings(bookings);
  logActivity('walkin', id, `Walk-in: ${fullName} → ${abbr} ${courtNum} @ ${timeSlot} until ${endLabel}${equipment.length ? ' + ' + equipment.join(',') : ''}`);

  const courtRef = COURT_DATA[sport][courtNum - 1];
  if (courtRef) {
    courtRef.status    = 'occupied';
    courtRef.player    = fullName;
    courtRef.startTime = Date.now();
    courtRef.duration  = totalMins;
    courtRef.booking   = id;
    courtRef.equipment = equipment;
    delete alarmFired[`${sport}-${courtNum}`];
  }

  closeNewSession();
  saveCourtData();
  renderCourtsView();

  // Show receipt
  const now2 = new Date();
  const sh2 = now2.getHours(); const sm2 = now2.getMinutes();
  const sp2 = sh2>=12?'PM':'AM'; const sh12b = sh2>12?sh2-12:sh2===0?12:sh2;
  showReceiptPreview(makeReceiptData('session', {
    id, player: fullName, sport, abbr,
    courtNum, courtCost: selectedWalkInOption.cost,
    startTimeLabel: `${sh12b}:${String(sm2).padStart(2,'0')} ${sp2}`,
    endLabel, durationLabel: selectedWalkInOption.durLabel,
    equipment, items: [], total, paymentMethod: 'cash',
  }));
}

// ═══════════════════════════════════════
//  COURT ACTION MODAL  (occupied click)
// ═══════════════════════════════════════
function openCourtActionModal(sport, courtNum) {
  activeCourtAction = { sport, courtNum };
  caCartItems = [];

  const court = COURT_DATA[sport][courtNum - 1];
  const abbr  = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const rem   = Math.max(0, court.startTime + court.duration * 60000 - Date.now());
  const mins  = Math.floor(rem / 60000);
  const secs  = Math.floor((rem % 60000) / 1000);

  const titleEl = document.getElementById('caCourtTitle');
  const subEl   = document.getElementById('caCourtSub');
  const timerEl = document.getElementById('caTimer');
  if (titleEl) titleEl.textContent = `${abbr} ${sport === 'drill' ? 'Zone' : 'Court'} ${courtNum}`;
  if (subEl)   subEl.textContent   = `${court.player} · ${court.equipment?.length ? '🏸 ' + court.equipment.join(', ') : 'No equipment rented'}`;
  if (timerEl) timerEl.textContent  = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  // Live timer inside modal
  const caTimerInterval = setInterval(() => {
    const el = document.getElementById('caTimer');
    const modal = document.getElementById('courtActionModal');
    if (!el || !modal.classList.contains('open')) { clearInterval(caTimerInterval); return; }
    const ref  = COURT_DATA[sport][courtNum - 1];
    const r    = Math.max(0, ref.startTime + ref.duration * 60000 - Date.now());
    const m    = Math.floor(r / 60000);
    const s    = Math.floor((r % 60000) / 1000);
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.style.color = r < 5 * 60000 ? '#f87171' : 'var(--gold)';
  }, 1000);

  // Reset to extend tab
  caTab('extend', document.querySelector('.ca-tab.active') || document.querySelectorAll('.ca-tab')[0]);

  // Build product grid for items tab
  buildCaProductGrid();

  const confirmBtn = document.getElementById('caConfirmBtn');
  if (confirmBtn) confirmBtn.style.display = 'none';
  caPayMethod = 'cash';
  _setPayBtns('ca','cash');
  const pw = document.getElementById('caPayWrap');
  if (pw) pw.style.display = 'none';
  const cw = document.getElementById('caCashWrap');
  if (cw) cw.style.display = 'block';

  document.getElementById('courtActionModal')?.classList.add('open');
}

function caTab(tab, btn) {
  document.querySelectorAll('.ca-tab').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'var(--text-muted)';
  });
  btn.style.background = 'rgba(212,175,55,0.1)';
  btn.style.color = 'var(--gold)';
  document.getElementById('caExtendPanel').style.display = tab === 'extend' ? 'block' : 'none';
  document.getElementById('caItemsPanel').style.display  = tab === 'items'  ? 'block' : 'none';
}

function extendFromModal(extraMins) {
  if (!activeCourtAction) return;
  const { sport, courtNum } = activeCourtAction;
  const court = COURT_DATA[sport][courtNum - 1];
  court.duration += extraMins;
  delete alarmFired[`${sport}-${courtNum}`];
  const price = extraMins === 30 ? 300 : extraMins === 60 ? 600 : extraMins === 90 ? 900 : 1200;
  saveCourtData();
  closeCaModal();
  showToast(`✅ Extended ${extraMins} min — ₱${price.toLocaleString()} charged`);
  renderCourtsView();
}

function buildCaProductGrid() {
  const grid = document.getElementById('caProductGrid');
  if (!grid) return;
  grid.innerHTML = '';
  caCartItems = [];

  const items = PRODUCTS.filter(p => p.cat === 'fb' || p.cat === 'rental');
  items.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'ca-product-tile';
    tile.id = 'ca-tile-' + p.id;
    tile.innerHTML = `
      <div style="font-size:22px;margin-bottom:4px">${p.icon}</div>
      <div class="pt-name">${p.name}</div>
      <div class="pt-price">₱${p.price}</div>
      <div class="pt-qty" id="ca-qty-${p.id}">0</div>`;
    tile.addEventListener('click', () => addCaItem(p));
    grid.appendChild(tile);
  });
}

function addCaItem(product) {
  const existing = caCartItems.find(i => i.id === product.id);
  if (existing) existing.qty++;
  else caCartItems.push({ ...product, qty: 1 });
  // Show payment section
  const pw = document.getElementById('caPayWrap');
  if (pw) pw.style.display = 'block';

  // Update tile badge
  const qty = caCartItems.find(i => i.id === product.id)?.qty || 0;
  const tile = document.getElementById('ca-tile-' + product.id);
  const qtyEl = document.getElementById('ca-qty-' + product.id);
  if (tile)  tile.classList.toggle('has-qty', qty > 0);
  if (qtyEl) qtyEl.textContent = qty;

  // Update total
  const total = caCartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const totEl  = document.getElementById('caItemsTotalAmt');
  const totRow = document.getElementById('caItemsTotal');
  if (totEl)  totEl.textContent = '₱' + total.toLocaleString();
  if (totRow) totRow.style.display = total > 0 ? 'flex' : 'none';

  // Show confirm button
  const btn = document.getElementById('caConfirmBtn');
  if (btn) {
    btn.style.display = total > 0 ? 'inline-block' : 'none';
    btn.textContent   = `Charge ₱${total.toLocaleString()}`;
  }
}

function confirmCourtAction() {
  if (!caCartItems.length) return;
  const total = caCartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const { sport, courtNum } = activeCourtAction;
  const abbr = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';

  // Track any new equipment rentals
  const court = COURT_DATA[sport][courtNum - 1];
  caCartItems.forEach(item => {
    if (EQUIPMENT_IDS.includes(item.id)) {
      if (!court.equipment) court.equipment = [];
      for (let i = 0; i < item.qty; i++) court.equipment.push(item.id);
    }
  });

  closeCaModal();
  showToast(`✅ PHP ${total.toLocaleString()} charged to ${abbr} ${courtNum}`);

  showReceiptPreview(makeReceiptData('items', {
    id: 'APX-I' + Math.floor(1000 + Math.random()*9000),
    player: court.player, sport, abbr, courtNum,
    items: caCartItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    equipment: [], total, paymentMethod: caPayMethod,
  }));

  renderCourtsView();
}

function closeCaModal() {
  document.getElementById('courtActionModal')?.classList.remove('open');
  activeCourtAction = null;
  caCartItems = [];
}

// ═══════════════════════════════════════
//  END SESSION  →  Equipment Return Check
// ═══════════════════════════════════════
function requestEndCourt() {
  if (!activeCourtAction) return;
  const { sport, courtNum } = activeCourtAction;
  const court = COURT_DATA[sport][courtNum - 1];

  // Close the action modal first
  document.getElementById('courtActionModal')?.classList.remove('open');

  // If equipment was rented, show return check modal
  if (court.equipment && court.equipment.length > 0) {
    openEquipReturnModal(sport, courtNum);
  } else {
    // No equipment — end directly
    endCourtSession(sport, courtNum);
  }
}

function openEquipReturnModal(sport, courtNum) {
  const court = COURT_DATA[sport][courtNum - 1];
  const abbr  = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';

  const subEl  = document.getElementById('equipReturnSub');
  const listEl = document.getElementById('equipReturnList');
  const btn    = document.getElementById('equipReturnConfirmBtn');

  if (subEl)  subEl.textContent = `${court.player} · ${abbr} ${courtNum} — confirm all items returned before ending.`;
  if (listEl) listEl.innerHTML  = '';

  // Store context
  const modal = document.getElementById('equipReturnModal');
  if (modal) { modal.dataset.sport = sport; modal.dataset.court = courtNum; }

  const ICONS = { racket: '🏸', shoes: '👟', balls: '🟡', towel: '🛁', grip: '🎁' };
  const NAMES = { racket: 'Racket Rental', shoes: 'Court Shoes', balls: 'Ball Pack (6)', towel: 'Towel', grip: 'Grip Tape' };

  court.equipment.forEach((item, idx) => {
    const row = document.createElement('label');
    row.className = 'equip-return-row';
    row.id = 'eq-row-' + idx;
    row.innerHTML = `
      <input type="checkbox" id="eq-check-${idx}" onchange="checkAllReturned()">
      <span style="font-size:20px">${ICONS[item] || '📦'}</span>
      <span style="font-size:14px;font-weight:600;flex:1">${NAMES[item] || item}</span>
      <span style="font-size:11px;color:var(--text-muted)">Return confirmed?</span>`;
    row.querySelector('input').addEventListener('change', function() {
      row.classList.toggle('returned', this.checked);
    });
    listEl?.appendChild(row);
  });

  if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
  modal?.classList.add('open');
}

function checkAllReturned() {
  const checkboxes = document.querySelectorAll('#equipReturnList input[type=checkbox]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const btn = document.getElementById('equipReturnConfirmBtn');
  if (btn) { btn.disabled = !allChecked; btn.style.opacity = allChecked ? '1' : '0.4'; }
}

function closeEquipReturn() {
  document.getElementById('equipReturnModal')?.classList.remove('open');
}

function finalizeEndCourt() {
  const modal    = document.getElementById('equipReturnModal');
  const sport    = modal?.dataset.sport;
  const courtNum = parseInt(modal?.dataset.court || '1');
  closeEquipReturn();
  endCourtSession(sport, courtNum);
}

function endCourtSession(sport, courtNum) {
  const court   = COURT_DATA[sport][courtNum - 1];
  const name    = court.player || 'Guest';
  const equip   = [...(court.equipment || [])];
  const booking = court.booking;
  const timerId = `${sport}-${courtNum}`;
  const abbr    = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';

  // Find original booking for session total
  const bkg = getBookings().find(b => b.id === booking);
  const sessionTotal = bkg?.totalAmount || 0;

  clearInterval(courtTimers[timerId]);
  delete alarmFired[timerId];
  court.status    = 'available';
  court.equipment = [];
  delete court.player; delete court.startTime; delete court.booking; delete court.duration;

  showToast(`✅ Session ended — ${abbr} ${courtNum} is now available`);
  activeCourtAction = null;
  saveCourtData();
  renderCourtsView();

  // End-of-session receipt
  if (bkg) {
    showReceiptPreview(makeReceiptData('end', {
      id: bkg.id, player: name, sport, abbr, courtNum,
      startTimeLabel: bkg.time, endLabel: 'Now',
      durationLabel: bkg.duration < 1 ? `${Math.round(bkg.duration*60)} min` : `${bkg.duration}h`,
      courtCost: bkg.totalAmount,
      equipment: equip, items: [], total: sessionTotal,
      paymentMethod: bkg.paymentMethod || 'cash',
    }));
  }
}

// ═══════════════════════════════════════
//  BOOKINGS TABLE
// ═══════════════════════════════════════
function seedDemoBookings() {
  if (getBookings().length > 0) return;
  const today = new Date().toISOString().split('T')[0];
  const demos = [
    { id:'APX-1241', userName:'Sarah K.',    sport:'pickleball', date:today, time:'10:00 AM', duration:1, court:1, extras:['racket'],         totalAmount:650,  status:'walkin',    paymentMethod:'cash',  createdAt:new Date().toISOString(), createdBy:'staff' },
    { id:'APX-1242', userName:'Marcus T.',   sport:'pickleball', date:today, time:'10:00 AM', duration:1.5, court:2, extras:['shoes','balls'], totalAmount:1070, status:'walkin',    paymentMethod:'cash',  createdAt:new Date().toISOString(), createdBy:'staff' },
    { id:'APX-1243', userName:'David H.',    sport:'pickleball', date:today, time:'10:00 AM', duration:1, court:4, extras:[],                  totalAmount:600,  status:'confirmed', paymentMethod:'gcash', createdAt:new Date().toISOString(), createdBy:'online' },
    { id:'APX-1244', userName:'Jennifer L.', sport:'badminton',  date:today, time:'11:00 AM', duration:1, court:1, extras:['racket','racket'], totalAmount:700,  status:'walkin',    paymentMethod:'cash',  createdAt:new Date().toISOString(), createdBy:'staff' },
    { id:'APX-1245', userName:'Tom W.',      sport:'badminton',  date:today, time:'11:00 AM', duration:2, court:4, extras:['towel'],           totalAmount:1250, status:'confirmed', paymentMethod:'card',  createdAt:new Date().toISOString(), createdBy:'online' },
  ];
  saveBookings(demos);
}

function renderBookings() {
  seedDemoBookings();
  const tbody = document.getElementById('bookingsTbody');
  if (!tbody) return;

  const dateFilter  = document.getElementById('bookingDateFilter');
  const searchEl    = document.getElementById('bookingSearch');
  const sportFilter = document.getElementById('bookingSportFilter');
  const filterDate  = dateFilter?.value || new Date().toISOString().split('T')[0];
  const searchQ     = searchEl?.value.trim().toLowerCase() || '';
  const filterSport = sportFilter?.value || '';

  const all      = getBookings();
  const filtered = all.filter(b => {
    if (b.status === 'cancelled')                                              return false;
    if (filterDate && b.date !== filterDate)                                   return false;
    if (filterSport && b.sport !== filterSport)                                return false;
    if (searchQ && !b.userName?.toLowerCase().includes(searchQ) && !b.id?.toLowerCase().includes(searchQ)) return false;
    return true;
  }).sort((a, b) => a.time > b.time ? 1 : -1);

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-dim)">No bookings for this date</td></tr>';
    return;
  }

  filtered.forEach(b => {
    const sportLabel = b.sport === 'pickleball' ? 'Pickleball' : b.sport === 'badminton' ? 'Badminton' : 'Drill Zone';
    const abbr       = b.sport === 'pickleball' ? 'PB' : b.sport === 'badminton' ? 'BD' : 'DZ';
    const courtLabel = b.sport === 'drill' ? 'DZ Zone 1' : `${abbr} ${b.court}`;
    const durLabel   = b.duration < 1 ? '30 min' : b.duration === 1 ? '1 hr' : b.duration + ' hrs';
    const statusMap  = { confirmed: 'chip-green', walkin: 'chip-purple', cancelled: 'chip-red', pending: 'chip-gold' };
    const chip       = `<span class="status-chip ${b.status || 'confirmed'}">${b.status || 'confirmed'}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${b.id}</td>
      <td class="name">${b.userName}</td>
      <td>${sportLabel}</td>
      <td>${courtLabel}</td>
      <td>${b.time || '—'}</td>
      <td>${durLabel}</td>
      <td>${chip}</td>
      <td style="font-weight:700;color:var(--gold)">₱${(b.totalAmount||0).toLocaleString()}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-sm red" style="padding:5px 10px;font-size:11px" onclick="confirmCancelBooking('${b.id}')">Cancel</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ─── CANCEL BOOKING ───
function confirmCancelBooking(id) {
  const modal = document.getElementById('cancelModal');
  if (!modal) return;
  document.getElementById('cancelBookingId').textContent = id;
  document.getElementById('cancelConfirmBtn').onclick = () => doCancel(id);
  modal.classList.add('open');
}

function doCancel(id) {
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx > -1) {
    bookings[idx].status = 'cancelled';
    saveBookings(bookings);
    logActivity('cancel', id, `Booking ${id} cancelled by staff`);
  }
  document.getElementById('cancelModal')?.classList.remove('open');
  showToast(`⚠️ Booking ${id} cancelled`);
  renderBookings();
}

function closeCancelModal() {
  document.getElementById('cancelModal')?.classList.remove('open');
}

// ─── TOAST ───
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.style.background = type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
  t.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)';
  t.style.color = type === 'error' ? '#f87171' : '#4ade80';
  t.style.transform = 'translateY(0)';
  t.style.opacity   = '1';
  setTimeout(() => { t.style.transform = 'translateY(100px)'; t.style.opacity = '0'; }, 3500);
}

// ─── MEMBER LOOKUP ───
let memberSearchTimer = null;
let selectedMember    = null;

async function searchMember(query) {
  clearTimeout(memberSearchTimer);
  const resultsEl = document.getElementById('memberSearchResults');
  if (!query || query.length < 2) { if (resultsEl) resultsEl.style.display = 'none'; return; }
  memberSearchTimer = setTimeout(async () => {
    if (window.apexDB) {
      try {
        const { data } = await window.apexDB
          .from('profiles')
          .select('id,first_name,last_name,email,phone')
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);
        if (data && data.length) { renderMemberResults(data); return; }
      } catch(e) { /* fallback */ }
    }
    const seen = {}; const results = [];
    getBookings().forEach(b => {
      if (b.userName && b.userName.toLowerCase().includes(query.toLowerCase()) && !seen[b.userName]) {
        seen[b.userName] = true;
        results.push({ first_name: b.userName.split(' ')[0], last_name: b.userName.split(' ').slice(1).join(' '), email: '', phone: b.phone || '' });
      }
    });
    if (results.length) renderMemberResults(results);
    else if (resultsEl) resultsEl.style.display = 'none';
  }, 250);
}

function renderMemberResults(members) {
  const el = document.getElementById('memberSearchResults');
  if (!el) return;
  el.innerHTML = '';
  members.forEach(m => {
    const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ');
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:10px;transition:background 0.15s';
    row.innerHTML = `
      <div style="width:30px;height:30px;border-radius:50%;background:rgba(0,194,168,0.15);border:1px solid rgba(0,194,168,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0">${(m.first_name||'?').charAt(0).toUpperCase()}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${fullName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${m.email || m.phone || 'Walk-in member'}</div>
      </div>`;
    row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.04)';
    row.onmouseleave = () => row.style.background = '';
    row.onclick = () => selectMember(m);
    el.appendChild(row);
  });
  el.style.display = 'block';
}

function selectMember(member) {
  selectedMember = member;
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ');
  const firstEl = document.getElementById('wi-first');
  const lastEl  = document.getElementById('wi-last');
  if (firstEl) firstEl.value = member.first_name || '';
  if (lastEl)  lastEl.value  = member.last_name  || '';
  const badge   = document.getElementById('selectedMemberBadge');
  const nameEl  = document.getElementById('selectedMemberName');
  const emailEl = document.getElementById('selectedMemberEmail');
  if (badge)   badge.style.display  = 'flex';
  if (nameEl)  nameEl.textContent   = fullName;
  if (emailEl) emailEl.textContent  = member.email || member.phone || '—';
  const searchEl  = document.getElementById('wi-member-search');
  const resultsEl = document.getElementById('memberSearchResults');
  if (searchEl)  searchEl.value         = fullName;
  if (resultsEl) resultsEl.style.display = 'none';
}

function clearMemberSearch() {
  selectedMember = null;
  const searchEl  = document.getElementById('wi-member-search');
  const resultsEl = document.getElementById('memberSearchResults');
  const badge     = document.getElementById('selectedMemberBadge');
  if (searchEl)  searchEl.value         = '';
  if (resultsEl) resultsEl.style.display = 'none';
  if (badge)     badge.style.display     = 'none';
  const firstEl = document.getElementById('wi-first');
  const lastEl  = document.getElementById('wi-last');
  if (firstEl) firstEl.value = '';
  if (lastEl)  lastEl.value  = '';
}

// ─── RIGHT PANEL: Live Summary ───
function updateLiveSummary() {
  const allCourts = [...COURT_DATA.pickleball, ...COURT_DATA.badminton, ...COURT_DATA.drill];
  const occ = allCourts.filter(c => c.status === 'occupied').length;
  const avl = allCourts.length - occ;
  const occEl  = document.getElementById('summaryOccupied');
  const avlEl  = document.getElementById('summaryAvail');
  if (occEl) occEl.textContent = occ;
  if (avlEl) avlEl.textContent = avl;

  // Today's revenue — Admin only
  const role = localStorage.getItem('apexRole');
  const isAdmin = role === 'Admin' || role === 'admin';
  const revPanel = document.getElementById('revenuePanel');
  if (revPanel) revPanel.style.display = isAdmin ? 'block' : 'none';

  if (isAdmin) {
    const today = new Date().toISOString().split('T')[0];
    const todayB = getBookings().filter(b => b.date === today && b.status !== 'cancelled');
    const rev    = todayB.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const revEl  = document.getElementById('summaryRevenue');
    const cntEl  = document.getElementById('summaryBookingCount');
    if (revEl) revEl.textContent = '₱' + rev.toLocaleString();
    if (cntEl) cntEl.textContent = `${todayB.length} booking${todayB.length !== 1 ? 's' : ''}`;
  }

  // Active sessions
  const sessEl = document.getElementById('activeSessions');
  if (!sessEl) return;
  const sessions = [];
  Object.entries(COURT_DATA).forEach(([sport, courts]) => {
    courts.forEach(c => {
      if (c.status === 'occupied') {
        const abbr = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
        const rem  = Math.max(0, c.startTime + c.duration * 60000 - Date.now());
        const mins = Math.floor(rem / 60000);
        const secs = Math.floor((rem % 60000) / 1000);
        const isUrgent = rem < 10 * 60000;
        sessions.push({ sport, courtNum: c.num, abbr, player: c.player, timeStr: `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`, isUrgent });
      }
    });
  });
  if (!sessions.length) {
    sessEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px">No active sessions</div>';
    return;
  }
  sessEl.innerHTML = sessions.map(s => `
    <div style="padding:10px 12px;border-radius:9px;background:var(--surface-3);border:1px solid ${s.isUrgent?'rgba(239,68,68,0.35)':'var(--border)'};display:flex;align-items:center;gap:10px;cursor:pointer"
         onclick="openCourtActionModal('${s.sport}',${s.courtNum})">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${s.abbr} ${s.courtNum}</div>
        <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.player}</div>
      </div>
      <div style="font-family:monospace;font-size:14px;font-weight:700;color:${s.isUrgent?'#f87171':'var(--gold)'}">${s.timeStr}</div>
    </div>`).join('');
}

// Refresh live summary every 5 seconds
setInterval(updateLiveSummary, 5000);

// ═══════════════════════════════════════
//  VOID TRANSACTION
// ═══════════════════════════════════════
function voidTransaction() {
  if (!_currentReceiptData) return;
  const d = _currentReceiptData;
  const confirmed = confirm(`Void transaction ${d.id}?\nThis will cancel the booking and free the court.`);
  if (!confirmed) return;

  // Mark booking as voided
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === d.id);
  if (idx > -1) { bookings[idx].status = 'voided'; saveBookings(bookings); }

  // Free court if session type
  if ((d.type === 'session' || d.type === 'end') && d.sport && d.courtNum) {
    const court = COURT_DATA[d.sport]?.[d.courtNum - 1];
    if (court && court.status === 'occupied') {
      const timerId = `${d.sport}-${d.courtNum}`;
      clearInterval(courtTimers[timerId]);
      delete alarmFired[timerId];
      court.status = 'available'; court.equipment = [];
      delete court.player; delete court.startTime; delete court.booking; delete court.duration;
      saveCourtData();
      renderCourtsView();
    }
  }

  _currentReceiptData = null;
  closeReceipt();
  showToast(`⚠️ Transaction ${d.id} voided`, 'error');
  logActivity('void', d.id, `Transaction voided by ${localStorage.getItem('apexUser') || 'Staff'}`);
}

// ═══════════════════════════════════════
//  MAINTENANCE MODE
// ═══════════════════════════════════════
function toggleMaintenanceFromModal() {
  if (!activeCourtAction) return;
  const { sport, courtNum } = activeCourtAction;
  const court   = COURT_DATA[sport][courtNum - 1];
  const abbr    = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const label   = `${abbr} ${sport === 'drill' ? 'Zone' : 'Court'} ${courtNum}`;

  if (court.status === 'occupied') {
    if (!confirm(`${label} has an active session. End it and mark as Maintenance?`)) return;
    endCourtSession(sport, courtNum);
  }

  court.status = court.status === 'maintenance' ? 'available' : 'maintenance';
  saveCourtData();
  closeCaModal();
  showToast(`🔧 ${label} marked as ${court.status}`);
  renderCourtsView();
}

// Also allow toggling maintenance on available courts
function toggleMaintenanceDirect(sport, courtNum) {
  const court = COURT_DATA[sport][courtNum - 1];
  if (!court) return;
  court.status = court.status === 'maintenance' ? 'available' : 'maintenance';
  saveCourtData();
  renderCourtsView();
}

// ═══════════════════════════════════════
//  REPRINT LAST RECEIPT
// ═══════════════════════════════════════
function reprintLast() {
  openReceiptHistory();
}

// ═══════════════════════════════════════
//  SHIFT CLOSE
// ═══════════════════════════════════════
function scTab(tab, btn) {
  ['summary','cash','inventory'].forEach(t => {
    const panel = document.getElementById('sc-panel-' + t);
    const tabBtn = document.getElementById('sc-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (tabBtn) {
      tabBtn.style.background = t === tab ? 'rgba(212,175,55,0.1)' : 'transparent';
      tabBtn.style.color      = t === tab ? 'var(--gold)' : 'var(--text-muted)';
    }
  });
}

/* ══════════════════════════════════════════════════════════
   SHIFT OPEN
   ══════════════════════════════════════════════════════════ */
function getOpeningFloat() {
  const today = new Date().toISOString().split('T')[0];
  const record = JSON.parse(localStorage.getItem('apexShiftOpen_' + today) || 'null');
  return record ? record.float : 0;
}

function openShiftOpen() {
  const modal = document.getElementById('shiftOpenModal');
  if (!modal) return;
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('shiftOpenDate').textContent =
    new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  document.getElementById('soStaff').value = localStorage.getItem('apexUser') || '';
  document.getElementById('soFloat').value = '';
  document.getElementById('soFloatPreview').textContent = '';

  // Show existing float if already opened today
  const existing = JSON.parse(localStorage.getItem('apexShiftOpen_' + today) || 'null');
  const notice = document.getElementById('soCurrentFloat');
  if (existing) {
    notice.style.display = 'block';
    notice.textContent = `⚠️ Shift already opened today by ${existing.openedBy} with ₱${existing.float.toLocaleString()} float. Submitting will update it.`;
  } else {
    notice.style.display = 'none';
  }

  modal.classList.add('open');
}

function updateFloatPreview() {
  const val = parseFloat(document.getElementById('soFloat').value);
  const el  = document.getElementById('soFloatPreview');
  if (!isNaN(val) && val >= 0) {
    el.textContent = `Opening drawer: ₱${val.toLocaleString()}`;
    el.style.color = 'var(--gold)';
  } else {
    el.textContent = '';
  }
}

function confirmShiftOpen() {
  const floatVal = parseFloat(document.getElementById('soFloat').value);
  const staff    = document.getElementById('soStaff').value.trim();

  if (isNaN(floatVal) || floatVal < 0) {
    showToast('Please enter a valid opening float amount.', true); return;
  }
  if (!staff) {
    document.getElementById('soStaff').style.borderColor = 'rgba(239,68,68,0.5)';
    document.getElementById('soStaff').focus();
    showToast('Please enter your name.', true); return;
  }

  const today = new Date().toISOString().split('T')[0];
  const record = { float: floatVal, openedBy: staff, openedAt: new Date().toISOString(), date: today };
  localStorage.setItem('apexShiftOpen_' + today, JSON.stringify(record));

  document.getElementById('shiftOpenModal').classList.remove('open');
  showToast(`Shift opened by ${staff} · Float: ₱${floatVal.toLocaleString()}`);
  updateFloatIndicator();
}

function updateFloatIndicator() {
  // Show today's float in the topbar if element exists
  const el = document.getElementById('posFloatBadge');
  if (!el) return;
  const f = getOpeningFloat();
  el.textContent = f > 0 ? `Float ₱${f.toLocaleString()}` : 'Set Float';
  el.style.color = f > 0 ? '#22c55e' : '#f97316';
}

function openShiftClose() {
  const modal   = document.getElementById('shiftCloseModal');
  if (!modal) return;
  const today   = new Date().toISOString().split('T')[0];
  const dateEl  = document.getElementById('shiftCloseDate');
  const isAdmin = ['Admin','admin'].includes(localStorage.getItem('apexRole'));
  if (dateEl) dateEl.textContent =
    new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) +
    ' · ' + (localStorage.getItem('apexUser') || 'Staff');

  const bookings = getBookings().filter(b =>
    b.date === today && b.status !== 'cancelled' && b.status !== 'voided'
  );

  const byPM    = { cash:0, gcash:0, card:0 };
  const bySport = {};
  let txCount = 0;
  bookings.forEach(b => {
    const pm  = (b.paymentMethod || 'cash').toLowerCase();
    const amt = b.totalAmount || 0;
    byPM[pm]  = (byPM[pm] || 0) + amt;
    const sl  = b.sport==='pickleball'?'Pickleball':b.sport==='badminton'?'Badminton':b.sport==='drill'?'Drill Zone':'Beverages';
    bySport[sl] = (bySport[sl]||0) + amt;
    if (amt > 0) txCount++;
  });
  const grand = Object.values(byPM).reduce((s,v) => s+v, 0);

  // ── Role-aware display ──
  const show = v => isAdmin ? `₱${v.toLocaleString()}` : '<span style="color:var(--text-dim);font-size:12px">Hidden</span>';

  const kpi = (label, val, color='var(--gold)') =>
    `<div style="padding:12px 16px;border-radius:10px;background:var(--surface-3);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--text-muted)">${label}</span>
      <span style="font-size:16px;font-weight:800;color:${color}">${show(val)}</span>
    </div>`;

  // ── SUMMARY PANEL ──
  const summaryPanel = document.getElementById('sc-panel-summary');
  if (summaryPanel) summaryPanel.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">
        Total Transactions: ${txCount}
      </div>
      ${kpi('💵 Cash', byPM.cash)}
      ${kpi('📱 GCash', byPM.gcash, '#a5b4fc')}
      ${kpi('💳 Card', byPM.card, '#93c5fd')}
    </div>
    <div style="padding:14px 16px;border-radius:10px;background:rgba(0,194,168,0.08);border:1px solid rgba(0,194,168,0.25);display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <span style="font-size:15px;font-weight:700">Grand Total</span>
      <span style="font-size:24px;font-weight:900;color:var(--gold)">${show(grand)}</span>
    </div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">By Category</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${Object.entries(bySport).map(([s,v]) => kpi(s, v, 'var(--text)')).join('')}
    </div>
    ${!isAdmin ? `<div style="margin-top:16px;padding:10px 14px;border-radius:9px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);font-size:12px;color:#a5b4fc">
      💡 Revenue amounts are visible to Admin only.
    </div>` : ''}`;

  // ── INVENTORY PANEL ──
  renderInventoryPanel(bookings);

  // ── CASH COUNT PANEL ──
  const openingFloat = getOpeningFloat();
  const expectedCashInDrawer = byPM.cash + openingFloat; // sales + float
  window._scExpected = {
    cash: byPM.cash, gcash: byPM.gcash, card: byPM.card, grand,
    openingFloat, expectedCashInDrawer
  };
  renderCashCountPanel(expectedCashInDrawer, byPM.gcash, byPM.card, byPM.cash, openingFloat);

  // Reset to summary tab
  scTab('summary', document.getElementById('sc-tab-summary'));
  modal.classList.add('open');
}

function renderCashCountPanel(expectedCash, expectedGcash, expectedCard, cashSales = 0, openingFloat = 0) {
  const panel = document.getElementById('sc-panel-cash');
  if (!panel) return;

  const row = (label, icon, expected, inputId, color = 'var(--gold)', subNote = '') => `
    <div style="padding:14px 16px;border-radius:10px;background:var(--surface-3);border:1px solid var(--border);margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${subNote?'4px':'10px'}">
        <span style="font-size:13px;font-weight:700">${icon} ${label}</span>
        <span style="font-size:12px;color:var(--text-muted)">Expected: <strong style="color:${color}">₱${expected.toLocaleString()}</strong></span>
      </div>
      ${subNote ? `<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">${subNote}</div>` : ''}
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px;color:var(--text-muted)">₱</span>
        <input type="number" id="${inputId}" min="0" step="1" placeholder="0"
          style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:16px;font-family:inherit;font-weight:700;outline:none"
          oninput="updateCashReconciliation()"
          onfocus="this.style.borderColor='var(--gold)'"
          onblur="this.style.borderColor='var(--border)'" />
      </div>
      <div id="${inputId}-result" style="margin-top:8px;font-size:12px;font-weight:600;text-align:right;min-height:16px"></div>
    </div>`;

  panel.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">
        Count actual amounts in drawer / receipts
      </div>
      ${openingFloat > 0
        ? row('Cash (Drawer)', '💵', expectedCash, 'sc-actual-cash', 'var(--gold)',
            `Opening float ₱${openingFloat.toLocaleString()} + Cash sales ₱${cashSales.toLocaleString()}`)
        : row('Cash (Drawer)', '💵', expectedCash, 'sc-actual-cash', 'var(--gold)',
            openingFloat === 0 ? '⚠️ No opening float set — <a onclick="document.getElementById(\'shiftCloseModal\').classList.remove(\'open\');openShiftOpen()" style="color:var(--gold);cursor:pointer;text-decoration:underline">set now</a>' : '')
      }
      ${row('GCash', '📱', expectedGcash, 'sc-actual-gcash', '#a5b4fc')}
      ${row('Card / Online', '💳', expectedCard, 'sc-actual-card', '#93c5fd')}
    </div>

    <!-- Overall reconciliation result -->
    <div id="sc-reconcile-total" style="padding:14px 16px;border-radius:10px;background:rgba(0,194,168,0.07);border:1px solid rgba(0,194,168,0.2);margin-bottom:16px;display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700">Total Over / Short</span>
        <span id="sc-total-diff" style="font-size:20px;font-weight:900"></span>
      </div>
      <div style="font-size:11px;color:var(--text-muted)" id="sc-reconcile-detail"></div>
    </div>

    <!-- Staff info -->
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px">Closed by</label>
        <input type="text" id="sc-closed-by" value="${localStorage.getItem('apexUser') || ''}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:14px;font-family:inherit;outline:none"
          onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px">Notes (optional)</label>
        <textarea id="sc-notes" rows="2" placeholder="Any discrepancies or remarks..."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:13px;font-family:inherit;outline:none;resize:none"
          onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      </div>
    </div>`;
}

function updateCashReconciliation() {
  const exp = window._scExpected || {};
  const items = [
    { inputId: 'sc-actual-cash',  expected: exp.expectedCashInDrawer || exp.cash || 0, label: 'Cash' },
    { inputId: 'sc-actual-gcash', expected: exp.gcash || 0, label: 'GCash' },
    { inputId: 'sc-actual-card',  expected: exp.card  || 0, label: 'Card' },
  ];

  let totalActual = 0, totalExpected = 0, allFilled = true;

  items.forEach(({ inputId, expected, label }) => {
    const input = document.getElementById(inputId);
    const result = document.getElementById(inputId + '-result');
    if (!input || !result) return;
    const val = parseFloat(input.value);
    if (isNaN(val) || input.value === '') { allFilled = false; result.textContent = ''; return; }
    const diff = val - expected;
    totalActual   += val;
    totalExpected += expected;
    if (diff === 0) {
      result.innerHTML = `<span style="color:#22c55e">✓ Balanced</span>`;
    } else if (diff > 0) {
      result.innerHTML = `<span style="color:#f97316">▲ Over ₱${Math.abs(diff).toLocaleString()}</span>`;
    } else {
      result.innerHTML = `<span style="color:#f87171">▼ Short ₱${Math.abs(diff).toLocaleString()}</span>`;
    }
  });

  const totalPanel = document.getElementById('sc-reconcile-total');
  const totalDiff  = document.getElementById('sc-total-diff');
  const detail     = document.getElementById('sc-reconcile-detail');
  if (allFilled && totalPanel && totalDiff) {
    const diff = totalActual - totalExpected;
    totalPanel.style.display = 'block';
    if (diff === 0) {
      totalPanel.style.borderColor = 'rgba(34,197,94,0.4)';
      totalPanel.style.background  = 'rgba(34,197,94,0.07)';
      totalDiff.textContent = '✓ Balanced';
      totalDiff.style.color = '#22c55e';
    } else if (diff > 0) {
      totalPanel.style.borderColor = 'rgba(249,115,22,0.4)';
      totalPanel.style.background  = 'rgba(249,115,22,0.07)';
      totalDiff.textContent = `▲ Over ₱${Math.abs(diff).toLocaleString()}`;
      totalDiff.style.color = '#f97316';
    } else {
      totalPanel.style.borderColor = 'rgba(239,68,68,0.4)';
      totalPanel.style.background  = 'rgba(239,68,68,0.07)';
      totalDiff.textContent = `▼ Short ₱${Math.abs(diff).toLocaleString()}`;
      totalDiff.style.color = '#f87171';
    }
    if (detail) detail.textContent =
      `Actual ₱${totalActual.toLocaleString()} vs Expected ₱${totalExpected.toLocaleString()}`;
  }
}

function confirmShiftClose() {
  // Validate cash count tab filled
  const cashVal  = document.getElementById('sc-actual-cash')?.value;
  const gcashVal = document.getElementById('sc-actual-gcash')?.value;
  const cardVal  = document.getElementById('sc-actual-card')?.value;
  const closedBy = document.getElementById('sc-closed-by')?.value?.trim();

  if (!cashVal && !gcashVal && !cardVal) {
    // Allow closing without cash count (just summary mode)
    const ok = confirm('Cash count not entered. Close shift without reconciliation?');
    if (!ok) { scTab('cash', document.getElementById('sc-tab-cash')); return; }
  }

  if (!closedBy) {
    scTab('cash', document.getElementById('sc-tab-cash'));
    const el = document.getElementById('sc-closed-by');
    if (el) { el.style.borderColor = 'rgba(239,68,68,0.5)'; el.focus(); }
    showToast('Please enter your name before closing shift.', true);
    return;
  }

  const exp   = window._scExpected || {};
  const notes = document.getElementById('sc-notes')?.value || '';
  const record = {
    closedAt:  new Date().toISOString(),
    closedBy,
    notes,
    expected:  { cash: exp.cash, gcash: exp.gcash, card: exp.card, total: exp.grand },
    actual: {
      cash:  parseFloat(cashVal)  || null,
      gcash: parseFloat(gcashVal) || null,
      card:  parseFloat(cardVal)  || null,
    },
  };
  record.actual.total = (record.actual.cash || 0) + (record.actual.gcash || 0) + (record.actual.card || 0);
  record.diff = record.actual.total - (exp.grand || 0);

  // Save shift close record
  const history = JSON.parse(localStorage.getItem('apexShiftHistory') || '[]');
  history.unshift(record);
  localStorage.setItem('apexShiftHistory', JSON.stringify(history.slice(0, 30)));

  document.getElementById('shiftCloseModal').classList.remove('open');

  const diffMsg = record.diff === 0 ? 'Balanced ✓'
    : record.diff > 0 ? `Over ₱${Math.abs(record.diff).toLocaleString()}`
    : `Short ₱${Math.abs(record.diff).toLocaleString()}`;
  showToast(`Shift closed by ${closedBy} · ${diffMsg}`);
  printShiftSummary();
}

function renderInventoryPanel(bookings) {
  const panel = document.getElementById('sc-panel-inventory');
  if (!panel) return;

  // Count equipment rented today from bookings
  const rentedCount = { racket:0, shoes:0, balls:0, towel:0, grip:0 };
  bookings.forEach(b => {
    (b.extras || []).forEach(e => { if (rentedCount[e] !== undefined) rentedCount[e]++; });
  });

  // Count still-active equipment (not yet returned = still in COURT_DATA)
  const stillOut = { racket:0, shoes:0, balls:0, towel:0, grip:0 };
  Object.values(COURT_DATA).forEach(courts => {
    courts.forEach(c => {
      if (c.status === 'occupied') {
        (c.equipment || []).forEach(e => { if (stillOut[e] !== undefined) stillOut[e]++; });
      }
    });
  });

  const EQUIP_NAMES = { racket:'Racket', shoes:'Court Shoes', balls:'Ball Pack (6)', towel:'Towel', grip:'Grip Tape' };
  const BEV_NAMES   = { water:'Water 500ml', pocari:'Pocari Sweat', 'coke-zero':'Coke Zero', energy:'Energy Drink', snack:'Snack Bar' };

  // Equipment section
  const equipRows = Object.entries(EQUIP_NAMES).map(([k, name]) => {
    const rented   = rentedCount[k];
    const out      = stillOut[k];
    const returned = rented - out;
    const warn     = out > 0;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--surface-3);border:1px solid ${warn?'rgba(239,68,68,0.35)':'var(--border)'}">
        <input type="checkbox" id="inv-${k}" style="accent-color:#4ade80;width:16px;height:16px;cursor:pointer" ${rented===0?'disabled':''} />
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:${warn?'#f87171':'var(--text)'}">${name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            Rented: ${rented} · Returned: ${returned} · <span style="color:${warn?'#f87171':'#4ade80'};font-weight:700">${out > 0 ? `⚠️ ${out} still out` : '✓ All returned'}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Beverages stock section (manual count)
  const bevRows = Object.entries(BEV_NAMES).map(([k, name]) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:var(--surface-3);border:1px solid var(--border)">
      <div style="flex:1;font-size:13px;font-weight:600;color:var(--text)">${name}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--text-muted)">Remaining:</span>
        <input type="number" id="stock-${k}" min="0" placeholder="—" style="width:60px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;text-align:center;outline:none" />
      </div>
    </div>`).join('');

  panel.innerHTML = `
    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">
      Equipment — check all returned
    </div>
    <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">${equipRows}</div>

    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">
      Beverages — enter closing stock count
    </div>
    <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">${bevRows}</div>

    <button onclick="saveInventoryCheck()" class="btn-sm gold" style="width:100%;padding:12px;font-size:13px">
      ✓ Save Inventory Check
    </button>`;
}

function saveInventoryCheck() {
  // Collect equipment checkbox states
  const equip = {};
  ['racket','shoes','balls','towel','grip'].forEach(k => {
    equip[k] = document.getElementById('inv-'+k)?.checked || false;
  });
  // Collect beverage stock counts
  const stock = {};
  ['water','pocari','coke-zero','energy','snack'].forEach(k => {
    stock[k] = parseInt(document.getElementById('stock-'+k)?.value || '0') || 0;
  });
  const record = {
    date:      new Date().toISOString().split('T')[0],
    time:      new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
    staff:     localStorage.getItem('apexUser') || 'Staff',
    equipment: equip,
    beverages: stock,
  };
  // Save to localStorage
  const history = JSON.parse(localStorage.getItem('apexInventoryLog') || '[]');
  history.unshift(record);
  localStorage.setItem('apexInventoryLog', JSON.stringify(history.slice(0, 60)));
  showToast('✅ Inventory check saved');
  document.getElementById('shiftCloseModal')?.classList.remove('open');
  logActivity('inventory', 'INV-' + Date.now(), `Inventory check by ${record.staff}`);
}

function printShiftSummary() {
  const today = new Date().toISOString().split('T')[0];
  const bookings = getBookings().filter(b => b.date === today && b.status !== 'cancelled' && b.status !== 'voided');
  const byPM = { cash:0, gcash:0, card:0 };
  const bySport = {};
  bookings.forEach(b => {
    const pm = (b.paymentMethod||'cash').toLowerCase();
    byPM[pm] = (byPM[pm]||0) + (b.totalAmount||0);
    const sl = b.sport==='pickleball'?'Pickleball':b.sport==='badminton'?'Badminton':b.sport==='drill'?'Drill Zone':'Beverages';
    bySport[sl] = (bySport[sl]||0) + (b.totalAmount||0);
  });
  const grand = Object.values(byPM).reduce((s,v)=>s+v,0);
  const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const staff   = localStorage.getItem('apexUser') || 'Staff';

  const p = new ESCPOSBuilder();
  p.init();
  p.lf();
  p.line(STUDIO_CONFIG.name, 1, true, true);
  p.line('SHIFT CLOSE REPORT', 1, true);
  p.line(dateStr, 1);
  p.line('Staff: ' + staff, 1);
  p.divider('=');
  p.pad('Cash:', 'PHP ' + byPM.cash.toLocaleString());
  p.pad('GCash:', 'PHP ' + byPM.gcash.toLocaleString());
  p.pad('Card:', 'PHP ' + byPM.card.toLocaleString());
  p.divider('-');
  Object.entries(bySport).forEach(([s,v]) => p.pad(s+':', 'PHP '+v.toLocaleString()));
  p.divider('=');
  p.bold(true); p.dblH(true);
  p.pad('TOTAL:', 'PHP ' + grand.toLocaleString());
  p.dblH(false); p.bold(false);
  p.lf(4); p.cut();

  // Re-use the print USB function with inline data
  const prevData = _currentReceiptData;
  _currentReceiptData = { _rawESCPOS: p.build() };
  printReceiptUSBRaw(p.build()).then(() => { _currentReceiptData = prevData; });
}

async function printReceiptUSBRaw(bytes) {
  if (!('serial' in navigator)) { showToast('Web Serial not supported. Use Chrome/Edge.', 'error'); return; }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    await port.close();
    showToast('✅ Printed successfully!');
  } catch(e) {
    if (e.name !== 'NotFoundError') showToast('Print error: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════
//  CHECK-IN (pre-booked customers)
// ═══════════════════════════════════════
function renderCheckIn() {
  const list = document.getElementById('checkinList');
  if (!list) return;
  const today    = new Date().toISOString().split('T')[0];
  const bookings = getBookings().filter(b =>
    b.date === today && b.status === 'confirmed' && b.sport !== 'beverages'
  ).sort((a,b) => (a.time > b.time ? 1 : -1));

  if (!bookings.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:14px">No confirmed bookings for today</div>';
    return;
  }

  list.innerHTML = bookings.map(b => {
    const sportLabel = b.sport==='pickleball'?'Pickleball':b.sport==='badminton'?'Badminton':'Drill Zone';
    const abbr       = b.sport==='pickleball'?'PB':b.sport==='badminton'?'BD':'DZ';
    const durLabel   = b.duration < 1 ? `${Math.round(b.duration*60)} min` : `${b.duration}h`;
    const court      = COURT_DATA[b.sport]?.[b.court-1];
    const isOccupied = court?.status === 'occupied';
    return `
      <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:12px;background:var(--surface);border:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${b.userName}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${sportLabel} · ${abbr} Court ${b.court} · ${b.time} (${durLabel})</div>
          <div style="font-size:11px;font-family:monospace;color:var(--text-dim);margin-top:2px">${b.id}</div>
        </div>
        ${isOccupied
          ? `<div style="font-size:11px;padding:4px 10px;border-radius:100px;background:rgba(212,175,55,0.1);color:var(--gold);font-weight:700">In Play</div>`
          : `<button class="btn-sm gold" onclick="checkInBooking('${b.id}','${b.sport}',${b.court})">Check In</button>`}
      </div>`;
  }).join('');
}

function checkInBooking(bookingId, sport, courtNum) {
  const bkg = getBookings().find(b => b.id === bookingId);
  if (!bkg) return;

  const court = COURT_DATA[sport]?.[courtNum - 1];
  if (!court) return;

  if (court.status === 'occupied') {
    showToast('Court is already occupied.', 'error'); return;
  }

  // Activate court session
  court.status    = 'occupied';
  court.player    = bkg.userName;
  court.startTime = Date.now();
  court.duration  = Math.round((bkg.duration || 1) * 60);
  court.booking   = bookingId;
  court.equipment = bkg.extras?.filter(e => EQUIPMENT_IDS.includes(e)) || [];
  delete alarmFired[`${sport}-${courtNum}`];

  // Mark booking as checked-in
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx > -1) { bookings[idx].status = 'walkin'; saveBookings(bookings); }

  const abbr = sport==='pickleball'?'PB':sport==='badminton'?'BD':'DZ';
  logActivity('checkin', bookingId, `${bkg.userName} checked in → ${abbr} ${courtNum}`);
  saveCourtData();
  renderCheckIn();
  showToast(`✅ ${bkg.userName} checked in — ${abbr} Court ${courtNum}`);
}

// ═══════════════════════════════════════
//  BEVERAGES QUICK SELL
// ═══════════════════════════════════════
let bevCart = {}; // { productId: qty }

function renderBevView() {
  const grid = document.getElementById('bevProductGrid');
  if (!grid) return;
  grid.innerHTML = '';
  bevCart = {};

  PRODUCTS.filter(p => p.cat === 'fb').forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'ca-product-tile';
    tile.id = 'bev-tile-' + p.id;
    tile.style.cssText = 'padding:16px 12px;border-radius:12px;text-align:center;background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:all 0.2s;position:relative;';
    tile.innerHTML = `
      <div style="font-size:28px;margin-bottom:6px">${p.icon}</div>
      <div style="font-size:12px;font-weight:700;margin-bottom:2px">${p.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${p.sub}</div>
      <div style="font-size:14px;font-weight:800;color:var(--gold)">₱${p.price}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px">
        <button type="button" onclick="event.stopPropagation();addBevItem('${p.id}',-1)" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--surface-3);color:var(--text);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">−</button>
        <span style="font-size:14px;font-weight:700;min-width:20px;text-align:center" id="bev-qty-${p.id}">0</span>
        <button type="button" onclick="event.stopPropagation();addBevItem('${p.id}',1)" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--surface-3);color:var(--text);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">+</button>
      </div>`;
    tile.addEventListener('click', () => addBevItem(p.id, 1));
    grid.appendChild(tile);
  });
  updateBevTotal();
}

function addBevItem(id, delta) {
  bevCart[id] = Math.max(0, (bevCart[id] || 0) + delta);
  const qtyEl = document.getElementById('bev-qty-' + id);
  if (qtyEl) qtyEl.textContent = bevCart[id];
  const tile = document.getElementById('bev-tile-' + id);
  if (tile) {
    tile.style.borderColor = bevCart[id] > 0 ? 'rgba(0,194,168,0.5)' : 'var(--border)';
    tile.style.background  = bevCart[id] > 0 ? 'rgba(0,194,168,0.06)' : 'var(--surface)';
  }
  updateBevTotal();
}

function updateBevTotal() {
  let total = 0;
  const lines = [];
  Object.entries(bevCart).forEach(([id, qty]) => {
    if (!qty) return;
    const p = PRODUCTS.find(pr => pr.id === id);
    if (!p) return;
    total += p.price * qty;
    lines.push({ p, qty });
  });

  const totalEl  = document.getElementById('bevTotal');
  const btn      = document.getElementById('bevChargeBtn');
  const emptyMsg = document.getElementById('bevEmptyMsg');
  const itemsEl  = document.getElementById('bevCartItems');

  if (totalEl) totalEl.textContent = '₱' + total.toLocaleString();
  if (btn) {
    btn.disabled = total === 0;
    btn.style.opacity = total > 0 ? '1' : '0.4';
    btn.textContent   = total > 0 ? `Charge ₱${total.toLocaleString()}` : 'Select items';
  }
  if (emptyMsg) emptyMsg.style.display = lines.length ? 'none' : 'block';

  // Cart line items
  if (itemsEl) {
    const existing = itemsEl.querySelectorAll('.bev-cart-line');
    existing.forEach(el => el.remove());
    lines.forEach(({ p, qty }) => {
      const row = document.createElement('div');
      row.className = 'bev-cart-line';
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;';
      row.innerHTML = `
        <span style="color:var(--text)">${p.icon} ${p.name} ×${qty}</span>
        <span style="font-weight:700;color:var(--gold)">₱${(p.price * qty).toLocaleString()}</span>`;
      itemsEl.appendChild(row);
    });
  }
}

function resetBevCart() {
  renderBevView();
}

function chargeBeverages() {
  const items = Object.entries(bevCart).filter(([, q]) => q > 0);
  if (!items.length) return;
  const total = items.reduce((s, [id, q]) => {
    const p = PRODUCTS.find(pr => pr.id === id);
    return s + (p ? p.price * q : 0);
  }, 0);
  const itemNames = items.map(([id, q]) => {
    const p = PRODUCTS.find(pr => pr.id === id);
    return `${q}× ${p?.name || id}`;
  }).join(', ');

  const id    = 'APX-B' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date();
  const sh = now.getHours(); const sm = now.getMinutes();
  const sp = sh >= 12 ? 'PM' : 'AM'; const sh12 = sh > 12 ? sh - 12 : sh === 0 ? 12 : sh;
  const timeStr = `${sh12}:${String(sm).padStart(2,'0')} ${sp}`;

  const bookings = getBookings();
  bookings.unshift({
    id, userName: 'Quick Sale', sport: 'beverages', date: today,
    time: timeStr, duration: 0, court: 0,
    extras: items.map(([pid]) => pid),
    totalAmount: total, status: 'walkin',
    paymentMethod: bevPayMethod, createdAt: new Date().toISOString(), createdBy: 'staff',
  });
  saveBookings(bookings);
  logActivity('beverages', id, `Quick sale: ${itemNames} — ₱${total.toLocaleString()} (${bevPayMethod})`);
  showToast(`✅ PHP ${total.toLocaleString()} charged — ${itemNames}`);

  // Show receipt
  showReceiptPreview(makeReceiptData('beverages', {
    id, items: items.map(([pid, q]) => {
      const pr = PRODUCTS.find(p => p.id === pid);
      return { name: pr?.name || pid, qty: q, price: pr?.price || 0 };
    }),
    total, paymentMethod: 'cash',
  }));
  renderBevView();
}

// ═══════════════════════════════════════
//  RECEIPT SYSTEM
// ═══════════════════════════════════════

let _currentReceiptData = null;

// Build receipt data object from different transaction types
function makeReceiptData(type, params) {
  const now = new Date();
  return {
    type,
    id:       params.id || ('APX-' + Math.floor(Math.random()*9000+1000)),
    date:     now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
    time:     now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
    cashier:  localStorage.getItem('apexUser') || 'Staff',
    paymentMethod: params.paymentMethod || 'cash',
    ...params,
  };
}

// ─── HTML RECEIPT PREVIEW ───
function buildReceiptHTML(d) {
  const W = 32; // chars wide (monospace columns)
  const line  = (txt='') => `<div>${txt}</div>`;
  const ctr   = (txt, bold=false, big=false) =>
    `<div class="r-center${bold?' r-bold':''}${big?' r-big':''}">${txt}</div>`;
  const div   = () => `<div class="r-div"></div>`;
  const divS  = () => `<div class="r-div-s"></div>`;
  const row   = (l,r,cls='') =>
    `<div class="r-row${cls?' '+cls:''}"><span>${l}</span><span>${r}</span></div>`;
  const blank = () => `<div>&nbsp;</div>`;
  const muted = (txt) => `<div class="r-center r-muted">${txt}</div>`;
  const indent= (txt) => `<div class="r-indent">${txt}</div>`;

  const vat   = Math.round(d.total * STUDIO_CONFIG.vat_rate / (100 + STUDIO_CONFIG.vat_rate));
  const net   = d.total - vat;
  const pmLabel = { cash:'Cash', gcash:'GCash', card:'Card / Online' }[d.paymentMethod] || d.paymentMethod;

  let html = '';

  // ── HEADER ──
  html += blank();
  html += ctr(STUDIO_CONFIG.name, true, true);
  html += ctr(STUDIO_CONFIG.tagline);
  html += blank();
  html += ctr(STUDIO_CONFIG.address1);
  html += ctr(STUDIO_CONFIG.address2);
  html += ctr(`Tel: ${STUDIO_CONFIG.phone}`);
  html += divS();

  // ── RECEIPT META ──
  html += row(`<span class="r-bold">Receipt #</span>`, `<span class="r-bold">${d.id}</span>`);
  html += row(d.date, d.time);
  html += row('Cashier:', d.cashier);
  html += div();

  // ── SESSION DETAILS ──
  if (d.type === 'session' || d.type === 'end') {
    html += `<div class="r-bold">COURT SESSION</div>`;
    const sportLabel = d.sport === 'pickleball' ? 'Pickleball' : d.sport === 'badminton' ? 'Badminton' : 'Drill Zone';
    html += indent(`${d.abbr} ${d.sport === 'drill' ? 'Zone' : 'Court'} ${d.courtNum} · ${sportLabel}`);
    html += indent(`Player: ${d.player}`);
    if (d.startTimeLabel && d.endLabel)
      html += indent(`${d.startTimeLabel} → ${d.endLabel} (${d.durationLabel})`);
    html += row('  Court fee:', `PHP ${d.courtCost?.toLocaleString() || 0}`);
    html += div();
  }

  // ── BEVERAGES TYPE ──
  if (d.type === 'beverages') {
    html += `<div class="r-bold">BEVERAGES / QUICK SALE</div>`;
    html += div();
  }

  // ── LINE ITEMS ──
  const hasEquip = d.equipment && d.equipment.length;
  const hasItems = d.items && d.items.length;

  if (hasEquip) {
    html += `<div class="r-bold">EQUIPMENT RENTAL</div>`;
    const grouped = {};
    d.equipment.forEach(e => { grouped[e] = (grouped[e]||0)+1; });
    const NAMES = { racket:'Racket Rental', shoes:'Court Shoes', balls:'Ball Pack (6)', towel:'Towel', grip:'Grip Tape' };
    const PRICES = { racket:50, shoes:50, balls:120, towel:50, grip:80 };
    Object.entries(grouped).forEach(([k,q]) => {
      html += row(`  ${NAMES[k]||k} ×${q}`, `PHP ${((PRICES[k]||0)*q).toLocaleString()}`);
    });
    html += div();
  }

  if (hasItems) {
    html += `<div class="r-bold">ITEMS</div>`;
    d.items.forEach(it => {
      html += row(`  ${it.name} ×${it.qty}`, `PHP ${(it.price * it.qty).toLocaleString()}`);
    });
    html += div();
  }

  // ── TOTALS ──
  html += divS();
  html += row('Net Amount (excl. VAT):', `PHP ${net.toLocaleString()}`);
  html += row(`VAT ${STUDIO_CONFIG.vat_rate}% (incl.):`, `PHP ${vat.toLocaleString()}`);
  html += divS();
  html += `<div class="r-row r-total"><span>TOTAL</span><span>PHP ${d.total.toLocaleString()}</span></div>`;
  html += row('Payment:', pmLabel);
  html += divS();

  // ── FOOTER ──
  html += blank();
  html += muted(`Wi-Fi: ${STUDIO_CONFIG.wifi_ssid}`);
  html += muted(`Password: ${STUDIO_CONFIG.wifi_pass}`);
  html += blank();
  html += muted(STUDIO_CONFIG.hours);
  html += blank();
  html += muted(STUDIO_CONFIG.website);
  html += muted(STUDIO_CONFIG.instagram);
  html += blank();

  // ── QR CODE placeholder ──
  html += `<div class="r-center" style="margin:10px 0">`;
  html += `<div id="receiptQR" style="display:inline-block"></div>`;
  html += `<div class="r-muted r-small" style="margin-top:4px">Scan to book online</div>`;
  html += `</div>`;

  html += div();
  html += ctr('Thank you for playing with us!', true);
  html += ctr('See you next time  🎾');
  html += blank();

  return html;
}

// ─── RECEIPT HISTORY ───
function saveToReceiptHistory(data) {
  const hist = JSON.parse(localStorage.getItem('apexReceiptHistory') || '[]');
  hist.unshift({
    id:       data.id,
    time:     data.time,
    date:     data.date,
    type:     data.type,
    name:     data.player || data.userName || 'Quick Sale',
    total:    data.total || 0,
    paymentMethod: data.paymentMethod || 'cash',
    data,
  });
  // Keep last 100 receipts
  localStorage.setItem('apexReceiptHistory', JSON.stringify(hist.slice(0, 100)));
}

function openReceiptHistory() {
  const modal  = document.getElementById('receiptHistoryModal');
  const list   = document.getElementById('receiptHistoryList');
  if (!modal || !list) return;

  const today = new Date().toISOString().split('T')[0];
  const hist  = JSON.parse(localStorage.getItem('apexReceiptHistory') || '[]')
    .filter(h => h.data?.date === today || h.date === today);

  const isAdmin = ['Admin','admin'].includes(localStorage.getItem('apexRole'));

  if (!hist.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-dim)">No receipts today</div>';
  } else {
    const typeIcon = { session:'🎾', beverages:'🥤', items:'🛒', end:'✅' };
    const pmIcon   = { cash:'💵', gcash:'📱', card:'💳' };
    list.innerHTML = hist.map((h, i) => `
      <div onclick="reprintFromHistory(${i})" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor='rgba(0,194,168,0.4)'" onmouseleave="this.style.borderColor='var(--border)'">
        <div style="font-size:22px">${typeIcon[h.type] || '🧾'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${h.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${h.time} · ${h.type} · ${pmIcon[h.paymentMethod]||''} ${h.paymentMethod}</div>
          <div style="font-size:10px;font-family:monospace;color:var(--text-dim);margin-top:1px">${h.id}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:800;color:var(--gold)">${isAdmin ? '₱'+h.total.toLocaleString() : '—'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">tap to reprint</div>
        </div>
      </div>`).join('');
  }
  modal.classList.add('open');
}

function reprintFromHistory(idx) {
  const hist = JSON.parse(localStorage.getItem('apexReceiptHistory') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const todayHist = hist.filter(h => h.data?.date === today || h.date === today);
  if (!todayHist[idx]) return;
  document.getElementById('receiptHistoryModal')?.classList.remove('open');
  showReceiptPreview(todayHist[idx].data);
}

// Show receipt modal
function showReceiptPreview(data) {
  _currentReceiptData = data;
  const paper    = document.getElementById('receiptPaper');
  const subtitle = document.getElementById('receiptSubtitle');
  const modal    = document.getElementById('receiptModal');
  if (!paper || !modal) return;

  paper.innerHTML = buildReceiptHTML(data);
  if (subtitle) subtitle.textContent = `${data.id} · ${data.date} ${data.time}`;
  saveToReceiptHistory(data);

  // Render QR code
  const qrEl = document.getElementById('receiptQR');
  if (qrEl && window.QRCode) {
    qrEl.innerHTML = '';
    try {
      new QRCode(qrEl, {
        text: STUDIO_CONFIG.qr_url,
        width: 80, height: 80,
        colorDark: '#111', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) { qrEl.innerHTML = '<div style="font-size:10px;color:#666">[QR]</div>'; }
  }

  modal.classList.add('open');
}

function closeReceipt() {
  document.getElementById('receiptModal')?.classList.remove('open');
  const s = document.getElementById('usbStatus');
  if (s) s.style.display = 'none';
}

// ─── ESC/POS THERMAL PRINTER ───
class ESCPOSBuilder {
  constructor() { this.buf = []; }
  push(...b)  { this.buf.push(...b); return this; }
  init()      { return this.push(0x1B,0x40); }
  lf(n=1)     { for(let i=0;i<n;i++) this.buf.push(0x0A); return this; }
  align(a)    { return this.push(0x1B,0x61,a); }  // 0=L 1=C 2=R
  bold(on)    { return this.push(0x1B,0x45,on?1:0); }
  dblH(on)    { return this.push(0x1B,0x21,on?0x10:0x00); }
  dblWH(on)   { return this.push(0x1D,0x21,on?0x11:0x00); }
  text(str)   {
    for (const ch of str) {
      const code = ch.charCodeAt(0);
      this.buf.push(code < 128 ? code : 0x3F); // '?' for non-ASCII
    }
    return this;
  }
  line(str, al=0, bold=false, dbl=false) {
    this.align(al);
    if (bold) this.bold(true);
    if (dbl)  this.dblWH(true);
    this.text(str).lf();
    if (dbl)  this.dblWH(false);
    if (bold) this.bold(false);
    return this;
  }
  pad(l,r,w=32) {
    const sp = w - l.length - r.length;
    return this.align(0).text(l + ' '.repeat(Math.max(1,sp)) + r).lf();
  }
  divider(c='-',w=32) { return this.align(0).text(c.repeat(w)).lf(); }
  qr(url, size=5) {
    const d = [...url].map(c => c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 0x3F);
    const len = d.length + 3;
    const lL = len & 0xFF, lH = (len>>8)&0xFF;
    // model 2, size, error correction M, store, print
    this.push(0x1D,0x28,0x6B,4,0,49,65,50,0);           // model 2
    this.push(0x1D,0x28,0x6B,3,0,49,67,size);            // size
    this.push(0x1D,0x28,0x6B,3,0,49,69,49);              // error M
    this.push(0x1D,0x28,0x6B,lL,lH,49,80,48,...d);       // store
    this.push(0x1D,0x28,0x6B,3,0,49,81,48);              // print
    return this;
  }
  cut() { return this.push(0x1D,0x56,0x42,0x00); }
  build() { return new Uint8Array(this.buf); }
}

function buildESCPOS(d) {
  const W = 32;
  const p = new ESCPOSBuilder();
  const vat = Math.round(d.total * STUDIO_CONFIG.vat_rate / (100 + STUDIO_CONFIG.vat_rate));
  const net = d.total - vat;
  const pmLabel = { cash:'Cash', gcash:'GCash', card:'Card/Online' }[d.paymentMethod] || d.paymentMethod;

  p.init();
  p.lf();
  p.line(STUDIO_CONFIG.name, 1, true, true);
  p.line(STUDIO_CONFIG.tagline, 1);
  p.line(STUDIO_CONFIG.address1, 1);
  p.line(STUDIO_CONFIG.address2, 1);
  p.line('Tel: ' + STUDIO_CONFIG.phone, 1);
  p.divider('=');

  p.pad('Receipt #: ' + d.id, '');
  p.pad(d.date, d.time);
  p.pad('Cashier:', d.cashier);
  p.divider('-');

  if (d.type === 'session' || d.type === 'end') {
    p.line('COURT SESSION', 0, true);
    const sLabel = d.sport==='pickleball'?'Pickleball':d.sport==='badminton'?'Badminton':'Drill Zone';
    p.line(`  ${d.abbr} ${d.sport==='drill'?'Zone':'Court'} ${d.courtNum} - ${sLabel}`);
    p.line(`  Player: ${d.player}`);
    if (d.startTimeLabel && d.endLabel)
      p.line(`  ${d.startTimeLabel} -> ${d.endLabel} (${d.durationLabel})`);
    p.pad('  Court fee:', 'PHP ' + (d.courtCost||0).toLocaleString());
    p.divider('-');
  }

  if (d.equipment && d.equipment.length) {
    p.line('EQUIPMENT RENTAL', 0, true);
    const gr = {}; d.equipment.forEach(e => gr[e]=(gr[e]||0)+1);
    const NM = {racket:'Racket',shoes:'Shoes',balls:'Ball Pack',towel:'Towel',grip:'Grip'};
    const PR = {racket:50,shoes:50,balls:120,towel:50,grip:80};
    Object.entries(gr).forEach(([k,q]) => p.pad(`  ${NM[k]||k} x${q}`, 'PHP '+(PR[k]||0)*q));
    p.divider('-');
  }

  if (d.items && d.items.length) {
    p.line('ITEMS', 0, true);
    d.items.forEach(it => p.pad(`  ${it.name} x${it.qty}`, 'PHP '+(it.price*it.qty)));
    p.divider('-');
  }

  p.divider('=');
  p.pad('Net (excl. VAT):', 'PHP ' + net.toLocaleString());
  p.pad(`VAT ${STUDIO_CONFIG.vat_rate}% (incl.):`, 'PHP ' + vat.toLocaleString());
  p.divider('=');
  p.bold(true); p.dblH(true);
  p.pad('TOTAL:', 'PHP ' + d.total.toLocaleString());
  p.dblH(false); p.bold(false);
  p.pad('Payment:', pmLabel);
  p.divider('=');

  p.lf();
  p.align(1);
  p.line('Wi-Fi: ' + STUDIO_CONFIG.wifi_ssid, 1);
  p.line('Pass:  ' + STUDIO_CONFIG.wifi_pass, 1);
  p.lf();
  p.line(STUDIO_CONFIG.hours, 1);
  p.line(STUDIO_CONFIG.website, 1);
  p.line(STUDIO_CONFIG.instagram, 1);
  p.lf();
  p.qr(STUDIO_CONFIG.qr_url, 5);
  p.line('Scan to book your next session', 1);
  p.lf();
  p.line('Thank you for playing with us!', 1, true);
  p.line('See you next time :)', 1);
  p.lf(4);
  p.cut();

  return p.build();
}

async function printReceiptUSB() {
  const statusEl = document.getElementById('usbStatus');
  function setStatus(msg, color) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.background = `rgba(${color},0.1)`;
    statusEl.style.border = `1px solid rgba(${color},0.3)`;
    statusEl.style.color = `rgb(${color})`;
    statusEl.textContent = msg;
  }

  if (!('serial' in navigator)) {
    setStatus('⚠️ Web Serial API not supported. Use Chrome or Edge.', '251,146,60');
    return;
  }
  if (!_currentReceiptData) return;

  try {
    setStatus('🔌 Connecting to printer…', '99,102,241');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    const bytes  = buildESCPOS(_currentReceiptData);
    await writer.write(bytes);
    writer.releaseLock();
    await port.close();
    setStatus('✅ Printed successfully!', '34,197,94');
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      setStatus('❌ Print error: ' + err.message, '239,68,68');
    } else {
      setStatus('', '0,0,0');
      if (statusEl) statusEl.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════
//  MOBILE HELPERS
// ═══════════════════════════════════════
function toggleMobMore() {
  document.getElementById('mobMoreSheet')?.classList.add('open');
}
function closeMobMore() {
  document.getElementById('mobMoreSheet')?.classList.remove('open');
}
function toggleLiveSummary() {
  const drawer = document.getElementById('mobSummaryDrawer');
  if (!drawer) return;
  // Sync data to mobile drawer
  const allCourts = [...COURT_DATA.pickleball, ...COURT_DATA.badminton, ...COURT_DATA.drill];
  const occ = allCourts.filter(c => c.status === 'occupied').length;
  const avl = allCourts.length - occ;
  const occEl = document.getElementById('mobSummaryOcc');
  const avlEl = document.getElementById('mobSummaryAvl');
  if (occEl) occEl.textContent = occ;
  if (avlEl) avlEl.textContent = avl;

  const role    = localStorage.getItem('apexRole');
  const isAdmin = role === 'Admin' || role === 'admin';
  const revMob  = document.getElementById('revenuePanel-mob');
  if (revMob) revMob.style.display = isAdmin ? 'block' : 'none';
  if (isAdmin) {
    const today  = new Date().toISOString().split('T')[0];
    const todayB = getBookings().filter(b => b.date === today && b.status !== 'cancelled');
    const rev    = todayB.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const revEl  = document.getElementById('mobSummaryRev');
    if (revEl) revEl.textContent = '₱' + rev.toLocaleString();
  }

  // Active sessions
  const sessEl = document.getElementById('mobActiveSessions');
  if (sessEl) {
    const sessions = [];
    Object.entries(COURT_DATA).forEach(([sport, courts]) => {
      courts.forEach(c => {
        if (c.status !== 'occupied') return;
        const abbr = sport==='pickleball'?'PB':sport==='badminton'?'BD':'DZ';
        const rem  = Math.max(0, c.startTime + c.duration*60000 - Date.now());
        const m = Math.floor(rem/60000), s = Math.floor((rem%60000)/1000);
        sessions.push(`<div onclick="closeMobSummary();openCourtActionModal('${sport}',${c.num})" style="padding:10px 12px;border-radius:9px;background:var(--surface-3);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer">
          <div><div style="font-size:12px;font-weight:700">${abbr} ${c.num}</div><div style="font-size:11px;color:var(--text-muted)">${c.player}</div></div>
          <div style="font-family:monospace;font-size:16px;font-weight:800;color:${rem<600000?'#f87171':'var(--gold)'}">
            ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}
          </div>
        </div>`);
      });
    });
    sessEl.innerHTML = sessions.length ? sessions.join('') : '<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:16px">No active sessions</div>';
  }

  drawer.classList.add('open');
}
function closeMobSummary() {
  document.getElementById('mobSummaryDrawer')?.classList.remove('open');
}

// ═══════════════════════════════════════
//  RIPPLE EFFECT
// ═══════════════════════════════════════
function addRipple(e) {
  const btn  = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x    = e.clientX - rect.left - size / 2;
  const y    = e.clientY - rect.top  - size / 2;
  const rip  = document.createElement('span');
  rip.style.cssText = `
    position:absolute;border-radius:50%;pointer-events:none;
    width:${size}px;height:${size}px;left:${x}px;top:${y}px;
    background:rgba(255,255,255,0.18);transform:scale(0);
    animation:rippleOut 0.5s var(--ease-out) forwards;`;
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(rip);
  setTimeout(() => rip.remove(), 520);
}

// Inject ripple keyframes once
(function() {
  const s = document.createElement('style');
  s.textContent = `@keyframes rippleOut{to{transform:scale(2.2);opacity:0;}}`;
  document.head.appendChild(s);
})();

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  loadCourtData();
  seedDemoBookings();

  // Attach ripple to all primary/gold buttons
  document.querySelectorAll('.modal-btn.primary, .btn-sm.gold, .charge-btn').forEach(btn => {
    btn.addEventListener('click', addRipple);
  });

  // Default view = courts
  showView('courts', document.querySelector('.sidebar-item'));

  // Booking date filter
  const dateFilter = document.getElementById('bookingDateFilter');
  if (dateFilter) {
    dateFilter.value = new Date().toISOString().split('T')[0];
    dateFilter.addEventListener('change', renderBookings);
  }

  // Initial live summary
  updateLiveSummary();
});
