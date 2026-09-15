"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PengsooAvatar } from "@/components/Pengsoo";
import { api, getPlayerId, getSavedName, saveName } from "@/lib/client";
import { TOPICS } from "@/lib/topics";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setName(getSavedName()), []);

  const create = async () => {
    if (!name.trim()) return setError("먼저 이름표(닉네임)를 적어 주세요!");
    setBusy(true);
    setError("");
    try {
      saveName(name.trim());
      const res = await api<{ code: string }>("/api/rooms", { playerId: getPlayerId(), name: name.trim() });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방을 만들지 못했어요.");
      setBusy(false);
    }
  };

  const join = () => {
    if (!name.trim()) return setError("먼저 이름표(닉네임)를 적어 주세요!");
    if (!/^\d{6}$/.test(code)) return setError("방 코드는 6자리 숫자예요.");
    saveName(name.trim());
    router.push(`/room/${code}`);
  };

  return (
    <div className="home">
      <div className="chalkboard home-board">
        <h1>
          그려서 <span className="y">배워요!</span>
        </h1>
        <p>칠판에 그림을 그리고, 친구들이 맞히는 교실 그림 퀴즈</p>
        <div className="doodles" aria-hidden>
          <span>🏯</span>
          <span>🔬</span>
          <span>📚</span>
          <span>🔤</span>
          <span>📐</span>
          <span>🎨</span>
        </div>
      </div>
      <div className="chalk-tray" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="chalk-pieces" aria-hidden>
          {["#ff6b6b", "#ffa94d", "#ffe066", "#8ce99a", "#74c0fc", "#8c9eff", "#d0a2ff"].map((c, i) => (
            <span key={c} className="chalk-piece" style={{ background: c, transform: `rotate(${(i % 2 ? 1 : -1) * (i + 1)}deg)` }} />
          ))}
        </div>
        <span className="tray-label">3~10명 · 초등 1~6학년</span>
      </div>

      <div className="home-grid">
        <div className="paper home-card pin">
          <h2>✏️ 교실 입장하기</h2>
          <label htmlFor="name">내 이름표 (닉네임)</label>
          <input
            id="name"
            className="input"
            maxLength={10}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 똑똑한펭귄"
          />
          <div className="row">
            <button className="btn green" onClick={create} disabled={busy} style={{ flex: "1 1 100%" }}>
              {busy ? "교실 만드는 중..." : "🏫 새 교실(방) 만들기"}
            </button>
          </div>
          <label htmlFor="code" style={{ marginTop: 12 }}>
            친구 교실에 들어가기
          </label>
          <form
            className="row"
            style={{ marginTop: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <input
              id="code"
              className="input"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="방 코드 6자리"
            />
            <button className="btn blue">참가하기</button>
          </form>
          {error && <p style={{ color: "var(--red)", fontWeight: 700, lineHeight: "32px", margin: "8px 0 0" }}>{error}</p>}
        </div>

        <div className="paper home-card pin">
          <h2>📋 놀이 방법</h2>
          <ul className="how">
            <li>1. 리더가 주제와 난이도를 골라요</li>
            <li>2. AI 펭수가 제시어를 뽑아 줘요</li>
            <li>3. 리더는 칠판에 그림을 그려요</li>
            <li>4. 친구들은 채팅으로 정답을 맞혀요</li>
            <li>5. 정답을 맞힌 친구가 다음 리더!</li>
            <li>💡 오답 5개마다 펭수가 힌트를 줘요</li>
            <li>🏆 5문제 × 3주제 = 1라운드, 3라운드까지!</li>
          </ul>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
            <PengsooAvatar size={56} />
            <div className="subjects">
              {TOPICS.map((t) => (
                <span key={t.id} className="tag">
                  {t.emoji} {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
