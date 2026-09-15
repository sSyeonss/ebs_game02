import { body, handle, type Ctx } from "@/lib/api";
import { sendChat } from "@/lib/game";


export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return sendChat(code, b.playerId, b.text);
  });
}
