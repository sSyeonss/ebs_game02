"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board, { type BoardHandle } from "./Board";
import { PengsooAvatar, PengsooDesk } from "./Pengsoo";
import { api, getPlayerId, getSavedName, saveName } from "@/lib/client";
import { nim } from "@/lib/text";
import type { ChatMessage, GameState, Player } from "@/lib/game";
import { DIFFICULTIES, TOPICS, difficultyName, topicEmoji, topicName, type Difficulty, type TopicId } from "@/lib/topics";

const AVATAR_COLORS = ["#e2574c", "#4a90d9", "#5bab5b", "#f0a030", "#9b6bd6", "#e76fa8", "#2fa3a3", "#8d6e63", "#607d8b", "#d4a017"];

function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return { toast, show };
}

function rankList(players: Player[], key: "scoreRound" | "scoreTotal") {
  const sorted = [...players].sort((a, b) => b[key] - a[key]);
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((p, i) => {
    if (p[key] !== prev) {
      rank = i + 1;
      prev = p[key];
    }
    return { ...p, rank, score: p[key] };
  });
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState<"init" | "name" | "joining" | "in">("init");
  const [nameInput, setNameInput] = useState("");
  const [fatal, setFatal] = useState<string | null>(null);
  const [view, setView] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { toast, show } = useToast();

  const boardRef = useRef<BoardHandle>(null);
  const cursors = useRef({ seq: 0, stroke: 0, msg: 0 });
  const offset = useRef(0);
  const wake = useRef<() => void>(() => {});
  const chatList = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const join = useCallback(
    async (pid: string, name: string) => {
      setPhase("joining");
      try {
        const res = await api<{ name: string }>(`/api/rooms/${code}/join`, { playerId: pid, name });
        saveName(res.name);
        cursors.current = { seq: 0, stroke: 0, msg: 0 };
        setMessages([]);
        setPhase("in");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "입장하지 못했어요.";
        if (/찾을 수 없|가득/.test(msg)) setFatal(msg);
        else show(msg);
        setPhase("name");
      }
    },
    [code, show],
  );

  useEffect(() => {
    const pid = getPlayerId();
    setPlayerId(pid);
    const saved = getSavedName();
    setNameInput(saved);
    if (saved) join(pid, saved);
    else setPhase("name");
  }, [join]);

  // ───── 폴링 루프 ─────
  useEffect(() => {
    if (phase !== "in" || !playerId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let wakeRequested = false;

    const poll = async () => {
      clearTimeout(timer);
      if (inFlight) return;
      inFlight = true;
      wakeRequested = false;
      let delay = 1200;
      try {
        const c = cursors.current;
        const sentAt = Date.now();
        const res = await fetch(
          `/api/rooms/${code}/state?playerId=${playerId}&seq=${c.seq}&strokeAfter=${c.stroke}&msgAfter=${c.msg}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          if (res.status === 404) {
            setFatal(data.error ?? "방을 찾을 수 없어요.");
            return;
          }
          throw new Error(data.error);
        }
        if (!data.joined) {
          setPhase("name");
          return;
        }
        const s = data as GameState;
        offset.current = s.serverNow - (sentAt + Date.now()) / 2;
        const isDrawer = s.leaderId === playerId && s.status === "drawing";

        if (s.strokeReset) {
          boardRef.current?.reset();
          c.stroke = 0;
        }
        if (s.strokes.length) {
          if (!isDrawer || s.strokeReset) boardRef.current?.apply(s.strokes.map((x) => x.op));
          c.stroke = s.strokes[s.strokes.length - 1].id;
        }
        c.seq = s.seq;
        if (s.messages.length) {
          c.msg = s.messages[s.messages.length - 1].id;
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...s.messages.filter((m) => !seen.has(m.id))].slice(-200);
          });
        }
        setView(s);
        delay = s.status === "drawing" ? (isDrawer ? 1000 : 600) : 1200;
      } catch {
        delay = 2500;
      }
      inFlight = false;
      if (alive) timer = setTimeout(poll, wakeRequested ? 30 : delay);
    };

    // 행동 직후 바로 새 상태를 받아오기 (진행 중인 요청이 있으면 끝난 뒤 즉시)
    wake.current = () => {
      if (inFlight) wakeRequested = true;
      else {
        clearTimeout(timer);
        timer = setTimeout(poll, 30);
      }
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [phase, playerId, code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = chatList.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const act = async (path: string, body: Record<string, unknown> = {}) => {
    try {
      const res = await api(`/api/rooms/${code}/${path}`, { playerId, ...body });
      wake.current();
      return res;
    } catch (e) {
      show(e instanceof Error ? e.message : "문제가 생겼어요.");
      return null;
    }
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    const res = (await act("chat", { text })) as { correct?: boolean; points?: number } | null;
    if (res?.correct) show(`🎉 정답이에요! +${res.points}점`);
  };

  const leave = async () => {
    if (!confirm("정말 방에서 나갈까요? 점수가 사라져요.")) return;
    await act("leave");
    router.push("/");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/room/${code}`);
      show("초대 링크를 복사했어요! 친구에게 보내 주세요.");
    } catch {
      show(`방 코드: ${code}`);
    }
  };

  const pengsooMsg = useMemo(
    () => [...messages].reverse().find((m) => m.kind === "pengsoo" || m.kind === "hint" || m.kind === "explain"),
    [messages],
  );

  // ───── 입장 전 화면 ─────
  if (fatal) {
    return (
      <div className="center-page">
        <div className="card" style={{ textAlign: "center", maxWidth: 420 }}>
          <PengsooAvatar size={96} />
          <h2 style={{ fontFamily: "var(--font-title)", fontWeight: "normal" }}>{fatal}</h2>
          <Link href="/" className="btn">
            처음으로
          </Link>
        </div>
      </div>
    );
  }

  if (phase !== "in" || !view) {
    return (
      <div className="center-page">
        <form
          className="paper home-card pin"
          style={{ width: "min(100%, 440px)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (nameInput.trim()) join(playerId, nameInput.trim());
          }}
        >
          <h2>🏫 {code}번 교실에 들어가기</h2>
          {phase === "init" || phase === "joining" || (phase === "in" && !view) ? (
            <p style={{ lineHeight: "32px" }}>교실 문을 여는 중이에요...</p>
          ) : (
            <>
              <label htmlFor="nick">내 이름표 (닉네임)</label>
              <div className="row">
                <input
                  id="nick"
                  className="input"
                  maxLength={10}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="예) 똑똑한펭귄"
                  autoFocus
                />
                <button className="btn" disabled={!nameInput.trim()}>
                  입장!
                </button>
              </div>
            </>
          )}
        </form>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // ───── 게임 화면 ─────
  const v = view;
  const me = v.players.find((p) => p.id === playerId);
  const isHost = v.hostId === playerId;
  const isLeader = v.leaderId === playerId;
  const leaderName = v.players.find((p) => p.id === v.leaderId)?.name ?? "";
  const onlineCount = v.players.filter((p) => p.online).length;
  const remain = v.deadline ? Math.max(0, Math.ceil((v.deadline - (now + offset.current)) / 1000)) : null;
  const totalSec = v.phaseSeconds ?? 60;
  const inGame = v.status !== "lobby" && v.status !== "game_end";
  const nextHintAt = v.hintsRevealed < v.rules.maxHints ? (v.hintsRevealed + 1) * v.rules.wrongPerHint : null;

  let overlay: React.ReactNode = null;
  if (v.status === "drawing" && v.npcDrawStatus === "pending") {
    overlay = (
      <div className="board-overlay">
        <h2>🤖 {nim(leaderName)}이 그림을 구상하는 중...</h2>
        <p>AI 로봇이 곧 칠판에 그림을 그려요!</p>
      </div>
    );
  } else if (v.status === "lobby") {
    overlay = (
      <div className="board-overlay">
        <h2>대기실</h2>
        <p>칠판에 방 코드를 적어 두었어요</p>
        <div className="lobby-code">{code}</div>
        <div className="lobby-players">
          {v.players.map((p) => (
            <span key={p.id} className={`name-tag ${p.npc ? "npc" : ""}`} style={{ opacity: p.online ? 1 : 0.4 }}>
              {p.id === v.hostId ? "👑 " : p.npc ? "🤖 " : ""}
              {p.name}
              {p.npc && isHost && (
                <button className="npc-remove" onClick={() => act("npc", { action: "remove", npcId: p.id })} aria-label={`${p.name} 빼기`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <p>
          {onlineCount} / {v.rules.maxPlayers}명 · {v.rules.minPlayers}명 이상 모이면 시작할 수 있어요
          {onlineCount < v.rules.minPlayers && " (친구가 부족하면 NPC와 함께!)"}
        </p>
        {isHost ? (
          <div className="lobby-actions">
            <button className="btn ghost" disabled={v.players.length >= v.rules.maxPlayers} onClick={() => act("npc", { action: "add" })}>
              🤖 NPC 추가
            </button>
            {onlineCount >= v.rules.minPlayers ? (
              <button className="btn green" onClick={() => act("start")}>
                🎮 게임 시작하기
              </button>
            ) : (
              <button className="btn green" onClick={() => act("start", { fillNpc: true })}>
                🤖 NPC {v.rules.minPlayers - onlineCount}명과 함께 시작하기
              </button>
            )}
          </div>
        ) : (
          <p>방장이 게임을 시작하기를 기다리고 있어요...</p>
        )}
      </div>
    );
  } else if (v.status === "choosing") {
    overlay = isLeader ? (
      <TopicPicker remain={remain} onPick={(topic, difficulty) => act("topic", { topic, difficulty })} lastDifficulty={v.difficulty} />
    ) : (
      <div className="board-overlay">
        <PengsooAvatar size={96} />
        <h2>{nim(leaderName)}이 주제를 고르는 중...</h2>
        <p>
          {v.round}라운드 · {v.setNo}번째 주제 {remain !== null && `(${remain}초)`}
        </p>
      </div>
    );
  } else if (v.status === "generating") {
    overlay = (
      <div className="board-overlay">
        <PengsooAvatar size={110} />
        <h2>펭수가 문제를 준비하고 있어요</h2>
        <p>
          {topicEmoji(v.topic)} {topicName(v.topic)} · {difficultyName(v.difficulty)} ✏️ 잠깐만 기다려 주세요!
        </p>
      </div>
    );
  } else if (v.status === "reveal" && v.lastResult) {
    const r = v.lastResult;
    overlay = (
      <div className="board-overlay dim">
        <div className="learn-card">
          <div className="label">정답은</div>
          <div className="answer">{r.word}</div>
          <div style={{ fontFamily: "var(--font-title)", fontSize: 20, margin: "4px 0 10px" }}>
            {r.winnerName
              ? `🎉 ${nim(r.winnerName)} 정답! (+${r.points}점) · 그린 사람 ${r.drawerName} (+${r.drawerPoints}점)`
              : r.reason === "timeout"
                ? "⏰ 아쉽게도 시간이 다 됐어요"
                : "🚪 그리는 사람이 나가서 넘어갔어요"}
          </div>
          {r.explain && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left" }}>
              <PengsooAvatar size={64} />
              <div>
                <div className="label">📘 AI 펭수의 알고 가요!</div>
                <div className="explain">{r.explain}</div>
              </div>
            </div>
          )}
        </div>
        <p>{remain !== null && `${remain}초 뒤 다음으로 넘어가요`}</p>
      </div>
    );
  } else if (v.status === "round_end") {
    overlay = (
      <div className="board-overlay dim">
        <h2>🏁 {v.round}라운드 순위</h2>
        <RankingList players={v.players} keyName="scoreRound" />
        {isHost ? (
          <button className="btn" onClick={() => act("next")}>
            다음 라운드 시작 {remain !== null && `(${remain})`}
          </button>
        ) : (
          <p>{remain !== null && `${remain}초 뒤 다음 라운드가 시작돼요`}</p>
        )}
      </div>
    );
  } else if (v.status === "game_end") {
    const ranked = rankList(v.players, "scoreTotal");
    overlay = (
      <div className="board-overlay dim">
        <h2>🏆 최종 순위</h2>
        <div className="podium">
          {[1, 0, 2].map((i) =>
            ranked[i] ? (
              <div key={ranked[i].id}>
                <span>{ranked[i].name}</span>
                <span style={{ color: "#ffe66d" }}>{ranked[i].score}점</span>
                <div className="stand" style={{ height: [110, 80, 60][i] }}>
                  {MEDALS[ranked[i].rank - 1] ?? ranked[i].rank}
                </div>
              </div>
            ) : null,
          )}
        </div>
        <RankingList players={v.players} keyName="scoreTotal" />
        {isHost ? (
          <button className="btn green" onClick={() => act("next")}>
            🔁 대기실로 돌아가기
          </button>
        ) : (
          <p>방장이 다시 시작할 수 있어요</p>
        )}
      </div>
    );
  }

  const trayInfo =
    v.status === "drawing"
      ? v.npcDrawStatus
        ? `🤖 ${nim(leaderName)}이 AI로 그리고 있어요`
        : `✏️ ${nim(leaderName)}이 그리고 있어요`
      : v.status === "lobby"
        ? "분필을 준비했어요!"
        : "";

  return (
    <div className="room">
      <header className="room-header">
        <div className="class-sign">
          🏫 그려서 배워요! <span>교실</span> <b>{code}</b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn small blue" onClick={copyLink}>
            🔗 초대 링크
          </button>
          <button className="btn small ghost" onClick={leave}>
            나가기
          </button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="col-players card roster pin">
          <h3>📋 출석부</h3>
          <ul>
            {v.players.map((p) => (
              <li
                key={p.id}
                className={[p.id === playerId && "me", inGame && p.id === v.leaderId && "leader", !p.online && "offline"]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="avatar" style={{ background: p.npc ? "#607d8b" : avatarColor(p.id) }}>
                  {p.npc ? "🤖" : [...p.name][0]}
                </span>
                <span className="pname">
                  {p.id === v.hostId && "👑"}
                  {inGame && p.id === v.leaderId && "✏️"}
                  {p.name}
                  {p.id === playerId && " (나)"}
                  {p.npc && <small className="npc-badge">NPC</small>}
                </span>
                <span className="pscore">
                  {p.scoreTotal}
                  <small>이번 판 {p.scoreRound}</small>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="col-board">
          <div className="info-bar">
            {inGame || v.status === "game_end" ? (
              <>
                <span className="info-chip">
                  {v.round}/{v.rules.rounds} 라운드
                </span>
                <span className="info-chip">
                  주제 {v.setNo}/{v.rules.sets}
                </span>
                {v.questionNo > 0 && (
                  <span className="info-chip">
                    문제 {v.questionNo}/{v.rules.questions}
                  </span>
                )}
                {v.topic && (
                  <span className="info-chip topic">
                    {topicEmoji(v.topic)} {topicName(v.topic)} · {difficultyName(v.difficulty)}
                  </span>
                )}
              </>
            ) : (
              <span className="info-chip">🔔 곧 수업(게임)이 시작돼요</span>
            )}
            {remain !== null && inGame && (
              <span className={`clock ${v.status === "drawing" && remain <= 10 ? "urgent" : ""}`}>
                <span
                  className="clock-face"
                  style={{ ["--p" as string]: `${Math.min(100, Math.max(0, 100 - (remain / totalSec) * 100))}%` }}
                />
                {remain}초
              </span>
            )}
          </div>

          {v.status === "drawing" && (
            <div className="word-line">
              {isLeader && v.word ? (
                <span className="word-card">
                  제시어: <b>{v.word}</b>
                </span>
              ) : (
                v.mask && (
                  <span className="mask">
                    {v.mask}
                    <small>{v.mask.replace(/\s/g, "").length}글자</small>
                  </span>
                )
              )}
              <div className="hint-notes">
                {v.hints.map((h, i) => (
                  <span key={i} className="sticky">
                    💡 {h}
                  </span>
                ))}
              </div>
              <span className="info-chip" style={{ marginLeft: "auto" }}>
                오답 {v.wrongCount}개{nextHintAt !== null && ` · 펭수 힌트까지 ${Math.max(0, nextHintAt - v.wrongCount)}개`}
              </span>
            </div>
          )}

          <Board
            ref={boardRef}
            canDraw={v.status === "drawing" && isLeader}
            seq={v.seq}
            code={code}
            playerId={playerId}
            overlay={overlay}
            trayInfo={trayInfo}
          />
          {v.status === "drawing" && !isLeader && (
            <form className="quick-answer" onSubmit={sendChat}>
              <input
                className="input"
                value={chatText}
                maxLength={60}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="정답을 입력해 보세요!"
                aria-label="정답 입력"
              />
              <button className="btn small" disabled={!chatText.trim()}>
                정답!
              </button>
            </form>
          )}
          {v.status === "drawing" && isLeader && (
            <p style={{ margin: "10px 4px 0", fontWeight: 700, color: "var(--ink-soft)" }}>
              ✏️ 글자나 숫자는 쓰지 말고 그림으로만 설명해 주세요! 친구들이 오답을 {v.rules.wrongPerHint}개 낼 때마다 펭수가 힌트를 줘요.
            </p>
          )}
        </main>

        <section className="col-chat">
          <PengsooDesk
            text={pengsooMsg?.text ?? "펭-하! 나는 AI 펭수야. 틀려도 괜찮으니까 떠오르는 대로 마음껏 외쳐 봐!"}
            pulseKey={pengsooMsg?.id ?? 0}
          />
          <div className="paper chat pin">
            <h3>📒 알림장 · 채팅</h3>
            <div
              className="chat-list"
              ref={chatList}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              }}
            >
              {messages.map((m) => (
                <div key={m.id} className={`msg k-${m.kind}`}>
                  {m.kind === "chat" && <b style={{ color: avatarColor(m.playerId ?? "") }}>{m.name}</b>}
                  {(m.kind === "pengsoo" || m.kind === "hint") && <b>🐧 AI 펭수</b>}
                  {m.text}
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={sendChat}>
              <input
                className="input"
                value={chatText}
                maxLength={60}
                onChange={(e) => setChatText(e.target.value)}
                placeholder={
                  v.status === "drawing" ? (isLeader ? "친구들과 이야기해요 (정답은 쓸 수 없어요)" : "정답을 입력해 보세요!") : "메시지를 입력해요"
                }
                aria-label="채팅 입력"
              />
              <button className="btn small" disabled={!chatText.trim() || !me}>
                보내기
              </button>
            </form>
          </div>
        </section>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function RankingList({ players, keyName }: { players: Player[]; keyName: "scoreRound" | "scoreTotal" }) {
  return (
    <ol className="ranking">
      {rankList(players, keyName).map((p) => (
        <li key={p.id}>
          <span className="rank">{MEDALS[p.rank - 1] ?? `${p.rank}`}</span>
          <span className="nm">{p.name}</span>
          <span className="sc">{p.score}점</span>
        </li>
      ))}
    </ol>
  );
}

function TopicPicker({
  remain,
  onPick,
  lastDifficulty,
}: {
  remain: number | null;
  onPick: (topic: TopicId, difficulty: Difficulty) => Promise<unknown>;
  lastDifficulty: Difficulty | null;
}) {
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(lastDifficulty ?? "medium");
  const [busy, setBusy] = useState(false);
  return (
    <div className="board-overlay">
      <h2>오늘의 주제를 골라 주세요!</h2>
      <p>{remain !== null && `${remain}초 안에 고르지 않으면 펭수가 골라요`}</p>
      <div className="topic-grid">
        {TOPICS.map((t) => (
          <button key={t.id} className={`topic-btn ${topic === t.id ? "on" : ""}`} onClick={() => setTopic(t.id)}>
            {t.emoji} {t.name}
            <small>{t.desc}</small>
          </button>
        ))}
      </div>
      <div className="diff-row">
        {DIFFICULTIES.map((d) => (
          <button key={d.id} className={`diff-btn ${difficulty === d.id ? "on" : ""}`} onClick={() => setDifficulty(d.id)}>
            {d.name} <small>{d.grade}</small>
          </button>
        ))}
      </div>
      <button
        className="btn"
        disabled={!topic || busy}
        onClick={async () => {
          if (!topic) return;
          setBusy(true);
          await onPick(topic, difficulty);
          setBusy(false);
        }}
      >
        {busy ? "펭수가 문제를 만드는 중..." : "이 주제로 시작!"}
      </button>
    </div>
  );
}
