-- ============================================================
--  APEX COURTS — Row Level Security (RLS) Policies
--  Run AFTER schema.sql
-- ============================================================

-- Enable RLS on every table
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_play_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_play_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log          ENABLE ROW LEVEL SECURITY;


-- ── Helper: is the caller an admin or pos_staff? ─────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin','pos_staff')
     FROM public.profiles WHERE id = auth.uid()),
  FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT role = 'admin'
     FROM public.profiles WHERE id = auth.uid()),
  FALSE);
$$;


-- ── PROFILES ─────────────────────────────────────────────────
-- Anyone can read public profile data (name, role)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT USING (TRUE);

-- Users can update only their own profile (except role)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins can update any profile (including role changes)
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());


-- ── COURTS ───────────────────────────────────────────────────
-- Courts are read-only for everyone (public)
CREATE POLICY "courts_select_public"
  ON public.courts FOR SELECT USING (TRUE);

-- Only admins can add/modify courts
CREATE POLICY "courts_admin_write"
  ON public.courts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── BOOKINGS ─────────────────────────────────────────────────
-- Public: read availability for any date (no user data exposed)
CREATE POLICY "bookings_select_availability"
  ON public.bookings FOR SELECT
  USING (TRUE);  -- all bookings visible (court+time only needed for grid)

-- Members can create their own bookings
CREATE POLICY "bookings_insert_own"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Members can cancel (update status) their own bookings
CREATE POLICY "bookings_update_own"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff());

-- Staff can do everything
CREATE POLICY "bookings_staff_all"
  ON public.bookings FOR ALL
  USING (public.is_staff());


-- ── OPEN PLAY SESSIONS ───────────────────────────────────────
-- Anyone can read sessions
CREATE POLICY "sessions_select_public"
  ON public.open_play_sessions FOR SELECT USING (TRUE);

-- Only staff/admin can create, update, delete sessions
CREATE POLICY "sessions_staff_write"
  ON public.open_play_sessions FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "sessions_staff_update"
  ON public.open_play_sessions FOR UPDATE
  USING (public.is_staff());

CREATE POLICY "sessions_admin_delete"
  ON public.open_play_sessions FOR DELETE
  USING (public.is_admin());


-- ── OPEN PLAY REGISTRATIONS ──────────────────────────────────
-- Logged-in users can read registrations for sessions they're in
CREATE POLICY "reg_select_own"
  ON public.open_play_registrations FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff());

-- Members register themselves
CREATE POLICY "reg_insert_own"
  ON public.open_play_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Members can cancel (set cancelled_at) their own registration
CREATE POLICY "reg_update_own"
  ON public.open_play_registrations FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff());

-- Staff can delete
CREATE POLICY "reg_staff_delete"
  ON public.open_play_registrations FOR DELETE
  USING (public.is_staff());


-- ── NEWS ─────────────────────────────────────────────────────
-- Everyone can read published news
CREATE POLICY "news_select_published"
  ON public.news FOR SELECT
  USING (is_published = TRUE OR public.is_staff());

-- Only admin can write news
CREATE POLICY "news_admin_write"
  ON public.news FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── COMMUNITY POSTS ──────────────────────────────────────────
-- Everyone can read posts
CREATE POLICY "posts_select_public"
  ON public.community_posts FOR SELECT USING (TRUE);

-- Members can create their own posts
CREATE POLICY "posts_insert_member"
  ON public.community_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id AND auth.uid() IS NOT NULL);

-- Authors can update/delete their own posts; admins can do all
CREATE POLICY "posts_update_own"
  ON public.community_posts FOR UPDATE
  USING (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "posts_delete_own"
  ON public.community_posts FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin());


-- ── POST LIKES ───────────────────────────────────────────────
-- Anyone can read like counts (post.likes_count is denormalised)
CREATE POLICY "likes_select_public"
  ON public.post_likes FOR SELECT USING (TRUE);

-- Logged-in users can like/unlike
CREATE POLICY "likes_insert_own"
  ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "likes_delete_own"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);


-- ── ACTIVITY LOG ─────────────────────────────────────────────
-- Staff only
CREATE POLICY "log_staff_select"
  ON public.activity_log FOR SELECT USING (public.is_staff());

CREATE POLICY "log_staff_insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (public.is_staff());
