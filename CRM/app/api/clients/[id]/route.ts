import { NextRequest, NextResponse } from "next/server";
import type { Client } from "@/types";
import { updateSharedData } from "@/lib/shared-data-store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const incoming = (await request.json()) as Partial<Client>;
    let client: Client | null = null;
    await updateSharedData("clients", (records) => {
      const current = records as Client[];
      const index = current.findIndex((item) => item.id === id);
      client = { ...(index >= 0 ? current[index] : {}), ...incoming, id } as Client;
      return index >= 0
        ? current.map((item) => (item.id === id ? client as Client : item))
        : [client, ...current];
    });
    return NextResponse.json({ success: true, data: client, client });
  } catch (error) {
    console.error("PUT /api/clients/[id] failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "The client update was not saved to the database" } },
      { status: 503 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const clients = await updateSharedData(
      "clients",
      (records) => (records as Client[]).filter((client) => client.id !== id)
    ) as Client[];
    return NextResponse.json({ success: true, data: { id }, clients });
  } catch (error) {
    console.error("DELETE /api/clients/[id] failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "The client was not deleted from the database" } },
      { status: 503 }
    );
  }
}
