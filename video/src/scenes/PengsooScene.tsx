import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Headline, Pengsoo, usePop, Wall } from "../components";
import { C, F } from "../theme";

const CARDS = [
  { at: 24, tag: "💪 격려", color: C.green, text: "틀려도 괜찮아! 떠오르는 대로 마음껏 외쳐 봐!" },
  { at: 56, tag: "💡 힌트", color: C.blue, text: "오답이 5개 나올 때마다 펭수가 힌트를 줘요" },
  { at: 88, tag: "🎉 축하", color: "#f08c00", text: "로봇 똘이야 진짜 대단해! 척척 맞혀서 펭-하!" },
];

export const PengsooScene: React.FC = () => {
  const frame = useCurrentFrame();
  const peng = usePop(6, 11);
  const answer = usePop(122, 13);
  // 카드가 나올 때마다 펭수가 콩 뛰기
  const hop = [...CARDS.map((c) => c.at), 122].reduce((acc, at) => {
    const t = frame - at;
    return acc + (t >= 0 && t < 12 ? Math.sin((t / 12) * Math.PI) * 26 : 0);
  }, 0);

  return (
    <Wall>
      <Headline text="AI 펭수가 함께 수업해요" top={40} />

      <div style={{ position: "absolute", left: 110, top: 290, width: 400, textAlign: "center" }}>
        <Pengsoo size={380} style={{ position: "relative", transform: `translateY(${(1 - peng) * 300 - hop}px) scale(${0.6 + peng * 0.4})` }} />
        <div
          style={{
            display: "inline-block",
            marginTop: 30,
            fontFamily: F.title,
            fontSize: 50,
            background: C.ink,
            color: C.yellow,
            padding: "8px 36px",
            borderRadius: 40,
            opacity: peng,
          }}
        >
          AI 펭수
        </div>
      </div>

      <div style={{ position: "absolute", left: 610, top: 200, width: 1200, display: "flex", flexDirection: "column", gap: 26 }}>
        {CARDS.map((c) => {
          const p = usePop(c.at, 12);
          return (
            <div
              key={c.tag}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 28,
                background: "#fff",
                border: `5px solid ${C.ink}`,
                borderRadius: 30,
                padding: "22px 34px",
                boxShadow: "0 10px 22px rgba(60,40,20,0.14)",
                opacity: Math.min(1, p * 1.5),
                transform: `translateX(${(1 - p) * 120}px) scale(${0.85 + p * 0.15})`,
                transformOrigin: "0 50%",
              }}
            >
              <span style={{ flexShrink: 0, fontFamily: F.title, fontSize: 40, color: "#fff", background: c.color, padding: "6px 22px", borderRadius: 30 }}>{c.tag}</span>
              <span style={{ fontSize: 46, fontWeight: 700 }}>{c.text}</span>
            </div>
          );
        })}

        <div
          style={{
            marginTop: 8,
            background: C.paper,
            borderRadius: 26,
            padding: "26px 40px 30px",
            boxShadow: "0 18px 40px rgba(60,40,20,0.22)",
            border: `5px solid ${C.blue}`,
            opacity: answer,
            transform: `translateY(${(1 - answer) * 60}px) rotate(${interpolate(answer, [0, 1], [-4, -1])}deg)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontFamily: F.title, fontSize: 40, color: C.blue }}>📘 알고 가요!</span>
            <span style={{ fontFamily: F.title, fontSize: 76, color: C.red }}>태양</span>
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>
            태양은 우리 지구를 따뜻하게 해 주는 큰 불덩어리 펭-하! 없으면 모두 얼어붙어.
          </div>
        </div>
      </div>
    </Wall>
  );
};
