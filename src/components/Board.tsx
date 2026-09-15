"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { StrokeOp } from "@/lib/game";

const W = 800;
const H = 600;
const SCALE = 2;

// 무지개 7색 분필 (초록 칠판 위에서 잘 보이도록 밝은 톤)
export const CHALKS = [
  { c: "#ff6b6b", name: "빨강" },
  { c: "#ffa94d", name: "주황" },
  { c: "#ffe066", name: "노랑" },
  { c: "#8ce99a", name: "초록" },
  { c: "#74c0fc", name: "파랑" },
  { c: "#8c9eff", name: "남색" },
  { c: "#d0a2ff", name: "보라" },
];

const SIZES = [
  { w: 3, name: "가늘게" },
  { w: 7, name: "보통" },
  { w: 13, name: "굵게" },
  { w: 22, name: "아주 굵게" },
];

type Stroke = { s: number; c: string; w: number; p: [number, number][] };

export type BoardHandle = {
  reset(): void;
  apply(ops: StrokeOp[]): void;
};

type Props = {
  canDraw: boolean;
  seq: number;
  code: string;
  playerId: string;
  overlay?: ReactNode;
  trayInfo?: ReactNode;
};

const Board = forwardRef<BoardHandle, Props>(function Board({ canDraw, seq, code, playerId, overlay, trayInfo }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const pending = useRef<StrokeOp[]>([]);
  const sending = useRef(false);
  const current = useRef<number | null>(null);
  const seqRef = useRef(seq);
  seqRef.current = seq;

  const [color, setColor] = useState(CHALKS[2].c);
  const [size, setSize] = useState(SIZES[1].w);
  const [erasing, setErasing] = useState(false);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const drawPath = (c: string, w: number, pts: [number, number][], from?: [number, number]) => {
    const g = ctx();
    if (!g || !pts.length) return;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    if (c === "erase") {
      g.globalCompositeOperation = "destination-out";
      g.strokeStyle = "#000";
      g.lineWidth = w * 2.5;
    } else {
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.92;
      g.strokeStyle = c;
      g.shadowColor = c;
      g.shadowBlur = Math.max(1.5, w * 0.35);
      g.lineWidth = w;
    }
    g.beginPath();
    const start = from ?? pts[0];
    g.moveTo(start[0], start[1]);
    if (!from && pts.length === 1) g.lineTo(start[0] + 0.1, start[1]);
    for (const [x, y] of from ? pts : pts.slice(1)) g.lineTo(x, y);
    g.stroke();
    g.restore();
  };

  const redraw = () => {
    const g = ctx();
    if (!g) return;
    g.clearRect(0, 0, W, H);
    for (const s of strokes.current) drawPath(s.c, s.w, s.p);
  };

  const applyOp = (op: StrokeOp) => {
    if (op.t === "clear") {
      strokes.current = [];
      redraw();
    } else if (op.t === "undo") {
      strokes.current.pop();
      redraw();
    } else {
      const last = strokes.current[strokes.current.length - 1];
      if (last && last.s === op.s) {
        const from = last.p[last.p.length - 1];
        last.p.push(...op.p);
        drawPath(op.c, op.w, op.p, from);
      } else {
        strokes.current.push({ s: op.s, c: op.c, w: op.w, p: [...op.p] });
        drawPath(op.c, op.w, op.p);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    reset() {
      strokes.current = [];
      pending.current = [];
      current.current = null;
      redraw();
    },
    apply(ops) {
      for (const op of ops) applyOp(op);
    },
  }));

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = W * SCALE;
    cv.height = H * SCALE;
    cv.getContext("2d")?.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그린 내용을 0.09초마다 순서대로 서버에 전송
  const flush = useCallback(async () => {
    if (sending.current || !pending.current.length) return;
    const ops = pending.current;
    pending.current = [];
    sending.current = true;
    try {
      await fetch(`/api/rooms/${code}/strokes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, seq: seqRef.current, ops }),
      });
    } catch {
      // 네트워크 오류 시 해당 조각은 버림
    } finally {
      sending.current = false;
    }
  }, [code, playerId]);

  useEffect(() => {
    if (!canDraw) return;
    const t = setInterval(flush, 90);
    return () => clearInterval(t);
  }, [canDraw, flush]);

  const queue = (op: StrokeOp) => {
    const last = pending.current[pending.current.length - 1];
    if (op.t === "d" && last?.t === "d" && last.s === op.s && last.p.length < 800) last.p.push(...op.p);
    else pending.current.push(op.t === "d" ? { ...op, p: [...op.p] } : op);
  };

  const emit = (op: StrokeOp) => {
    applyOp(op);
    queue(op);
  };

  const point = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [
      Math.round(Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W))),
      Math.round(Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H))),
    ];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = strokes.current.reduce((m, st) => Math.max(m, st.s), 0) + 1;
    current.current = s;
    emit({ t: "d", s, c: erasing ? "erase" : color, w: size, p: [point(e)] });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!canDraw || s === null) return;
    const last = strokes.current[strokes.current.length - 1];
    if (!last || last.s !== s) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const pts: [number, number][] = [];
    let prev = last.p[last.p.length - 1];
    for (const ev of events) {
      const p = point(ev);
      if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) >= 1.5) {
        pts.push(p);
        prev = p;
      }
    }
    if (pts.length) emit({ t: "d", s, c: last.c, w: last.w, p: pts });
  };

  const onUp = () => {
    current.current = null;
  };

  return (
    <div className="board-wrap">
      <div className="chalkboard">
        <div className={`board-surface ${canDraw ? "can-draw" : ""}`}>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="칠판"
          />
          {overlay}
        </div>
      </div>
      <div className="chalk-tray">
        {canDraw ? (
          <div className="tools">
            <div className="tool-group">
              <span className="tray-label">분필 색</span>
              <div className="tool-row">
                {CHALKS.map((ch) => (
                  <button
                    key={ch.c}
                    className={`chalk-btn ${!erasing && color === ch.c ? "on" : ""}`}
                    style={{ background: ch.c }}
                    title={`${ch.name} 분필`}
                    aria-label={`${ch.name} 분필`}
                    aria-pressed={!erasing && color === ch.c}
                    onClick={() => {
                      setColor(ch.c);
                      setErasing(false);
                    }}
                  />
                ))}
              </div>
            </div>
            <span className="tool-sep" />
            <div className="tool-group">
              <span className="tray-label">{erasing ? "지우개 크기" : "굵기"}</span>
              <div className="tool-row">
                {SIZES.map((s) => (
                  <button
                    key={s.w}
                    className={`size-btn ${size === s.w ? "on" : ""}`}
                    onClick={() => setSize(s.w)}
                    title={s.name}
                    aria-label={`굵기 ${s.name}`}
                    aria-pressed={size === s.w}
                  >
                    <i
                      style={{
                        width: Math.min(28, s.w + 3),
                        height: Math.min(28, s.w + 3),
                        background: erasing ? "#f5ecd9" : color,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <span className="tool-sep" />
            <div className="tool-group">
              <span className="tray-label">지우개</span>
              <div className="tool-row">
                <button
                  className={`eraser-btn ${erasing ? "on" : ""}`}
                  onClick={() => setErasing((v) => !v)}
                  title="부분 지우개: 문지른 곳만 지워요"
                  aria-pressed={erasing}
                >
                  부분
                </button>
                <button
                  className="eraser-btn all"
                  onClick={() => {
                    if (strokes.current.length && confirm("칠판을 전부 지울까요?")) emit({ t: "clear" });
                  }}
                  title="전체 지우개: 칠판을 모두 지워요"
                >
                  전체
                </button>
                <button className="btn small ghost" onClick={() => emit({ t: "undo" })} title="방금 그린 선 취소">
                  ↩
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="tools">
            <div className="chalk-pieces" aria-hidden>
              {CHALKS.slice(0, 5).map((ch, i) => (
                <span key={ch.c} className="chalk-piece" style={{ background: ch.c, transform: `rotate(${(i % 2 ? 1 : -1) * (i + 2)}deg)` }} />
              ))}
            </div>
            <span className="tray-label">{trayInfo}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default Board;
