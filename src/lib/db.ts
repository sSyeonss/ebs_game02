import { neon } from "@neondatabase/serverless";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;
export type Query = [text: string, params?: unknown[]];

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  batch(queries: Query[]): Promise<Row[][]>;
}

function neonDriver(url: string): Driver {
  const sql = neon(url);
  return {
    query: (text, params = []) => sql.query(text, params) as Promise<Row[]>,
    batch: (queries) => sql.transaction(queries.map(([t, p = []]) => sql.query(t, p))) as Promise<Row[][]>,
  };
}

// 로컬 개발용: DATABASE_URL 없이 `npm run dev:local`로 실행하면 내장 PGlite(WASM Postgres) 사용
async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.waitReady;
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  return {
    query: (text, params = []) => serial(async () => (await db.query<Row>(text, params)).rows),
    batch: (queries) =>
      serial(async () => {
        const out: Row[][] = [];
        for (const [t, p = []] of queries) out.push((await db.query<Row>(t, p)).rows);
        return out;
      }),
  };
}

const g = globalThis as unknown as { __driver?: Promise<Driver>; __schema?: Promise<void> };

function driver(): Promise<Driver> {
  if (!g.__driver) {
    const url = process.env.DATABASE_URL;
    if (url) g.__driver = Promise.resolve(neonDriver(url));
    else if (process.env.LOCAL_PGLITE === "1") g.__driver = pgliteDriver();
    else throw new Error("DATABASE_URL 환경 변수가 설정되지 않았어요.");
  }
  return g.__driver;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS rooms (
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
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    id text NOT NULL,
    name text NOT NULL,
    score_total int NOT NULL DEFAULT 0,
    score_round int NOT NULL DEFAULT 0,
    joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (room_code, id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id bigserial PRIMARY KEY,
    room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    player_id text,
    name text,
    kind text NOT NULL,
    text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_room_idx ON messages (room_code, id)`,
  `CREATE TABLE IF NOT EXISTS strokes (
    id bigserial PRIMARY KEY,
    room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    seq int NOT NULL,
    data jsonb NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS strokes_room_idx ON strokes (room_code, seq, id)`,
  // NPC(로봇 친구)
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS is_npc boolean NOT NULL DEFAULT false`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS npc jsonb`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS npc_strokes jsonb`,
];

async function ensureSchema(d: Driver) {
  if (!g.__schema) {
    g.__schema = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          for (const s of SCHEMA) await d.query(s);
          return;
        } catch (e) {
          // 여러 인스턴스가 동시에 테이블을 만들 때 생기는 충돌은 한 번 더 시도
          if (attempt >= 2) throw e;
        }
      }
    })().catch((e) => {
      g.__schema = undefined;
      throw e;
    });
  }
  return g.__schema;
}

export async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  const d = await driver();
  await ensureSchema(d);
  return d.query(text, params);
}

/** 여러 쿼리를 한 번의 왕복(트랜잭션)으로 실행 */
export async function batch(queries: Query[]): Promise<Row[][]> {
  const d = await driver();
  await ensureSchema(d);
  return d.batch(queries);
}
