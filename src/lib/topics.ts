export type TopicId = "history" | "society" | "science" | "literature" | "english" | "math" | "arts";
export type Difficulty = "easy" | "medium" | "hard";

export const TOPICS: { id: TopicId; name: string; emoji: string; desc: string; areas: string[] }[] = [
  {
    id: "history",
    name: "역사",
    emoji: "🏯",
    desc: "옛날 사람들, 문화유산, 위인",
    areas: ["선사 시대", "고조선과 삼국 시대", "고려", "조선", "문화유산", "위인과 발명품", "근현대사", "전통 생활 도구"],
  },
  {
    id: "society",
    name: "사회",
    emoji: "🏙️",
    desc: "우리 동네, 경제, 지리, 민주주의",
    areas: ["우리 동네 공공기관", "교통과 통신", "지도와 지리", "경제생활", "민주주의와 선거", "세계 여러 나라", "환경과 지속 가능성", "직업"],
  },
  {
    id: "science",
    name: "과학",
    emoji: "🔬",
    desc: "동식물, 우주, 날씨, 실험",
    areas: ["동물의 생활", "식물의 생활", "날씨와 기후", "지구와 우주", "물질의 성질", "힘과 에너지", "우리 몸", "실험 도구", "화산과 지진"],
  },
  {
    id: "literature",
    name: "문학",
    emoji: "📚",
    desc: "전래동화, 동시, 속담, 국어",
    areas: ["전래동화", "세계 명작 동화", "속담 속 사물", "동시 속 자연", "우리말 표현", "글의 종류", "책과 도서관"],
  },
  {
    id: "english",
    name: "영어",
    emoji: "🔤",
    desc: "영어 단어를 그림으로! (영어로 정답)",
    areas: ["animals", "food", "school", "family and jobs", "weather and seasons", "body", "places", "sports and hobbies", "things at home"],
  },
  {
    id: "math",
    name: "수학",
    emoji: "📐",
    desc: "도형, 측정, 시계, 그래프",
    areas: ["평면도형", "입체도형", "측정 도구", "시각과 시간", "분수와 소수", "그래프와 표", "규칙 찾기", "각도"],
  },
  {
    id: "arts",
    name: "예체능",
    emoji: "🎨",
    desc: "음악·미술·체육",
    areas: ["악기", "음악 기호", "미술 도구", "미술 기법", "구기 운동", "전통 놀이", "체조와 육상", "민속 무용과 전통 음악"],
  },
];

export const DIFFICULTIES: { id: Difficulty; name: string; grade: string }[] = [
  { id: "easy", name: "쉬움", grade: "1~2학년" },
  { id: "medium", name: "보통", grade: "3~4학년" },
  { id: "hard", name: "어려움", grade: "5~6학년" },
];

export function topicName(id: string | null | undefined) {
  return TOPICS.find((t) => t.id === id)?.name ?? "";
}

export function topicEmoji(id: string | null | undefined) {
  return TOPICS.find((t) => t.id === id)?.emoji ?? "";
}

export function difficultyName(id: string | null | undefined) {
  return DIFFICULTIES.find((d) => d.id === id)?.name ?? "";
}

export function isTopic(id: unknown): id is TopicId {
  return TOPICS.some((t) => t.id === id);
}

export function isDifficulty(id: unknown): id is Difficulty {
  return DIFFICULTIES.some((d) => d.id === id);
}

export const RULES = {
  MIN_PLAYERS_DEFAULT: 3,
  MAX_PLAYERS: 10,
  ROUNDS: 3,
  SETS_PER_ROUND: 3,
  QUESTIONS_PER_SET: 5,
  WRONG_PER_HINT: 5,
  MAX_HINTS: 3,
  CHOOSE_SECONDS: 40,
  DRAW_SECONDS: 100,
  REVEAL_SECONDS: 8,
  ROUND_END_SECONDS: 30,
  GENERATING_SECONDS: 45,
  OFFLINE_SECONDS: 20,
  NAME_MAX: 10,
  CHAT_MAX: 60,
  GUESS_POINTS: 10,
  HINT_PENALTY: 2,
  MIN_GUESS_POINTS: 4,
  DRAWER_POINTS: 5,
} as const;
