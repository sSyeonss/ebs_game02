import { body, handle, type Ctx } from "@/lib/api";
import { manageNpc } from "@/lib/game";

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return manageNpc(code, b.playerId, b.action, b.npcId);
  });
}
