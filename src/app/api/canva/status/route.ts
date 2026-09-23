import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canvaConfigured } from "@/lib/canva";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({ configured: canvaConfigured(), connected: Boolean(jar.get("canva_token")?.value) });
}
