import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "./theme";

/** 지연(delay) 뒤 통통 튀며 0→1 */
export const usePop = (delay: number, damping = 12) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140, mass: 0.8 } });
};

/** start~end 구간에서 0→1 (앞뒤로 고정) */
export const useProgress = (start: number, end: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

/** 교실 벽 배경 */
export const Wall: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `repeating-linear-gradient(90deg, transparent 0 69px, rgba(255,255,255,0.2) 69px 72px), linear-gradient(${C.wall}, ${C.wallStripe})`,
      fontFamily: F.hand,
      color: C.ink,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** 나무 틀 초록 칠판 */
export const Chalkboard: React.FC<{
  width: number;
  height: number;
  tray?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ width, height, tray = true, style, children }) => (
  <div style={{ position: "absolute", width, ...style }}>
    <div
      style={{
        width,
        height,
        borderRadius: 10,
        padding: 26,
        background: `linear-gradient(135deg, ${C.woodLight}, ${C.wood} 45%, ${C.woodDark})`,
        boxShadow: "0 18px 40px rgba(60,40,20,0.28)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 4,
          overflow: "hidden",
          background: `radial-gradient(ellipse at 30% 20%, #3d6852, ${C.board} 55%, ${C.boardDark})`,
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.35)",
        }}
      >
        {children}
      </div>
    </div>
    {tray && (
      <div
        style={{
          margin: "-6px 18px 0",
          height: 46,
          borderRadius: "0 0 14px 14px",
          background: `linear-gradient(${C.woodLight}, ${C.wood})`,
          boxShadow: "0 10px 20px rgba(60,40,20,0.25)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          paddingLeft: 36,
        }}
      >
        {["#f26b6b", "#ffa94d", "#ffe066", "#8ce99a", "#74c0fc", "#91a7ff", "#d0a2ff"].map((c, i) => (
          <div key={c} style={{ width: 70, height: 16, borderRadius: 8, background: c, transform: `rotate(${i % 2 ? 3 : -2}deg)` }} />
        ))}
      </div>
    )}
  </div>
);

/** 브라우저 창 틀에 앱 캡처를 넣음. children은 캡처 원본(1440×960) 좌표계로 겹쳐 그림 */
export const BrowserFrame: React.FC<{
  src: string;
  width: number;
  zoom?: { scale: number; x: number; y: number };
  style?: React.CSSProperties;
  children?: React.ReactNode;
  overlaySrc?: { src: string; opacity: number };
}> = ({ src, width, zoom, style, children, overlaySrc }) => {
  const k = width / 1440;
  const h = 960 * k;
  const z = zoom ?? { scale: 1, x: 720, y: 480 };
  return (
    <div
      style={{
        position: "absolute",
        width,
        borderRadius: 22,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 30px 70px rgba(60,40,20,0.3), 0 0 0 4px rgba(46,42,37,0.08)",
        ...style,
      }}
    >
      <div style={{ height: 50, background: "#f6efe0", display: "flex", alignItems: "center", gap: 12, padding: "0 22px" }}>
        {["#ff6b6b", "#ffd43b", "#69db7c"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 20,
            flex: 1,
            height: 32,
            borderRadius: 16,
            background: "#fff",
            fontFamily: F.title,
            fontSize: 20,
            color: C.inkSoft,
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
          }}
        >
          🏫 그려서 배워요! - 교실 그림 퀴즈
        </div>
      </div>
      <div style={{ position: "relative", width, height: h, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            width: 1440,
            height: 960,
            transformOrigin: "0 0",
            transform: `scale(${k}) translate(${z.x}px, ${z.y}px) scale(${z.scale}) translate(${-z.x}px, ${-z.y}px)`,
          }}
        >
          <Img src={staticFile(src)} style={{ position: "absolute", width: 1440, height: 960 }} />
          {overlaySrc && (
            <Img src={staticFile(overlaySrc.src)} style={{ position: "absolute", width: 1440, height: 960, opacity: overlaySrc.opacity }} />
          )}
          {children}
        </div>
      </div>
    </div>
  );
};

/** 펭수 아바타 (원형) */
export const Pengsoo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      border: `${Math.round(size / 28)}px solid ${C.ink}`,
      background: C.yellow,
      boxShadow: "0 16px 36px rgba(60,40,20,0.3)",
      ...style,
    }}
  >
    <Img src={staticFile("pengsoo.png")} style={{ width: "100%", height: "100%" }} />
  </div>
);

/** 말풍선 */
export const Bubble: React.FC<{ style?: React.CSSProperties; tail?: "left" | "bottom-left"; children: React.ReactNode }> = ({
  style,
  tail = "left",
  children,
}) => (
  <div
    style={{
      position: "absolute",
      background: "#fff",
      border: `5px solid ${C.ink}`,
      borderRadius: 30,
      padding: "18px 30px",
      fontFamily: F.hand,
      fontWeight: 700,
      color: C.ink,
      boxShadow: "0 10px 24px rgba(60,40,20,0.18)",
      ...style,
    }}
  >
    {children}
    <div
      style={{
        position: "absolute",
        width: 30,
        height: 30,
        background: "#fff",
        borderLeft: `5px solid ${C.ink}`,
        borderBottom: `5px solid ${C.ink}`,
        ...(tail === "left"
          ? { left: -18, top: "50%", marginTop: -15, transform: "rotate(45deg)" }
          : { left: 50, bottom: -18, transform: "rotate(-45deg)" }),
      }}
    />
  </div>
);

/** 장면 제목 자막 (형광펜 밑줄) */
export const Headline: React.FC<{ text: string; sub?: string; delay?: number; top?: number }> = ({
  text,
  sub,
  delay = 4,
  top = 64,
}) => {
  const p = usePop(delay, 14);
  const marker = useProgress(delay + 8, delay + 22);
  const subP = usePop(delay + 12, 14);
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          position: "relative",
          fontFamily: F.title,
          fontSize: 84,
          color: C.ink,
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -16,
            bottom: 8,
            height: 34,
            width: `calc(${marker * 100}% + ${marker * 32}px)`,
            background: C.yellow,
            opacity: 0.75,
            borderRadius: 10,
          }}
        />
        <span style={{ position: "relative" }}>{text}</span>
      </div>
      {sub && (
        <div style={{ fontSize: 44, fontWeight: 700, color: C.inkSoft, marginTop: 6, opacity: subP, transform: `translateY(${(1 - subP) * 20}px)` }}>
          {sub}
        </div>
      )}
    </div>
  );
};

/** 빨간 펜 동그라미 강조 (캡처 좌표계) */
export const RedCircle: React.FC<{ cx: number; cy: number; rx: number; ry: number; start: number; dur?: number }> = ({
  cx,
  cy,
  rx,
  ry,
  start,
  dur = 16,
}) => {
  const p = useProgress(start, start + dur);
  if (p <= 0) return null;
  // 살짝 삐뚤고 끝이 겹치는 손그림 동그라미
  const pts: string[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.6 + (i / n) * Math.PI * 2.15;
    const wob = 1 + 0.04 * Math.sin(i * 0.9);
    pts.push(`${cx + rx * wob * Math.cos(a)},${cy + ry * wob * Math.sin(a)}`);
  }
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 960, overflow: "visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={C.red}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};
