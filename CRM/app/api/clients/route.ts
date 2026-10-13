import { NextRequest, NextResponse } from "next/server";
import type { Client } from "@/types";
import { mergeSharedData, readSharedData, updateSharedData } from "@/lib/shared-data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clients = (await readSharedData("clients")) as Client[];
    return NextResponse.json(
      { success: true, data: clients, clients },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/clients failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "The client database is unavailable" } },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incoming: Client[] = Array.isArray(body?.clients)
      ? body.clients
      : body?.client
      ? [body.client]
      : body?.id
      ? [body]
      : [];
    if (incoming.length === 0) {
      return NextResponse.json({ success: false, error: { message: "A client record is required" } }, { status: 400 });
    }
    const clients = await updateSharedData(
      "clients",
      (current) => mergeSharedData(current, incoming)
    ) as Client[];
    const saved = incoming[0];
    return NextResponse.json({ success: true, data: saved, client: saved, clients });
  } catch (error) {
    console.error("POST /api/clients failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "The client was not saved to the database" } },
      { status: 503 }
    );
  }
}
