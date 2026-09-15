/** NPC(로봇 친구): 사람이 부족할 때 함께 맞히고, 리더가 되면 AI로 칠판에 그림을 그림 */
import type { StrokeOp } from "./game";
import { normalize } from "./text";
import type { TopicId } from "./topics";
import { WORD_BANK } from "./wordbank";

export const NPC_NAMES = ["로봇 똘이", "로봇 콩이", "로봇 별이", "로봇 봄이", "로봇 달이", "로봇 솔이", "로봇 해미", "로봇 누리", "로봇 초롱"];

export type NpcGuesser = { next: number; solve: number | null };
export type NpcDraw = {
  status: "none" | "pending" | "ready" | "failed";
  start?: number;
  step?: number;
  done?: number;
  total?: number;
  hintsGiven?: number;
};
export type NpcState = { seq: number; guessers: Record<string, NpcGuesser>; draw: NpcDraw };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function newNpcId() {
  return `npc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** 문제 시작 시 NPC들이 언제 오답을 말하고 언제 정답을 맞힐지 정함 */
export function planGuessers(npcIds: string[], nowMs: number, drawMs: number, humanGuessers: number) {
  const guessers: Record<string, NpcGuesser> = {};
  for (const id of npcIds) {
    // 사람이 맞힐 기회를 먼저 주도록, 사람이 있으면 NPC는 늦게 맞힘
    const [lo, hi] = humanGuessers > 0 ? [0.5, 0.92] : [0.3, 0.75];
    guessers[id] = {
      next: nowMs + drawMs * rand(0.08, 0.2),
      solve: Math.random() < 0.8 ? nowMs + drawMs * rand(lo, hi) : null,
    };
  }
  return guessers;
}

export function nextGuessDelay(drawMs: number) {
  return drawMs * rand(0.1, 0.22);
}

const CHATTER = ["음... 뭘까?", "알 것 같은데!", "우와, 잘 그린다!", "힌트 주세요~", "어렵다 어려워!", "조금만 더 그려 줘!", "혹시...?"];

/** NPC의 오답(같은 주제의 다른 단어) 또는 잡담 */
export function npcGuessText(topic: TopicId | null, answer: string, avoid: string[]) {
  if (!topic || Math.random() < 0.3) return CHATTER[Math.floor(Math.random() * CHATTER.length)];
  const n = normalize(answer);
  const block = new Set(avoid.map(normalize));
  const pool = Object.values(WORD_BANK[topic])
    .flat()
    .map(([w]) => w)
    .filter((w) => {
      const x = normalize(w);
      return x !== n && !block.has(x) && !x.includes(n) && !n.includes(x);
    });
  if (!pool.length) return CHATTER[0];
  const w = pool[Math.floor(Math.random() * pool.length)];
  return Math.random() < 0.5 ? w : `${w}?`;
}

const COLORS: Record<string, string> = {
  red: "#ff6b6b",
  orange: "#ffa94d",
  yellow: "#ffe066",
  green: "#8ce99a",
  blue: "#74c0fc",
  indigo: "#8c9eff",
  purple: "#d0a2ff",
};

/** OpenAI로 제시어를 선 그림(획 목록)으로 그리기 */
export async function aiDrawing(word: string, topicName: string): Promise<StrokeOp[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 없음");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      // 그림은 gpt-4.1이 mini보다 훨씬 알아보기 쉬움
      model: process.env.OPENAI_DRAW_MODEL || "gpt-4.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You draw simple, recognizable line art for a kids' Pictionary game on an 800x600 chalkboard (x right, y down). Reply with JSON only.",
        },
        {
          role: "user",
          content: `Draw "${word}" (school subject: ${topicName}) so children can guess it.
Rules:
- 8 to 30 strokes. Each stroke is a polyline of 2 to 48 integer points [x, y] within 40..760 (x) and 40..560 (y).
- Use smooth curves: circles/ovals need at least 16 points.
- Draw the main object large and centered, then add 1-3 small helpful details.
- NEVER write letters, numbers, or words.
- Colors: red, orange, yellow, green, blue, indigo, purple. Width 3 to 14.
- Order strokes from the big outline to small details.
JSON: {"strokes":[{"color":"yellow","width":6,"points":[[x,y],[x,y]]}]}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  const raw: unknown[] = Array.isArray(parsed.strokes) ? parsed.strokes.slice(0, 40) : [];
  const ops: StrokeOp[] = [];
  for (const item of raw) {
    const s = item as { color?: string; width?: number; points?: unknown[] };
    const pts = (Array.isArray(s.points) ? s.points : [])
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .slice(0, 80)
      .map(([x, y]) => [Math.round(Math.min(800, Math.max(0, Number(x) || 0))), Math.round(Math.min(600, Math.max(0, Number(y) || 0)))] as [number, number]);
    if (pts.length < 2) continue;
    ops.push({
      t: "d",
      s: ops.length + 1,
      c: COLORS[String(s.color).toLowerCase()] ?? COLORS.yellow,
      w: Math.min(14, Math.max(3, Math.round(Number(s.width) || 6))),
      p: pts,
    });
  }
  if (ops.length < 3) throw new Error("그림 획이 너무 적음");
  return ops;
}
