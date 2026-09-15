import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { Chalkboard, Headline, usePop, Wall } from "../components";
import { C, F } from "../theme";

// 칠판(viewBox 1000×560)에 그릴 태양과 집. [path, 그리기 시작 프레임, 끝 프레임]
const circle = (cx: number, cy: number, r: number) => `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx + r - 0.1} ${cy - 0.5}`;
const rays = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return `M ${200 + 82 * Math.cos(a)} ${140 + 82 * Math.sin(a)} L ${200 + 118 * Math.cos(a)} ${140 + 118 * Math.sin(a)}`;
});
const STROKES: [string, number, number][] = [
  [circle(200, 140, 58), 14, 34],
  ...rays.map((d, i): [string, number, number] => [d, 34 + i * 3, 38 + i * 3]),
  ["M 450 480 L 450 310 L 600 205 L 750 310 L 750 480 Z", 62, 90],
  ["M 562 480 L 562 385 L 638 385 L 638 480", 90, 102],
  ["M 50 480 L 950 480", 102, 116],
  ["M 870 480 L 870 330", 116, 124],
  [circle(870, 280, 50), 124, 140],
];

const CHAT: { at: number; who: string; text: string; kind?: "hint" | "win" }[] = [
  { at: 50, who: "로봇 콩이", text: "동그라미?" },
  { at: 80, who: "로봇 별이", text: "무지개?" },
  { at: 110, who: "로봇 똘이", text: "온도계?" },
  { at: 142, who: "🐧 AI 펭수", text: "힌트! 낮에 하늘에서 환하게 빛나요", kind: "hint" },
  { at: 180, who: "로봇 똘이", text: "태양!" },
  { at: 196, who: "🎉", text: "똘이 정답! +8점", kind: "win" },
];

const ChatRow: React.FC<{ row: (typeof CHAT)[number] }> = ({ row }) => {
  const p = usePop(row.at, 13);
  const bg = row.kind === "hint" ? "#e3f0ff" : row.kind === "win" ? "#fff3bf" : "transparent";
  return (
    <div
      style={{
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 40}px)`,
        background: bg,
        borderLeft: row.kind === "hint" ? `8px solid ${C.blue}` : row.kind === "win" ? `8px solid ${C.yellow}` : "8px solid transparent",
        borderRadius: 10,
        padding: "8px 16px",
        fontSize: 42,
        lineHeight: 1.35,
        fontWeight: 700,
      }}
    >
      <span style={{ color: row.kind === "hint" ? C.blue : row.kind === "win" ? "#c0392b" : "#b0602a", marginRight: 12 }}>{row.who}</span>
      <span style={{ color: C.ink }}>{row.text}</span>
    </div>
  );
};

export const Draw: React.FC = () => {
  const frame = useCurrentFrame();
  const board = usePop(4, 15);
  const note = usePop(12, 15);
  const tag = usePop(10, 12);
  const seconds = Math.max(0, Math.round(80 - frame / 6));
  const win = interpolate(frame, [196, 230], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Wall>
      <Headline text="그리면, 친구들이 채팅으로 맞혀요!" top={40} />

      <div style={{ position: "absolute", left: 90, top: 190, display: "flex", gap: 20, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
        <div
          style={{
            fontFamily: F.title,
            fontSize: 48,
            background: "#fff",
            border: `5px dashed ${C.red}`,
            borderRadius: 18,
            padding: "4px 26px",
          }}
        >
          제시어: <span style={{ color: C.red }}>태양</span>
        </div>
        <div style={{ fontFamily: F.title, fontSize: 44, background: "#fff", borderRadius: 40, padding: "10px 28px", alignSelf: "center" }}>⏰ {seconds}초</div>
      </div>

      <Chalkboard width={1080} height={640} style={{ left: 90, top: 290, opacity: board, transform: `scale(${0.94 + board * 0.06})` }}>
        <svg viewBox="0 0 1000 560" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {STROKES.map(([d, s, e], i) => {
            const p = interpolate(frame, [s, e], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            if (p <= 0) return null;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={C.yellow} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.92} />
                <path d={d} fill="none" stroke="#fff6cf" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.5} transform="translate(2 -2)" />
              </g>
            );
          })}
        </svg>
        {win > 0 &&
          Array.from({ length: 60 }, (_, i) => {
            const x = random(`x${i}`) * 1030;
            const vy = 300 + random(`v${i}`) * 500;
            const colors = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc", "#ffa94d"];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x + Math.sin(win * 8 + i) * 30,
                  top: -30 + win * vy * 1.2,
                  width: 16,
                  height: 26,
                  borderRadius: 4,
                  background: colors[i % colors.length],
                  transform: `rotate(${win * 720 * (random(`r${i}`) - 0.5)}deg)`,
                  opacity: 1 - Math.max(0, win - 0.75) * 4,
                }}
              />
            );
          })}
      </Chalkboard>

      <div
        style={{
          position: "absolute",
          left: 1220,
          top: 190,
          width: 620,
          height: 800,
          borderRadius: 16,
          overflow: "hidden",
          background: `repeating-linear-gradient(${C.paper} 0 58px, ${C.paperLine} 58px 61px)`,
          boxShadow: "0 18px 40px rgba(60,40,20,0.22)",
          opacity: note,
          transform: `translateX(${(1 - note) * 160}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 44, top: 0, bottom: 0, width: 4, background: C.margin }} />
        <div style={{ fontFamily: F.title, fontSize: 46, textAlign: "center", padding: "22px 0 18px", background: C.paper }}>📒 알림장 · 채팅</div>
        <div style={{ padding: "6px 22px 0 56px", display: "flex", flexDirection: "column", gap: 14 }}>
          {CHAT.map((row) => (
            <ChatRow key={row.at} row={row} />
          ))}
        </div>
      </div>
    </Wall>
  );
};
