import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Chalkboard, Pengsoo, usePop, Wall } from "../components";
import { C, F } from "../theme";

const RANK = [
  { medal: "🥇", name: "로봇 똘이", score: 128, color: C.yellow },
  { medal: "🥈", name: "선생님", score: 115, color: "#ced4da" },
  { medal: "🥉", name: "로봇 콩이", score: 96, color: "#e8a36b" },
  { medal: "4", name: "로봇 별이", score: 72, color: "#a5d8ff" },
];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const board = usePop(0, 15);
  const out = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logo = usePop(66, 14);
  const tagline = usePop(84, 14);
  const peng = usePop(96, 11);

  return (
    <Wall>
      {/* 최종 순위 */}
      <div
        style={{
          position: "absolute",
          left: 360,
          top: 150,
          width: 1200,
          padding: "40px 60px",
          background: C.paper,
          borderRadius: 30,
          boxShadow: "0 20px 44px rgba(60,40,20,0.22)",
          opacity: board * (1 - out),
          transform: `scale(${(0.9 + board * 0.1) * (1 - out * 0.15)})`,
        }}
      >
        <div style={{ fontFamily: F.title, fontSize: 80, textAlign: "center", marginBottom: 30 }}>🏆 최종 순위</div>
        {RANK.map((r, i) => {
          const grow = interpolate(frame, [8 + i * 5, 40 + i * 5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 24, height: 118 }}>
              <span style={{ width: 80, fontSize: 60, textAlign: "center", fontFamily: F.title, color: C.inkSoft }}>{r.medal}</span>
              <span style={{ width: 250, fontSize: 52, fontWeight: 700 }}>{r.name}</span>
              <div style={{ flex: 1, height: 64, background: "#f1e6cf", borderRadius: 32, overflow: "hidden" }}>
                <div style={{ width: `${(r.score / 128) * 100 * grow}%`, height: "100%", background: r.color, borderRadius: 32 }} />
              </div>
              <span style={{ width: 130, textAlign: "right", fontFamily: F.title, fontSize: 56, color: C.red }}>{Math.round(r.score * grow)}</span>
            </div>
          );
        })}
      </div>

      {/* 마무리 로고 */}
      {frame >= 60 && (
        <>
          <Chalkboard
            width={1500}
            height={720}
            style={{ left: 210, top: 120, opacity: logo, transform: `scale(${0.85 + logo * 0.15})` }}
          >
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: F.chalk, fontSize: 230, lineHeight: 1, color: C.chalk }}>
                그려서 <span style={{ color: C.yellow }}>배워요!</span>
              </div>
              <div style={{ fontFamily: F.chalk, fontSize: 90, color: C.chalkDim, marginTop: 30, opacity: tagline, transform: `translateY(${(1 - tagline) * 20}px)` }}>
                함께 그리고, 함께 맞히고, 함께 배워요
              </div>
              <div
                style={{
                  marginTop: 44,
                  fontFamily: F.title,
                  fontSize: 52,
                  color: C.ink,
                  background: C.yellow,
                  padding: "10px 44px",
                  borderRadius: 40,
                  opacity: tagline,
                }}
              >
                3~10명 · 초등 1~6학년 · 회원가입 없이 바로!
              </div>
            </div>
          </Chalkboard>
          <Pengsoo size={230} style={{ right: 90, bottom: 60, transform: `translateY(${(1 - peng) * 400}px) rotate(${Math.sin(frame / 7) * 4}deg)` }} />
        </>
      )}
    </Wall>
  );
};
