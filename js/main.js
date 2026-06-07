/* ─── SMASH STUDIO — main.js ───────────────────────────────────
   Homepage logic: navbar, availability grid, canvas sync, UI.
   Depends on: utils.js (getTodayPH, getNowHPH, isToday,
               parseHourStr, slotTimeToKey, pgTimeToLabel)
   ─────────────────────────────────────────────────────────── */

// ─── NAVBAR SCROLL ───────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ─── MOBILE MENU ─────────────────────────────────────────────
function toggleMenu() {
  const links = document.getElementById('navLinks');
  const btn   = document.getElementById('hamburger');
  if (!links || !btn) return;
  const isOpen = links.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
  btn.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  const spans = btn.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
    spans[1].style.opacity   = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
}
document.addEventListener('click', e => {
  const links = document.getElementById('navLinks');
  const btn   = document.getElementById('hamburger');
  if (!links?.classList.contains('open')) return;
  if (e.target.closest('a') || (!links.contains(e.target) && !btn?.contains(e.target))) {
    toggleMenu();
  }
});

// ─── SCROLL REVEAL ───────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ─── MAGNETIC BUTTON ─────────────────────────────────────────
document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    btn.style.transform = `translate(${(e.clientX - r.left - r.width/2) * 0.12}px, ${(e.clientY - r.top - r.height/2) * 0.18}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => { btn.style.transition = ''; }, 400);
  });
});

// ─── AVAILABILITY GRID ────────────────────────────────────────
const TIMES  = ['6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM'];
const DZ_TIMES = ['8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM'];
const COURTS = { pickleball: 4, badminton: 4, drillzone: 1 };

/** Read localStorage bookings → slot map for the given sport/date. */
function buildSlotMapFromLocal(sport, timeArr) {
  const today     = getTodayPH();
  const myUserId  = localStorage.getItem('apexUserId');
  const bookings  = JSON.parse(localStorage.getItem('apexBookings') || '[]');
  const openPlays = JSON.parse(localStorage.getItem('apexOpenSessions') || '[]');
  const map = {};

  // 'drill' (booking.js key) and 'drillzone' (main.js key) are the same sport
  const normSport = sport === 'drillzone' ? ['drillzone', 'drill'] : [sport];

  bookings.forEach(b => {
    if (b.status === 'cancelled') return;
    if (!normSport.includes(b.sport)) return;
    (b.slots || []).forEach(s => {
      if (s.date !== today) return;
      const c = Number(s.court);
      if (!map[c]) map[c] = {};
      const label = slotTimeToKey(s.time);
      if (timeArr.includes(label)) {
        map[c][label] = (b.userId && myUserId && b.userId === myUserId) ? 'mine' : 'booked';
      }
    });
  });

  openPlays.forEach(s => {
    if (s.date !== today || s.sport !== sport) return;
    const c = Number(s.court || 1);
    if (!map[c]) map[c] = {};
    const label = slotTimeToKey(s.time);
    if (timeArr.includes(label) && !map[c][label]) {
      map[c][label] = 'open-session';
    }
  });

  return map;
}

/** Merge Supabase booking rows into a slot map. */
function buildSlotMapFromDB(rows, myUserId, timeArr) {
  const map = {};
  rows.forEach(b => {
    const c = b.court_number;
    if (!map[c]) map[c] = {};
    const label = slotTimeToKey(b.start_time);
    if (timeArr.includes(label)) {
      map[c][label] = (b.user_id && b.user_id === myUserId) ? 'mine' : 'booked';
    }
  });
  return map;
}

/** Render the court availability grid for the given sport. */
async function renderAvailability(sport) {
  const grid = document.getElementById('availGrid');
  if (!grid) return;

  const isDZ     = sport === 'drillzone';
  const nowH     = getNowHPH();
  const today    = getTodayPH();
  const n        = COURTS[sport];
  const abbr     = sport === 'pickleball' ? 'PB' : sport === 'badminton' ? 'BD' : 'DZ';

  // Only show time slots from now onward — past slots hidden entirely
  const allTimes = isDZ ? DZ_TIMES : TIMES;
  const timeArr  = allTimes.filter(t => {
    let h = parseInt(t);
    if (t.includes('PM') && h !== 12) h += 12;
    if (t.includes('AM') && h === 12) h = 0;
    return h >= Math.floor(nowH); // show current hour and future
  });

  // Step 1 — localStorage (instant, always available)
  let slotMap  = buildSlotMapFromLocal(sport, timeArr);
  let myUserId = localStorage.getItem('apexUserId');

  // Step 2 — Supabase merge (additive)
  if (window.apexDB) {
    try {
      const { data: dbRows, error } = await window.apexDB
        .from('bookings')
        .select('court_number,start_time,sport,status,user_id')
        .eq('booking_date', today)
        .eq('sport', sport)
        .neq('status', 'cancelled');

      if (!error && dbRows) {
        try {
          const { data: { user } } = await window.apexDB.auth.getUser();
          if (user?.id) myUserId = user.id;
        } catch (_) {}

        const dbMap = buildSlotMapFromDB(dbRows, myUserId, timeArr);
        for (const c in dbMap) {
          if (!slotMap[c]) slotMap[c] = {};
          Object.assign(slotMap[c], dbMap[c]);
        }
      }
    } catch (_) {}
  }

  // LIVE badge
  const liveEl = document.getElementById('availLiveTag');
  if (liveEl) {
    liveEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#4ade80">
      <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;animation:livePulse 1.4s ease-in-out infinite"></span>LIVE
    </span>`;
  }

  // Build slots per court
  const slots = {};
  for (let c = 1; c <= n; c++) {
    slots[c] = timeArr.map(t => slotMap[c]?.[t] || 'open');
  }

  // Time header
  let html = `<div style="display:flex;gap:4px;margin-bottom:8px">
    <div style="width:88px;flex-shrink:0"></div>
    <div style="display:flex;gap:4px;flex:1">`;
  timeArr.forEach(t => {
    let h = parseInt(t);
    if (t.includes('PM') && h !== 12) h += 12;
    if (t.includes('AM') && h === 12) h = 0;
    const isCurrent = h === Math.floor(nowH);
    html += `<div style="flex:1;font-size:9px;text-align:center;letter-spacing:0.04em;
      color:${isCurrent ? 'var(--accent)' : 'var(--cream-dim)'};
      font-weight:${isCurrent ? '700' : '400'}">${t}</div>`;
  });
  html += '</div></div>';

  // Drill Zone notice
  if (isDZ) {
    html += `<div style="margin:0 0 10px;padding:8px 12px;border-radius:8px;
      background:rgba(0,194,168,0.07);border:1px solid rgba(0,194,168,0.2);
      font-size:11px;color:rgba(0,194,168,0.75);display:flex;align-items:center;gap:8px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/>
        <circle cx="12" cy="12" r="11" opacity=".25"/>
      </svg>
      Solo training zone · Ball machine included · Book in 30 or 60-min blocks
    </div>`;
  }

  // Court rows
  for (let c = 1; c <= n; c++) {
    const rowLabel = isDZ ? 'Drill Zone' : `${abbr} Court ${c}`;
    html += `<div class="court-row" role="row" aria-label="${rowLabel}">
      <div class="court-label" role="rowheader">${isDZ ? 'DZ' : abbr + ' ' + c}</div>
      <div class="time-slots" role="group">`;

    slots[c].forEach((s, i) => {
      const tLabel = timeArr[i];
      const status     = s;
      const isBookable = status === 'open';
      const slotLabel  = status === 'open-session' ? 'OPEN'
                       : status === 'mine'         ? 'MINE'
                       : status === 'booked'       ? 'BOOKED' : '';
      html += `<div class="slot ${status}"
        role="${isBookable ? 'button' : 'cell'}"
        tabindex="${isBookable ? '0' : '-1'}"
        aria-label="${tLabel}: ${isBookable ? 'Available' : slotLabel || status}"
        style="${!isBookable ? 'pointer-events:none;cursor:default' : 'cursor:pointer'}"
        ${isBookable ? `onclick="window.location.href='book.html?sport=${sport}&court=${c}&time=${tLabel}'"
          onkeydown="if(event.key==='Enter'||event.key===' ')this.click()"` : ''}
      >${slotLabel}</div>`;
    });

    html += '</div></div>';
  }

  // Reveal
  const skel = document.getElementById('availSkeleton');
  if (skel) skel.style.display = 'none';
  grid.style.display = '';
  grid.innerHTML = html;

  grid.querySelectorAll('.slot').forEach((slot, i) => {
    slot.style.opacity = '0';
    slot.style.transform = 'scaleY(0.6)';
    requestAnimationFrame(() => {
      setTimeout(() => {
        slot.style.transition = 'opacity 0.25s, transform 0.3s';
        slot.style.opacity = '1';
        slot.style.transform = 'none';
      }, Math.min(i * 5, 200));
    });
  });
}

function switchSport(sport, tabEl) {
  document.querySelectorAll('.avail-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  tabEl.classList.add('active');
  tabEl.setAttribute('aria-selected', 'true');
  renderAvailability(sport);
}

function getActiveSport() {
  const tab = document.querySelector('.avail-tab.active');
  if (!tab) return 'pickleball';
  const m = (tab.getAttribute('onclick') || '').match(/'([a-z]+)'/);
  return m ? m[1] : 'pickleball';
}

// Today date label + initial render
const todayEl = document.getElementById('todayDate');
if (todayEl) {
  todayEl.textContent = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric'
  });
}
renderAvailability('pickleball');

// ─── COURT CANVAS SYNC ────────────────────────────────────────
/** Update court animation based on active bookings right now. */
function syncCanvasNow() {
  if (!window.updateCourtActivity) return;

  const nowH  = getNowHPH();
  const today = getTodayPH();
  const act   = { P1:false, P2:false, P3:false, P4:false,
                  B1:false, B2:false, B3:false, B4:false, DZ:false };

  // localStorage — instant
  try {
    const local = JSON.parse(localStorage.getItem('apexBookings') || '[]');
    local.forEach(b => {
      if (b.status === 'cancelled') return;
      const isDrill = b.sport === 'drill' || b.sport === 'drillzone';
      const step    = isDrill ? 0.5 : 1;
      (b.slots || []).forEach(s => {
        if (s.date !== today) return;
        const startH = parseHourStr(s.time);
        if (startH < 0 || nowH < startH || nowH >= startH + step) return;
        const c = Number(s.court);
        if      (b.sport === 'pickleball' && c >= 1 && c <= 4) act['P'+c] = true;
        else if (b.sport === 'badminton'  && c >= 1 && c <= 4) act['B'+c] = true;
        else if (isDrill)                                        act.DZ    = true;
      });
    });
  } catch (_) {}

  window.updateCourtActivity({ ...act });

  // Supabase — additive
  if (window.apexDB) {
    window.apexDB
      .from('bookings')
      .select('court_number,sport,start_time,end_time')
      .eq('booking_date', today)
      .neq('status', 'cancelled')
      .then(({ data, error }) => {
        if (error || !data) return;
        data.forEach(r => {
          const sh = parseHourStr(r.start_time);
          const eh = parseHourStr(r.end_time || '23:00:00');
          if (sh < 0 || nowH < sh || nowH >= eh) return;
          const c = Math.max(1, Number(r.court_number) || 1);
          if      (r.sport === 'pickleball'                      && c <= 4) act['P'+c] = true;
          else if (r.sport === 'badminton'                       && c <= 4) act['B'+c] = true;
          else if (r.sport === 'drillzone' || r.sport === 'drill')          act.DZ    = true;
        });
        window.updateCourtActivity({ ...act });
      })
      .catch(() => {});
  }
}

// Run on load
syncCanvasNow();

// Cross-tab: re-render when book.html writes apexBookings
window.addEventListener('storage', e => {
  if (e.key !== 'apexBookings') return;
  renderAvailability(getActiveSport());
  syncCanvasNow();
});

// Poll every 30s — catches time boundary transitions
setInterval(() => {
  renderAvailability(getActiveSport());
  syncCanvasNow();
}, 30_000);

// Supabase Realtime (optional bonus — localStorage already drives everything)
(function setupRealtime() {
  if (!window.ApexCourts) return;
  const today = getTodayPH();
  const refresh = () => { renderAvailability(getActiveSport()); syncCanvasNow(); };
  ['pickleball', 'badminton', 'drillzone'].forEach(sport => {
    ApexCourts.subscribeAvailability(sport, today, refresh);
  });
})();

// ─── TESTIMONIALS ─────────────────────────────────────────────
const TESTIMONIALS = [
  { name: 'Sarah K.',    role: 'Pro Member',       avatar: 'SK', stars: 5, text: '"Best pickleball courts I\'ve played on outside of a tournament. The flooring is exceptional and booking takes 90 seconds flat."' },
  { name: 'Marcus T.',   role: 'Badminton Player',  avatar: 'MT', stars: 5, text: '"The ceiling height alone makes these courts worth it. Perfect lighting, zero glare. My shuttle speeds are consistent every single session."' },
  { name: 'Jennifer L.', role: 'Elite Member',      avatar: 'JL', stars: 5, text: '"I drive 45 minutes to play here. The unlimited membership pays for itself in two weeks. Staff are genuinely welcoming."' },
  { name: 'David H.',    role: 'Drop-In Player',    avatar: 'DH', stars: 5, text: '"Walked in without a reservation, got a court in 20 minutes, rented equipment for $8, played 2 hours. Completely seamless."' },
  { name: 'Priya R.',    role: 'Pro Member',        avatar: 'PR', stars: 5, text: '"Live court availability is a game changer. No more calling ahead or showing up to find everything taken. Pure convenience."' },
  { name: 'Tom W.',      role: 'Elite Member',      avatar: 'TW', stars: 5, text: '"Ran our company league tournament here — 40 people, zero hiccups. Staff handled scheduling, equipment, even catering. Will return every quarter."' },
];

const track = document.getElementById('testimonialTrack');
if (track) {
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

// ─── COUNTER ANIMATION ────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.hero-stat-num').forEach(el => {
    const raw = el.textContent;
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const suffix   = raw.replace(/[\d.]/g, '');
    const start    = performance.now();
    const update   = now => {
      const p = Math.min((now - start) / 1000, 1);
      el.textContent = Math.round(num * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  });
}
const statsObs   = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { animateCounters(); statsObs.disconnect(); }
}, { threshold: 0.5 });
const firstStat  = document.querySelector('.hero-stat-num');
if (firstStat) statsObs.observe(firstStat);
