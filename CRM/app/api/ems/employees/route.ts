import { NextResponse } from "next/server";
import { mockEmployees } from "@/lib/mock-data";

export async function GET() {
  const data = mockEmployees.map((e, idx) => ({
    id: e.id,
    employeeCode: `FM00${idx + 1}`,
    firstName: e.name.split(" ")[0] || e.name,
    lastName: e.name.split(" ").slice(1).join(" "),
    fullName: e.name,
    name: e.name,
    email: e.email,
    phone: e.phone,
    designationTitle: e.role,
    role: e.role,
    designation: e.role,
    departmentName: e.department,
    department: e.department,
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: e.id === "emp-fuhad" ? null : "emp-fuhad",
    managerName: e.id === "emp-fuhad" ? null : "Fuhad",
    status: "ACTIVE",
  }));

  return NextResponse.json({ success: true, data, employees: data });
}
