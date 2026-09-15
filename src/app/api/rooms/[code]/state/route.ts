import { handle, type Ctx } from "@/lib/api";
import { getState } from "@/lib/game";

export const dynamic = "force-dynamic";
// 주제 자동 선택 시 AI 제시어 생성이 포함될 수 있음
export const maxDuration = 60;

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const q = new URL(req.url).searchParams;
    const num = (k: string) => Math.max(0, Math.floor(Number(q.get(k)) || 0));
    return getState(code, q.get("playerId"), num("seq"), num("strokeAfter"), num("msgAfter"));
  });
}
