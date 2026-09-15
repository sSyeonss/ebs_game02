"use client";

import { useState } from "react";

/**
 * AI 펭수 아바타. public/pengsoo.png 이미지를 넣으면 그 이미지를 쓰고,
 * 없으면 기본 펭귄 그림을 보여줌.
 */
export function PengsooAvatar({ size = 64 }: { size?: number }) {
  const [useImg, setUseImg] = useState(true);
  if (useImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/pengsoo.png"
        alt="AI 펭수"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          flex: "none",
          borderRadius: "50%",
          border: "3px solid #2b3a55",
          background: "#ffd84d",
          boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
        }}
        onError={() => setUseImg(false)}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="AI 펭수" style={{ flex: "none" }}>
      <ellipse cx="50" cy="58" rx="36" ry="38" fill="#2b3a55" />
      <ellipse cx="50" cy="64" rx="25" ry="29" fill="#fdfdf8" />
      <ellipse cx="50" cy="40" rx="27" ry="23" fill="#fdfdf8" />
      <circle cx="40" cy="38" r="5" fill="#1d1d1d" />
      <circle cx="60" cy="38" r="5" fill="#1d1d1d" />
      <circle cx="41.5" cy="36.5" r="1.6" fill="#fff" />
      <circle cx="61.5" cy="36.5" r="1.6" fill="#fff" />
      <ellipse cx="32" cy="48" rx="5" ry="3" fill="#ffb3c1" />
      <ellipse cx="68" cy="48" rx="5" ry="3" fill="#ffb3c1" />
      <path d="M43 46 Q50 56 57 46 Z" fill="#ffa726" />
      <ellipse cx="14" cy="62" rx="6" ry="15" fill="#2b3a55" transform="rotate(20 14 62)" />
      <ellipse cx="86" cy="62" rx="6" ry="15" fill="#2b3a55" transform="rotate(-20 86 62)" />
      <ellipse cx="38" cy="95" rx="10" ry="4" fill="#ffa726" />
      <ellipse cx="62" cy="95" rx="10" ry="4" fill="#ffa726" />
    </svg>
  );
}

export function PengsooDesk({ text, pulseKey }: { text: string; pulseKey: number | string }) {
  return (
    <div className="pengsoo-desk">
      <PengsooAvatar size={72} />
      <div className="pengsoo-bubble" key={pulseKey}>
        <span className="pengsoo-name">AI 펭수</span>
        {text}
      </div>
    </div>
  );
}
