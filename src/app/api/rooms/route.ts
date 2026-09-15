import { body, handle } from "@/lib/api";
import { createRoom } from "@/lib/game";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    return createRoom(b.playerId, b.name);
  });
}
