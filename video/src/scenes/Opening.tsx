import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Bubble, Chalkboard, Pengsoo, usePop, useProgress, Wall } from "../components";
import { C, F } from "../theme";

const TITLE = [..."그려서 "].map((ch) => ({ ch, color: C.chalk })).concat([..."배워요!"].map((ch) => ({ ch, color: C.yellow })));

const Char: React.FC<{ ch: string; color: string; delay: number }> = ({ ch, color, delay }) => {
  const p = usePop(delay, 10);
  return (
    <span
      style={{
        display: "inline-block",
        color,
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * -60}px) rotate(${(1 - p) * -12}deg) scale(${0.6 + p * 0.4})`,
        minWidth: ch === " " ? 70 : undefined,
        textShadow: "0 0 18px rgba(255,255,255,0.18)",
      }}
    >
      {ch}
    </span>
  );
};

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const board = usePop(0, 16);
  const underline = useProgress(50, 72);
  const sub = usePop(68, 14);
  const icons = ["🏯", "🏙️", "🔬", "📚", "🔤", "📐", "🎨"];
  const peng = usePop(92, 11);
  const bubble = usePop(106, 12);
  const wiggle = Math.sin(frame / 6) * 3 * peng;

  return (
    <Wall>
      <Chalkboard
        width={1560}
        height={780}
        style={{
          left: 180,
          top: 90,
          opacity: board,
          transform: `scale(${0.92 + board * 0.08})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: F.chalk, fontSize: 250, lineHeight: 1, marginTop: -40 }}>
            {TITLE.map((t, i) => (
              <Char key={i} ch={t.ch} color={t.color} delay={10 + i * 5} />
            ))}
          </div>
          <svg width={900} height={60} style={{ marginTop: -10 }}>
            <path
              d="M20 34 C 160 12, 300 52, 450 30 S 740 14, 880 32"
              fill="none"
              stroke={C.chalkDim}
              strokeWidth={10}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - underline}
            />
          </svg>
          <div style={{ fontFamily: F.chalk, fontSize: 84, color: C.chalkDim, marginTop: 18, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
            칠판에 그리고, 친구들이 맞히는 교실 그림 퀴즈
          </div>
          <div style={{ display: "flex", gap: 44, marginTop: 36, fontSize: 70 }}>
            {icons.map((ic, i) => {
              const p = interpolate(frame, [78 + i * 4, 90 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <span key={ic} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
                  {ic}
                </span>
              );
            })}
          </div>
        </div>
      </Chalkboard>

      <Pengsoo
        size={260}
        style={{ right: 70, bottom: 40, transform: `translateY(${(1 - peng) * 420}px) rotate(${wiggle}deg)` }}
      />
      <Bubble
        tail="bottom-left"
        style={{
          right: 36,
          bottom: 320,
          fontSize: 64,
          opacity: bubble,
          transform: `scale(${bubble})`,
          transformOrigin: "20% 100%",
        }}
      >
        펭-하!
      </Bubble>
    </Wall>
  );
};
