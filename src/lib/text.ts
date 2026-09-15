/** 정답 비교용 정규화: 공백·문장부호 제거, 영문 소문자 */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export function isHangulSyllable(ch: string) {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

export function choseong(word: string) {
  return [...word]
    .map((ch) => (isHangulSyllable(ch) ? CHO[Math.floor((ch.charCodeAt(0) - 0xac00) / 588)] : ch))
    .join("");
}

/** 두 문자열의 편집 거리 (짧은 단어용) */
export function editDistance(a: string, b: string) {
  const A = [...a];
  const B = [...b];
  const dp = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= B.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (A[i - 1] === B[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[B.length];
}

/** 참가자에게 보여줄 글자 수 모양. 예) "첨성대" → "○○○", "apple pie" → "_____ ___" */
export function wordMask(word: string) {
  return [...word].map((ch) => (/\s/.test(ch) ? " " : /[a-zA-Z]/.test(ch) ? "_" : "○")).join("");
}

/** 받침 유무에 따라 조사 선택. josa("거미", "을", "를") → "거미를" */
export function josa(word: string, withBatchim: string, withoutBatchim: string) {
  const last = [...word.replace(/['"’”)\]\s]+$/, "")].pop() ?? "";
  if (isHangulSyllable(last)) return word + ((last.charCodeAt(0) - 0xac00) % 28 ? withBatchim : withoutBatchim);
  return `${word}${withBatchim}(${withoutBatchim})`;
}

/** "민수" → "민수님", 이미 "님"으로 끝나면 그대로 */
export function nim(name: string) {
  return name.endsWith("님") ? name : `${name}님`;
}
