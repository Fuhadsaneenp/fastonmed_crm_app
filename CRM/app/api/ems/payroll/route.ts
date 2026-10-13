import { NextRequest, NextResponse } from "next/server";
import { fetchPayrollData, getDbPool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || undefined;
    const data = await fetchPayrollData(companyId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch payroll data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, month, year, payrollType } = body;

    const pool = getDbPool();
    const id = `run_${Date.now()}`;
    const status = payrollType === "FINAL" ? "DRAFT_FINAL" : "DRAFT";

    // Insert dummy or calculated run
    await pool.query(
      `
      INSERT INTO PayrollRun (id, companyId, month, year, processedBy, status, type, grossTotal, netTotal, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        id,
        companyId || "cmrtifqe00002ty4zqy0vdpsr",
        month,
        year,
        "fastonmed_admin",
        status,
        payrollType || "REGULAR",
        "0.00",
        "0.00",
      ]
    );

    return NextResponse.json({ success: true, message: "Payroll run created", id });
  } catch (error: any) {
    console.error("Failed to generate payroll run:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate payroll" },
      { status: 500 }
    );
  }
}
