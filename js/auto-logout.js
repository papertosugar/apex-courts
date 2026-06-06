/* ─── SMASH STUDIO — Auto-Logout (Idle Timer) ─── *
 * Usage: add <script src="js/auto-logout.js"></script> to any
 *        authenticated page AFTER supabase-client.js.
 *
 * Config:
 *   IDLE_TIMEOUT_MS  — logout after this many ms of inactivity (default 30 min)
 *   WARN_BEFORE_MS   — show warning this many ms before logout (default 60 s)
 */

(function () {
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
  const WARN_BEFORE_MS  =      60 * 1000;  // warn 60 s before
  const WARN_TIMEOUT_MS = IDLE_TIMEOUT_MS - WARN_BEFORE_MS;

  let idleTimer    = null;
  let warnTimer    = null;
  let warnToast    = null;
  let isWarning    = false;

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
      'background:rgba(18,18,24,0.97)',
      'border:1px solid rgba(255,195,0,0.3)',
      'color:#fff',
      'padding:14px 20px',
      'border-radius:12px',
      'font-size:14px',
      'z-index:99999',
      'display:flex',
      'align-items:center',
      'gap:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'max-width:calc(100vw - 48px)',
    ].join(';');

    const msg = document.createElement('span');
    msg.id = 'idle-warn-msg';
    msg.textContent = '비활동으로 인해 곧 로그아웃됩니다.';

    const btn = document.createElement('button');
    btn.textContent = '계속 사용';
    btn.style.cssText = [
      'background:rgba(255,195,0,0.15)',
      'border:1px solid rgba(255,195,0,0.4)',
      'color:#FFC300',
      'padding:6px 14px',
      'border-radius:8px',
      'font-size:13px',
      'cursor:pointer',
      'white-space:nowrap',
      'flex-shrink:0',
    ].join(';');
    btn.onclick = resetIdleTimer;

    warnToast.appendChild(msg);
    warnToast.appendChild(btn);
    document.body.appendChild(warnToast);
  }

  function showWarning(secondsLeft) {
    createToast();
    isWarning = true;
    const msg = document.getElementById('idle-warn-msg');
    if (msg) msg.textContent = `비활동으로 인해 ${secondsLeft}초 후 로그아웃됩니다.`;
    warnToast.style.display = 'flex';

    // Countdown every second
    let sec = secondsLeft;
    const countdown = setInterval(() => {
      sec--;
      if (!isWarning) { clearInterval(countdown); return; }
      const m = document.getElementById('idle-warn-msg');
      if (m) m.textContent = `비활동으로 인해 ${sec}초 후 로그아웃됩니다.`;
    }, 1000);
  }

  function hideWarning() {
    isWarning = false;
    if (warnToast) warnToast.style.display = 'none';
  }

  // ── Logout ────────────────────────────────────────────────────────
  async function doLogout() {
    hideWarning();
    // Clear Supabase session
    if (typeof supabase !== 'undefined') {
      try { await supabase.auth.signOut(); } catch(e) {}
    }
    // Clear localStorage
    ['apexUser','apexRole','apexUserId'].forEach(k => localStorage.removeItem(k));

    // Redirect to login with session-expired flag
    window.location.href = 'login.html?reason=idle';
  }

  // ── Reset timers ──────────────────────────────────────────────────
  function resetIdleTimer() {
    hideWarning();
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);

    warnTimer  = setTimeout(() => showWarning(Math.round(WARN_BEFORE_MS / 1000)), WARN_TIMEOUT_MS);
    idleTimer  = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }

  // ── Activity listeners ────────────────────────────────────────────
  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  EVENTS.forEach(ev => document.addEventListener(ev, resetIdleTimer, { passive: true }));

  // ── Only run when a user is logged in ────────────────────────────
  if (localStorage.getItem('apexUser')) {
    resetIdleTimer();
  }

  // ── Show "session expired" toast on login page ────────────────────
  // (handled by login.html checking ?reason=idle)
})();
