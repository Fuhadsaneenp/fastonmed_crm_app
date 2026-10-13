"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { Employee } from "@/types";
import toast from "react-hot-toast";

const DEPT_COLORS: Record<string, { bg: string; color: string }> = {
  Sales: { bg: "#dbeafe", color: "#2563eb" },
  Technical: { bg: "#d1fae5", color: "#059669" },
  Management: { bg: "#ede9fe", color: "#7c3aed" },
  Finance: { bg: "#fef3c7", color: "#d97706" },
};

const AVATAR_COLORS = [
  "linear-gradient(135deg, #2563eb, #0891b2)",
  "linear-gradient(135deg, #7c3aed, #a855f7)",
  "linear-gradient(135deg, #059669, #0d9488)",
  "linear-gradient(135deg, #d97706, #f59e0b)",
  "linear-gradient(135deg, #dc2626, #f97316)",
  "linear-gradient(135deg, #0891b2, #06b6d4)",
  "linear-gradient(135deg, #6366f1, #818cf8)",
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<"directory" | "leaves" | "attendance" | "payroll">("directory");

  const [leaveRequests, setLeaveRequests] = useState([
    { id: "L1", name: "Hashim", role: "Operations Manager", type: "Annual Leave", from: "2026-09-08", to: "2026-09-10", days: 3, status: "Pending" },
    { id: "L2", name: "Fidha", role: "Client Relations", type: "Medical Leave", from: "2026-09-04", to: "2026-09-05", days: 2, status: "Approved" },
    { id: "L3", name: "Riyas", role: "Sales Executive", type: "Casual Leave", from: "2026-09-15", to: "2026-09-15", days: 1, status: "Approved" },
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadEmployees = async () => {
      setIsLoadingEmployees(true);
      setEmployeeLoadError(null);
      try {
        const liveEmployees = await apiRequest<Employee[]>("/api/employees");
        if (isMounted) setEmployees(liveEmployees);
      } catch (error) {
        console.error("Failed to load employees:", error);
        if (isMounted) {
          setEmployees([]);
          setEmployeeLoadError("Could not load live employees from the API.");
        }
      } finally {
        if (isMounted) setIsLoadingEmployees(false);
      }
    };

    loadEmployees();

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = employees.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === "All" || e.department === filterDept;
    return matchSearch && matchDept;
  });

  const totalRevenue = employees.reduce((s, e) => s + e.performance.revenue, 0);

  if (selected) {
    return <EmployeeProfile employee={selected} onBack={() => setSelected(null)} colorIdx={employees.indexOf(selected)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
      {/* EMS Section Navigation Header */}
      <div
        className="card"
        style={{
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderLeft: "4px solid #2563eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>EMS — Employee Management Suite</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Staff directory, attendance logs, leave approvals & payroll</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
          {[
            { key: "directory", label: "Staff Directory", icon: "📋" },
            { key: "leaves", label: "Leaves & Time-Off", icon: "🌴" },
            { key: "attendance", label: "Attendance & Logs", icon: "⏱️" },
            { key: "payroll", label: "Payroll & Salary", icon: "💳" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 12.5,
                fontWeight: activeTab === tab.key ? 700 : 500,
                backgroundColor: activeTab === tab.key ? "#ffffff" : "transparent",
                color: activeTab === tab.key ? "#2563eb" : "#64748b",
                boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {employeeLoadError && (
        <div className="card" style={{ padding: "10px 14px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {employeeLoadError}
        </div>
      )}

      {isLoadingEmployees && (
        <div className="card" style={{ padding: "10px 14px", border: "1px solid #dbeafe", background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 600 }}>
          Loading live employees...
        </div>
      )}

      {activeTab === "leaves" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>14</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Annual Leave Balance Avg</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>1</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Pending Approvals</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>96.4%</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Staff Availability This Month</div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Recent Leave Requests</h3>
            <div className="table-container">
              <table data-mobile-cards="true">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>From - To</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((lr) => (
                    <tr key={lr.id}>
                      <td data-label="Employee" style={{ fontWeight: 600 }}>{lr.name} <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>({lr.role})</span></td>
                      <td data-label="Type">{lr.type}</td>
                      <td data-label="From - To">{lr.from} to {lr.to}</td>
                      <td data-label="Duration">{lr.days} Day(s)</td>
                      <td data-label="Status">
                        <span className={`badge ${lr.status === "Approved" ? "badge-success" : "badge-warning"}`}>
                          {lr.status}
                        </span>
                      </td>
                      <td data-label="Action">
                        {lr.status === "Pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() => {
                                setLeaveRequests(prev => prev.map(item => item.id === lr.id ? { ...item, status: "Approved" } : item));
                                toast.success(`Approved leave for ${lr.name}`);
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "4px 8px", fontSize: 11, color: "#dc2626" }}
                              onClick={() => {
                                setLeaveRequests(prev => prev.map(item => item.id === lr.id ? { ...item, status: "Rejected" } : item));
                                toast.error(`Declined leave for ${lr.name}`);
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>24 / 26</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Present Today</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>09:12 AM</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Average Clock-In</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed" }}>8.4 Hrs</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Average Shift Duration</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>2 On Field</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Hospital Site Visits</div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Today's Clock-in Log</h3>
            <div className="table-container">
              <table data-mobile-cards="true">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Department</th>
                    <th>Punch In</th>
                    <th>Location / Mode</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, i) => (
                    <tr key={e.id}>
                      <td data-label="Staff Name" style={{ fontWeight: 600 }}>{e.name}</td>
                      <td data-label="Department">{e.department}</td>
                      <td data-label="Punch In">{i % 2 === 0 ? "08:58 AM" : "09:14 AM"}</td>
                      <td data-label="Location / Mode">{e.department === "Technical" ? "Cleveland Clinic Abu Dhabi Site" : "Fastonmed UAE HQ, Dubai Healthcare City"}</td>
                      <td data-label="Status">
                        <span className="badge badge-success">On Duty</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "payroll" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>AED 184,500</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Monthly Disbursal</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>AED 24,000</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Sales & Service Incentives</div>
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed" }}>Sep 01, 2026</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Last Processed Cycle</div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Employee Compensation & Payslips</h3>
            <div className="table-container">
              <table data-mobile-cards="true">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Designation</th>
                    <th>Base Tier</th>
                    <th>Incentive Earned</th>
                    <th>Net Pay</th>
                    <th>Status</th>
                    <th>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Staff Name" style={{ fontWeight: 600 }}>{e.name}</td>
                      <td data-label="Designation">{e.role}</td>
                      <td data-label="Base Tier">AED 14,000</td>
                      <td data-label="Incentive Earned" style={{ color: "#059669", fontWeight: 600 }}>+AED 3,500</td>
                      <td data-label="Net Pay" style={{ fontWeight: 700 }}>AED 17,500</td>
                      <td data-label="Status"><span className="badge badge-success">Disbursed</span></td>
                      <td data-label="Payslip">
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={() => toast.success(`Downloaded payslip for ${e.name}`)}
                        >
                          📄 Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "directory" && (
        <>
          {/* Stats */}
          <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Total Employees", value: employees.length, color: "#2563eb" },
              { label: "Sales Team", value: employees.filter((e) => e.department === "Sales").length, color: "#7c3aed" },
              { label: "Technical Team", value: employees.filter((e) => e.department === "Technical").length, color: "#059669" },
              { label: "Total Revenue Generated", value: formatCurrency(totalRevenue), color: "#d97706" },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: typeof s.value === "string" ? 18 : 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="form-input"
              placeholder="🔍  Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 260 }}
            />
            <select className="form-input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="All">All Departments</option>
              <option>Sales</option>
              <option>Technical</option>
              <option>Management</option>
              <option>Finance</option>
            </select>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn btn-primary" onClick={() => toast.success("Add employee form opened")}>+ Add Employee</button>
            </div>
          </div>

      {/* Employee Cards */}
      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map((emp, idx) => {
          const dept = DEPT_COLORS[emp.department] || { bg: "#f1f5f9", color: "#64748b" };
          return (
            <div
              key={emp.id}
              className="card"
              style={{ padding: 0, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
              onClick={() => setSelected(emp)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "";
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              {/* Top gradient */}
              <div style={{ height: 6, background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }} />

              <div style={{ padding: "20px 22px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 20,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(emp.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{emp.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>{emp.role}</div>
                    <span
                      style={{
                        fontSize: 11,
                        background: dept.bg,
                        color: dept.color,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 600,
                        display: "inline-block",
                        marginTop: 4,
                      }}
                    >
                      {emp.department}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>📞 {emp.phone}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>✉️ {emp.email}</div>
                </div>

                <div data-mobile-grid="stack"
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 8,
                  }}
                >
                  {emp.department === "Technical" ? (
                    <>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{emp.performance.serviceTickets}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>Tickets</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.performance.leadsAssigned}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>Leads</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.performance.dealsClosed}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>Closed</div>
                      </div>
                    </>
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#059669" }}>
                      {formatCurrency(emp.performance.revenue)}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Revenue</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14 }}>{"⭐".repeat(Math.floor(emp.performance.rating))}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{emp.performance.rating}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

function EmployeeProfile({ employee, onBack, colorIdx }: { employee: Employee; onBack: () => void; colorIdx: number }) {
  const convRate = employee.performance.leadsAssigned > 0
    ? Math.round((employee.performance.dealsClosed / employee.performance.leadsAssigned) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}>
        ← Back to Employees
      </button>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 100, background: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length] }} />
        <div style={{ padding: "0 28px 24px" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 28,
              fontWeight: 700,
              marginTop: -40,
              border: "4px solid white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {getInitials(employee.name)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ marginTop: 12 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>{employee.name}</h1>
              <p style={{ color: "#64748b", fontSize: 14 }}>{employee.role} · {employee.department}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary">✏️ Edit</button>
              <button className="btn btn-primary">📋 Assign Task</button>
            </div>
          </div>
        </div>
      </div>

      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Contact Info</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13 }}>📞 {employee.phone}</div>
              <div style={{ fontSize: 13 }}>✉️ {employee.email}</div>
              <div style={{ fontSize: 13 }}>📅 Joined: {employee.joiningDate}</div>
              <div style={{ fontSize: 13 }}>
                🔴 Status:{" "}
                <span style={{ color: employee.status === "Active" ? "#059669" : "#dc2626", fontWeight: 600 }}>
                  {employee.status}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Assigned Clients</h3>
            <div style={{ fontSize: 13, color: employee.assignedClients.length ? "#475569" : "#94a3b8" }}>
              {employee.assignedClients.length > 0
                ? `${employee.assignedClients.length} client(s) assigned`
                : "No clients assigned"}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Performance Metrics</h3>
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {employee.department === "Technical" ? (
              <>
                {[
                  { label: "Service Tickets", value: employee.performance.serviceTickets, suffix: "", color: "#059669" },
                  { label: "Rating", value: employee.performance.rating.toString(), suffix: "/5", color: "#d97706" },
                ].map((m) => (
                  <div key={m.label} style={{ background: "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}{m.suffix}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: "Leads Assigned", value: employee.performance.leadsAssigned, suffix: "", color: "#2563eb" },
                  { label: "Deals Closed", value: employee.performance.dealsClosed, suffix: "", color: "#059669" },
                  { label: "Conversion Rate", value: convRate, suffix: "%", color: "#7c3aed" },
                  { label: "Rating", value: employee.performance.rating.toString(), suffix: "/5", color: "#d97706" },
                ].map((m) => (
                  <div key={m.label} style={{ background: "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}{m.suffix}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Revenue Generated</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#059669" }}>{formatCurrency(employee.performance.revenue)}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "75%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
