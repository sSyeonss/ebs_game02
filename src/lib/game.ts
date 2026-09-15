import { after } from "next/server";
import { batch, query, type Query, type Row } from "./db";
import { pengsooCheer, pengsooLines } from "./pengsoo";
import { editDistance, josa, nim, normalize, wordMask } from "./text";
import { aiDrawing, newNpcId, nextGuessDelay, NPC_NAMES, npcGuessText, planGuessers, type NpcState } from "./npc";
import { difficultyName, isDifficulty, isTopic, RULES, topicName, type Difficulty, type TopicId } from "./topics";
import { generateWords, isCorrectGuess, randomTopic, type Word } from "./words";

export type Status = "lobby" | "choosing" | "generating" | "drawing" | "reveal" | "round_end" | "game_end";

export type LastResult = {
  word: string;
  explain: string;
  winnerId: string | null;
  winnerName: string | null;
  drawerId: string | null;
  drawerName: string | null;
  points: number;
  drawerPoints: number;
  reason: "correct" | "timeout" | "left";
};

export type Room = {
  code: string;
  hostId: string;
  status: Status;
  version: number;
  round: number;
  setNo: number;
  questionNo: number;
  seq: number;
  topic: TopicId | null;
  difficulty: Difficulty | null;
  leaderId: string | null;
  words: Word[];
  currentWord: Word | null;
  hintsRevealed: number;
  wrongCount: number;
  usedWords: string[];
  lastResult: LastResult | null;
  deadlineMs: number | null;
  nowMs: number;
  /** nowMs를 받은 시점의 서버 시계 (DB 현재 시각 추정용) */
  localAt: number;
  npc: NpcState | null;
};

export type Player = {
  id: string;
  name: string;
  scoreTotal: number;
  scoreRound: number;
  online: boolean;
  npc: boolean;
};

export class GameError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const ROOM_COLS = `code, host_id, status, version, round, set_no, question_no, seq, topic, difficulty, leader_id,
  words, current_word, hints_revealed, wrong_count, used_words, last_result, npc,
  (extract(epoch from deadline) * 1000)::float8 AS deadline_ms,
  (extract(epoch from now()) * 1000)::float8 AS now_ms`;

const PLAYERS_SQL = `SELECT id, name, score_total, score_round, is_npc,
  (is_npc OR last_seen > now() - interval '${RULES.OFFLINE_SECONDS} seconds') AS online
  FROM players WHERE room_code = $1 ORDER BY joined_at, id`;

const JSON_COLS = new Set(["words", "current_word", "used_words", "last_result", "npc", "npc_strokes"]);

function mapRoom(r: Row): Room {
  return {
    code: r.code,
    hostId: r.host_id,
    status: r.status,
    version: Number(r.version),
    round: Number(r.round),
    setNo: Number(r.set_no),
    questionNo: Number(r.question_no),
    seq: Number(r.seq),
    topic: r.topic,
    difficulty: r.difficulty,
    leaderId: r.leader_id,
    words: r.words ?? [],
    currentWord: r.current_word ?? null,
    hintsRevealed: Number(r.hints_revealed),
    wrongCount: Number(r.wrong_count),
    usedWords: r.used_words ?? [],
    lastResult: r.last_result ?? null,
    deadlineMs: r.deadline_ms == null ? null : Number(r.deadline_ms),
    nowMs: Number(r.now_ms),
    localAt: Date.now(),
    npc: r.npc ?? null,
  };
}

function mapPlayer(r: Row): Player {
  return {
    id: r.id,
    name: r.name,
    scoreTotal: Number(r.score_total),
    scoreRound: Number(r.score_round),
    online: Boolean(r.online),
    npc: Boolean(r.is_npc),
  };
}

class Raw {
  constructor(public sql: string) {}
}
const NULL = new Raw("NULL");
// 테스트용 시간 배율 (예: GAME_TIME_SCALE=0.1 이면 모든 제한 시간이 1/10)
const TIME_SCALE = Number(process.env.GAME_TIME_SCALE) > 0 ? Number(process.env.GAME_TIME_SCALE) : 1;
const scaled = (s: number) => Math.max(1, Math.round(s * TIME_SCALE));
const inSeconds = (s: number) => new Raw(`now() + interval '${scaled(s)} seconds'`);

const PHASE_SECONDS: Partial<Record<Status, number>> = {
  choosing: RULES.CHOOSE_SECONDS,
  generating: RULES.GENERATING_SECONDS,
  drawing: RULES.DRAW_SECONDS,
  reveal: RULES.REVEAL_SECONDS,
  round_end: RULES.ROUND_END_SECONDS,
};

/** version이 그대로일 때만 방 상태를 바꿈 (여러 폴링 요청이 동시에 와도 한 번만 전이) */
async function transition(room: Room, fields: Record<string, unknown>): Promise<Room | null> {
  const params: unknown[] = [room.code, room.version];
  const sets = Object.entries(fields).map(([col, v]) => {
    if (v instanceof Raw) return `${col} = ${v.sql}`;
    params.push(JSON_COLS.has(col) ? JSON.stringify(v) : v);
    return `${col} = $${params.length}${JSON_COLS.has(col) ? "::jsonb" : ""}`;
  });
  const rows = await query(
    `UPDATE rooms SET ${sets.join(", ")}, version = version + 1, updated_at = now()
     WHERE code = $1 AND version = $2 RETURNING ${ROOM_COLS}`,
    params,
  );
  return rows[0] ? mapRoom(rows[0]) : null;
}

type Msg = { playerId?: string | null; name?: string | null; kind: "chat" | "correct" | "system" | "hint" | "explain" | "pengsoo"; text: string };

function messagesQuery(code: string, msgs: Msg[]): Query {
  const params: unknown[] = [code];
  const values = msgs.map((m) => {
    params.push(m.playerId ?? null, m.name ?? null, m.kind, m.text);
    const n = params.length;
    return `($1, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
  });
  return [`INSERT INTO messages (room_code, player_id, name, kind, text) VALUES ${values.join(", ")}`, params];
}

async function addMessages(code: string, ...msgs: Msg[]) {
  if (msgs.length) await query(...messagesQuery(code, msgs));
}

async function loadRoom(code: string) {
  const rows = await query(`SELECT ${ROOM_COLS} FROM rooms WHERE code = $1`, [code]);
  if (!rows[0]) throw new GameError("방을 찾을 수 없어요. 방 코드를 확인해 주세요.", 404);
  return mapRoom(rows[0]);
}

async function loadPlayers(code: string) {
  return (await query(PLAYERS_SQL, [code])).map(mapPlayer);
}

async function loadRoomAndPlayers(code: string) {
  const [roomRows, playerRows] = await batch([
    [`SELECT ${ROOM_COLS} FROM rooms WHERE code = $1`, [code]],
    [PLAYERS_SQL, [code]],
  ]);
  if (!roomRows[0]) throw new GameError("방을 찾을 수 없어요. 방 코드를 확인해 주세요.", 404);
  return { room: mapRoom(roomRows[0]), players: playerRows.map(mapPlayer) };
}

function nameOf(players: Player[], id: string | null) {
  return players.find((p) => p.id === id)?.name ?? "알 수 없음";
}

/** 참가 순서상 current 다음의 접속 중인 사람 */
function nextLeader(players: Player[], currentId: string | null): string | null {
  const n = players.length;
  if (!n) return null;
  const idx = players.findIndex((p) => p.id === currentId);
  for (let k = 1; k <= n; k++) {
    const p = players[(idx + k + n) % n];
    if (p.online && p.id !== currentId) return p.id;
  }
  return players.find((p) => p.online)?.id ?? currentId;
}

export function minPlayers() {
  const v = Number(process.env.MIN_PLAYERS);
  return Number.isFinite(v) && v >= 1 ? Math.min(v, RULES.MAX_PLAYERS) : RULES.MIN_PLAYERS_DEFAULT;
}

// ─────────────────────────── 입력 검증 ───────────────────────────

export function validPlayerId(id: unknown): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new GameError("잘못된 사용자 정보예요.", 400);
  return id;
}

export function validCode(code: unknown): string {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new GameError("방 코드는 6자리 숫자예요.", 400);
  return code;
}

function validName(name: unknown): string {
  const n = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, RULES.NAME_MAX) : "";
  if (!n) throw new GameError("닉네임을 입력해 주세요.");
  return n;
}

// ─────────────────────────── 게임 진행 ───────────────────────────

async function startQuestion(room: Room, players: Player[], words: Word[], questionNo: number, extra: Record<string, unknown> = {}) {
  const word = words[questionNo - 1];
  if (!word) return null;
  const seq = room.seq + 1;
  const drawMs = scaled(RULES.DRAW_SECONDS) * 1000;
  const leader = players.find((p) => p.id === room.leaderId);
  const npcs = players.filter((p) => p.npc && p.id !== room.leaderId);
  const humanGuessers = players.filter((p) => !p.npc && p.online && p.id !== room.leaderId).length;
  const dbNow = room.nowMs + (Date.now() - room.localAt);
  const npc: NpcState | null =
    npcs.length || leader?.npc
      ? {
          seq,
          guessers: planGuessers(npcs.map((p) => p.id), dbNow, drawMs, humanGuessers),
          draw: { status: leader?.npc ? "pending" : "none" },
        }
      : null;
  const r = await transition(room, {
    ...extra,
    npc: npc ?? NULL,
    npc_strokes: NULL,
    status: "drawing",
    words,
    question_no: questionNo,
    seq,
    current_word: word,
    hints_revealed: 0,
    wrong_count: 0,
    last_result: NULL,
    deadline: inSeconds(RULES.DRAW_SECONDS),
  });
  if (!r) return null;
  await batch([
    [`DELETE FROM strokes WHERE room_code = $1 AND seq < $2`, [room.code, seq]],
    messagesQuery(room.code, [
      {
        kind: "system",
        text: `✏️ ${r.round}라운드 ${r.setNo}세트 ${questionNo}번 문제! ${nim(nameOf(players, r.leaderId))}이 그림을 그려요.`,
      },
    ]),
  ]);
  if (leader?.npc) {
    // NPC가 리더면 응답 후에 AI로 그림을 만들어 조금씩 칠판에 그림
    const topic = topicName(r.topic);
    after(() => npcDraw(r.code, seq, word.word, topic, leader.name));
  }
  return r;
}

async function npcDraw(code: string, seq: number, word: string, topic: string, npcName: string) {
  const setDraw = (drawSql: string, params: unknown[], extraSet = "") =>
    query(
      `UPDATE rooms SET ${extraSet} npc = jsonb_set(npc, '{draw}', ${drawSql})
       WHERE code = $1 AND seq = $2 AND status = 'drawing' AND npc IS NOT NULL`,
      [code, seq, ...params],
    );
  try {
    const ops = await aiDrawing(word, topic);
    const stepMs = Math.max(150, Math.round((Math.min(45_000, ops.length * 1800) * TIME_SCALE) / ops.length));
    await setDraw(
      `jsonb_build_object('status', 'ready', 'done', 0, 'total', $4::int, 'step', $5::int, 'start', (extract(epoch from now()) * 1000)::float8)`,
      [JSON.stringify(ops), ops.length, stepMs],
      "npc_strokes = $3::jsonb,",
    );
  } catch (e) {
    console.error("[npc] AI 그림 실패:", e instanceof Error ? e.message : e);
    await setDraw(`jsonb_build_object('status', 'failed', 'start', (extract(epoch from now()) * 1000)::float8)`, []);
    await addMessages(code, { kind: "pengsoo", text: `${npcName}가 그림이 잘 안 그려진대! 대신 펭수가 힌트를 자주 줄게!` });
  }
}

/** NPC들의 오답·정답, NPC 리더의 그림 진행, NPC 그림일 때 시간 힌트 */
async function npcTick(room: Room, players: Player[]): Promise<Room | null> {
  const npc = room.npc;
  const cw = room.currentWord;
  if (!npc || npc.seq !== room.seq || !cw) return null;
  const now = room.nowMs;
  const drawMs = scaled(RULES.DRAW_SECONDS) * 1000;
  const next: NpcState = JSON.parse(JSON.stringify(npc));
  const d = next.draw;
  const leader = players.find((p) => p.id === room.leaderId);

  let strokeRange: [number, number] | null = null;
  if (d.status === "ready" && d.start != null && d.step && d.total) {
    const due = Math.min(d.total, Math.floor((now - d.start) / d.step) + 1);
    if (due > (d.done ?? 0)) {
      strokeRange = [d.done ?? 0, due];
      d.done = due;
    }
  }
  // NPC 그림은 60% 이상 그려진 뒤에야 다른 NPC가 맞힐 수 있음
  const canSolve =
    d.status === "none" || d.status === "failed" || (d.status === "ready" && (d.done ?? 0) >= Math.ceil((d.total ?? 0) * 0.6));

  let solver: Player | null = null;
  const wrongs: Player[] = [];
  for (const [id, g] of Object.entries(next.guessers)) {
    const p = players.find((x) => x.id === id);
    if (!p || id === room.leaderId) continue;
    if (!solver && canSolve && g.solve !== null && now >= g.solve) solver = p;
    else if (d.status !== "pending" && now >= g.next) {
      wrongs.push(p);
      g.next = now + nextGuessDelay(drawMs);
    }
  }

  let timedHint = false;
  if (leader?.npc && d.start != null && (d.status === "ready" || d.status === "failed")) {
    const every = drawMs * (d.status === "failed" ? 0.15 : 0.22);
    const h = room.hintsRevealed;
    if (h < Math.min(RULES.MAX_HINTS, cw.hints.length) && now - d.start >= (h + 1) * every) timedHint = true;
  }

  if (strokeRange || solver || wrongs.length) {
    // 여러 폴링 요청이 동시에 처리해도 한 번만 실행되도록 선점
    const claimed = await query(
      `UPDATE rooms SET npc = $3::jsonb WHERE code = $1 AND seq = $2 AND status = 'drawing' AND npc = $4::jsonb RETURNING 1`,
      [room.code, room.seq, JSON.stringify(next), JSON.stringify(npc)],
    );
    if (!claimed[0]) return null;
  } else if (!timedHint) {
    return null;
  }

  if (strokeRange) {
    await query(
      `INSERT INTO strokes (room_code, seq, data)
       SELECT $1, $2, x.value FROM rooms r
       CROSS JOIN LATERAL jsonb_array_elements(r.npc_strokes) WITH ORDINALITY AS x(value, ord)
       WHERE r.code = $1 AND x.ord > $3 AND x.ord <= $4
       ORDER BY x.ord`,
      [room.code, room.seq, strokeRange[0], strokeRange[1]],
    );
  }
  if (solver) return endQuestion(room, players, solver, "correct");

  for (const p of wrongs) {
    const text = npcGuessText(room.topic, cw.word, room.words.map((w) => w.word));
    const [, updated] = await batch([
      messagesQuery(room.code, [{ kind: "chat", playerId: p.id, name: p.name, text }]),
      [
        `UPDATE rooms SET wrong_count = wrong_count + 1 WHERE code = $1 AND status = 'drawing' AND seq = $2 RETURNING wrong_count, hints_revealed`,
        [room.code, room.seq],
      ],
    ]);
    if (updated[0]) await pengsooReact(room, p, Number(updated[0].wrong_count), Number(updated[0].hints_revealed), false);
  }
  if (timedHint) await revealHintAt(room, room.hintsRevealed);
  return null;
}

async function chooseTopic(room: Room, players: Player[], topic: TopicId, difficulty: Difficulty, auto: boolean) {
  const g = await transition(room, {
    status: "generating",
    topic,
    difficulty,
    deadline: inSeconds(RULES.GENERATING_SECONDS),
  });
  if (!g) return null;
  const who = nameOf(players, g.leaderId);
  await addMessages(
    g.code,
    {
      kind: "system",
      text: auto
        ? `⏳ 시간이 지나 주제를 자동으로 골랐어요: ${topicName(topic)} (${difficultyName(difficulty)})`
        : `📚 ${nim(who)}이 '${topicName(topic)} (${difficultyName(difficulty)})' 주제를 골랐어요!`,
    },
    { kind: "pengsoo", text: pengsooLines.topicPicked(topicName(topic)) },
  );
  const { words } = await generateWords(topic, difficulty, g.usedWords);
  const used = [...g.usedWords, ...words.map((w) => w.word)].slice(-300);
  return startQuestion(g, players, words, 1, { used_words: used });
}

async function endQuestion(room: Room, players: Player[], winner: Player | null, reason: LastResult["reason"]) {
  const cw = room.currentWord;
  if (!cw) return null;
  const points = winner ? Math.max(RULES.MIN_GUESS_POINTS, RULES.GUESS_POINTS - RULES.HINT_PENALTY * room.hintsRevealed) : 0;
  const drawerPoints = winner ? RULES.DRAWER_POINTS : 0;
  const result: LastResult = {
    word: cw.word,
    explain: cw.explain,
    winnerId: winner?.id ?? null,
    winnerName: winner?.name ?? null,
    drawerId: room.leaderId,
    drawerName: nameOf(players, room.leaderId),
    points,
    drawerPoints,
    reason,
  };
  const r = await transition(room, {
    status: "reveal",
    leader_id: winner ? winner.id : nextLeader(players, room.leaderId),
    last_result: result,
    deadline: inSeconds(RULES.REVEAL_SECONDS),
  });
  if (!r) return null;

  const msgs: Msg[] = [];
  if (reason === "correct" && winner) {
    msgs.push({ kind: "correct", playerId: winner.id, name: winner.name, text: `🎉 ${nim(winner.name)}이 정답 ${josa(`'${cw.word}'`, "을", "를")} 맞혔어요! (+${points}점)` });
    const topic = topicName(room.topic);
    // 응답을 늦추지 않도록 AI 펭수의 축하 한마디는 응답 후에 생성
    after(async () => {
      const text = await pengsooCheer(winner.name, cw.word, topic);
      await addMessages(room.code, { kind: "pengsoo", text });
    });
  } else if (reason === "timeout") {
    msgs.push({ kind: "system", text: `⏰ 시간이 다 됐어요! 정답은 '${cw.word}'였어요.` });
    msgs.push({ kind: "pengsoo", text: pengsooLines.timeout(cw.word) });
  } else {
    msgs.push({ kind: "system", text: `🚪 그리는 사람이 나가서 문제를 넘겨요. 정답은 '${cw.word}'였어요.` });
  }
  if (cw.explain) msgs.push({ kind: "explain", text: `${cw.word} — ${cw.explain}` });

  const qs: Query[] = [messagesQuery(room.code, msgs)];
  if (winner) {
    qs.push([
      `UPDATE players SET
         score_total = score_total + CASE WHEN id = $2 THEN $3::int ELSE $4::int END,
         score_round = score_round + CASE WHEN id = $2 THEN $3::int ELSE $4::int END
       WHERE room_code = $1 AND id IN ($2, $5)`,
      [room.code, winner.id, points, drawerPoints, room.leaderId ?? ""],
    ]);
  }
  await batch(qs);
  return r;
}

async function advance(room: Room, players: Player[]) {
  if (room.questionNo < RULES.QUESTIONS_PER_SET) {
    return startQuestion(room, players, room.words, room.questionNo + 1);
  }
  if (room.setNo < RULES.SETS_PER_ROUND) {
    const r = await transition(room, {
      status: "choosing",
      set_no: room.setNo + 1,
      question_no: 0,
      current_word: NULL,
      deadline: inSeconds(RULES.CHOOSE_SECONDS),
    });
    if (r) await addMessages(r.code, { kind: "system", text: `🔄 주제 하나를 끝냈어요! 다음 주제는 ${nim(nameOf(players, r.leaderId))}이 골라요.` });
    return r;
  }
  if (room.round < RULES.ROUNDS) {
    const r = await transition(room, { status: "round_end", current_word: NULL, deadline: inSeconds(RULES.ROUND_END_SECONDS) });
    if (r)
      await addMessages(
        r.code,
        { kind: "system", text: `🏁 ${r.round}라운드가 끝났어요! 순위를 확인해 보세요.` },
        { kind: "pengsoo", text: pengsooLines.roundEnd(r.round) },
      );
    return r;
  }
  const r = await transition(room, { status: "game_end", current_word: NULL, deadline: NULL });
  if (r)
    await addMessages(
      r.code,
      { kind: "system", text: `🏆 3라운드가 모두 끝났어요! 최종 순위를 확인해 보세요.` },
      { kind: "pengsoo", text: pengsooLines.gameEnd() },
    );
  return r;
}

async function nextRound(room: Room, players: Player[]) {
  const r = await transition(room, {
    status: "choosing",
    round: room.round + 1,
    set_no: 1,
    question_no: 0,
    deadline: inSeconds(RULES.CHOOSE_SECONDS),
  });
  if (!r) return null;
  await batch([
    [`UPDATE players SET score_round = 0 WHERE room_code = $1`, [r.code]],
    messagesQuery(r.code, [{ kind: "system", text: `🚀 ${r.round}라운드 시작! ${nim(nameOf(players, r.leaderId))}이 주제를 골라요.` }]),
  ]);
  return r;
}

/** 폴링 시점에 마감 시간·접속 끊김을 확인해 필요한 전이를 수행 */
async function step(room: Room, players: Player[]): Promise<Room | null> {
  const online = players.filter((p) => p.online);
  const humans = online.filter((p) => !p.npc);
  if (!humans.length) return null;
  const isOnline = (id: string | null) => online.some((p) => p.id === id);
  const expired = room.deadlineMs !== null && room.nowMs >= room.deadlineMs;

  if (!humans.some((p) => p.id === room.hostId)) {
    const r = await transition(room, { host_id: humans[0].id });
    if (r) await addMessages(r.code, { kind: "system", text: `👑 ${nim(humans[0].name)}이 새 방장이 되었어요.` });
    return r;
  }
  const leaderIsNpc = players.some((p) => p.id === room.leaderId && p.npc);

  switch (room.status) {
    case "choosing":
      if (!isOnline(room.leaderId)) {
        const next = nextLeader(players, room.leaderId);
        const r = await transition(room, { leader_id: next, deadline: inSeconds(RULES.CHOOSE_SECONDS) });
        if (r) await addMessages(r.code, { kind: "system", text: `🔁 ${nim(nameOf(players, next))}이 대신 주제를 골라요.` });
        return r;
      }
      if (expired) return chooseTopic(room, players, randomTopic(), room.difficulty ?? "medium", true);
      // NPC 리더는 잠깐 고민하는 척하고 주제를 고름
      if (leaderIsNpc && room.deadlineMs !== null && room.nowMs >= room.deadlineMs - (scaled(RULES.CHOOSE_SECONDS) - 3 * TIME_SCALE) * 1000) {
        return chooseTopic(room, players, randomTopic(), room.difficulty ?? "medium", false);
      }
      return null;
    case "generating":
      if (expired) return transition(room, { status: "choosing", deadline: inSeconds(RULES.CHOOSE_SECONDS) });
      return null;
    case "drawing":
      if (!isOnline(room.leaderId)) return endQuestion(room, players, null, "left");
      if (expired) return endQuestion(room, players, null, "timeout");
      return npcTick(room, players);
    case "reveal":
      if (expired) return advance(room, players);
      return null;
    case "round_end":
      if (expired) return nextRound(room, players);
      return null;
    default:
      return null;
  }
}

// ─────────────────────────── API에서 쓰는 동작 ───────────────────────────

export async function createRoom(playerIdRaw: unknown, nameRaw: unknown) {
  const playerId = validPlayerId(playerIdRaw);
  const name = validName(nameRaw);
  // 오래된 방 정리
  await query(
    `DELETE FROM rooms r WHERE r.updated_at < now() - interval '6 hours'
     AND NOT EXISTS (SELECT 1 FROM players p WHERE p.room_code = r.code AND p.last_seen > now() - interval '1 hour')`,
  );
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const rows = await query(`INSERT INTO rooms (code, host_id, leader_id) VALUES ($1, $2, $2) ON CONFLICT DO NOTHING RETURNING code`, [
      code,
      playerId,
    ]);
    if (rows[0]) {
      await batch([
        [`INSERT INTO players (room_code, id, name) VALUES ($1, $2, $3)`, [code, playerId, name]],
        messagesQuery(code, [{ kind: "system", text: `🏠 ${nim(name)}이 방을 만들었어요. 친구들에게 방 코드 ${code}를 알려 주세요!` }]),
      ]);
      return { code };
    }
  }
  throw new GameError("방을 만들지 못했어요. 다시 시도해 주세요.", 500);
}

export async function joinRoom(codeRaw: unknown, playerIdRaw: unknown, nameRaw: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const wanted = validName(nameRaw);
  let { room, players } = await loadRoomAndPlayers(code);

  const me = players.find((p) => p.id === playerId);
  if (me) {
    await query(`UPDATE players SET last_seen = now() WHERE room_code = $1 AND id = $2`, [code, playerId]);
    return { ok: true, name: me.name };
  }

  if (players.length >= RULES.MAX_PLAYERS) {
    await query(`DELETE FROM players WHERE room_code = $1 AND last_seen < now() - interval '2 minutes'`, [code]);
    players = await loadPlayers(code);
  }
  // 대기실에서 자리가 없으면 NPC가 사람에게 자리를 비켜 줌
  const npcSeat = [...players].reverse().find((p) => p.npc);
  if (players.length >= RULES.MAX_PLAYERS && room.status === "lobby" && npcSeat) {
    await query(`DELETE FROM players WHERE room_code = $1 AND id = $2 AND is_npc`, [code, npcSeat.id]);
    players = players.filter((p) => p.id !== npcSeat.id);
  }
  if (players.length >= RULES.MAX_PLAYERS) throw new GameError(`방이 가득 찼어요. (최대 ${RULES.MAX_PLAYERS}명)`, 409);

  const taken = new Set(players.map((p) => p.name));
  let name = wanted;
  for (let i = 2; taken.has(name); i++) name = `${wanted.slice(0, RULES.NAME_MAX - String(i).length)}${i}`;

  await batch([
    [`INSERT INTO players (room_code, id, name) VALUES ($1, $2, $3) ON CONFLICT (room_code, id) DO UPDATE SET last_seen = now()`, [code, playerId, name]],
    messagesQuery(code, [{ kind: "system", text: `👋 ${nim(name)}이 들어왔어요.` }]),
  ]);
  return { ok: true, name };
}

export async function leaveRoom(codeRaw: unknown, playerIdRaw: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const rows = await query(`DELETE FROM players WHERE room_code = $1 AND id = $2 RETURNING name`, [code, playerId]);
  if (rows[0]) {
    const left = await query(`SELECT count(*)::int AS n FROM players WHERE room_code = $1 AND NOT is_npc`, [code]);
    if (Number(left[0]?.n) === 0) await query(`DELETE FROM rooms WHERE code = $1`, [code]);
    else await addMessages(code, { kind: "system", text: `🚪 ${nim(rows[0].name)}이 나갔어요.` });
  }
  return { ok: true };
}

export async function startGame(codeRaw: unknown, playerIdRaw: unknown, fillNpc: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  let { room, players } = await loadRoomAndPlayers(code);
  if (room.hostId !== playerId) throw new GameError("방장만 게임을 시작할 수 있어요.", 403);
  if (room.status !== "lobby") throw new GameError("이미 게임이 진행 중이에요.", 409);
  const need = minPlayers();
  const short = need - players.filter((p) => p.online).length;
  if (short > 0 && fillNpc === true) {
    await addNpcs(code, players, short);
    ({ room, players } = await loadRoomAndPlayers(code));
  }
  if (players.filter((p) => p.online).length < need) {
    throw new GameError(`${need}명 이상 모여야 시작할 수 있어요. NPC 친구를 추가해 보세요!`);
  }
  const r = await transition(room, {
    status: "choosing",
    round: 1,
    set_no: 1,
    question_no: 0,
    leader_id: room.hostId,
    topic: NULL,
    difficulty: NULL,
    current_word: NULL,
    last_result: NULL,
    deadline: inSeconds(RULES.CHOOSE_SECONDS),
  });
  if (!r) throw new GameError("잠시 후 다시 시도해 주세요.", 409);
  await batch([
    [`UPDATE players SET score_total = 0, score_round = 0 WHERE room_code = $1`, [code]],
    messagesQuery(code, [
      { kind: "system", text: `🎮 게임 시작! 첫 번째 주제는 ${nim(nameOf(players, r.leaderId))}이 골라요.` },
      { kind: "pengsoo", text: pengsooLines.gameStart(nameOf(players, r.leaderId)) },
    ]),
  ]);
  return { ok: true };
}

async function addNpcs(code: string, players: Player[], count: number) {
  const taken = new Set(players.map((p) => p.name));
  const limit = Math.min(count, Math.max(0, RULES.MAX_PLAYERS - players.length));
  const names: string[] = [];
  for (const n of NPC_NAMES) if (names.length < limit && !taken.has(n)) names.push(n);
  for (let i = 1; names.length < limit; i++) if (!taken.has(`로봇 ${i}호`)) names.push(`로봇 ${i}호`);
  if (!names.length) return [];
  const params: unknown[] = [code];
  const values = names.map((n) => {
    params.push(newNpcId(), n);
    return `($1, $${params.length - 1}, $${params.length}, true)`;
  });
  await batch([
    [`INSERT INTO players (room_code, id, name, is_npc) VALUES ${values.join(", ")}`, params],
    messagesQuery(code, names.map((n) => ({ kind: "system" as const, text: `🤖 NPC ${nim(n)}이 들어왔어요.` }))),
  ]);
  return names;
}

/** 방장이 대기실에서 NPC(로봇 친구)를 넣거나 뺌 */
export async function manageNpc(codeRaw: unknown, playerIdRaw: unknown, action: unknown, npcId: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const { room, players } = await loadRoomAndPlayers(code);
  if (room.hostId !== playerId) throw new GameError("방장만 NPC를 추가하거나 뺄 수 있어요.", 403);
  if (room.status !== "lobby") throw new GameError("NPC는 대기실에서만 바꿀 수 있어요.", 409);
  if (action === "add") {
    if (players.length >= RULES.MAX_PLAYERS) throw new GameError(`방이 가득 찼어요. (최대 ${RULES.MAX_PLAYERS}명)`, 409);
    await addNpcs(code, players, 1);
  } else if (action === "remove") {
    const rows = await query(`DELETE FROM players WHERE room_code = $1 AND id = $2 AND is_npc RETURNING name`, [code, String(npcId)]);
    if (rows[0]) await addMessages(code, { kind: "system", text: `🤖 NPC ${nim(rows[0].name)}이 나갔어요.` });
  } else {
    throw new GameError("알 수 없는 요청이에요.");
  }
  return { ok: true };
}

export async function selectTopic(codeRaw: unknown, playerIdRaw: unknown, topic: unknown, difficulty: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  if (!isTopic(topic) || !isDifficulty(difficulty)) throw new GameError("주제와 난이도를 골라 주세요.");
  const { room, players } = await loadRoomAndPlayers(code);
  if (room.status !== "choosing") throw new GameError("지금은 주제를 고를 수 없어요.", 409);
  if (room.leaderId !== playerId) throw new GameError("리더만 주제를 고를 수 있어요.", 403);
  const r = await chooseTopic(room, players, topic, difficulty, false);
  if (!r) throw new GameError("주제를 고르지 못했어요. 다시 시도해 주세요.", 409);
  return { ok: true };
}

export async function hostNext(codeRaw: unknown, playerIdRaw: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const { room, players } = await loadRoomAndPlayers(code);
  if (room.hostId !== playerId) throw new GameError("방장만 할 수 있어요.", 403);
  if (room.status === "round_end") {
    if (!(await nextRound(room, players))) throw new GameError("잠시 후 다시 시도해 주세요.", 409);
  } else if (room.status === "game_end") {
    const r = await transition(room, {
      status: "lobby",
      round: 0,
      set_no: 0,
      question_no: 0,
      topic: NULL,
      current_word: NULL,
      last_result: NULL,
      deadline: NULL,
    });
    if (!r) throw new GameError("잠시 후 다시 시도해 주세요.", 409);
    await batch([
      [`UPDATE players SET score_total = 0, score_round = 0 WHERE room_code = $1`, [code]],
      [`DELETE FROM strokes WHERE room_code = $1`, [code]],
      messagesQuery(code, [{ kind: "system", text: `🔁 대기실로 돌아왔어요. 방장이 다시 시작할 수 있어요.` }]),
    ]);
  } else {
    throw new GameError("지금은 할 수 없어요.", 409);
  }
  return { ok: true };
}

/** 오답이 쌓이면 AI 펭수가 힌트를 주거나 격려 */
async function pengsooReact(room: Room, me: Player, wrong: number, hints: number, close: boolean) {
  const cw = room.currentWord!;
  const maxHints = Math.min(RULES.MAX_HINTS, cw.hints.length);
  if (wrong % RULES.WRONG_PER_HINT === 0 && hints < maxHints && wrong / RULES.WRONG_PER_HINT > hints) {
    if (await revealHintAt(room, hints)) return;
  }
  if (close) await addMessages(room.code, { kind: "pengsoo", text: pengsooLines.near(me.name) });
  else if (wrong % RULES.WRONG_PER_HINT === 3) await addMessages(room.code, { kind: "pengsoo", text: pengsooLines.encourage() });
}

/** h번째 힌트를 공개 (이미 공개됐으면 false) */
async function revealHintAt(room: Room, h: number) {
  const cw = room.currentWord;
  if (!cw || h >= Math.min(RULES.MAX_HINTS, cw.hints.length)) return false;
  const rows = await query(
    `UPDATE rooms SET hints_revealed = hints_revealed + 1
     WHERE code = $1 AND status = 'drawing' AND seq = $2 AND hints_revealed = $3 RETURNING hints_revealed`,
    [room.code, room.seq, h],
  );
  if (!rows[0]) return false;
  await addMessages(room.code, { kind: "hint", text: pengsooLines.hint(h + 1, cw.hints[h]) });
  return true;
}

function isNearGuess(text: string, w: Word) {
  const g = normalize(text);
  return [w.word, ...w.aliases].some((a) => {
    const n = normalize(a);
    return [...n].length >= 3 && Math.abs([...g].length - [...n].length) <= 1 && editDistance(g, n) === 1;
  });
}

export async function sendChat(codeRaw: unknown, playerIdRaw: unknown, textRaw: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const text = typeof textRaw === "string" ? textRaw.replace(/\s+/g, " ").trim().slice(0, RULES.CHAT_MAX) : "";
  if (!text) throw new GameError("메시지를 입력해 주세요.");
  const { room, players } = await loadRoomAndPlayers(code);
  const me = players.find((p) => p.id === playerId && !p.npc);
  if (!me) throw new GameError("방에 참가하지 않았어요.", 403);

  const chat = messagesQuery(code, [{ kind: "chat", playerId, name: me.name, text }]);
  const cw = room.currentWord;
  if (room.status === "drawing" && cw) {
    if (playerId === room.leaderId) {
      const t = normalize(text);
      if ([cw.word, ...cw.aliases].some((a) => normalize(a) && t.includes(normalize(a)))) {
        throw new GameError("그림 그리는 사람은 정답을 채팅에 쓸 수 없어요! 🤫");
      }
    } else if (isCorrectGuess(text, cw)) {
      const r = await endQuestion(room, players, me, "correct");
      if (r) return { ok: true, correct: true, points: r.lastResult?.points ?? 0 };
      return { ok: true, late: true };
    } else {
      const [, updated] = await batch([
        chat,
        [
          `UPDATE rooms SET wrong_count = wrong_count + 1 WHERE code = $1 AND status = 'drawing' AND seq = $2
           RETURNING wrong_count, hints_revealed`,
          [code, room.seq],
        ],
      ]);
      const close = isNearGuess(text, cw);
      if (updated[0]) await pengsooReact(room, me, Number(updated[0].wrong_count), Number(updated[0].hints_revealed), close);
      return { ok: true, close };
    }
  }
  await query(...chat);
  return { ok: true };
}

export type StrokeOp =
  | { t: "d"; s: number; c: string; w: number; p: [number, number][] }
  | { t: "clear" }
  | { t: "undo" };

function validOps(ops: unknown): StrokeOp[] {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 200) throw new GameError("잘못된 그림 데이터예요.");
  return ops.map((o) => {
    const op = o as Record<string, unknown>;
    if (op?.t === "clear" || op?.t === "undo") return { t: op.t };
    if (op?.t !== "d" || !Array.isArray(op.p) || op.p.length === 0 || op.p.length > 1000) throw new GameError("잘못된 그림 데이터예요.");
    // "erase" = 칠판지우개
    const c = op.c === "erase" || (typeof op.c === "string" && /^#[0-9a-fA-F]{6}$/.test(op.c)) ? (op.c as string) : "#ffffff";
    const w = Math.min(80, Math.max(1, Number(op.w) || 4));
    const p = (op.p as unknown[]).map((pt) => {
      const [x, y] = Array.isArray(pt) ? pt : [0, 0];
      return [Math.round(Math.min(800, Math.max(0, Number(x) || 0))), Math.round(Math.min(600, Math.max(0, Number(y) || 0)))] as [number, number];
    });
    return { t: "d", s: Math.floor(Number(op.s) || 0), c, w, p };
  });
}

export async function addStrokes(codeRaw: unknown, playerIdRaw: unknown, seqRaw: unknown, opsRaw: unknown) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const seq = Number(seqRaw);
  const ops = validOps(opsRaw);
  const rows = await query(
    `INSERT INTO strokes (room_code, seq, data)
     SELECT $1, $2, x.value FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY AS x(value, ord)
     WHERE EXISTS (SELECT 1 FROM rooms WHERE code = $1 AND seq = $2 AND status = 'drawing' AND leader_id = $4)
       AND NOT EXISTS (SELECT 1 FROM players WHERE room_code = $1 AND id = $4 AND is_npc)
     ORDER BY x.ord
     RETURNING id`,
    [code, seq, JSON.stringify(ops), playerId],
  );
  if (!rows.length) throw new GameError("지금은 그릴 수 없어요.", 409);
  return { ok: true };
}

// ─────────────────────────── 상태 조회 ───────────────────────────

export type ChatMessage = { id: number; playerId: string | null; name: string | null; kind: Msg["kind"]; text: string };

export async function getState(codeRaw: unknown, playerIdRaw: unknown, clientSeq: number, strokeAfter: number, msgAfter: number) {
  const code = validCode(codeRaw);
  const playerId = validPlayerId(playerIdRaw);
  const [, roomRows, playerRows] = await batch([
    [`UPDATE players SET last_seen = now() WHERE room_code = $1 AND id = $2`, [code, playerId]],
    [`SELECT ${ROOM_COLS} FROM rooms WHERE code = $1`, [code]],
    [PLAYERS_SQL, [code]],
  ]);
  if (!roomRows[0]) throw new GameError("방을 찾을 수 없어요. 방 코드를 확인해 주세요.", 404);
  let room = mapRoom(roomRows[0]);
  let players = playerRows.map(mapPlayer);
  if (!players.some((p) => p.id === playerId && !p.npc)) return { joined: false as const };

  let changed = false;
  for (let i = 0; i < 4; i++) {
    const next = await step(room, players);
    if (!next) break;
    room = next;
    changed = true;
  }

  const showStrokes = room.status === "drawing" || room.status === "reveal";
  const strokeReset = clientSeq !== room.seq;
  const queries: Query[] = [
    msgAfter > 0
      ? [`SELECT id, player_id, name, kind, text FROM messages WHERE room_code = $1 AND id > $2 ORDER BY id LIMIT 200`, [code, msgAfter]]
      : [`SELECT * FROM (SELECT id, player_id, name, kind, text FROM messages WHERE room_code = $1 ORDER BY id DESC LIMIT 60) m ORDER BY id`, [code]],
  ];
  if (showStrokes) {
    queries.push([
      `SELECT id, data FROM strokes WHERE room_code = $1 AND seq = $2 AND id > $3 ORDER BY id LIMIT 5000`,
      [code, room.seq, strokeReset ? 0 : strokeAfter],
    ]);
  }
  if (changed) queries.push([PLAYERS_SQL, [code]]);
  const results = await batch(queries);
  const messages: ChatMessage[] = results[0].map((m) => ({
    id: Number(m.id),
    playerId: m.player_id,
    name: m.name,
    kind: m.kind,
    text: m.text,
  }));
  const strokes = showStrokes ? results[1].map((s) => ({ id: Number(s.id), op: s.data as StrokeOp })) : [];
  if (changed) players = results[results.length - 1].map(mapPlayer);

  const isLeader = room.leaderId === playerId;
  const cw = room.currentWord;
  const drawing = room.status === "drawing";

  return {
    joined: true as const,
    me: playerId,
    serverNow: room.nowMs,
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    round: room.round,
    setNo: room.setNo,
    questionNo: room.questionNo,
    seq: room.seq,
    topic: room.topic,
    difficulty: room.difficulty,
    leaderId: room.leaderId,
    deadline: room.deadlineMs,
    phaseSeconds: PHASE_SECONDS[room.status] ? scaled(PHASE_SECONDS[room.status]!) : null,
    wrongCount: room.wrongCount,
    hintsRevealed: room.hintsRevealed,
    word: drawing && isLeader && cw ? cw.word : null,
    mask: drawing && cw ? wordMask(cw.word) : null,
    hints: drawing && cw ? cw.hints.slice(0, room.hintsRevealed) : [],
    allHints: drawing && isLeader && cw ? cw.hints : [],
    lastResult: room.status === "reveal" ? room.lastResult : null,
    npcDrawStatus: drawing && players.some((p) => p.id === room.leaderId && p.npc) ? (room.npc?.draw.status ?? null) : null,
    players,
    strokes,
    strokeReset,
    messages,
    rules: {
      minPlayers: minPlayers(),
      maxPlayers: RULES.MAX_PLAYERS,
      rounds: RULES.ROUNDS,
      sets: RULES.SETS_PER_ROUND,
      questions: RULES.QUESTIONS_PER_SET,
      wrongPerHint: RULES.WRONG_PER_HINT,
      maxHints: RULES.MAX_HINTS,
    },
  };
}

export type GameState = Extract<Awaited<ReturnType<typeof getState>>, { joined: true }>;
