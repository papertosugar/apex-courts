/* ============================================================
   SMASH STUDIO — Supabase Client
   Replaces localStorage data layer with Supabase queries.

   Setup:
   1. Copy your Project URL + anon key from
      Supabase Dashboard → Settings → API
   2. Set them in your Vercel environment variables:
        SUPABASE_URL      = https://qughntfplchllsiaiteu.supabase.co/rest/v1/
        SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z2hudGZwbGNobGxzaWFpdGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODI4NzgsImV4cCI6MjA5NjE1ODg3OH0.MFspR7dJ0cMN1ayq6fZxruk9Nv2yKJQzxvzJy96FBBI
   3. This file reads them from window.__ENV__ (injected by
      Vercel Edge Config, or set manually below for local dev).
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
// For local development, hard-code here.
// For Vercel production, these come from environment variables
// injected via a <script> tag in your HTML head or an edge function.
const SUPABASE_URL      = window.__ENV__?.SUPABASE_URL      || 'https://qughntfplchllsiaiteu.supabase.co';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z2hudGZwbGNobGxzaWFpdGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODI4NzgsImV4cCI6MjA5NjE1ODg3OH0.MFspR7dJ0cMN1ayq6fZxruk9Nv2yKJQzxvzJy96FBBI';

// Load Supabase client (added via CDN in HTML head)
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.apexDB = db;  // expose globally for other scripts


/* ============================================================
   AUTH HELPERS
   ============================================================ */

/** Sign up a new member */
async function signUp({ email, phone, password, firstName, lastName }) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://apex-courts.vercel.app/auth-callback',
      data: { first_name: firstName, last_name: lastName, phone, role: 'member' }
    }
  });
  if (error) throw error;
  return data;
}

/** Sign in with email + password */
async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in with phone + OTP */
async function sendOTP(phone) {
  const { error } = await db.auth.signInWithOtp({ phone });
  if (error) throw error;
}

async function verifyOTP(phone, token) {
  const { data, error } = await db.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return data;
}

/** Verify email signup OTP (6-digit code sent by Supabase on signUp) */
async function verifyEmailOTP(email, token) {
  const { data, error } = await db.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw error;
  return data;
}

/** Resend signup confirmation OTP */
async function resendEmailOTP(email) {
  const { error } = await db.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

/** Sign out */
async function signOut() {
  await db.auth.signOut();
  sessionStorage.clear();
  window.location.href = '/index.html';
}

/** Get the current logged-in user + profile */
async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return { ...user, profile };
}


/* ============================================================
   AVAILABILITY  (homepage Real-Time Availability section)
   ============================================================ */

/**
 * Get all bookings for a given sport + date.
 * Returns array of { court_id, start_time, end_time, status }
 *
 * Usage:
 *   const slots = await getAvailability('pickleball', '2026-06-05');
 */
async function getAvailability(sport, date) {
  const { data, error } = await db
    .from('v_court_availability')
    .select('court_id, label, court_number, booking_id, start_time, end_time, booking_status')
    .eq('court_type', sport)
    .eq('booking_date', date)
    .order('court_number')
    .order('start_time');
  if (error) throw error;
  return data;
}

/**
 * Get courts for a sport (static, cached)
 * Returns [{ id, label, court_number }]
 */
async function getCourts(sport) {
  const { data, error } = await db
    .from('courts')
    .select('id, label, court_number, hourly_rate')
    .eq('court_type', sport)
    .eq('is_active', true)
    .order('court_number');
  if (error) throw error;
  return data;
}


/* ============================================================
   BOOKINGS
   ============================================================ */

/** Create a new booking */
async function createBooking({ courtId, date, startTime, endTime, durationMins, playerCount, notes, userName, paymentMethod, totalAmount, sport, courtNum, bookingCode }) {
  const user = await getCurrentUser();
  const payload = {
    booking_date:     date,
    start_time:       startTime,
    end_time:         endTime,
    duration_minutes: durationMins,
    player_count:     playerCount || 2,
    notes,
    status:           'confirmed',
  };
  // Optional fields — add only if they exist
  if (courtId)       payload.court_id         = courtId;
  if (user?.id)      payload.user_id           = user.id;
  if (userName)      payload.player_name       = userName;
  if (paymentMethod) payload.payment_method    = paymentMethod;
  if (totalAmount)   payload.total_amount      = totalAmount;
  if (sport)         payload.sport             = sport;
  if (courtNum)      payload.court_number      = courtNum;
  if (bookingCode)   payload.booking_code      = bookingCode;

  const { data, error } = await db.from('bookings').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Cancel a booking */
async function cancelBooking(bookingId) {
  const { error } = await db
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);
  if (error) throw error;
}

/** Get bookings for the logged-in user */
async function getMyBookings() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db
    .from('bookings')
    .select('*, courts(label, court_type)')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('booking_date', { ascending: false })
    .order('start_time');
  if (error) throw error;
  return data;
}


/* ============================================================
   OPEN PLAY
   ============================================================ */

/** Get upcoming + recent open play sessions */
async function getOpenPlaySessions() {
  const { data, error } = await db
    .from('v_open_play')
    .select('*')
    .gte('session_date', new Date(Date.now() - 30 * 86400 * 1000).toISOString().split('T')[0])
    .order('session_date')
    .order('session_time');
  if (error) throw error;
  return data;
}

/** Register the current user for an open play session */
async function registerOpenPlay(sessionId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Must be logged in to register');
  const { data, error } = await db
    .from('open_play_registrations')
    .insert({
      session_id:  sessionId,
      user_id:     user.id,
      player_name: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
      contact:     user.profile.phone || user.email,
    })
    .select().single();
  if (error) throw error;
  return data;
}

/** Cancel open play registration */
async function cancelOpenPlayRegistration(sessionId) {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await db
    .from('open_play_registrations')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', user.id);
  if (error) throw error;
}

/** [Admin] Create an open play session */
async function createOpenPlaySession({ sport, date, time, maxPlayers, notes, type }) {
  const user = await getCurrentUser();
  const { data, error } = await db
    .from('open_play_sessions')
    .insert({
      sport, session_date: date, session_time: time,
      max_players: maxPlayers || 12,
      session_type: type || 'standard',
      notes, created_by: user?.id,
    })
    .select().single();
  if (error) throw error;
  return data;
}


/* ============================================================
   NEWS
   ============================================================ */

async function getNews() {
  const { data, error } = await db
    .from('news')
    .select('*, profiles(first_name, last_name)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

async function publishNews({ title, content }) {
  const user = await getCurrentUser();
  const { data, error } = await db
    .from('news')
    .insert({ title, content, author_id: user?.id })
    .select().single();
  if (error) throw error;
  return data;
}


/* ============================================================
   COMMUNITY POSTS
   ============================================================ */

async function getCommunityPosts(sport = null) {
  let q = db
    .from('v_community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (sport && sport !== 'all') q = q.eq('sport_tag', sport);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createPost({ sportTag, text, photoFile }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Must be logged in to post');

  let photo_url = null;
  if (photoFile) {
    const path = `posts/${user.id}/${Date.now()}-${photoFile.name}`;
    const { error: upErr } = await db.storage.from('community').upload(path, photoFile);
    if (upErr) throw upErr;
    const { data: { publicUrl } } = db.storage.from('community').getPublicUrl(path);
    photo_url = publicUrl;
  }

  const { data, error } = await db
    .from('community_posts')
    .insert({ author_id: user.id, sport_tag: sportTag || 'general', text_content: text, photo_url })
    .select().single();
  if (error) throw error;
  return data;
}

async function toggleLike(postId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Must be logged in to like');

  const { data: existing } = await db
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    return false;  // unliked
  } else {
    await db.from('post_likes').insert({ post_id: postId, user_id: user.id });
    return true;   // liked
  }
}


/* ============================================================
   REAL-TIME SUBSCRIPTIONS
   Usage in availability page:
     subscribeAvailability('pickleball', '2026-06-05', (payload) => renderGrid());
   ============================================================ */

function subscribeAvailability(sport, date, onUpdate) {
  return db
    .channel(`availability-${sport}-${date}`)
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'bookings',
      filter: `booking_date=eq.${date}`,
    }, onUpdate)
    .subscribe();
}

function subscribeOpenPlay(onUpdate) {
  return db
    .channel('open-play-updates')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'open_play_sessions',
    }, onUpdate)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'open_play_registrations',
    }, onUpdate)
    .subscribe();
}


/* ============================================================
   EXPORT
   ============================================================ */
window.ApexCourts = {
  // Auth
  signUp, signIn, sendOTP, verifyOTP, verifyEmailOTP, resendEmailOTP, signOut, getCurrentUser,
  // Availability
  getAvailability, getCourts,
  // Bookings
  createBooking, cancelBooking, getMyBookings,
  // Open Play
  getOpenPlaySessions, registerOpenPlay, cancelOpenPlayRegistration, createOpenPlaySession,
  // Community
  getNews, publishNews, getCommunityPosts, createPost, toggleLike,
  // Real-time
  subscribeAvailability, subscribeOpenPlay,
  // Raw client (for advanced queries)
  db,
};

console.log('[ApexCourts] Supabase client ready.');
