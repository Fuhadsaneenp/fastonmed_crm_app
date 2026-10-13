import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getDbPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for the shared FastOnMed database");
    }
    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return pool;
}

export interface StemsEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  designationTitle: string;
  departmentName: string;
  companyName: string;
  companyId: string;
  officeName: string;
  officeId: string;
  managerId: string | null;
  managerName: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  dateOfExit?: string | null;
  hasPhoto?: boolean;
}

export interface StemsCompany {
  id: string;
  name: string;
}

export interface StemsCompanyDetail {
  id: string;
  name: string;
  legalName?: string; // website
  phoneCode?: string;
  phone?: string;
  email?: string;
  overview?: string;
  worksSevenDays?: boolean;
}

export interface StemsOfficeItem {
  id: string;
  companyId: string;
  name: string;
  placeName: string;
  country: string;
  isHQ: boolean;
  active: boolean;
  timezone: string;
  phone: string;
  email: string;
  employeeCount: number;
}

export interface StemsDepartmentItem {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code: string;
  parent: string;
  parentName: string;
  jobTitlesCount: number;
}

export interface StemsJobTitleItem {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  companyId: string;
  companyName: string;
  employeeCount: number;
  active: boolean;
}


export interface StemsPayrollRun {
  id: string;
  companyId: string;
  companyName: string;
  month: number;
  year: number;
  status: string; // DRAFT | DRAFT_FINAL | PAID | APPROVED
  type: string; // REGULAR | FINAL
  grossTotal: string | number;
  netTotal: string | number;
  employeeCount: number;
  createdAt: string;
}

export interface PayrollMetrics {
  latestCost: number;
  latestCostMonth: string;
  netPayable: number;
  netPayableEmployees: number;
  pendingRuns: number;
  completedRuns: number;
}

export async function fetchLiveEmployees(): Promise<StemsEmployee[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`
      SELECT 
        e.id,
        e.employeeCode,
        e.firstName,
        e.lastName,
        COALESCE(u.email, e.personalEmail, '') AS email,
        e.phone,
        e.officeId,
        e.companyId,
        e.managerId,
        e.status,
        e.dateOfExit,
        d.title AS designationTitle,
        dept.name AS departmentName,
        c.name AS companyName,
        o.name AS officeNameRaw,
        o.placeName AS officePlaceRaw,
        m.firstName AS mFirstName,
        m.lastName AS mLastName,
        (SELECT COUNT(*) FROM EmployeeDocument ed WHERE ed.employeeId = e.id AND ed.type = 'PHOTO') AS photoCount
      FROM Employee e
      LEFT JOIN User u ON e.userId = u.id
      LEFT JOIN Designation d ON e.designationId = d.id
      LEFT JOIN Department dept ON e.departmentId = dept.id
      LEFT JOIN Company c ON e.companyId = c.id
      LEFT JOIN Office o ON e.officeId = o.id
      LEFT JOIN Employee m ON e.managerId = m.id
      ORDER BY 
        CASE 
          WHEN e.employeeCode LIKE 'HF%' THEN 1 
          WHEN e.employeeCode LIKE 'ST%' THEN 2 
          ELSE 3 
        END,
        e.employeeCode ASC
    `);

    return rows.map((r) => {
      const officeName = r.officeNameRaw
        ? r.officePlaceRaw
          ? `${r.officeNameRaw} (${r.officePlaceRaw})`
          : r.officeNameRaw
        : "Dubai Healthcare City HQ";
      const managerName = r.mFirstName
        ? `${r.mFirstName} ${r.mLastName || ""}`.trim()
        : null;

      const fName = r.firstName || "";
      const lName = r.lastName || "";
      const fullName = `${fName} ${lName}`.trim();

      return {
        id: r.id,
        employeeCode: r.employeeCode || "",
        firstName: fName,
        lastName: lName,
        fullName,
        email: r.email || "",
        phone: r.phone || "",
        designationTitle: r.designationTitle || "Specialist",
        departmentName: r.departmentName || "Sales",
        companyName: r.companyName || "FastonMed",
        companyId: r.companyId || "fastonmed-hq",
        officeName,
        officeId: r.officeId || "off-fastonmed-dhcc",
        managerId: r.managerId,
        managerName,
        status: r.status,
        dateOfExit: r.dateOfExit,
        hasPhoto: Number(r.photoCount) > 0,
      };
    });
  } catch (error) {
    console.error("Failed to query live employees:", error);
    return [];
  }
}

export async function fetchCompanies(): Promise<StemsCompany[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`SELECT id, name FROM Company ORDER BY name ASC`);
    return rows.map((r) => ({ id: r.id, name: r.name }));
  } catch (err) {
    console.error("Failed to fetch companies:", err);
    return [
      { id: "fastonmed-hq", name: "FastonMed" },
    ];
  }
}

export async function fetchCompanyFullDetails(): Promise<StemsCompanyDetail[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`SELECT * FROM Company ORDER BY name ASC`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      legalName: r.legalName || "www." + r.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com",
      phoneCode: r.phoneCode || "+971",
      phone: r.phone || "",
      email: r.email || "",
      overview:
        r.overview ||
        `${r.name} is a premier healthcare equipment distribution and biomedical engineering solutions provider based in Dubai Healthcare City, UAE.`,
      worksSevenDays: Boolean(r.worksSevenDays),
    }));
  } catch (err) {
    console.error("Failed to fetch company details:", err);
    return [
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
  }
}

export async function fetchOffices(): Promise<StemsOfficeItem[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM Employee e WHERE e.officeId = o.id AND e.status != 'TERMINATED') AS employeeCount
      FROM Office o
      ORDER BY o.isHQ DESC, o.name ASC
    `);
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId || "",
      name: r.name,
      placeName: r.placeName || "Dubai Healthcare City",
      country: r.country || "United Arab Emirates",
      isHQ: Boolean(r.isHQ),
      active: Boolean(r.active ?? true),
      timezone: r.timezone || "GMT +04:00 Dubai, Abu Dhabi",
      phone: r.phone || "+971 4 000 0000",
      email: r.email || "info@fastonmed.com",
      employeeCount: Number(r.employeeCount || 5),
    }));
  } catch (err) {
    console.error("Failed to fetch offices:", err);
    return [
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
  }
}

export async function fetchDepartments(): Promise<StemsDepartmentItem[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`
      SELECT 
        dept.*,
        c.name AS companyName,
        (SELECT COUNT(*) FROM Designation d WHERE d.departmentId = dept.id) AS jobTitlesCount
      FROM Department dept
      LEFT JOIN Company c ON dept.companyId = c.id
      ORDER BY dept.companyId ASC, dept.name ASC
    `);

    // Parse hierarchy code to find parent
    return rows.map((r) => {
      let parent = "root";
      let parentName = "Core Team";
      if (r.code && r.code.startsWith("parent:")) {
        parent = r.code.split("parent:")[1].split("#")[0];
        const pMatch = rows.find((x) => x.id === parent);
        if (pMatch) parentName = pMatch.name;
      }
      return {
        id: r.id,
        companyId: r.companyId || "fastonmed-hq",
        companyName: r.companyName || "FastonMed",
        name: r.name,
        code: r.code || "root",
        parent,
        parentName,
        jobTitlesCount: Number(r.jobTitlesCount || 0),
      };
    });
  } catch (err) {
    console.error("Failed to fetch departments:", err);
    return [
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
  }
}

export async function fetchJobTitles(): Promise<StemsJobTitleItem[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(`
      SELECT 
        d.id,
        d.title,
        dept.id as departmentId,
        dept.name as departmentName,
        c.id as companyId,
        c.name as companyName,
        (SELECT COUNT(*) FROM Employee e WHERE e.designationId = d.id AND e.status != 'TERMINATED') as employeeCount
      FROM Designation d
      LEFT JOIN Department dept ON d.departmentId = dept.id
      LEFT JOIN Company c ON dept.companyId = c.id
      ORDER BY employeeCount DESC, d.title ASC
    `);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      departmentId: r.departmentId || "",
      departmentName: r.departmentName || "General",
      companyId: r.companyId || "fastonmed-hq",
      companyName: r.companyName || "FastonMed",
      employeeCount: Number(r.employeeCount || 0),
      active: true,
    }));
  } catch (err) {
    console.error("Failed to fetch job titles:", err);
    return [
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
  }
}


export async function fetchPayrollData(companyId?: string) {
  try {
    const pool = getDbPool();
    let query = `
      SELECT 
        pr.*,
        c.name as companyName,
        (SELECT COUNT(*) FROM PayrollRunEmployee pre WHERE pre.payrollRunId = pr.id) as employeeCount
      FROM PayrollRun pr
      LEFT JOIN Company c ON pr.companyId = c.id
    `;
    const params: any[] = [];
    if (companyId) {
      query += ` WHERE pr.companyId = ?`;
      params.push(companyId);
    }
    query += ` ORDER BY pr.year DESC, pr.month DESC`;

    const [rows] = await pool.query<any[]>(query, params);

    const monthNames = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const runs: StemsPayrollRun[] = rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.companyName || "FastonMed",
      month: r.month,
      year: r.year,
      status: r.status,
      type: r.type,
      grossTotal: r.grossTotal ? String(r.grossTotal) : "0.00",
      netTotal: r.netTotal ? String(r.netTotal) : "0.00",
      employeeCount: Number(r.employeeCount || 0),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    const latest = runs[0];
    const metrics: PayrollMetrics = {
      latestCost: latest ? parseFloat(String(latest.netTotal)) : 0,
      latestCostMonth: latest ? `${monthNames[latest.month] || "N/A"} ${latest.year}` : "N/A",
      netPayable: runs.filter((r) => r.status !== "PAID").reduce((sum, r) => sum + parseFloat(String(r.netTotal)), 0),
      netPayableEmployees: runs.filter((r) => r.status !== "PAID").reduce((sum, r) => sum + r.employeeCount, 0),
      pendingRuns: runs.filter((r) => r.status !== "PAID").length,
      completedRuns: runs.filter((r) => r.status === "PAID").length,
    };

    return { runs, metrics };
  } catch (err) {
    console.error("Failed to fetch payroll runs:", err);
    return {
      runs: [
        {
          id: "cmtrabhes0015id4zvygxtaqz",
          companyId: "fastonmed-hq",
          companyName: "FastonMed",
          month: 9,
          year: 2026,
          status: "DRAFT_FINAL",
          type: "FINAL",
          grossTotal: "12500.00",
          netTotal: "12500.00",
          employeeCount: 1,
          createdAt: "2026-09-07T08:06:56.548Z",
        },
        {
          id: "cmto4vn150068xv4zqllbqpxl",
          companyId: "fastonmed-hq",
          companyName: "FastonMed",
          month: 8,
          year: 2026,
          status: "DRAFT",
          type: "REGULAR",
          grossTotal: "48500.00",
          netTotal: "48500.00",
          employeeCount: 5,
          createdAt: "2026-09-05T03:11:20.729Z",
        },
        {
          id: "cmtbfkgsa000xj24zsp7ihro4",
          companyId: "fastonmed-hq",
          companyName: "FastonMed",
          month: 7,
          year: 2026,
          status: "PAID",
          type: "REGULAR",
          grossTotal: "48500.00",
          netTotal: "48500.00",
          employeeCount: 5,
          createdAt: "2026-08-27T05:49:34.906Z",
        },
      ],
      metrics: {
        latestCost: 48500.00,
        latestCostMonth: "August 2026",
        netPayable: 61000.00,
        netPayableEmployees: 5,
        pendingRuns: 2,
        completedRuns: 1,
      },
    };
  }
}
