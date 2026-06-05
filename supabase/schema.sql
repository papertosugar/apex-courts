-- ============================================================
--  APEX COURTS — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Order: 1. schema.sql  2. rls.sql  3. seed.sql
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- required for EXCLUDE constraint on bookings


-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE court_type      AS ENUM ('pickleball', 'badminton', 'drillzone');
CREATE TYPE booking_status  AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'walkin');
CREATE TYPE session_status  AS ENUM ('upcoming', 'confirmed', 'cancelled', 'closed');
CREATE TYPE session_type    AS ENUM ('standard', 'extended');
CREATE TYPE sport_tag       AS ENUM ('pickleball', 'badminton', 'drillzone', 'general');
CREATE TYPE user_role       AS ENUM ('admin', 'pos_staff', 'member');


-- ============================================================
--  PROFILES  (extends auth.users — 1-to-1)
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT        NOT NULL DEFAULT '',
  last_name     TEXT        NOT NULL DEFAULT '',
  phone         TEXT,
  role          user_role   NOT NULL DEFAULT 'member',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'member'::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
--  COURTS  (static facility definition)
-- ============================================================
CREATE TABLE public.courts (
  id            SERIAL      PRIMARY KEY,
  court_type    court_type  NOT NULL,
  court_number  SMALLINT    NOT NULL,  -- 1–4 for PB/BD, 1 for DZ
  label         TEXT        GENERATED ALWAYS AS (
                  CASE court_type
                    WHEN 'pickleball' THEN 'P' || court_number
                    WHEN 'badminton'  THEN 'B' || court_number
                    ELSE 'DZ'
                  END
                ) STORED,
  hourly_rate   DECIMAL(10,2) NOT NULL DEFAULT 600.00,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  UNIQUE (court_type, court_number)
);


-- ============================================================
--  BOOKINGS  (drives Real-Time Availability grid)
-- ============================================================
CREATE TABLE public.bookings (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  court_id         INTEGER       NOT NULL REFERENCES public.courts(id),
  booking_date     DATE          NOT NULL,
  start_time       TIME          NOT NULL,
  end_time         TIME          NOT NULL,
  duration_minutes SMALLINT      NOT NULL CHECK (duration_minutes IN (30, 60, 90, 120)),
  status           booking_status NOT NULL DEFAULT 'pending',
  player_count     SMALLINT      NOT NULL DEFAULT 2 CHECK (player_count BETWEEN 1 AND 10),
  notes            TEXT,
  total_price      DECIMAL(10,2),
  is_walkin        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by_staff UUID          REFERENCES public.profiles(id),  -- POS walk-in
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- No overlapping bookings on same court+date
  CONSTRAINT no_overlap EXCLUDE USING gist (
    court_id WITH =,
    booking_date WITH =,
    tsrange(
      booking_date + start_time,
      booking_date + end_time
    ) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

CREATE INDEX idx_bookings_date_court   ON public.bookings (booking_date, court_id);
CREATE INDEX idx_bookings_user         ON public.bookings (user_id);
CREATE INDEX idx_bookings_status       ON public.bookings (status);
CREATE INDEX idx_bookings_date         ON public.bookings (booking_date);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Computed total_price on insert/update
CREATE OR REPLACE FUNCTION public.compute_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_rate DECIMAL(10,2);
BEGIN
  SELECT hourly_rate INTO v_rate FROM public.courts WHERE id = NEW.court_id;
  NEW.total_price := v_rate * (NEW.duration_minutes / 60.0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_compute_price
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.compute_booking_price();


-- ============================================================
--  OPEN PLAY SESSIONS
-- ============================================================
CREATE TABLE public.open_play_sessions (
  id             TEXT          PRIMARY KEY DEFAULT 'OP-' || upper(substr(uuid_generate_v4()::text, 1, 8)),
  session_type   session_type  NOT NULL DEFAULT 'standard',
  sport          court_type    NOT NULL,
  session_date   DATE          NOT NULL,
  session_time   TIME          NOT NULL,
  max_players    SMALLINT      NOT NULL DEFAULT 12,
  min_players    SMALLINT      NOT NULL DEFAULT 4,
  price_per_person DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  notes          TEXT,
  status         session_status NOT NULL DEFAULT 'upcoming',
  created_by     UUID          REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_open_play_date    ON public.open_play_sessions (session_date);
CREATE INDEX idx_open_play_status  ON public.open_play_sessions (status);
CREATE INDEX idx_open_play_sport   ON public.open_play_sessions (sport);

CREATE TRIGGER open_play_updated_at
  BEFORE UPDATE ON public.open_play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set price based on session time (peak = 14:00+)
CREATE OR REPLACE FUNCTION public.compute_openplay_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.price_per_person IS NULL OR NEW.price_per_person = 0 THEN
    NEW.price_per_person := CASE
      WHEN EXTRACT(HOUR FROM NEW.session_time) >= 14 THEN 300.00
      ELSE 200.00
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER open_play_compute_price
  BEFORE INSERT ON public.open_play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.compute_openplay_price();

-- Auto-close past sessions (call this via a scheduled function)
CREATE OR REPLACE FUNCTION public.close_past_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.open_play_sessions
  SET status = 'closed'
  WHERE status IN ('upcoming', 'confirmed')
    AND (session_date + session_time)::TIMESTAMPTZ < NOW() - INTERVAL '1 hour';
END;
$$;

-- Purge old closed sessions (30-day retention)
CREATE OR REPLACE FUNCTION public.purge_old_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.open_play_sessions
  WHERE status IN ('closed', 'cancelled')
    AND session_date < CURRENT_DATE - INTERVAL '30 days';
END;
$$;


-- ============================================================
--  OPEN PLAY REGISTRATIONS
-- ============================================================
CREATE TABLE public.open_play_registrations (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     TEXT          NOT NULL REFERENCES public.open_play_sessions(id) ON DELETE CASCADE,
  user_id        UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  player_name    TEXT          NOT NULL,
  contact        TEXT,
  registered_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  cancelled_at   TIMESTAMPTZ,

  UNIQUE (session_id, user_id)  -- one registration per user per session
);

CREATE INDEX idx_reg_session ON public.open_play_registrations (session_id);
CREATE INDEX idx_reg_user    ON public.open_play_registrations (user_id);

-- Enforce max_players cap
CREATE OR REPLACE FUNCTION public.check_session_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_max  SMALLINT;
  v_curr INTEGER;
BEGIN
  SELECT max_players INTO v_max
  FROM public.open_play_sessions WHERE id = NEW.session_id;

  SELECT COUNT(*) INTO v_curr
  FROM public.open_play_registrations
  WHERE session_id = NEW.session_id AND cancelled_at IS NULL;

  IF v_curr >= v_max THEN
    RAISE EXCEPTION 'Session is full (% / % players)', v_curr, v_max;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_session_capacity
  BEFORE INSERT ON public.open_play_registrations
  FOR EACH ROW EXECUTE FUNCTION public.check_session_capacity();


-- ============================================================
--  NEWS  (admin-published announcements)
-- ============================================================
CREATE TABLE public.news (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  author_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published BOOLEAN     NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_published ON public.news (is_published, published_at DESC);

CREATE TRIGGER news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
--  COMMUNITY POSTS  (member reviews + pictures)
-- ============================================================
CREATE TABLE public.community_posts (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_tag    sport_tag   NOT NULL DEFAULT 'general',
  text_content TEXT,
  photo_url    TEXT,                -- Supabase Storage object path
  likes_count  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (text_content IS NOT NULL OR photo_url IS NOT NULL)  -- must have content
);

CREATE INDEX idx_posts_author   ON public.community_posts (author_id);
CREATE INDEX idx_posts_sport    ON public.community_posts (sport_tag);
CREATE INDEX idx_posts_created  ON public.community_posts (created_at DESC);

CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
--  POST LIKES  (per-user, de-duplicate)
-- ============================================================
CREATE TABLE public.post_likes (
  post_id    UUID        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Keep likes_count denormalised counter in sync
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();


-- ============================================================
--  ACTIVITY LOG  (POS audit trail)
-- ============================================================
CREATE TABLE public.activity_log (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type  TEXT        NOT NULL,  -- 'booking_created', 'walkin', 'cancelled', etc.
  user_id      UUID        REFERENCES public.profiles(id),       -- affected member
  booking_id   UUID        REFERENCES public.bookings(id),
  performed_by UUID        REFERENCES public.profiles(id),       -- staff who did it
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_action  ON public.activity_log (action_type);
CREATE INDEX idx_log_booking ON public.activity_log (booking_id);
CREATE INDEX idx_log_created ON public.activity_log (created_at DESC);


-- ============================================================
--  USEFUL VIEWS
-- ============================================================

-- Court availability for a given date (used by homepage grid)
CREATE OR REPLACE VIEW public.v_court_availability AS
SELECT
  c.id            AS court_id,
  c.label,
  c.court_type,
  c.court_number,
  b.id            AS booking_id,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.status        AS booking_status,
  b.user_id       AS booked_by
FROM public.courts c
LEFT JOIN public.bookings b
  ON b.court_id = c.id
  AND b.status NOT IN ('cancelled')
WHERE c.is_active = TRUE;

-- Open play with registration count
CREATE OR REPLACE VIEW public.v_open_play AS
SELECT
  s.*,
  COUNT(r.id) FILTER (WHERE r.cancelled_at IS NULL) AS registered_count,
  s.max_players - COUNT(r.id) FILTER (WHERE r.cancelled_at IS NULL) AS spots_left
FROM public.open_play_sessions s
LEFT JOIN public.open_play_registrations r ON r.session_id = s.id
GROUP BY s.id;

-- Community posts with author name
CREATE OR REPLACE VIEW public.v_community_posts AS
SELECT
  p.*,
  pr.first_name || ' ' || pr.last_name AS author_name,
  pr.avatar_url
FROM public.community_posts p
JOIN public.profiles pr ON pr.id = p.author_id;
