import React from "react";
import { Headline, usePop, Wall } from "../components";
import { C, F } from "../theme";

const TOPICS = [
  { icon: "🏯", name: "역사", ex: "거북선 · 첨성대", bg: "#ffe3e3" },
  { icon: "🏙️", name: "사회", ex: "신호등 · 지도", bg: "#fff0d6" },
  { icon: "🔬", name: "과학", ex: "화산 · 무지개", bg: "#fff9c4" },
  { icon: "📚", name: "문학", ex: "흥부와 놀부", bg: "#e3f6e3" },
  { icon: "🔤", name: "영어", ex: "apple · rainbow", bg: "#dff0ff" },
  { icon: "📐", name: "수학", ex: "삼각형 · 시계", bg: "#e7e5ff" },
  { icon: "🎨", name: "예체능", ex: "리코더 · 태권도", bg: "#f5e3ff" },
];

const LEVELS = [
  { name: "쉬움", grade: "1~2학년", color: C.green },
  { name: "보통", grade: "3~4학년", color: C.blue },
  { name: "어려움", grade: "5~6학년", color: C.red },
];

export const Intro: React.FC = () => {
  return (
    <Wall>
      <Headline text="교과서 속 개념을 그림으로!" sub="초등 교육과정 7개 주제에서 AI가 제시어를 골라요" top={90} />

      <div style={{ position: "absolute", top: 390, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 28 }}>
        {TOPICS.map((t, i) => {
          const p = usePop(30 + i * 7, 11);
          return (
            <div
              key={t.name}
              style={{
                width: 216,
                height: 300,
                borderRadius: 28,
                background: t.bg,
                border: `4px solid rgba(46,42,37,0.12)`,
                boxShadow: "0 14px 30px rgba(60,40,20,0.16)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: Math.min(1, p * 1.5),
                transform: `translateY(${(1 - p) * 120}px) rotate(${(i % 2 ? 2 : -2) * p}deg)`,
              }}
            >
              <div style={{ fontSize: 110, lineHeight: 1.1 }}>{t.icon}</div>
              <div style={{ fontFamily: F.title, fontSize: 56, marginTop: 14 }}>{t.name}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.inkSoft, marginTop: 4 }}>{t.ex}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", top: 790, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 36 }}>
        {LEVELS.map((l, i) => {
          const p = usePop(95 + i * 8, 12);
          return (
            <div
              key={l.name}
              style={{
                padding: "18px 44px",
                borderRadius: 60,
                background: "#fff",
                border: `6px solid ${l.color}`,
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                opacity: p,
                transform: `scale(${0.5 + p * 0.5})`,
                boxShadow: "0 10px 20px rgba(60,40,20,0.12)",
              }}
            >
              <span style={{ fontFamily: F.title, fontSize: 58, color: l.color }}>{l.name}</span>
              <span style={{ fontSize: 40, fontWeight: 700, color: C.inkSoft }}>{l.grade}</span>
            </div>
          );
        })}
      </div>
    </Wall>
  );
};
