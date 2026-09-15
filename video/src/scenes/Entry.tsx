import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BrowserFrame, RedCircle, usePop, Wall } from "../components";
import { C, F } from "../theme";

const STEPS = [
  { icon: "✏️", text: "닉네임만 입력하고" },
  { icon: "🏫", text: "교실(방)을 만들면" },
  { icon: "🔗", text: "방 코드로 친구 초대" },
  { icon: "🤖", text: "친구가 부족하면 로봇 친구!" },
];

export const Entry: React.FC = () => {
  const frame = useCurrentFrame();
  const title = usePop(4, 14);
  const frameIn = usePop(8, 15);
  const toLobby = interpolate(frame, [62, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, 165], [1, 1.05]);

  return (
    <Wall>
      <div style={{ position: "absolute", left: 110, top: 200, width: 640 }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: F.title,
            fontSize: 34,
            color: "#fff",
            background: C.green,
            padding: "8px 24px",
            borderRadius: 30,
            opacity: title,
          }}
        >
          회원가입 없이
        </div>
        <div style={{ fontFamily: F.title, fontSize: 92, lineHeight: 1.15, marginTop: 18, opacity: title, transform: `translateY(${(1 - title) * 30}px)` }}>
          입장은
          <br />
          정말 간단해요
        </div>
        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 22 }}>
          {STEPS.map((s, i) => {
            const p = usePop(28 + i * 16, 13);
            return (
              <div
                key={s.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  fontSize: 46,
                  fontWeight: 700,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -60}px)`,
                }}
              >
                <span
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 42,
                    boxShadow: "0 6px 14px rgba(60,40,20,0.14)",
                  }}
                >
                  {s.icon}
                </span>
                {s.text}
              </div>
            );
          })}
        </div>
      </div>

      <BrowserFrame
        src="home.png"
        overlaySrc={{ src: "lobby.png", opacity: toLobby }}
        width={1060}
        zoom={{ scale: zoom, x: 670, y: 420 }}
        style={{
          right: 80,
          top: 180,
          opacity: frameIn,
          transform: `translateX(${(1 - frameIn) * 200}px) rotate(${(1 - frameIn) * 3}deg)`,
        }}
      >
        {toLobby >= 1 && <RedCircle cx={672} cy={370} rx={200} ry={62} start={92} />}
      </BrowserFrame>
    </Wall>
  );
};
