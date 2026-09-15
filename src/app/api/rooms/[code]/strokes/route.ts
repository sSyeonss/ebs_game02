import { body, handle, type Ctx } from "@/lib/api";
import { addStrokes } from "@/lib/game";


export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return addStrokes(code, b.playerId, b.seq, b.ops);
  });
}
