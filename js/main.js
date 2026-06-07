/* ─── SMASH STUDIO — main.js v2 ─── */

// ── Philippines timezone helper (UTC+8, always) ──────────────
function getTodayPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  // en-CA gives YYYY-MM-DD format natively
}
function getNowHPH() {
  const now = new Date();
  const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return ph.getHours() + ph.getMinutes() / 60;
}

// ─── NAVBAR ───
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ─── MOBILE MENU ───
function toggleMenu() {
  const links = document.getElementById('navLinks');
  const btn = document.getElementById('hamburger');
  if (!links || !btn) return;
  const isOpen = links.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
  btn.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  const spans = btn.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
}
// Close menu on outside click or nav link click
document.addEventListener('click', e => {
  const links = document.getElementById('navLinks');
  const btn   = document.getElementById('hamburger');
  if (!links?.classList.contains('open')) return;
  const clickedLink = e.target.closest('a');
  if (clickedLink || (!links.contains(e.target) && !btn?.contains(e.target))) {
    toggleMenu();
  }
});

// ─── SCROLL REVEAL (directional, staggered) ───
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    // Honour explicit transition-delay set inline
    el.classList.add('visible');
    revealObserver.unobserve(el);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ─── MAGNETIC BUTTON EFFECT (motion that whispers) ───
document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s';
    setTimeout(() => { btn.style.transition = ''; }, 400);
  });
});

// ─── AVAILABILITY GRID ───
const TIMES    = ['6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM'];
const DZ_TIMES = ['8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM'];
const COURTS   = { pickleball: 4, badminton: 4, drillzone: 1 };

// ── Time helpers ─────────────────────────────────────────────
// '8AM' → '08:00', '2PM' → '14:00'
function labelTo24(t) {
  let h = parseInt(t);
  if (t.includes('PM') && h !== 12) h += 12;
  if (t.includes('AM') && h === 12) h = 0;
  return String(h).padStart(2,'0') + ':00';
}
// '08:00:00' → '8AM'
function pgTimeToLabel(pg) {
  let h = parseInt(pg.split(':')[0]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return h + suffix;
}

// ── Convert any time string → TIMES/DZ_TIMES key ──────────────
// Handles:  '08:00:00' / '13:00:00' (DB 24h)
//           '8 AM' / '1 PM' / '8:30 AM' (booking.js labels with space)
function slotTimeToKey(t) {
  if (!t) return '';
  // PostgreSQL 24h: '08:00:00', '13:30:00'
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return pgTimeToLabel(t);
  // booking.js label with space: '8 AM', '1 PM', '8:30 AM'
  // Strip the space so it matches TIMES keys: '8AM', '1PM', '8:30AM'
  return t.replace(' ', '');
}

// ── Build slot map from localStorage bookings ─────────────────
function buildSlotMapFromLocal(sport, timeArr) {
  const today     = getTodayPH();
  const myUserId  = localStorage.getItem('apexUserId');
  const bookings  = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  const openPlays = JSON.parse(localStorage.getItem('apexOpenSessions') || '[]');
  const map = {};

  // Regular bookings
  // booking.js stores sport as 'drill'; main.js sport key is 'drillzone' → normalise both ways
  const normSport = sport === 'drillzone' ? ['drillzone','drill'] : [sport];
  bookings.forEach(b => {
    if (b.status === 'cancelled') return;
    if (!normSport.includes(b.sport)) return;
    (b.slots || []).forEach(s => {
      if (s.date !== today) return;
      const c = Number(s.court);
      if (!map[c]) map[c] = {};
      const label = slotTimeToKey(s.time);
      if (timeArr.includes(label)) {
        map[c][label] = (b.id && myUserId && b.userId === myUserId) ? 'mine' : 'booked';
      }
    });
  });

  // Open play sessions → show as open-session
  openPlays.forEach(s => {
    if (s.date !== today) return;
    if (s.sport !== sport) return;
    const c = Number(s.court || 1);
    if (!map[c]) map[c] = {};
    const label = slotTimeToKey(s.time);
    if (timeArr.includes(label)) {
      if (!map[c][label]) map[c][label] = 'open-session';
    }
  });

  return map;
}

// ── Build slot map from Supabase bookings ─────────────────────
function buildSlotMap(bookings, myUserId, timeArr) {
  const map = {};
  bookings.forEach(b => {
    const cNum = b.court_number;
    if (!map[cNum]) map[cNum] = {};
    const label = slotTimeToKey(b.start_time);
    if (timeArr.includes(label)) {
      map[cNum][label] = (b.user_id && b.user_id === myUserId) ? 'mine' : 'booked';
    }
  });
  return map;
}

async function renderAvailability(sport) {
  const grid = document.getElementById('availGrid');
  if (!grid) return;
  const isDZ    = sport === 'drillzone';
  const timeArr = isDZ ? DZ_TIMES : TIMES;
  const n       = COURTS[sport];
  const label   = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';
  const now     = Math.floor(getNowHPH());

  // ── Show loading state ────────────────────────────────────
  const liveEl = document.getElementById('availLiveTag');

  // ── 1) localStorage에서 실제 예약 읽기 (항상) ──────────────
  let slotMap = buildSlotMapFromLocal(sport, timeArr);
  let myUserId = localStorage.getItem('apexUserId');
  let isLive = true;

  // ── 2) Supabase에서 추가 데이터 머지 (bookings 테이블 직접 쿼리) ──
  if (window.apexDB) {
    try {
      const today = getTodayPH();
      // Query bookings table directly — no v_court_availability view dependency
      // drillzone: DB stores as 'drillzone'; pickleball/badminton as-is
      const { data: dbRows, error } = await window.apexDB
        .from('bookings')
        .select('court_number,start_time,end_time,sport,status,user_id')
        .eq('booking_date', today)
        .eq('sport', sport)          // 'pickleball' | 'badminton' | 'drillzone'
        .neq('status', 'cancelled');

      if (!error && dbRows) {
        // Also try to get current user ID for 'mine' highlighting
        try {
          const { data: { user } } = await window.apexDB.auth.getUser();
          if (user?.id) myUserId = user.id;
        } catch(_) {}

        const dbMap = buildSlotMap(dbRows, myUserId, timeArr);
        for (const c in dbMap) {
          if (!slotMap[c]) slotMap[c] = {};
          Object.assign(slotMap[c], dbMap[c]);
        }
      }
    } catch (e) {
      console.warn('[Availability] Supabase query failed, using localStorage only');
    }
  }

  // Update LIVE indicator
  if (liveEl) {
    liveEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#4ade80">
        <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;animation:livePulse 1.4s ease-in-out infinite"></span>LIVE
      </span>`;
  }

  // Build slots array
  const slots = {};
  for (let c = 1; c <= n; c++) {
    slots[c] = timeArr.map(t => slotMap[c]?.[t] || 'open');
  }

  // Time header row
  let html = `<div style="display:flex;gap:4px;margin-bottom:8px">
    <div style="width:88px;flex-shrink:0"></div><div style="display:flex;gap:4px;flex:1">`;
  timeArr.forEach((t) => {
    const h = parseInt(t) + (t.includes('PM') && t !== '12PM' ? 12 : 0);
    html += `<div style="flex:1;font-size:9px;text-align:center;letter-spacing:0.04em;color:${h === now ? 'var(--gold)' : 'var(--cream-dim)'};font-weight:${h === now ? '700' : '400'}">${t}</div>`;
  });
  html += '</div></div>';

  // Drill Zone notice
  if (isDZ) {
    html += `<div style="margin:0 0 10px;padding:8px 12px;border-radius:8px;background:rgba(0,194,168,0.07);border:1px solid rgba(0,194,168,0.2);font-size:11px;color:rgba(0,194,168,0.75);display:flex;align-items:center;gap:8px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity="0.5"/><circle cx="12" cy="12" r="11" opacity="0.25"/></svg>
      Solo training zone · Ball machine included · Book in 30 or 60-min blocks
    </div>`;
  }

  // Court rows
  const rowLabel = isDZ ? 'Drill Zone' : `${label} Court`;
  for (let c = 1; c <= n; c++) {
    html += `<div class="court-row" role="row" aria-label="${rowLabel}${n > 1 ? ' ' + c : ''}">
      <div class="court-label" role="rowheader">${isDZ ? 'DZ' : label + ' ' + c}</div>
      <div class="time-slots" role="group" aria-label="Time slots">`;
    slots[c].forEach((s, i) => {
      const tLabel = timeArr[i];
      const h = parseInt(tLabel) + (tLabel.includes('PM') && tLabel !== '12PM' ? 12 : 0);
      const isPast    = isToday() && h < now;
      const cls       = isPast && s !== 'mine' ? 'booked' : s;
      const isBookable = cls === 'open' && !isPast;
      const slotLabel  = cls === 'open-session' ? 'OPEN'
                       : cls === 'mine'         ? 'MINE'
                       : cls === 'booked'       ? 'BOOKED'
                       : '';
      const ariaLabel  = `${tLabel}: ${cls === 'open' ? 'Available — click to book' : cls === 'open-session' ? 'Open Session' : cls === 'mine' ? 'Your booking' : 'Booked'}`;
      html += `<div class="slot ${cls}"
        role="${isBookable ? 'button' : 'cell'}"
        tabindex="${isBookable ? '0' : '-1'}"
        aria-label="${ariaLabel}"
        style="${!isBookable ? 'pointer-events:none;cursor:default' : 'cursor:pointer'}"
        ${isBookable ? `onclick="window.location.href='book.html?sport=${sport}&court=${c}&time=${tLabel}'"
        onkeydown="if(event.key==='Enter'||event.key===' ')this.click()"` : ''}
      >${slotLabel}</div>`;
    });
    html += '</div></div>';
  }

  // Hide skeleton, show grid
  const skel = document.getElementById('availSkeleton');
  if (skel) skel.style.display = 'none';
  grid.style.display = '';

  grid.innerHTML = html;

  // Stagger entrance — 30ms per slot (ui-ux-pro-max rule: stagger 30–50ms)
  grid.querySelectorAll('.slot').forEach((slot, i) => {
    slot.style.opacity = '0';
    slot.style.transform = 'scaleY(0.6)';
    requestAnimationFrame(() => {
      setTimeout(() => {
        slot.style.transition = 'opacity 0.25s var(--ease-out), transform 0.3s var(--ease-spring)';
        slot.style.opacity = '1';
        slot.style.transform = 'none';
      }, Math.min(i * 5, 200)); // cap at 200ms total
    });
  });
}

function isToday() { return true; }

function switchSport(sport, tabEl) {
  document.querySelectorAll('.avail-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  tabEl.classList.add('active');
  tabEl.setAttribute('aria-selected', 'true');
  renderAvailability(sport);
}

// Today's date
const todayEl = document.getElementById('todayDate');
if (todayEl) todayEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
renderAvailability('pickleball');

// ─── ALWAYS-ON CANVAS SYNC (no Supabase dependency) ──────────────
// Reads localStorage + Supabase (if available) and updates the court
// animation. Called on load, every 30s, and on storage events.
const today = getTodayPH();

function parseHours(t) {
  if (!t) return -1;
  const parts = String(t).replace(/\s*(AM|PM)/i, '').trim().split(':');
  let h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  if (/PM/i.test(t) && h !== 12) h += 12;
  if (/AM/i.test(t) && h === 12) h = 0;
  return h + m / 60;
}

function getActiveSport() {
  const tab = document.querySelector('.avail-tab.active');
  if (!tab) return 'pickleball';
  const m = (tab.getAttribute('onclick') || '').match(/'([a-z]+)'/);
  return m ? m[1] : 'pickleball';
}

function syncCanvasNow() {
  if (!window.updateCourtActivity) return;

  const nowH = getNowHPH();

  const act = { P1:false, P2:false, P3:false, P4:false,
                B1:false, B2:false, B3:false, B4:false, DZ:false };

  // ── Step 1: localStorage (always works, zero latency) ───────
  try {
    const local = JSON.parse(localStorage.getItem('apexBookings') || '[]');
    local.forEach(b => {
      if (b.status === 'cancelled') return;
      const isDrill = b.sport === 'drill' || b.sport === 'drillzone';
      const step = isDrill ? 0.5 : 1;
      (b.slots || []).forEach(s => {
        if (s.date !== today) return;
        const startH = parseHours(s.time);
        if (startH < 0 || nowH < startH || nowH >= startH + step) return;
        const c = Number(s.court);
        if (b.sport === 'pickleball' && c >= 1 && c <= 4)  act['P'+c] = true;
        else if (b.sport === 'badminton' && c >= 1 && c <= 4) act['B'+c] = true;
        else if (isDrill) act.DZ = true;
      });
    });
  } catch(_) {}

  // Apply what we have immediately (localStorage result)
  window.updateCourtActivity({ ...act });

  // ── Step 2: Supabase (async, additive) ──────────────────────
  if (window.apexDB) {
    window.apexDB
      .from('bookings')
      .select('court_number,sport,status,start_time,end_time')
      .eq('booking_date', today)
      .neq('status', 'cancelled')
      .then(({ data, error }) => {
        if (error || !data) return;
        data.forEach(r => {
          if (r.status === 'cancelled') return;
          const sh = parseHours(r.start_time);
          const eh = parseHours(r.end_time || '23:00:00');
          if (sh < 0 || nowH < sh || nowH >= eh) return;
          const c = Math.max(1, Number(r.court_number) || 1);
          if (r.sport === 'pickleball' && c >= 1 && c <= 4)             act['P'+c] = true;
          else if (r.sport === 'badminton' && c >= 1 && c <= 4)          act['B'+c] = true;
          else if (r.sport === 'drillzone' || r.sport === 'drill')        act.DZ    = true;
        });
        window.updateCourtActivity({ ...act });
      })
      .catch(() => {});
  }
}

// ── Initial canvas sync (runs always, no Supabase guard) ─────
syncCanvasNow();

// ── Cross-tab sync: when book.html writes apexBookings, re-render ─
window.addEventListener('storage', e => {
  if (e.key !== 'apexBookings') return;
  renderAvailability(getActiveSport());
  syncCanvasNow();
});

// ── Poll every 30s — catches time-based transitions ───────────
setInterval(() => {
  renderAvailability(getActiveSport());
  syncCanvasNow();
}, 30_000);

// ── Supabase Realtime (bonus layer — works even if this fails) ─
(function setupRealtime() {
  if (!window.ApexCourts) return;  // optional — localStorage already drives everything

  function onBookingChange() {
    renderAvailability(getActiveSport());
    syncCanvasNow();
  }

  // Subscribe to all sports so any DB booking triggers a refresh
  ['pickleball', 'badminton', 'drillzone'].forEach(sport => {
    ApexCourts.subscribeAvailability(sport, today, onBookingChange);
  });
})()

// ─── TESTIMONIALS — infinite marquee ───
const TESTIMONIALS = [
  { name: 'Sarah K.', role: 'Pro Member', avatar: 'SK', stars: 5, text: '"Best pickleball courts I\'ve played on outside of a tournament. The flooring is exceptional and booking takes 90 seconds flat."' },
  { name: 'Marcus T.', role: 'Badminton Player', avatar: 'MT', stars: 5, text: '"The ceiling height alone makes these courts worth it. Perfect lighting, zero glare. My shuttle speeds are consistent every single session."' },
  { name: 'Jennifer L.', role: 'Elite Member', avatar: 'JL', stars: 5, text: '"I drive 45 minutes to play here. The unlimited membership pays for itself in two weeks. Staff are genuinely welcoming."' },
  { name: 'David H.', role: 'Drop-In Player', avatar: 'DH', stars: 5, text: '"Walked in without a reservation, got a court in 20 minutes, rented equipment for $8, played 2 hours. Completely seamless."' },
  { name: 'Priya R.', role: 'Pro Member', avatar: 'PR', stars: 5, text: '"Live court availability is a game changer. No more calling ahead or showing up to find everything taken. Pure convenience."' },
  { name: 'Tom W.', role: 'Elite Member', avatar: 'TW', stars: 5, text: '"Ran our company league tournament here — 40 people, zero hiccups. Staff handled scheduling, equipment, even catering. Will return every quarter."' },
];

const track = document.getElementById('testimonialTrack');
if (track) {
  // Double for seamless loop
  [...TESTIMONIALS, ...TESTIMONIALS].forEach(t => {
    const card = document.createElement('article');
    card.className = 't-card';
    card.setAttribute('aria-label', `Review by ${t.name}`);
    card.innerHTML = `
      <div class="t-stars" aria-label="${t.stars} out of 5 stars">${'★'.repeat(t.stars)}</div>
      <blockquote class="t-text">${t.text}</blockquote>
      <div class="t-author">
        <div class="t-avatar" aria-hidden="true">${t.avatar}</div>
        <div>
          <div class="t-name">${t.name}</div>
          <div class="t-role">${t.role}</div>
        </div>
      </div>`;
    track.appendChild(card);
  });
}

// ─── COUNTER ANIMATION ───
function animateCounters() {
  document.querySelectorAll('.hero-stat-num').forEach(el => {
    const raw = el.textContent;
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const suffix = raw.replace(/[\d.]/g, '');
    const duration = 1000;
    const start = performance.now();
    const update = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(num * eased) + suffix;
      if (p < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  });
}

const statsObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { animateCounters(); statsObs.disconnect(); }
}, { threshold: 0.5 });
const firstStat = document.querySelector('.hero-stat-num');
if (firstStat) statsObs.observe(firstStat);
