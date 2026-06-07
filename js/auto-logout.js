/* ─── SMASH STUDIO — Auto-Logout (Idle Timer) ───────────────────
 * Add <script src="js/auto-logout.js"></script> to any authenticated
 * page AFTER supabase-client.js and utils.js.
 *
 * Config:
 *   IDLE_TIMEOUT_MS  — sign out after this many ms of inactivity (30 min)
 *   WARN_BEFORE_MS   — show warning this many ms before sign-out (60 s)
 */

(function () {
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
  const WARN_BEFORE_MS  =      60 * 1000;  // warn 60 s before
  const WARN_TIMEOUT_MS = IDLE_TIMEOUT_MS - WARN_BEFORE_MS;

  let idleTimer = null;
  let warnTimer = null;
  let warnToast = null;
  let isWarning = false;

  // ── Create warning toast ──────────────────────────────────────────
  function createToast() {
    if (warnToast) return;
    warnToast = document.createElement('div');
    warnToast.id = 'idle-warn-toast';
    warnToast.setAttribute('role', 'alert');
    warnToast.setAttribute('aria-live', 'assertive');
    warnToast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(12,12,18,0.97)',
      'border:1px solid rgba(212,175,55,0.35)',
      'color:#f2ede4',
      'padding:14px 20px',
      'border-radius:12px',
      'font-size:14px',
      'font-family:inherit',
      'z-index:99999',
      'display:flex',
      'align-items:center',
      'gap:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'max-width:calc(100vw - 48px)',
      'backdrop-filter:blur(12px)',
    ].join(';');

    const msg = document.createElement('span');
    msg.id = 'idle-warn-msg';
    msg.textContent = 'You will be signed out soon due to inactivity.';

    const btn = document.createElement('button');
    btn.textContent = 'Stay Signed In';
    btn.style.cssText = [
      'background:rgba(212,175,55,0.15)',
      'border:1px solid rgba(212,175,55,0.45)',
      'color:#D4AF37',
      'padding:6px 14px',
      'border-radius:8px',
      'font-size:13px',
      'font-weight:700',
      'font-family:inherit',
      'cursor:pointer',
      'white-space:nowrap',
      'flex-shrink:0',
      'transition:background 0.2s',
    ].join(';');
    btn.onmouseover = () => { btn.style.background = 'rgba(212,175,55,0.28)'; };
    btn.onmouseout  = () => { btn.style.background = 'rgba(212,175,55,0.15)'; };
    btn.onclick = resetIdleTimer;

    warnToast.appendChild(msg);
    warnToast.appendChild(btn);
    document.body.appendChild(warnToast);
  }

  function showWarning(secondsLeft) {
    createToast();
    isWarning = true;
    const msg = document.getElementById('idle-warn-msg');
    if (msg) msg.textContent = `Signing out in ${secondsLeft}s due to inactivity.`;
    warnToast.style.display = 'flex';

    // Countdown every second
    let sec = secondsLeft;
    const countdown = setInterval(() => {
      sec--;
      if (!isWarning) { clearInterval(countdown); return; }
      const m = document.getElementById('idle-warn-msg');
      if (m) m.textContent = `Signing out in ${sec}s due to inactivity.`;
    }, 1000);
  }

  function hideWarning() {
    isWarning = false;
    if (warnToast) warnToast.style.display = 'none';
  }

  // ── Sign out ──────────────────────────────────────────────────────
  async function doLogout() {
    hideWarning();
    // Sign out from Supabase
    if (window.apexDB) {
      try { await window.apexDB.auth.signOut(); } catch (_) {}
    }
    // Clear local state
    ['apexUser', 'apexRole', 'apexUserId', 'apexNick'].forEach(k => localStorage.removeItem(k));
    // Redirect to login with reason flag
    window.location.href = 'login.html?reason=idle';
  }

  // ── Reset timers on any activity ─────────────────────────────────
  function resetIdleTimer() {
    hideWarning();
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => showWarning(Math.round(WARN_BEFORE_MS / 1000)), WARN_TIMEOUT_MS);
    idleTimer = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }

  // ── Activity listeners ────────────────────────────────────────────
  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  EVENTS.forEach(ev => document.addEventListener(ev, resetIdleTimer, { passive: true }));

  // ── Only activate when a user is logged in ────────────────────────
  // Also watch for login/logout events across tabs
  if (localStorage.getItem('apexUser')) {
    resetIdleTimer();
  }
  window.addEventListener('storage', e => {
    if (e.key !== 'apexUser') return;
    if (e.newValue) {
      resetIdleTimer(); // logged in from another tab
    } else {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      hideWarning();
    }
  });
})();
