import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      `SELECT fileData, mimeType FROM EmployeeDocument WHERE employeeId = ? AND type = 'PHOTO' LIMIT 1`,
      [employeeId]
    );

    if (!rows || rows.length === 0 || !rows[0].fileData) {
      return new NextResponse(null, { status: 404 });
    }

    const doc = rows[0];
    return new NextResponse(doc.fileData, {
      headers: {
        "Content-Type": doc.mimeType || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return new NextResponse(null, { status: 500 });
  }
}
