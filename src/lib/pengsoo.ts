import { josa } from "./text";

/** AI 펭수: 오답 격려, 정답 축하, 힌트·설명을 전하는 캐릭터 */

export const PENGSOO_PERSONA = `너는 EBS 캐릭터 '펭수'야. 남극에서 온 10살 펭귄이고, 우주 대스타를 꿈꾸는 EBS 연습생이야.
당당하고 유쾌하며 친구들을 진심으로 응원해. 초등학생 친구들에게 친근한 반말('~야', '~거든!', '~하자!')로 말하고,
가끔 '펭-하!', '잘한다 잘한다 잘한다!' 같은 말버릇을 써. 쉬운 말만 쓰고, 절대 비꼬거나 놀리지 않아.`;

function pick<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const pengsooLines = {
  gameStart: (leader: string) =>
    pick([
      `펭-하! 나는 AI 펭수야! 오늘은 ${leader} 친구부터 칠판에 그림을 그려 볼까? 모두 힘내자!`,
      `펭-하! 그림 퀴즈 시간이야! 틀려도 괜찮으니까 떠오르는 대로 마음껏 외쳐 봐!`,
    ]),
  topicPicked: (topic: string) =>
    pick([`오, ${topic}! 펭수가 재미있는 문제 준비할게. 잠깐만 기다려 줘!`, `${topic} 좋아! 펭수가 문제 뽑는 중이야~ 두근두근!`]),
  encourage: () =>
    pick([
      "괜찮아 괜찮아! 틀리면서 배우는 거야. 그림을 한 번 더 자세히 봐 봐!",
      "잘한다 잘한다 잘한다! 거의 다 왔어, 계속 도전해 보자!",
      "펭수도 처음엔 다 몰랐어. 떠오르는 단어를 막 말해 봐!",
      "좋아, 생각하는 모습 멋지다! 그림에서 제일 큰 모양이 뭘까?",
      "포기하지 마! 오늘 배운 거랑 연결해서 생각해 봐!",
    ]),
  near: (name: string) =>
    pick([`${name} 친구, 아깝다! 정말 거의 맞았어! 한 글자만 더 생각해 봐!`, `오오! ${name} 친구 거의 다 왔어! 조금만 고쳐 볼까?`]),
  hint: (n: number, hint: string) => `친구들 힘내라고 펭수가 힌트 줄게! 💡 힌트 ${n}: ${hint}`,
  cheer: (winner: string, word: string) =>
    pick([
      `우와! ${winner} 친구가 ${josa(`'${word}'`, "을", "를")} 맞혔어! 잘한다 잘한다 잘한다! 👏`,
      `${winner} 친구 최고야! '${word}' 정답! 펭수가 박수 쳐 줄게! 🎉`,
      `대단해! ${winner} 친구 눈썰미가 우주 대스타급이야! 정답은 '${word}'!`,
    ]),
  timeout: (word: string) =>
    pick([`아쉽다! 정답은 '${word}'였어. 다음 문제는 꼭 맞힐 수 있어!`, `시간 끝! '${word}'였지롱~ 괜찮아, 이렇게 하나 배웠잖아!`]),
  roundEnd: (round: number) => `${round}라운드 끝! 모두 정말 잘했어. 순위보다 오늘 배운 게 더 소중한 거 알지?`,
  gameEnd: () => `펭-바! 오늘 그림 퀴즈 정말 재미있었어. 다들 우주 대스타처럼 멋졌어! 또 놀자!`,
};

/** 정답자를 위한 AI 축하 한마디 (실패 시 기본 문장) */
export async function pengsooCheer(winner: string, word: string, topic: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return pengsooLines.cheer(winner, word);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        max_tokens: 120,
        messages: [
          { role: "system", content: PENGSOO_PERSONA },
          {
            role: "user",
            content: `그림 맞히기 게임에서 '${winner}' 친구가 ${topic} 문제 '${word}'를 맞혔어. 이름을 불러 주며 신나게 축하하는 말을 한 문장(50자 이내)으로 해 줘. 따옴표 없이 문장만.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const text = String(json.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");
    return text && text.length <= 120 ? text : pengsooLines.cheer(winner, word);
  } catch {
    return pengsooLines.cheer(winner, word);
  }
}
