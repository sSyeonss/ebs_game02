import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BrowserFrame, Headline, RedCircle, usePop, useProgress, Wall } from "../components";
import { C } from "../theme";

// 캡처(topic.png) 속 위치
const SCIENCE = { x: 766, y: 384 };
const EASY = { x: 528, y: 578 };
const START = { x: 674, y: 638 };

export const Topic: React.FC = () => {
  const frame = useCurrentFrame();
  const frameIn = usePop(6, 15);
  const zoom = interpolate(frame, [40, 85], [1, 1.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // 손가락 커서: 과학 → 쉬움 → 시작 버튼
  const cx = interpolate(frame, [70, 90, 115, 135, 150, 165], [SCIENCE.x + 60, SCIENCE.x, SCIENCE.x, EASY.x, EASY.x, START.x], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const cy = interpolate(frame, [70, 90, 115, 135, 150, 165], [SCIENCE.y + 80, SCIENCE.y, SCIENCE.y, EASY.y, EASY.y, START.y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const cursorOpacity = useProgress(66, 74);
  const click = frame >= 168 && frame < 178 ? 0.85 : 1;
  const ripple = useProgress(168, 190);

  return (
    <Wall>
      <Headline text="주제와 난이도를 골라요" sub="40초 안에 고르지 않으면 펭수가 대신 골라 줘요" top={36} />
      <BrowserFrame
        src="topic.png"
        width={1140}
        zoom={{ scale: zoom, x: 660, y: 500 }}
        style={{ left: 390, top: 236, opacity: frameIn, transform: `translateY(${(1 - frameIn) * 120}px)` }}
      >
        <RedCircle cx={SCIENCE.x} cy={SCIENCE.y} rx={105} ry={62} start={92} />
        <RedCircle cx={EASY.x} cy={EASY.y} rx={82} ry={40} start={137} dur={12} />
        {ripple > 0 && ripple < 1 && (
          <div
            style={{
              position: "absolute",
              left: START.x - 90,
              top: START.y - 90,
              width: 180,
              height: 180,
              borderRadius: 90,
              border: `8px solid ${C.yellow}`,
              opacity: 1 - ripple,
              transform: `scale(${0.3 + ripple})`,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: cx - 14,
            top: cy - 6,
            fontSize: 64,
            opacity: cursorOpacity,
            transform: `scale(${click})`,
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
          }}
        >
          👆
        </div>
      </BrowserFrame>
    </Wall>
  );
};
