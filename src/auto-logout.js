/* ── Auto-logout / session watcher (ESM) ── */
import { db } from './supabase-client.js';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle
let timer;

function resetTimer() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await db.auth.signOut();
    localStorage.removeItem('apexUser');
    localStorage.removeItem('apexRole');
    localStorage.removeItem('apexNick');
    window.location.href = '/login.html?reason=timeout';
  }, TIMEOUT_MS);
}

['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, resetTimer, { passive: true })
);
resetTimer();
