import { body, handle, type Ctx } from "@/lib/api";
import { selectTopic } from "@/lib/game";

export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return selectTopic(code, b.playerId, b.topic, b.difficulty);
  });
}
