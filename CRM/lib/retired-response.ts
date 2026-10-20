import { NextResponse } from "next/server";
import { filterRetiredRecords, getRetiredIds, type RetiredDataset } from "./retired-records";

export function withRetiredResponse(handler: (...args: any[]) => Promise<Response>, dataset: RetiredDataset, field: string) {
  return async (...args: any[]) => {
    const response = await handler(...args);
    const body = await response.json();
    if (Array.isArray(body[field])) {
      body[field] = filterRetiredRecords(dataset, body[field]);
      if (typeof body.count === "number") body.count = body[field].length;
    }
    body.retiredIds = getRetiredIds(dataset);
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  };
}
