import { NextResponse } from "next/server";
import { GameError } from "./game";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    const msg = e instanceof Error && /DATABASE_URL/.test(e.message) ? e.message : "서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export type Ctx = { params: Promise<{ code: string }> };
