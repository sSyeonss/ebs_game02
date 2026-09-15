-- 그려서 배워요! Neon 테이블 스키마
-- 앱이 첫 요청 때 자동으로 만들지만, Neon 콘솔의 SQL Editor에서 미리 실행해도 됩니다.

CREATE TABLE IF NOT EXISTS rooms (
  code text PRIMARY KEY,
  host_id text NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  version int NOT NULL DEFAULT 0,
  round int NOT NULL DEFAULT 0,
  set_no int NOT NULL DEFAULT 0,
  question_no int NOT NULL DEFAULT 0,
  seq int NOT NULL DEFAULT 0,
  topic text,
  difficulty text,
  leader_id text,
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_word jsonb,
  hints_revealed int NOT NULL DEFAULT 0,
  wrong_count int NOT NULL DEFAULT 0,
  used_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_result jsonb,
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  score_total int NOT NULL DEFAULT 0,
  score_round int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, id)
);

CREATE TABLE IF NOT EXISTS messages (
  id bigserial PRIMARY KEY,
  room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id text,
  name text,
  kind text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_room_idx ON messages (room_code, id);

CREATE TABLE IF NOT EXISTS strokes (
  id bigserial PRIMARY KEY,
  room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  seq int NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS strokes_room_idx ON strokes (room_code, seq, id);

-- NPC(로봇 친구)
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_npc boolean NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS npc jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS npc_strokes jsonb;
