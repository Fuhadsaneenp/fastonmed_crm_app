import { NextResponse } from "next/server";

export async function GET() {
  const companies = [
    { id: "fastonmed-hq", name: "FastonMed" },
  ];
  return NextResponse.json({ success: true, data: companies });
}
