"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getStoredServiceTickets,
  fetchStoredServiceTicketsFromServer,
  addStoredServiceTicket,
  updateStoredServiceTicket,
  updateStoredServiceTicketStatus,
  deleteStoredServiceTicket,
  getStoredEngineers,
  addStoredEngineer,
  DEFAULT_ENGINEERS,
} from "@/lib/service-store";
import { getStoredClients } from "@/lib/client-store";
import { mockEmployees } from "@/lib/mock-data";
import type { ServiceTicket, ServiceStatus, Client } from "@/types";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Calendar as CalendarIcon,
  Building2,
  Bookmark,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldCheck,
  User,
  Trash2,
  Edit3,
  X,
  Filter,
  Eye,
  Phone,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";

const SERVICE_STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  "New Request": { label: "New Request", bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  Assigned: { label: "Assigned", bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  "Visit Scheduled": { label: "Visit Scheduled", bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  "Under Repair": { label: "Under Repair", bg: "#fef3c7", text: "#d97706", border: "#fde68a" },
  "Waiting Parts": { label: "Waiting Parts", bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  Completed: { label: "Completed", bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" },
  Closed: { label: "Closed", bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

const ALL_STATUSES: ServiceStatus[] = [
  "New Request",
  "Assigned",
  "Visit Scheduled",
  "Under Repair",
  "Waiting Parts",
  "Completed",
  "Closed",
];

function getTaskCategory(ticket: ServiceTicket): string {
  const text = `${ticket.complaint} ${ticket.equipment}`.toLowerCase();
  if (text.includes("calibrat")) return "Calibration";
  if (text.includes("preventive") || text.includes("annual") || text.includes("routine") || text.includes("maintenance"))
    return "Preventive Maintenance";
  if (text.includes("replac") || text.includes("pump") || text.includes("spare") || text.includes("parts"))
    return "Parts Replacement";
  if (text.includes("error") || text.includes("alarm") || text.includes("fault") || text.includes("repair"))
    return "Corrective Repair";
  if (text.includes("audit") || text.includes("dha") || text.includes("inspect"))
    return "DHA Inspection";
  if (text.includes("leak") || text.includes("test")) return "Safety Testing";
  if (text.includes("install")) return "Installation";
  return "Clinical Service";
}

function formatSheetDate(dateStr?: string): string {
  if (!dateStr) return "Not Scheduled";
  try {
    const parts = dateStr.slice(0, 10).split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    }
    const fallback = new Date(dateStr);
    if (!isNaN(fallback.getTime())) {
      return fallback.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

const CLIENT_PASTELS = [
  { bg: "#e6fcf5", text: "#0ca678", border: "#bbf7d0" }, // Soft Mint
  { bg: "#e7f5ff", text: "#1c7ed6", border: "#bfdbfe" }, // Soft Sky
  { bg: "#f3f0ff", text: "#7048e8", border: "#ddd6fe" }, // Soft Violet
  { bg: "#fff4e6", text: "#d9480f", border: "#fed7aa" }, // Soft Coral
  { bg: "#ebfbee", text: "#2b8a3e", border: "#bbf7d0" }, // Soft Green
  { bg: "#fff0f6", text: "#c2255c", border: "#fbcfe8" }, // Soft Rose
  { bg: "#e3fafc", text: "#0c8599", border: "#bae6fd" }, // Soft Cyan
];

function getClientBadgeStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLIENT_PASTELS[Math.abs(hash) % CLIENT_PASTELS.length];
}

export default function ServiceTrackPage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [customEngineers, setCustomEngineers] = useState<string[]>([]);

  // Search and Filter States
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("All");
  const [filterEngineer, setFilterEngineer] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterAmc, setFilterAmc] = useState("All");

  // Selected Ticket for Inspection / Edit Modal
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // New Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newConcernedPerson, setNewConcernedPerson] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newComplaint, setNewComplaint] = useState("");
  const [newPriority, setNewPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [newStatus, setNewStatus] = useState<ServiceStatus>("Assigned");
  const [newEngineer, setNewEngineer] = useState("Hashim");
  const [newVisitDate, setNewVisitDate] = useState("2026-09-08");
  const [newAmcCovered, setNewAmcCovered] = useState(true);

  // Load and Sync Data
  useEffect(() => {
    setTickets(getStoredServiceTickets());
    setClients(getStoredClients());
    setCustomEngineers(getStoredEngineers());

    fetchStoredServiceTicketsFromServer().then((srv) => {
      if (srv && srv.length > 0) {
        setTickets(srv);
      }
    });

    const handleSync = () => {
      setTickets(getStoredServiceTickets());
      setClients(getStoredClients());
      setCustomEngineers(getStoredEngineers());
    };

    window.addEventListener("fastonmed_services_updated", handleSync);
    window.addEventListener("fastonmed_clients_updated", handleSync);
    window.addEventListener("fastonmed_engineers_updated", handleSync);
    return () => {
      window.removeEventListener("fastonmed_services_updated", handleSync);
      window.removeEventListener("fastonmed_clients_updated", handleSync);
      window.removeEventListener("fastonmed_engineers_updated", handleSync);
    };
  }, []);

  // Engineers / Team Members List
  const engineers = useMemo(() => {
    const stored = customEngineers.length > 0 ? customEngineers : getStoredEngineers();
    const empNames = mockEmployees.map((e) => e.name);
    const legacyDummies = ["Rahul Kumar", "Sneha Pillai", "Deepa Suresh"];
    const fromTickets = tickets
      .map((t) => t.assignedEngineerName)
      .filter((n) => Boolean(n) && !legacyDummies.includes(n));
    return Array.from(new Set([...stored, ...empNames, ...fromTickets]));
  }, [customEngineers, tickets]);

  // Unique clients from tickets and client store
  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach((t) => {
      if (t.clientName) names.add(t.clientName);
    });
    clients.forEach((c) => {
      if (c.name) names.add(c.name);
    });
    return Array.from(names).sort();
  }, [tickets, clients]);

  // Unique categories
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    tickets.forEach((t) => {
      cats.add(getTaskCategory(t));
    });
    return Array.from(cats).sort();
  }, [tickets]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchSearch =
          t.ticketNumber.toLowerCase().includes(q) ||
          t.equipment.toLowerCase().includes(q) ||
          t.clientName.toLowerCase().includes(q) ||
          (t.complaint && t.complaint.toLowerCase().includes(q)) ||
          (t.assignedEngineerName && t.assignedEngineerName.toLowerCase().includes(q)) ||
          (t.concernedPerson && t.concernedPerson.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }

      // Client filter
      if (filterClient !== "All" && t.clientName !== filterClient) return false;

      // Engineer filter
      if (filterEngineer !== "All" && t.assignedEngineerName !== filterEngineer) return false;

      // Category filter
      if (filterCategory !== "All" && getTaskCategory(t) !== filterCategory) return false;

      // Status filter
      if (filterStatus !== "All" && t.status !== filterStatus) return false;

      // AMC filter
      if (filterAmc === "AMC" && !t.amcCovered) return false;
      if (filterAmc === "Non-AMC" && t.amcCovered) return false;

      return true;
    });
  }, [tickets, search, filterClient, filterEngineer, filterCategory, filterStatus, filterAmc]);

  // Open Create Modal with default pre-fill
  const handleOpenCreateModal = () => {
    const defaultClient = clients[0];
    setNewVisitDate("2026-09-08");
    setNewClientId(defaultClient?.id || "c-1");
    setNewClientName(defaultClient?.name || "Cleveland Clinic Abu Dhabi");
    if (defaultClient?.contacts && defaultClient.contacts.length > 0) {
      const c = defaultClient.contacts[0];
      setNewConcernedPerson(`${c.name}${c.designation ? ` (${c.designation})` : ""}`);
      setNewContactPhone(c.phone || defaultClient.phone || "");
    } else {
      setNewConcernedPerson("Dr. Sarah Al-Hashimi (Biomedical Lead)");
      setNewContactPhone(defaultClient?.phone || "+971 50 123 4567");
    }
    setNewEquipment("ICU Ventilator SV-300");
    setNewModel("SV-300");
    setNewSerial(`MR-SV300-${Date.now().toString().slice(-4)}`);
    setNewComplaint("Preventive maintenance & sensor calibration inspection");
    setNewPriority("High");
    setNewStatus("Visit Scheduled");
    setNewEngineer("Hashim");
    setNewAmcCovered(true);
    setShowCreateModal(true);
  };

  // Submit New Ticket
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newEquipment) {
      toast.error("Please enter client and equipment details");
      return;
    }

    const matchedClient = clients.find((c) => c.name.toLowerCase() === newClientName.toLowerCase());

    const newTicket: ServiceTicket = {
      id: `st-${Date.now()}`,
      ticketNumber: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: matchedClient?.id || (newClientId || "c-custom"),
      clientName: newClientName,
      concernedPerson: newConcernedPerson.trim(),
      contactPhone: newContactPhone.trim(),
      equipment: newEquipment,
      model: newModel || "Standard",
      serialNumber: newSerial || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      complaint: newComplaint,
      priority: newPriority,
      status: newStatus,
      assignedEngineerId: `emp-${newEngineer.toLowerCase().replace(/\s+/g, "")}`,
      assignedEngineerName: newEngineer,
      visitDate: newVisitDate,
      amcCovered: newAmcCovered,
      createdAt: new Date().toISOString().split("T")[0],
    };

    addStoredServiceTicket(newTicket);
    setTickets(getStoredServiceTickets());
    setShowCreateModal(false);
    toast.success(`Service task ${newTicket.ticketNumber} added to Service Track!`);
  };

  // Inline Status Update
  const handleStatusChange = (ticketId: string, newStatus: ServiceStatus) => {
    updateStoredServiceTicketStatus(ticketId, newStatus);
    setTickets(getStoredServiceTickets());
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
    toast.success(`Status updated to ${newStatus}`);
  };

  // Save changes from Edit Modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    updateStoredServiceTicket(selectedTicket);
    setTickets(getStoredServiceTickets());
    setIsEditing(false);
    toast.success(`Task ${selectedTicket.ticketNumber} updated successfully`);
  };

  // Delete Ticket
  const handleDeleteTicket = (ticketId: string) => {
    if (confirm("Are you sure you want to delete this service task?")) {
      deleteStoredServiceTicket(ticketId);
      setTickets(getStoredServiceTickets());
      setSelectedTicket(null);
      toast.success("Service task deleted");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.25s ease" }}>
      {/* ─── TOP HEADER & ACTIONS ─── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#f0fdfa",
                border: "1px solid #ccfbf1",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                Service Track
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                Live sheet view of all service visits, preventive maintenance, calibration & repair tasks scheduled across UAE facilities
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/service-calendar"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <CalendarIcon size={15} color="#0f766e" />
            <span>Open Calendar</span>
          </Link>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Plus size={16} />
            <span>+ Schedule Service Task</span>
          </button>
        </div>
      </div>

      {/* ─── MINIMAL CONTROLS & FILTERS TOOLBAR ─── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          backgroundColor: "#ffffff",
          borderRadius: 10,
          border: "1px solid #eaecf0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 300, minWidth: 180 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search task, equipment, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: 32,
              height: 34,
              fontSize: 12.5,
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 9,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 2,
                fontSize: 11,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Client Filter */}
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            height: 34,
            fontSize: 12,
            fontWeight: 500,
            color: filterClient === "All" ? "#64748b" : "#0f766e",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "0 10px",
            outline: "none",
            cursor: "pointer",
            maxWidth: 175,
          }}
        >
          <option value="All">All Clients ({clientOptions.length})</option>
          {clientOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Assigned Staff Filter */}
        <select
          value={filterEngineer}
          onChange={(e) => setFilterEngineer(e.target.value)}
          style={{
            height: 34,
            fontSize: 12,
            fontWeight: 500,
            color: filterEngineer === "All" ? "#64748b" : "#0f766e",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "0 10px",
            outline: "none",
            cursor: "pointer",
            maxWidth: 155,
          }}
        >
          <option value="All">All Assigned Staff</option>
          {engineers.map((eng) => (
            <option key={eng} value={eng}>
              {eng}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            height: 34,
            fontSize: 12,
            fontWeight: 500,
            color: filterCategory === "All" ? "#64748b" : "#0f766e",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "0 10px",
            outline: "none",
            cursor: "pointer",
            maxWidth: 145,
          }}
        >
          <option value="All">All Categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            height: 34,
            fontSize: 12,
            fontWeight: 500,
            color: filterStatus === "All" ? "#64748b" : "#0f766e",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "0 10px",
            outline: "none",
            cursor: "pointer",
            maxWidth: 135,
          }}
        >
          <option value="All">All Statuses</option>
          {ALL_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {(search || filterClient !== "All" || filterEngineer !== "All" || filterCategory !== "All" || filterStatus !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterClient("All");
              setFilterEngineer("All");
              setFilterCategory("All");
              setFilterStatus("All");
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              color: "#0f766e",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Reset
          </button>
        )}

        {/* Task Count Badge */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: "#475569",
              fontWeight: 600,
              backgroundColor: "#f1f5f9",
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          >
            {filteredTickets.length} {filteredTickets.length === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>

      {/* ─── MINIMAL SHEET DESIGN TABLE (EXACT SPREADSHEET LAYOUT) ─── */}
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #eaecf0",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table data-mobile-cards="true" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "#fcfcfd",
                  borderBottom: "1px solid #eaecf0",
                }}
              >
                <th
                  style={{
                    padding: "12px 20px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    width: "36%",
                  }}
                >
                  TASK / TITLE
                </th>
                <th
                  style={{
                    padding: "12px 18px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    width: "22%",
                  }}
                >
                  CLIENT
                </th>
                <th
                  style={{
                    padding: "12px 18px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    width: "18%",
                  }}
                >
                  ASSIGNED TO
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    width: "13%",
                  }}
                >
                  CATEGORY
                </th>
                <th
                  style={{
                    padding: "12px 20px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    width: "11%",
                    textAlign: "right",
                  }}
                >
                  SCHEDULED DATE
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8" }}>
                    <FileSpreadsheet size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>No service tasks found</div>
                    <div style={{ fontSize: 12.5, marginTop: 4, color: "#94a3b8" }}>
                      Create a new service task or adjust your search filter.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, index) => {
                  const category = getTaskCategory(ticket);
                  const badge = getClientBadgeStyle(ticket.clientName);
                  const scheduledDate = formatSheetDate(ticket.visitDate || ticket.createdAt);
                  const isLast = index === filteredTickets.length - 1;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      style={{
                        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                        cursor: "pointer",
                        transition: "background-color 0.12s ease",
                        height: 52,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fbfcfd";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {/* Column 1: TASK / TITLE */}
                      <td data-label="TASK / TITLE" style={{ padding: "12px 20px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0f172a",
                              lineHeight: 1.35,
                            }}
                          >
                            {ticket.complaint ? ticket.complaint : `${ticket.equipment} Maintenance Inspection`}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                            <span style={{ fontFamily: "monospace", letterSpacing: "0.02em" }}>
                              {ticket.ticketNumber}
                            </span>
                            {ticket.equipment && (
                              <>
                                <span>•</span>
                                <span style={{ color: "#64748b" }}>{ticket.equipment}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: CLIENT (Soft pastel pill badge with bookmark matching Screenshot 2) */}
                      <td data-label="CLIENT" style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <span
                          title={
                            ticket.concernedPerson
                              ? `Contact: ${ticket.concernedPerson}${ticket.contactPhone ? ` (${ticket.contactPhone})` : ""}`
                              : ticket.clientName
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2.5px 8px",
                            borderRadius: 6,
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            fontSize: 11.5,
                            fontWeight: 600,
                            maxWidth: 240,
                          }}
                        >
                          <Bookmark size={11} color={badge.text} fill={badge.bg} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ticket.clientName}
                          </span>
                        </span>
                      </td>

                      {/* Column 3: ASSIGNED TO (Avatar initial + Name matching Screenshot 2) */}
                      <td data-label="ASSIGNED TO" style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              backgroundColor: "#f1f5f9",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10.5,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {ticket.assignedEngineerName
                              ? ticket.assignedEngineerName.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
                            {ticket.assignedEngineerName || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* Column 4: CATEGORY (Clean pill tag matching Screenshot 2) */}
                      <td data-label="CATEGORY" style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2.5px 8px",
                            borderRadius: 5,
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#64748b",
                            fontSize: 11,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {category}
                        </span>
                      </td>

                      {/* Column 5: SCHEDULED DATE (Clean typography matching Screenshot 2) */}
                      <td data-label="SCHEDULED DATE" style={{ padding: "12px 20px", verticalAlign: "middle", textAlign: "right" }}>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {scheduledDate}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── TICKET INSPECTION & EDIT MODAL ─── */}
      {selectedTicket && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 16,
          }}
          onClick={() => {
            setSelectedTicket(null);
            setIsEditing(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "min(720px, 95vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 25px 60px rgba(15, 23, 42, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                    {selectedTicket.ticketNumber}
                  </h2>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      backgroundColor: SERVICE_STATUS_CONFIG[selectedTicket.status]?.bg || "#f1f5f9",
                      color: SERVICE_STATUS_CONFIG[selectedTicket.status]?.text || "#475569",
                      border: `1px solid ${SERVICE_STATUS_CONFIG[selectedTicket.status]?.border || "#cbd5e1"}`,
                    }}
                  >
                    {selectedTicket.status}
                  </span>
                  {selectedTicket.amcCovered && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      AMC Covered
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                  {selectedTicket.clientName} • {selectedTicket.equipment}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsEditing((prev) => !prev)}
                  className="btn btn-secondary"
                  style={{ padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}
                >
                  <Edit3 size={14} />
                  <span>{isEditing ? "View Details" : "Edit Task"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicket(null);
                    setIsEditing(false);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "none",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Client</label>
                    <input
                      className="form-input"
                      value={selectedTicket.clientName}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, clientName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Concerned Person</label>
                    <input
                      className="form-input"
                      value={selectedTicket.concernedPerson || ""}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, concernedPerson: e.target.value })}
                    />
                  </div>
                </div>

                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Equipment</label>
                    <input
                      className="form-input"
                      value={selectedTicket.equipment}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, equipment: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Model / Serial #</label>
                    <input
                      className="form-input"
                      value={selectedTicket.model}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, model: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Task Description / Scope</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={selectedTicket.complaint}
                    onChange={(e) => setSelectedTicket({ ...selectedTicket, complaint: e.target.value })}
                  />
                </div>

                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "115px 1.55fr 150px", gap: 12 }}>
                  <div>
                    <label className="form-label">Priority</label>
                    <select
                      className="form-input"
                      value={selectedTicket.priority}
                      onChange={(e) =>
                        setSelectedTicket({
                          ...selectedTicket,
                          priority: e.target.value as ServiceTicket["priority"],
                        })
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Assigned To</label>
                    <select
                      className="form-input"
                      value={selectedTicket.assignedEngineerName}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          const name = window.prompt("Enter name:");
                          if (name && name.trim()) {
                            const updated = addStoredEngineer(name.trim());
                            setCustomEngineers(updated);
                            setSelectedTicket({
                              ...selectedTicket,
                              assignedEngineerName: name.trim(),
                              assignedEngineerId: `emp-${name.trim().toLowerCase().replace(/\s+/g, "")}`,
                            });
                          }
                        } else {
                          setSelectedTicket({
                            ...selectedTicket,
                            assignedEngineerName: e.target.value,
                            assignedEngineerId: `emp-${e.target.value.toLowerCase().replace(/\s+/g, "")}`,
                          });
                        }
                      }}
                    >
                      {engineers.map((eng) => (
                        <option key={eng} value={eng}>
                          {eng}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add Person...</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Scheduled Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={selectedTicket.visitDate || ""}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, visitDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteTicket(selectedTicket.id)}
                    className="btn btn-secondary"
                    style={{ color: "#dc2626", borderColor: "#fecaca" }}
                  >
                    <Trash2 size={14} />
                    <span>Delete Task</span>
                  </button>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Healthcare Facility
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
                      {selectedTicket.clientName}
                    </div>
                    {selectedTicket.concernedPerson && (
                      <div style={{ fontSize: 12, color: "#0f766e", marginTop: 4, fontWeight: 600 }}>
                        Contact: {selectedTicket.concernedPerson} {selectedTicket.contactPhone && `(${selectedTicket.contactPhone})`}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Assigned Staff
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
                      👤 {selectedTicket.assignedEngineerName}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Scheduled Date: <strong>{formatSheetDate(selectedTicket.visitDate || selectedTicket.createdAt)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                    Equipment & Scope
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
                    {selectedTicket.equipment} ({selectedTicket.model || "Standard"})
                  </div>
                  {selectedTicket.serialNumber && (
                    <div style={{ fontSize: 11.5, fontFamily: "monospace", color: "#64748b", marginTop: 2 }}>
                      SN: {selectedTicket.serialNumber}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 8, lineHeight: 1.5 }}>
                    {selectedTicket.complaint}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SCHEDULE SERVICE TASK MODAL ─── */}
      {showCreateModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 16,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card"
            style={{
              width: "min(640px, 95vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Schedule Service Task
                </h2>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Add a clinical repair, maintenance, or calibration task to Service Track & Calendar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Client Selection */}
              <div>
                <label className="form-label">Client / Healthcare Institution</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Type or select hospital/facility..."
                  value={newClientName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewClientName(val);
                    const matched = clients.find((c) => c.name.toLowerCase() === val.toLowerCase() || c.id === val);
                    if (matched) {
                      setNewClientId(matched.id);
                      if (matched.contacts && matched.contacts.length > 0) {
                        const c = matched.contacts[0];
                        setNewConcernedPerson(`${c.name}${c.designation ? ` (${c.designation})` : ""}`);
                        if (c.phone) setNewContactPhone(c.phone);
                      } else if (matched.phone) {
                        setNewContactPhone(matched.phone);
                      }
                    }
                  }}
                  list="servicetrack-clients-list"
                />
                <datalist id="servicetrack-clients-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.orgType ? `(${c.orgType})` : ""}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Concerned Person & Contact Phone */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                <div>
                  <label className="form-label">Concerned Person / In-Charge</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Mansoor / Biomedical Head"
                    value={newConcernedPerson}
                    onChange={(e) => setNewConcernedPerson(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Contact Phone / Ext.</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +971 50 123 4567"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Equipment & Model */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">Equipment Name</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. ICU Ventilator SV-300"
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Model / Serial #</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. SV-300"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                  />
                </div>
              </div>

              {/* Complaint Description */}
              <div>
                <label className="form-label">Task Description / Scope</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  placeholder="Describe technical issue, calibration details, or scheduled maintenance..."
                  value={newComplaint}
                  onChange={(e) => setNewComplaint(e.target.value)}
                />
              </div>

              {/* Priority, Assigned To & Visit Date */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "115px 1.55fr 150px", gap: 12 }}>
                <div>
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label className="form-label">Assigned To</label>
                  <select
                    className="form-input"
                    value={newEngineer}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        const name = window.prompt("Enter name:");
                        if (name && name.trim()) {
                          const updated = addStoredEngineer(name.trim());
                          setCustomEngineers(updated);
                          setNewEngineer(name.trim());
                        }
                      } else {
                        setNewEngineer(e.target.value);
                      }
                    }}
                  >
                    {engineers.map((eng) => (
                      <option key={eng} value={eng}>
                        {eng}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add Person...</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Scheduled Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Status & AMC Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    id="servicetrack-amc-chk"
                    checked={newAmcCovered}
                    onChange={(e) => setNewAmcCovered(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label
                    htmlFor="servicetrack-amc-chk"
                    style={{ fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}
                  >
                    Covered under active AMC Contract
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Status:
                  </label>
                  <select
                    className="form-input"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ServiceStatus)}
                    style={{ width: 150 }}
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
