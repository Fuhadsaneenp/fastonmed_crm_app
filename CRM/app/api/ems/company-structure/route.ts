import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = [
    {
      id: "fastonmed-hq",
      name: "FastonMed",
      legalName: "FastonMed Healthcare Equipment & Medical Solutions LLC",
      phoneCode: "+971",
      phone: "50 000 0001",
      email: "info@fastonmed.com",
      overview:
        "FastonMed is a premier healthcare equipment distribution and biomedical engineering solutions provider based in Dubai Healthcare City, UAE.",
      worksSevenDays: false,
    },
  ];

  const offices = [
    {
      id: "off-fastonmed-dhcc",
      companyId: "fastonmed-hq",
      name: "FastonMed HQ",
      placeName: "Dubai Healthcare City",
      country: "United Arab Emirates",
      isHQ: true,
      active: true,
      timezone: "GMT +04:00 Dubai, Abu Dhabi",
      phone: "+971 4 000 0000",
      email: "info@fastonmed.com",
      employeeCount: 5,
    },
  ];

  const departments = [
    {
      id: "dept-mgmt",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Management",
      code: "MGMT",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 2,
    },
    {
      id: "dept-sales",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Sales",
      code: "SALES",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 2,
    },
    {
      id: "dept-admin",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Administration",
      code: "ADMIN",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 1,
    },
    {
      id: "dept-ops",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Operations & Biomedical",
      code: "OPS",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 1,
    },
  ];

  const jobTitles = [
    {
      id: "job-superadmin",
      title: "Super Admin",
      departmentId: "dept-mgmt",
      departmentName: "Management",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
    {
      id: "job-ops-mgr",
      title: "Operations Manager",
      departmentId: "dept-mgmt",
      departmentName: "Management",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
    {
      id: "job-sales-exec",
      title: "Sales Executive",
      departmentId: "dept-sales",
      departmentName: "Sales",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 2,
      active: true,
    },
    {
      id: "job-client-rel",
      title: "Client Relations",
      departmentId: "dept-admin",
      departmentName: "Administration",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
  ];

  return NextResponse.json({
    success: true,
    data: {
      companies,
      offices,
      departments,
      jobTitles,
    },
  });
}
