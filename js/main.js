/* ─── SMASH STUDIO — main.js v2 ─── */

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

// ── Fallback: seeded fake data (used if Supabase unavailable) ─
function getDaySlots(sport) {
  const seed = new Date().getDate() + (sport === 'pickleball' ? 0 : sport === 'badminton' ? 100 : 200);
  const rng  = n => { const x = Math.sin(n + seed) * 10000; return x - Math.floor(x); };
  const slots = {}, n = COURTS[sport], isDZ = sport === 'drillzone';
  const timeArr = isDZ ? DZ_TIMES : TIMES;
  for (let c = 1; c <= n; c++) {
    slots[c] = [];
    for (let t = 0; t < timeArr.length; t++) {
      const r = rng(c * 100 + t);
      if (r < 0.06 && t === 2) slots[c].push('mine');
      else if (r < (isDZ ? 0.35 : 0.42)) slots[c].push('booked');
      else slots[c].push('open');
    }
  }
  return slots;
}

// ── Build slot map from Supabase bookings ─────────────────────
// returns { courtNum: { '8AM': 'booked'|'mine', ... } }
function buildSlotMap(bookings, myUserId, timeArr) {
  const map = {};
  bookings.forEach(b => {
    const cNum = b.court_number;
    if (!map[cNum]) map[cNum] = {};
    const label = pgTimeToLabel(b.start_time);
    if (timeArr.includes(label)) {
      map[cNum][label] = (b.booked_by && b.booked_by === myUserId) ? 'mine' : 'booked';
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
  const now     = new Date().getHours();

  // ── Show loading state ────────────────────────────────────
  const liveEl = document.getElementById('availLiveTag');

  // ── Try Supabase, fall back to fake data ──────────────────
  let slotMap = null;
  let myUserId = null;
  let isLive = false;
  if (window.ApexCourts) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dbSport = sport === 'drillzone' ? 'drillzone' : sport;
      const [bookings, user] = await Promise.all([
        ApexCourts.getAvailability(dbSport, today),
        ApexCourts.getCurrentUser().catch(() => null),
      ]);
      myUserId = user?.id;
      slotMap  = buildSlotMap(bookings, myUserId, timeArr);
      isLive   = true;
    } catch (e) {
      console.warn('[Availability] Supabase error, using fallback:', e.message);
    }
  }

  // Update LIVE indicator
  if (liveEl) {
    liveEl.innerHTML = isLive
      ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#4ade80">
           <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;animation:livePulse 1.4s ease-in-out infinite"></span>LIVE
         </span>`
      : `<span style="font-size:10px;color:var(--cream-dim);letter-spacing:0.06em">DEMO</span>`;
  }

  // Build slots array (Supabase or fallback)
  const slots = {};
  for (let c = 1; c <= n; c++) {
    slots[c] = timeArr.map(t =>
      slotMap ? (slotMap[c]?.[t] || 'open') : getDaySlots(sport)[c][timeArr.indexOf(t)]
    );
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
      const isPast = isToday() && h < now;
      const cls = isPast && s !== 'mine' ? 'booked' : s;
      const slotLabel = cls === 'open' && !isPast ? 'OPEN' : (cls === 'mine' ? 'MINE' : '');
      const ariaLabel = `${tLabel}: ${cls === 'open' && !isPast ? 'Available' : cls === 'mine' ? 'Your booking' : 'Booked'}`;
      html += `<div class="slot ${cls}"
        role="${cls === 'open' && !isPast ? 'button' : 'cell'}"
        tabindex="${cls === 'open' && !isPast ? '0' : '-1'}"
        aria-label="${ariaLabel}"
        ${cls === 'open' && !isPast ? `onclick="window.location.href='book.html?sport=${sport}&court=${c}&time=${tLabel}'"
        onkeydown="if(event.key==='Enter'||event.key===' ')this.click()"` : ''}
      >${slotLabel}</div>`;
    });
    html += '</div></div>';
  }

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

// ── Real-time: subscribe all 3 sports, refresh active grid ───
(function setupRealtime() {
  if (!window.ApexCourts) return;
  const today = new Date().toISOString().split('T')[0];

  function getActiveSport() {
    const tab = document.querySelector('.avail-tab.active');
    if (!tab) return 'pickleball';
    // extract sport from onclick attr or data-sport
    const m = (tab.getAttribute('onclick') || '').match(/'([a-z]+)'/);
    return m ? m[1] : 'pickleball';
  }

  // ── Court canvas: map Supabase bookings → animation active states ──
  // courtNum: 1-4 for PB/BD, 1 for DZ  →  id: P1-P4, B1-B4, DZ
  async function syncCanvasActivity() {
    if (!window.updateCourtActivity) return;
    const nowStr = new Date().toTimeString().slice(0,5); // "HH:MM"
    try {
      const [pb, bd, dz] = await Promise.all([
        ApexCourts.getAvailability('pickleball', today),
        ApexCourts.getAvailability('badminton',  today),
        ApexCourts.getAvailability('drillzone',  today),
      ]);

      // A court is "active" if it has a booking that covers right now
      function isNowBooked(rows, courtNum) {
        return rows.some(r =>
          r.court_number === courtNum &&
          r.booking_id &&
          r.booking_status !== 'cancelled' &&
          r.start_time <= nowStr &&
          (r.end_time || '23:59') > nowStr
        );
      }

      window.updateCourtActivity({
        P1: isNowBooked(pb, 1), P2: isNowBooked(pb, 2),
        P3: isNowBooked(pb, 3), P4: isNowBooked(pb, 4),
        B1: isNowBooked(bd, 1), B2: isNowBooked(bd, 2),
        B3: isNowBooked(bd, 3), B4: isNowBooked(bd, 4),
        DZ: isNowBooked(dz, 1),
      });
    } catch(e) {
      console.warn('[Canvas] Activity sync failed:', e.message);
    }
  }

  function onBookingChange() {
    renderAvailability(getActiveSport());
    syncCanvasActivity();           // also update the animation
  }

  // Subscribe to all sports so any booking triggers a refresh
  ['pickleball', 'badminton', 'drillzone'].forEach(sport => {
    ApexCourts.subscribeAvailability(sport, today, onBookingChange);
  });

  // Initial sync on load
  syncCanvasActivity();

  // Poll every 60s — catches time-based transitions (booking starts/ends)
  setInterval(() => {
    renderAvailability(getActiveSport());
    syncCanvasActivity();
  }, 60_000);
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
