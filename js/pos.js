/* ─── APEX COURTS — POS System JS ─── */

// ─── AUTH GUARD ───
(function() {
  const role = sessionStorage.getItem('apexRole');
  if (!role) window.location.href = 'index.html';
  const user = sessionStorage.getItem('apexUser') || 'Staff';
  const el = document.getElementById('posUserLabel');
  if (el) el.textContent = `${user} (${role})`;
})();

// ─── CLOCK ───
function updateClock() {
  const el = document.getElementById('posTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ─── DATA LAYER (localStorage) ───
function getBookings() {
  return JSON.parse(localStorage.getItem('apexBookings') || '[]');
}
function saveBookings(bookings) {
  localStorage.setItem('apexBookings', JSON.stringify(bookings));
}
function getActivityLog() {
  return JSON.parse(localStorage.getItem('apexActivityLog') || '[]');
}
function logActivity(action, bookingId, details) {
  const log = getActivityLog();
  log.unshift({
    id: 'LOG-' + Date.now(),
    action,
    bookingId,
    staffName: sessionStorage.getItem('apexUser') || 'Staff',
    details,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem('apexActivityLog', JSON.stringify(log.slice(0, 200)));
}

// ─── PRODUCTS CATALOG ───
const PRODUCTS = [
  { id: 'court-1h',   cat: 'court', icon: '🏟', name: 'Court 1hr',        sub: 'Pickleball / Badminton', price: 600 },
  { id: 'court-15h',  cat: 'court', icon: '🏟', name: 'Court 1.5hr',      sub: 'Pickleball / Badminton', price: 1200 },
  { id: 'court-2h',   cat: 'court', icon: '🏟', name: 'Court 2hr',        sub: 'Pickleball / Badminton', price: 1200 },
  { id: 'drill-30',   cat: 'court', icon: '🎯', name: 'Drill Zone 30min', sub: '1 zone • Solo training', price: 400 },
  { id: 'drill-60',   cat: 'court', icon: '🎯', name: 'Drill Zone 1hr',   sub: '1 zone • Solo training', price: 700 },
  { id: 'drill-90',   cat: 'court', icon: '🎯', name: 'Drill Zone 1.5hr', sub: '1 zone • Solo training', price: 1000 },
  { id: 'drill-120',  cat: 'court', icon: '🎯', name: 'Drill Zone 2hr',   sub: '1 zone • Solo training', price: 1300 },
  { id: 'racket', cat: 'rental', icon: '🏸', name: 'Racket Rental', sub: 'Per session', price: 50 },
  { id: 'shoes',  cat: 'rental', icon: '👟', name: 'Court Shoes',   sub: 'Per session', price: 50 },
  { id: 'balls',  cat: 'rental', icon: '🟡', name: 'Ball Pack (6)', sub: 'New balls',   price: 120 },
  { id: 'towel',  cat: 'rental', icon: '🛁', name: 'Towel Rental',  sub: 'Fresh daily', price: 50 },
  { id: 'grip',   cat: 'rental', icon: '🎁', name: 'Grip Tape',     sub: 'Overgrip',    price: 80 },
  { id: 'water',      cat: 'fb', icon: '💧', name: 'Water',        sub: '500ml · still',    price: 60 },
  { id: 'pocari',     cat: 'fb', icon: '🥤', name: 'Pocari Sweat',  sub: '500ml · isotonic', price: 75 },
  { id: 'coke-zero',  cat: 'fb', icon: '🥫', name: 'Coke Zero',     sub: '330ml · zero cal', price: 60 },
  { id: 'energy',     cat: 'fb', icon: '⚡', name: 'Energy Drink',  sub: 'Red Bull 250ml',   price: 120 },
  // Membership tier removed — handled separately at front desk
];

let currentCategory = 'all';
let cart = [];
let payMethod = 'card';

function setCategory(cat, tabEl) {
  currentCategory = cat;
  if (tabEl) {
    document.querySelectorAll('.pos-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
  }
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  const filtered = currentCategory === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === currentCategory);
  grid.innerHTML = '';
  filtered.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'product-tile';
    tile.innerHTML = `<div class="pt-icon">${p.icon}</div><div class="pt-name">${p.name}</div><div class="pt-price">₱${p.price.toLocaleString()}</div>`;
    tile.addEventListener('click', () => addToCart(p));
    grid.appendChild(tile);
  });
  grid.querySelectorAll('.product-tile').forEach((t, i) => {
    t.style.opacity = '0'; t.style.transform = 'scale(0.85)';
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
      t.style.opacity = '1'; t.style.transform = 'scale(1)';
    }, i * 25);
  });
}

// ─── CART ───
function addToCart(product) {
  const existing = cart.find(i => i.product.id === product.id);
  if (existing) existing.qty++;
  else cart.push({ product, qty: 1 });
  renderCart();
}

function updateQty(id, delta) {
  const idx = cart.findIndex(i => i.product.id === id);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}

function removeItem(id) {
  cart = cart.filter(i => i.product.id !== id);
  renderCart();
}

function clearCart() { cart = []; renderCart(); }

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const totalsEl = document.getElementById('cartTotals');
  const chargeBtn = document.getElementById('chargeBtn');
  const chargeBtnAmt = document.getElementById('chargeBtnAmount');

  if (!cart.length) {
    itemsEl.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-dim);font-size:13px">
      <div style="font-size:32px;margin-bottom:10px">🛒</div>No items yet. Click products to add.</div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    if (chargeBtn) chargeBtn.disabled = true;
    if (chargeBtnAmt) chargeBtnAmt.textContent = '0';
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const tax = subtotal * 0.08;
  const total = Math.round(subtotal + tax);

  itemsEl.innerHTML = '';
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-icon">${item.product.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product.name}</div>
        <div class="cart-item-sub">${item.product.sub}</div>
      </div>
      <div class="cart-qty">
        <div class="qty-btn" onclick="updateQty('${item.product.id}',-1)">−</div>
        <div class="qty-num">${item.qty}</div>
        <div class="qty-btn" onclick="updateQty('${item.product.id}',1)">+</div>
      </div>
      <div class="cart-item-price">₱${(item.product.price * item.qty).toLocaleString()}</div>
      <div class="cart-item-remove" onclick="removeItem('${item.product.id}')" title="Remove">×</div>`;
    itemsEl.appendChild(div);
  });

  if (totalsEl) totalsEl.style.display = 'block';
  const subEl = document.getElementById('cartSubtotal');
  const taxEl = document.getElementById('cartTax');
  const totEl = document.getElementById('cartTotal');
  if (subEl) subEl.textContent = `₱${subtotal.toLocaleString()}`;
  if (taxEl) taxEl.textContent = `₱${Math.round(tax).toLocaleString()}`;
  if (totEl) totEl.textContent = `₱${total.toLocaleString()}`;
  if (chargeBtn) chargeBtn.disabled = false;
  if (chargeBtnAmt) chargeBtnAmt.textContent = total.toLocaleString();
}

function selectPay(method, el) {
  payMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function processPayment() {
  if (!cart.length) return;
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const total = Math.round(subtotal * 1.08);
  const method = payMethod.charAt(0).toUpperCase() + payMethod.slice(1);
  showToast(`✅ Payment of ₱${total.toLocaleString()} via ${method} processed!`);
  cart = [];
  renderCart();
}

// ─── TOAST ───
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.style.transform = 'translateY(0)';
  t.style.opacity = '1';
  setTimeout(() => { t.style.transform = 'translateY(100px)'; t.style.opacity = '0'; }, 3500);
}

// ─── VIEWS ───
function showView(view, sidebarEl) {
  document.querySelectorAll('#posMainContent > div').forEach(v => v.style.display = 'none');
  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';
  if (sidebarEl) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    sidebarEl.classList.add('active');
  }
  if (view === 'courts') renderCourtsView();
  if (view === 'bookings') renderBookings();
}

// ─── COURT STATUS DATA (4 PB + 4 BD + 1 Drill) ───
const COURT_DATA = {
  pickleball: [
    { num: 1, status: 'occupied', player: 'Sarah K.',    startTime: Date.now() - 45*60000, duration: 60,  booking: 'APX-1241' },
    { num: 2, status: 'occupied', player: 'Marcus T.',   startTime: Date.now() - 20*60000, duration: 90,  booking: 'APX-1242' },
    { num: 3, status: 'available' },
    { num: 4, status: 'occupied', player: 'David H.',    startTime: Date.now() - 55*60000, duration: 60,  booking: 'APX-1243' },
  ],
  badminton: [
    { num: 1, status: 'occupied', player: 'Jennifer L.', startTime: Date.now() - 30*60000, duration: 60,  booking: 'APX-1244' },
    { num: 2, status: 'available' },
    { num: 3, status: 'available' },
    { num: 4, status: 'occupied', player: 'Tom W.',      startTime: Date.now() - 10*60000, duration: 120, booking: 'APX-1245' },
  ],
  drill: [
    { num: 1, status: 'available' },
  ],
};

const courtTimers = {};
const alarmFired = {}; // track which courts have had the 10-min alarm

function renderCourtsView() {
  const sportConfig = [
    { key: 'pickleball', label: 'Pickleball Courts', containerId: 'pickleballCourts', abbr: 'PB' },
    { key: 'badminton',  label: 'Badminton Courts',  containerId: 'badmintonCourts',  abbr: 'BD' },
    { key: 'drill',      label: 'Drill Zone',        containerId: 'drillCourts',      abbr: 'DZ' },
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
        const endTime = court.startTime + court.duration * 60000;
        const remaining = endTime - Date.now();
        const isUrgent = remaining < 10 * 60000; // 10-min alarm threshold

        card.innerHTML = `
          <div class="cc-header">
            <div class="cc-name">${abbr} ${key === 'drill' ? 'Zone' : 'Court'} ${court.num}</div>
            <div class="cc-badge occupied">Occupied</div>
            ${isUrgent ? '<div class="alarm-indicator" title="⏰ Less than 10 min left!"></div>' : ''}
          </div>
          <div class="cc-info">
            <div style="font-weight:600;color:var(--text)">${court.player}</div>
            <div>Booking: ${court.booking}</div>
            <div>${court.duration} min session</div>
          </div>
          <div class="cc-timer">
            <div>
              <div style="font-size:10px;color:var(--text-muted);letter-spacing:0.05em;text-transform:uppercase">Time Left</div>
              <div class="cc-timer-time ${isUrgent ? 'urgent' : ''}" id="timer-${key}-${court.num}">--:--</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text-muted)">Session</div>
              <div style="font-size:13px;font-weight:600">${court.duration} min</div>
            </div>
          </div>
          <div class="cc-actions">
            <button class="btn-sm outline" style="font-size:11px;padding:6px 10px" onclick="extendCourt('${key}',${court.num})">+15 min</button>
            <button class="btn-sm red" style="font-size:11px;padding:6px 10px" onclick="endCourt('${key}',${court.num})">End</button>
          </div>`;

        // Timer
        const timerId = `${key}-${court.num}`;
        if (courtTimers[timerId]) clearInterval(courtTimers[timerId]);
        courtTimers[timerId] = setInterval(() => {
          const timerEl = document.getElementById(`timer-${timerId}`);
          if (!timerEl) { clearInterval(courtTimers[timerId]); return; }
          const courtRef = COURT_DATA[key][court.num - 1];
          const rem = Math.max(0, courtRef.startTime + courtRef.duration * 60000 - Date.now());
          const mins = Math.floor(rem / 60000);
          const secs = Math.floor((rem % 60000) / 1000);
          timerEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

          // 10-minute alarm — fires once
          if (rem < 10 * 60000 && rem > 0 && !alarmFired[timerId]) {
            alarmFired[timerId] = true;
            timerEl.classList.add('urgent');
            const cardEl = document.getElementById(`court-${timerId}`);
            if (cardEl) {
              // Flash card
              cardEl.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.6)';
              setTimeout(() => { if(cardEl) cardEl.style.boxShadow = ''; }, 3000);
            }
            showToast(`⏰ ALARM: ${abbr} ${key === 'drill' ? 'Zone' : 'Court'} ${court.num} — ${court.player} has less than 10 minutes left!`);
          }
          if (rem <= 0) { timerEl.textContent = '00:00'; clearInterval(courtTimers[timerId]); }
        }, 1000);

      } else {
        card.innerHTML = `
          <div class="cc-header">
            <div class="cc-name">${abbr} ${key === 'drill' ? 'Zone' : 'Court'} ${court.num}</div>
            <div class="cc-badge available">Available</div>
          </div>
          <div class="cc-info" style="color:var(--text-muted)">Ready for booking</div>
          <div class="cc-actions" style="margin-top:16px">
            <button class="btn-sm green" style="font-size:11px;padding:6px 10px;width:100%" onclick="openWalkIn('${key}',${court.num})">Book Walk-In</button>
          </div>`;
      }
      container.appendChild(card);
    });
  });

  // Update counts
  const allCourts = [...COURT_DATA.pickleball, ...COURT_DATA.badminton, ...COURT_DATA.drill];
  const totalOccupied = allCourts.filter(c => c.status === 'occupied').length;
  const totalAvail = allCourts.length - totalOccupied;
  const occ = document.getElementById('countOccupied');
  const avl = document.getElementById('countAvail');
  const badge = document.getElementById('occupiedCount');
  if (occ) occ.textContent = totalOccupied;
  if (avl) avl.textContent = totalAvail;
  if (badge) badge.textContent = totalOccupied;
}

function extendCourt(sport, num) {
  const court = COURT_DATA[sport][num - 1];
  court.duration += 15;
  // Reset alarm so it can fire again for the extended session
  delete alarmFired[`${sport}-${num}`];
  showToast(`✅ ${sport} Court ${num} extended by 15 minutes`);
  renderCourtsView();
}

function endCourt(sport, num) {
  const court = COURT_DATA[sport][num - 1];
  const name = court.player || 'Guest';
  const timerId = `${sport}-${num}`;
  clearInterval(courtTimers[timerId]);
  delete alarmFired[timerId];
  court.status = 'available';
  delete court.player; delete court.startTime; delete court.booking; delete court.duration;
  showToast(`✅ Session ended for ${name} — court is now available`);
  renderCourtsView();
}

// ─── BOOKINGS TABLE ───
// Seed demo bookings into localStorage if empty
function seedDemoBookings() {
  const existing = getBookings();
  if (existing.length > 0) return;
  const today = new Date().toISOString().split('T')[0];
  const demos = [
    { id:'APX-1241', userName:'Sarah K.',    sport:'pickleball', date:today, time:'10:00 AM', duration:1,   court:1, extras:[], totalAmount:600,  status:'confirmed', paymentMethod:'card',  createdAt:new Date().toISOString(), createdBy:'online' },
    { id:'APX-1242', userName:'Marcus T.',   sport:'pickleball', date:today, time:'10:30 AM', duration:1.5, court:2, extras:[], totalAmount:900,  status:'confirmed', paymentMethod:'card',  createdAt:new Date().toISOString(), createdBy:'online' },
    { id:'APX-1243', userName:'David H.',    sport:'pickleball', date:today, time:'10:00 AM', duration:1,   court:4, extras:[], totalAmount:600,  status:'confirmed', paymentMethod:'gcash', createdAt:new Date().toISOString(), createdBy:'online' },
    { id:'APX-1244', userName:'Jennifer L.', sport:'badminton',  date:today, time:'11:00 AM', duration:1,   court:1, extras:[], totalAmount:600,  status:'confirmed', paymentMethod:'card',  createdAt:new Date().toISOString(), createdBy:'online' },
    { id:'APX-1245', userName:'Tom W.',      sport:'badminton',  date:today, time:'11:30 AM', duration:2,   court:4, extras:[], totalAmount:1200, status:'confirmed', paymentMethod:'cash',  createdAt:new Date().toISOString(), createdBy:'online' },
  ];
  saveBookings(demos);
}

function renderBookings() {
  seedDemoBookings();
  const tbody = document.getElementById('bookingsTbody');
  if (!tbody) return;

  // Filter by selected date
  const dateFilter  = document.getElementById('bookingDateFilter');
  const searchEl    = document.getElementById('bookingSearch');
  const sportFilter = document.getElementById('bookingSportFilter');
  const filterDate  = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0];
  const searchQ     = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const filterSport = sportFilter ? sportFilter.value : '';

  const all = getBookings();
  const filtered = all.filter(b => {
    if (b.status === 'cancelled') return false;
    if (filterDate && b.date !== filterDate) return false;
    if (filterSport && b.sport !== filterSport) return false;
    if (searchQ && !b.userName.toLowerCase().includes(searchQ) && !b.id.toLowerCase().includes(searchQ)) return false;
    return true;
  }).sort((a,b) => a.time > b.time ? 1 : -1);

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-dim)">No bookings for this date</td></tr>';
    return;
  }

  filtered.forEach(b => {
    const sportLabel = b.sport === 'pickleball' ? 'Pickleball' : b.sport === 'badminton' ? 'Badminton' : 'Drill Zone';
    const abbr = b.sport === 'pickleball' ? 'PB' : b.sport === 'badminton' ? 'BD' : 'DZ';
    const courtLabel = b.sport === 'drill' ? 'DZ Zone 1' : `${abbr} ${b.court}`;
    const durLabel = b.duration < 1 ? '30 min' : b.duration === 1 ? '1 hr' : b.duration + ' hrs';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${b.id}</td>
      <td class="name">${b.userName}</td>
      <td>${sportLabel}</td>
      <td>${courtLabel}</td>
      <td>${b.time || '—'}</td>
      <td>${durLabel}</td>
      <td><span class="status-chip ${b.status || 'confirmed'}">${b.status || 'confirmed'}</span></td>
      <td style="font-weight:700;color:var(--gold)">₱${(b.totalAmount||0).toLocaleString()}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-sm outline" style="padding:5px 10px;font-size:11px" onclick="openEditBooking('${b.id}')">Edit</button>
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
  document.getElementById('cancelModal').classList.remove('open');
  showToast(`⚠️ Booking ${id} cancelled`);
  renderBookings();
}

function closeCancelModal() {
  document.getElementById('cancelModal').classList.remove('open');
}

// ─── EDIT BOOKING ───
function openEditBooking(id) {
  const bookings = getBookings();
  const b = bookings.find(b => b.id === id);
  if (!b) return;

  const modal = document.getElementById('editModal');
  if (!modal) return;

  document.getElementById('editBookingId').value = id;
  document.getElementById('editBookingUser').textContent = b.userName + ' — ' + b.id;

  // Set date
  const dateEl = document.getElementById('editDate');
  if (dateEl) dateEl.value = b.date || new Date().toISOString().split('T')[0];

  // Set time
  const timeEl = document.getElementById('editTime');
  if (timeEl) {
    // Convert "10:00 AM" to 24h for input
    const t = b.time || '10:00 AM';
    const [timePart, period] = t.split(' ');
    const [h, m] = timePart.split(':').map(Number);
    let h24 = h;
    if (period === 'PM' && h !== 12) h24 = h + 12;
    if (period === 'AM' && h === 12) h24 = 0;
    timeEl.value = `${String(h24).padStart(2,'0')}:${String(m||0).padStart(2,'0')}`;
  }

  // Set court
  const courtEl = document.getElementById('editCourt');
  if (courtEl) courtEl.value = b.court || 1;

  // Set duration
  const durEl = document.getElementById('editDuration');
  if (durEl) durEl.value = b.duration || 1;

  modal.classList.add('open');
}

function saveEditBooking() {
  const id = document.getElementById('editBookingId').value;
  const dateVal = document.getElementById('editDate').value;
  const timeVal = document.getElementById('editTime').value;
  const courtVal = parseInt(document.getElementById('editCourt').value);
  const durVal = parseFloat(document.getElementById('editDuration').value);

  // Convert 24h time to 12h
  const [h24, m] = timeVal.split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const timeLabel = `${h12}:${String(m).padStart(2,'0')} ${period}`;

  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx > -1) {
    const old = bookings[idx];
    logActivity('edit', id, `Changed from ${old.date} ${old.time} to ${dateVal} ${timeLabel}`);
    bookings[idx].date = dateVal;
    bookings[idx].time = timeLabel;
    bookings[idx].court = courtVal;
    bookings[idx].duration = durVal;
    saveBookings(bookings);
  }

  document.getElementById('editModal').classList.remove('open');
  showToast(`✅ Booking ${id} updated`);
  renderBookings();
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

// ─── WALK-IN ───
function openWalkIn(sport, courtNum) {
  const modal = document.getElementById('walkInModal');
  if (!modal) return;
  const now = new Date();
  const timeEl = document.getElementById('wi-time');
  if (timeEl) timeEl.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if (sport) { const el = document.getElementById('wi-sport'); if (el) el.value = sport; updateWiCourts(); }
  if (courtNum) { const el = document.getElementById('wi-court'); if (el) el.value = String(courtNum); }
  modal.classList.add('open');
}

function updateWiCourts() {
  const sport = document.getElementById('wi-sport')?.value;
  const courtSel = document.getElementById('wi-court');
  if (!courtSel) return;
  const count = sport === 'drill' ? 1 : 4;
  courtSel.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    courtSel.appendChild(opt);
  }
}

function closeWalkIn() {
  document.getElementById('walkInModal').classList.remove('open');
}

function confirmWalkIn() {
  const first  = document.getElementById('wi-first').value.trim() || 'Walk-In';
  const last   = document.getElementById('wi-last').value.trim() || 'Guest';
  const sport  = document.getElementById('wi-sport').value;
  const court  = parseInt(document.getElementById('wi-court').value);
  const dur    = parseFloat(document.getElementById('wi-dur').value);
  const timeRaw = document.getElementById('wi-time').value; // HH:MM
  const phone  = document.getElementById('wi-phone')?.value.trim() || '';

  // Convert to 12h
  const [h24, m] = timeRaw.split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const timeLabel = `${h12}:${String(m).padStart(2,'0')} ${period}`;

  const sportLabel = sport === 'pickleball' ? 'Pickleball' : sport === 'badminton' ? 'Badminton' : 'Drill Zone';
  const abbr = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const courtLabel = `${abbr} ${court}`;
  const price = sport === 'drill' ? (dur <= 0.5 ? 400 : dur <= 1 ? 700 : dur <= 1.5 ? 1000 : 1300) : 600 * dur;

  const id = 'APX-W' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date().toISOString().split('T')[0];

  // ── EFFECTIVE DURATION LOGIC ──
  // Arrival not on the hour → court blocks snap to hour boundaries.
  // If next hour slot is booked on this court: end at that boundary.
  // If next hour slot is free: play full natural duration.
  let effectiveDurMins = dur * 60;
  if (m !== 0) {
    const nextH = (h24 + 1) % 24;
    const nextPeriod = nextH >= 12 ? 'PM' : 'AM';
    const nextH12 = nextH % 12 || 12;
    const nextHourLabel = `${nextH12}:00 ${nextPeriod}`;
    const bookings = getBookings();
    const hasConflict = bookings.some(b =>
      b.sport === sport && b.court === court && b.date === today &&
      b.status !== 'cancelled' && b.time === nextHourLabel
    );
    if (hasConflict) {
      // Truncate to next hour boundary
      effectiveDurMins = (h24 + 1) * 60 - (h24 * 60 + m);
    }
  }
  // Calculate display end time
  const endTotalMins = h24 * 60 + m + effectiveDurMins;
  const endH24 = Math.floor(endTotalMins / 60) % 24;
  const endM = endTotalMins % 60;
  const endPeriod = endH24 >= 12 ? 'PM' : 'AM';
  const endH12 = endH24 % 12 || 12;
  const endLabel = `${endH12}:${String(endM).padStart(2,'0')} ${endPeriod}`;

  // Save to localStorage bookings
  const bookings = getBookings();
  bookings.unshift({
    id, userName: `${first} ${last}`, sport,
    date: today, time: timeLabel,
    duration: dur, court, extras: [],
    totalAmount: price, status: 'walkin',
    paymentMethod: 'cash', phone,
    createdAt: new Date().toISOString(),
    createdBy: 'staff',
  });
  saveBookings(bookings);

  // Log activity
  logActivity('walkin', id, `Walk-in: ${first} ${last} → ${sportLabel} ${courtLabel} at ${timeLabel} for ${dur < 1 ? '30 min' : dur + ' hr'}`);

  // Update live court status
  const courtData = COURT_DATA[sport];
  if (courtData && courtData[court - 1]) {
    courtData[court - 1].status = 'occupied';
    courtData[court - 1].player = `${first} ${last}`;
    courtData[court - 1].startTime = Date.now();
    courtData[court - 1].duration = effectiveDurMins; // effective minutes (may be truncated to next hour)
    courtData[court - 1].booking = id;
  }

  // Add to cart
  const durKey = dur <= 0.5 ? 'drill-30' : dur <= 1 ? (sport === 'drill' ? 'drill-60' : 'court-1h') : dur <= 1.5 ? (sport === 'drill' ? 'drill-90' : 'court-15h') : (sport === 'drill' ? 'drill-120' : 'court-2h');
  const prod = PRODUCTS.find(p => p.id === durKey);
  if (prod) addToCart(prod);

  closeWalkIn();
  showToast(`✅ Walk-in booked! ${first} ${last} → ${sportLabel} ${courtLabel} · ends ${endLabel}`);
  renderCourtsView();
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  seedDemoBookings();
  renderProducts();

  // Date filter for bookings
  const dateFilter = document.getElementById('bookingDateFilter');
  if (dateFilter) {
    dateFilter.value = new Date().toISOString().split('T')[0];
    dateFilter.addEventListener('change', renderBookings);
  }

  // Walk-in sport change updates court count
  const wiSport = document.getElementById('wi-sport');
  if (wiSport) wiSport.addEventListener('change', updateWiCourts);
  updateWiCourts();
});
