import { NextRequest, NextResponse } from "next/server";
import {
  isSharedDataset,
  mergeSharedData,
  readSharedData,
  updateSharedData,
} from "@/lib/shared-data-store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ dataset: string }> };

function invalidDataset() {
  return NextResponse.json({ success: false, error: "Unknown shared dataset" }, { status: 404 });
}

export async function GET(_request: NextRequest, context: Context) {
  const { dataset } = await context.params;
  if (!isSharedDataset(dataset)) return invalidDataset();
  try {
    const data = await readSharedData(dataset);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`GET shared dataset ${dataset} failed:`, error);
    return NextResponse.json(
      { success: false, error: "The shared database is currently unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { dataset } = await context.params;
  if (!isSharedDataset(dataset)) return invalidDataset();
  try {
    const body = await request.json();
    const incoming = Array.isArray(body) ? body : body?.data;
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ success: false, error: "An array is required" }, { status: 400 });
    }
    const data = await updateSharedData(dataset, (existing) =>
      body?.replace === true
        ? incoming
        : body?.preferExisting === true
        ? mergeSharedData(incoming, existing)
        : mergeSharedData(existing, incoming)
    );
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error(`POST shared dataset ${dataset} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Data was not saved because the database is unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { dataset } = await context.params;
  if (!isSharedDataset(dataset)) return invalidDataset();
  try {
    const body = await request.json().catch(() => ({}));
    const id = body?.id ? String(body.id) : "";
    const value = body?.value ? String(body.value).trim().toLowerCase() : "";
    if (!id && !value) {
      return NextResponse.json({ success: false, error: "id or value is required" }, { status: 400 });
    }
    const data = await updateSharedData(dataset, (current) =>
      current.filter((item) => {
        if (id && item && typeof item === "object" && String((item as { id?: unknown }).id || "") === id) return false;
        if (value && typeof item === "string" && item.trim().toLowerCase() === value) return false;
        return true;
      })
    );
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error(`DELETE shared dataset ${dataset} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Data was not deleted because the database is unavailable" },
      { status: 503 }
    );
  }
}
