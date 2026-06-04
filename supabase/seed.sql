-- ============================================================
--  APEX COURTS — Seed Data
--  Run AFTER schema.sql + rls.sql
-- ============================================================

-- ── Courts (9 total) ─────────────────────────────────────────
INSERT INTO public.courts (court_type, court_number, hourly_rate) VALUES
  ('pickleball', 1, 600.00),
  ('pickleball', 2, 600.00),
  ('pickleball', 3, 600.00),
  ('pickleball', 4, 600.00),
  ('badminton',  1, 600.00),
  ('badminton',  2, 600.00),
  ('badminton',  3, 600.00),
  ('badminton',  4, 600.00),
  ('drillzone',  1, 400.00);   -- ₱400 per 30 min → 800/hr stored, use app logic for 30-min blocks

-- ── Sample Admin & POS accounts ──────────────────────────────
-- NOTE: Create these users first via Supabase Auth (Dashboard → Auth → Users)
-- then run this update once you have their UUIDs.
--
-- Example (replace UUIDs with real ones after creating auth users):
--
-- UPDATE public.profiles SET role = 'admin'     WHERE id = '<admin-uuid>';
-- UPDATE public.profiles SET role = 'pos_staff' WHERE id = '<pos-uuid>';

-- ── Sample News ───────────────────────────────────────────────
-- Run after an admin profile exists; replace <admin-uuid> with real UUID
-- INSERT INTO public.news (title, content, author_id, published_at) VALUES
-- (
--   'Grand Opening — Apex Courts Now Open!',
--   'We are thrilled to announce that Apex Courts is officially open. 9 premium indoor courts, professional equipment, and a world-class facility await you.',
--   '<admin-uuid>',
--   NOW() - INTERVAL '30 days'
-- ),
-- (
--   'Open Play Sessions Every Weekend',
--   'Join our weekend Open Play sessions — ₱200/person weekday, ₱300/person peak. No partner needed. Minimum 4 players required.',
--   '<admin-uuid>',
--   NOW() - INTERVAL '14 days'
-- ),
-- (
--   'New Ball Machine in Drill Zone',
--   'Our Drill Zone now features a professional automated ball machine with adjustable speed, spin, and 7 target positions. Book solo sessions starting at ₱400/30min.',
--   '<admin-uuid>',
--   NOW() - INTERVAL '7 days'
-- );

-- ── Sample Open Play Sessions ─────────────────────────────────
-- Upcoming sessions (replace dates with future dates when running)
INSERT INTO public.open_play_sessions
  (session_type, sport, session_date, session_time, max_players, min_players, price_per_person, notes, status)
VALUES
  ('standard',  'pickleball', CURRENT_DATE + 2,  '10:00', 12, 4, 200.00, 'Beginner friendly. All levels welcome.', 'upcoming'),
  ('standard',  'badminton',  CURRENT_DATE + 3,  '14:00', 10, 4, 300.00, 'Intermediate and above.', 'upcoming'),
  ('extended',  'pickleball', CURRENT_DATE + 5,  '09:00', 16, 8, 200.00, 'Extended Open Play — 2 hours. Bring water.', 'upcoming'),
  ('standard',  'pickleball', CURRENT_DATE - 7,  '11:00',  8, 4, 200.00, 'Past session — closed.', 'closed');

-- ── Dummy bookings for today (populates availability demo) ───
-- Generates realistic availability spread across courts for today
DO $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_times TIME[] := ARRAY[
    '07:00','08:00','09:00','10:00','11:00','12:00',
    '13:00','14:00','15:00','16:00','17:00','18:00',
    '19:00','20:00','21:00','22:00'
  ];
  v_court INTEGER;
  v_t TIME;
  v_rand FLOAT;
  v_seed INTEGER := EXTRACT(DOY FROM CURRENT_DATE)::INTEGER;
BEGIN
  -- Pickleball courts 1–4 (court IDs 1–4)
  FOR v_court IN 1..4 LOOP
    FOREACH v_t IN ARRAY v_times LOOP
      v_rand := abs(sin(v_court * 100 + EXTRACT(HOUR FROM v_t)::INTEGER + v_seed));
      IF v_rand < 0.40 THEN
        INSERT INTO public.bookings
          (court_id, booking_date, start_time, end_time, duration_minutes, status, player_count)
        VALUES
          (v_court, v_date, v_t, v_t + INTERVAL '1 hour', 60, 'confirmed', 2)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Badminton courts 1–4 (court IDs 5–8)
  FOR v_court IN 5..8 LOOP
    FOREACH v_t IN ARRAY v_times LOOP
      v_rand := abs(sin(v_court * 100 + EXTRACT(HOUR FROM v_t)::INTEGER + v_seed));
      IF v_rand < 0.40 THEN
        INSERT INTO public.bookings
          (court_id, booking_date, start_time, end_time, duration_minutes, status, player_count)
        VALUES
          (v_court, v_date, v_t, v_t + INTERVAL '1 hour', 60, 'confirmed', 2)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Drill Zone (court ID 9) — 30-min blocks
  FOREACH v_t IN ARRAY v_times LOOP
    v_rand := abs(sin(9 * 100 + EXTRACT(HOUR FROM v_t)::INTEGER + v_seed));
    IF v_rand < 0.35 THEN
      INSERT INTO public.bookings
        (court_id, booking_date, start_time, end_time, duration_minutes, status, player_count)
      VALUES
        (9, v_date, v_t, v_t + INTERVAL '30 minutes', 30, 'confirmed', 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
