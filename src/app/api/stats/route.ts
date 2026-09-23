import { NextResponse } from "next/server";
import { countScanned, dbEnabled } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = dbEnabled() ? await countScanned().catch(() => ({ churches: 0, resources: 0 })) : { churches: 0, resources: 0 };
  return NextResponse.json({ ...stats, ai: aiEnabled(), db: dbEnabled(), canva: Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET) });
}
