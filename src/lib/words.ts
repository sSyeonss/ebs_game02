import { DIFFICULTIES, TOPICS, type Difficulty, type TopicId } from "./topics";
import { choseong, isHangulSyllable, normalize } from "./text";
import { PENGSOO_PERSONA } from "./pengsoo";
import { WORD_BANK } from "./wordbank";

export type Word = {
  word: string;
  aliases: string[];
  hints: string[];
  explain: string;
};

const COUNT = 5;

function pick<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 정답 단어로 기계적으로 만들 수 있는 힌트 (AI 힌트가 부족하거나 정답을 포함할 때 보충용) */
function autoHints(word: string): string[] {
  const first = [...word][0] ?? "";
  const hasHangul = [...word].some(isHangulSyllable);
  return [
    `첫 글자는 '${first}'${hasHangul ? "야" : "(으)로 시작해"}!`,
    hasHangul ? `초성은 '${choseong(word.replace(/\s/g, ""))}'이야!` : `알파벳은 모두 ${word.replace(/\s/g, "").length}개야!`,
  ];
}

function finishHints(word: string, hints: string[]): string[] {
  const n = normalize(word);
  const safe = hints
    .map((h) => String(h ?? "").trim())
    .filter((h) => h && h.length <= 80 && !normalize(h).includes(n))
    .slice(0, 3);
  for (const h of autoHints(word)) if (safe.length < 3) safe.push(h);
  return safe;
}

function bankWords(topic: TopicId, difficulty: Difficulty, exclude: Set<string>, count: number): Word[] {
  const list = WORD_BANK[topic][difficulty];
  const fresh = list.filter(([w]) => !exclude.has(normalize(w)));
  // 단어가 다 떨어지면 다른 난이도, 그래도 없으면 중복 허용
  const others = (Object.keys(WORD_BANK[topic]) as Difficulty[])
    .filter((d) => d !== difficulty)
    .flatMap((d) => WORD_BANK[topic][d])
    .filter(([w]) => !exclude.has(normalize(w)));
  const pool = [...shuffle(fresh), ...shuffle(others), ...shuffle(list)];
  const out: Word[] = [];
  const seen = new Set<string>();
  for (const [word, hint, explain] of pool) {
    if (out.length >= count) break;
    if (seen.has(normalize(word))) continue;
    seen.add(normalize(word));
    out.push({ word, aliases: [], hints: finishHints(word, [hint]), explain });
  }
  return out;
}

async function openAiWords(topic: TopicId, difficulty: Difficulty, exclude: string[]): Promise<Word[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 없음");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const t = TOPICS.find((x) => x.id === topic)!;
  const d = DIFFICULTIES.find((x) => x.id === difficulty)!;
  const areas = shuffle(t.areas).slice(0, 3).join(", ");
  const isEnglish = topic === "english";

  const system = `${PENGSOO_PERSONA}
지금 너는 한국 초등학교 교육과정을 잘 아는 출제자로서 교육용 그림 맞히기 게임 문제를 내. 내용은 반드시 사실에 맞아야 해. 반드시 JSON 객체로만 답해.`;
  const user = `다음 조건으로 그림 맞히기 제시어 ${COUNT}개를 만들어 줘.

- 과목(주제): ${t.name} (${t.desc})
- 수준: 초등학교 ${d.grade} 교육과정에서 배우거나 접하는 수준
- 이번에 골고루 섞을 단원/분야: ${areas}
- 이미 나온 제시어(절대 다시 쓰지 말 것): ${exclude.length ? exclude.slice(-80).join(", ") : "없음"}

제시어 조건:
- 그림으로 그려서 표현할 수 있는 구체적인 명사 (추상적인 개념 금지)
- ${isEnglish ? "영어 단어 1개(소문자, 초등 영어 교과서 수준). 정답도 영어로 맞혀야 함" : "한국어 1~7글자, 교과서에 나오는 표준 표기"}
- 폭력적·무섭거나 아이에게 부적절한 단어 금지, 서로 겹치지 않게

각 제시어마다:
- aliases: 정답으로 인정할 다른 표기 0~3개 (띄어쓰기 차이, 흔한 동의어${isEnglish ? ", 영어 복수형 등. 한국어 뜻은 넣지 말 것" : ""})
- hints: 펭수가 친구들에게 주는 힌트 3개. 1번은 막연하게, 3번으로 갈수록 구체적으로. 펭수 말투의 한국어 한 문장(40자 이내). 제시어나 aliases를 직접 쓰면 안 됨
- explain: 정답 공개 후 펭수가 들려주는 설명. ${d.grade} 아이 눈높이에 맞춘 쉽고 정확한 1~2문장, 펭수 말투(90자 이내). 핵심 개념(무엇인지, 왜 중요한지)을 꼭 담기.${isEnglish ? " 한국어 뜻과 짧은 영어 예문을 포함." : ""}

JSON 형식: {"words":[{"word":"...","aliases":["..."],"hints":["...","...","..."],"explain":"..."}]}`;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
  if (!/^(gpt-5|o\d)/.test(model)) body.temperature = 0.9;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  const raw: unknown[] = Array.isArray(parsed.words) ? parsed.words : [];

  const out: Word[] = [];
  const seen = new Set(exclude.map(normalize));
  for (const item of raw) {
    const r = item as Partial<Word>;
    const word = String(r.word ?? "").trim();
    const n = normalize(word);
    if (!word || word.length > 20 || !n || seen.has(n)) continue;
    seen.add(n);
    const aliases = (Array.isArray(r.aliases) ? r.aliases : [])
      .map((a) => String(a).trim())
      .filter((a) => a && a.length <= 20)
      .slice(0, 3);
    const explain = String(r.explain ?? "").trim().slice(0, 200);
    out.push({ word, aliases, hints: finishHints(word, [...(r.hints ?? [])]), explain });
  }
  return out.slice(0, COUNT);
}

/** 한 세트(5문제)의 제시어 생성. OpenAI 실패 시 내장 단어장으로 채움 */
export async function generateWords(topic: TopicId, difficulty: Difficulty, used: string[]) {
  let words: Word[] = [];
  let source: "ai" | "bank" = "ai";
  try {
    words = await openAiWords(topic, difficulty, used);
  } catch (e) {
    console.error("[words] OpenAI 제시어 생성 실패, 내장 단어장 사용:", e instanceof Error ? e.message : e);
  }
  if (words.length < COUNT) {
    if (words.length === 0) source = "bank";
    const exclude = new Set([...used, ...words.map((w) => w.word)].map(normalize));
    words = [...words, ...bankWords(topic, difficulty, exclude, COUNT - words.length)];
  }
  return { words, source };
}

export function randomTopic(): TopicId {
  return pick(TOPICS).id;
}

/**
 * 정답 판정. 정확히 같거나,
 * - 한글: 두 글자 이상 정답을 포함하고 덧붙인 말이 3글자 이하 ("첨성대요", "첨성대인가?")
 * - 영어: 단어 단위로 일치 ("it's a cat" → cat, 복수형 s 허용)
 */
export function isCorrectGuess(text: string, w: Word) {
  const g = normalize(text);
  if (!g) return false;
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return [w.word, ...w.aliases].some((a) => {
    const n = normalize(a);
    if (!n) return false;
    if (n === g) return true;
    if (/^[a-z]+$/.test(n)) return tokens.some((t) => t === n || t === `${n}s` || t === `${n}es`);
    return [...n].length >= 2 && g.includes(n) && [...g].length - [...n].length <= 3;
  });
}
