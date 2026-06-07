-- ============================================================
-- SMASH STUDIO — Supabase SQL Setup
-- Run these in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. court_id NOT NULL 제거 (예약 저장 실패 근본 원인)
ALTER TABLE bookings ALTER COLUMN court_id DROP NOT NULL;

-- 2. 동시 예약 방지 unique index
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_overlap
  ON bookings (court_number, booking_date, start_time, sport)
  WHERE status != 'cancelled';

-- 3. RLS Policies (이미 있으면 건너뜀)
DO $$
BEGIN
  -- Users can insert their own bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bookings_insert_own' AND tablename = 'bookings'
  ) THEN
    CREATE POLICY bookings_insert_own ON bookings
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Users can select their own bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bookings_select_own' AND tablename = 'bookings'
  ) THEN
    CREATE POLICY bookings_select_own ON bookings
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- Users can update (cancel) their own bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bookings_update_own' AND tablename = 'bookings'
  ) THEN
    CREATE POLICY bookings_update_own ON bookings
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ★ 테스트 데이터 정리 (개발 중 쌓인 더미 예약 삭제)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 주의: 실제 회원 예약도 지워지므로 개발 환경에서만 사용
-- DELETE FROM bookings;   ← 전체 삭제 (주의)

-- 특정 날짜 이전 예약만 삭제하려면:
-- DELETE FROM bookings WHERE booking_date < '2026-06-07';

-- 또는 court_number가 없는 잘못된 예약만 삭제:
-- DELETE FROM bookings WHERE court_number IS NULL;

-- 4. Public read for availability check (no auth required)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bookings_public_read' AND tablename = 'bookings'
  ) THEN
    CREATE POLICY bookings_public_read ON bookings
      FOR SELECT USING (true);
  END IF;
END
$$;
