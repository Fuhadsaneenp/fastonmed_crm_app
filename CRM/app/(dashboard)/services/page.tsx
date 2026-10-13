"use client";

import { useState, useEffect } from "react";
import { mockServiceTickets, mockEmployees } from "@/lib/mock-data";
import {
  getStoredServiceTickets,
  fetchStoredServiceTicketsFromServer,
  saveStoredServiceTickets,
  addStoredServiceTicket,
  updateStoredServiceTicketStatus,
} from "@/lib/service-store";
import { getStoredClients } from "@/lib/client-store";
import { getStatusColor, formatDate } from "@/lib/utils";
import type { ServiceTicket, ServiceStatus, Client } from "@/types";
import toast from "react-hot-toast";
import ServiceWorkCalendar from "@/components/calendar/ServiceWorkCalendar";
import {
  CalendarDays,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Wrench,
  ShieldCheck,
  Building2,
  Clock,
  User,
  AlertCircle,
  Search,
  X,
} from "lucide-react";

const STATUSES: ServiceStatus[] = [
  "New Request",
  "Assigned",
  "Visit Scheduled",
  "Under Repair",
  "Waiting Parts",
  "Completed",
  "Closed",
];

const STATUS_COLORS: Record<ServiceStatus, string> = {
  "New Request": "#3b82f6",
  "Assigned": "#8b5cf6",
  "Visit Scheduled": "#f59e0b",
  "Under Repair": "#f97316",
  "Waiting Parts": "#ef4444",
  "Completed": "#10b981",
  "Closed": "#94a3b8",
};

const priorityColors: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#ef4444",
};

export default function ServicesPage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView] = useState<"calendar" | "kanban" | "list">("calendar");
  const [selected, setSelected] = useState<ServiceTicket | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Add Ticket Form
  const [newClient, setNewClient] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newComplaint, setNewComplaint] = useState("");
  const [newPriority, setNewPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [newConcernedPerson, setNewConcernedPerson] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newEngineer, setNewEngineer] = useState("Hashim");
  const [newVisitDate, setNewVisitDate] = useState("2026-09-06");
  const [newAmc, setNewAmc] = useState(true);

  useEffect(() => {
    setTickets(getStoredServiceTickets());
    setClients(getStoredClients());

    fetchStoredServiceTicketsFromServer().then((srv) => {
      if (srv && srv.length > 0) {
        setTickets(srv);
      }
    });

    const handleSync = () => {
      setTickets(getStoredServiceTickets());
      setClients(getStoredClients());
    };

    window.addEventListener("fastonmed_services_updated", handleSync);
    window.addEventListener("fastonmed_clients_updated", handleSync);
    return () => {
      window.removeEventListener("fastonmed_services_updated", handleSync);
      window.removeEventListener("fastonmed_clients_updated", handleSync);
    };
  }, []);

  const updateStatus = (ticketId: string, newStatus: ServiceStatus) => {
    updateStoredServiceTicketStatus(ticketId, newStatus);
    setTickets(getStoredServiceTickets());
    toast.success(`Ticket status updated to "${newStatus}"`);
  };

  const handleCreateTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.trim() || !newComplaint.trim()) {
      toast.error("Please enter Client and Complaint details");
      return;
    }

    const matchedClient = clients.find((c) => c.name.toLowerCase() === newClient.toLowerCase());

    const newTicket: ServiceTicket = {
      id: `st-${Date.now()}`,
      ticketNumber: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: matchedClient?.id || "c-custom",
      clientName: newClient.trim(),
      concernedPerson: newConcernedPerson.trim(),
      contactPhone: newContactPhone.trim(),
      equipment: newEquipment.trim() || "Clinical Medical Equipment",
      model: "Standard",
      serialNumber: newSerial.trim() || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      complaint: newComplaint.trim(),
      priority: newPriority,
      status: "Assigned",
      assignedEngineerId: `emp-${newEngineer.toLowerCase().replace(/\s+/g, "")}`,
      assignedEngineerName: newEngineer,
      visitDate: newVisitDate,
      amcCovered: newAmc,
      createdAt: new Date().toISOString().split("T")[0],
    };

    addStoredServiceTicket(newTicket);
    setTickets(getStoredServiceTickets());
    setShowAdd(false);
    setNewClient("");
    setNewConcernedPerson("");
    setNewContactPhone("");
    setNewEquipment("");
    setNewSerial("");
    setNewComplaint("");
    toast.success(`Service ticket ${newTicket.ticketNumber} created!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.3s ease" }}>
      {/* ─── CONTROLS & VIEW SWITCHER ─── */}
      <div
        className="card service-mobile-view-controls"
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          borderRadius: 14,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Left: View Tabs */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "#f1f5f9",
            padding: 3,
            borderRadius: 10,
            border: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            className={`btn ${view === "calendar" ? "btn-primary" : "btn-secondary"}`}
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: view === "calendar" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
            onClick={() => setView("calendar")}
          >
            <CalendarDays size={15} />
            <span>Service Calendar</span>
          </button>

          <button
            type="button"
            className={`btn ${view === "kanban" ? "btn-primary" : "btn-secondary"}`}
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: view === "kanban" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid size={15} />
            <span>Kanban Board</span>
          </button>

          <button
            type="button"
            className={`btn ${view === "list" ? "btn-primary" : "btn-secondary"}`}
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: view === "list" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
            onClick={() => setView("list")}
          >
            <ListIcon size={15} />
            <span>Tickets List</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
            {tickets.length} Total Tickets
          </span>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAdd(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Plus size={15} />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* ─── 1. CALENDAR VIEW ─── */}
      {view === "calendar" && (
        <ServiceWorkCalendar onSelectTicket={(t) => setSelected(t)} />
      )}

      {/* ─── 2. KANBAN VIEW ─── */}
      {view === "kanban" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
          {STATUSES.map((status) => {
            const stageTickets = tickets.filter((t) => t.status === status);
            const color = STATUS_COLORS[status];

            return (
              <div key={status} className="kanban-column">
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 11, color }}>{status}</span>
                  <span
                    style={{
                      background: color,
                      color: "white",
                      borderRadius: 9999,
                      padding: "1px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {stageTickets.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                  {stageTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="kanban-card"
                      onClick={() => setSelected(ticket)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>
                          {ticket.ticketNumber}
                        </span>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: priorityColors[ticket.priority],
                            flexShrink: 0,
                          }}
                          title={ticket.priority}
                        />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{ticket.clientName}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, lineHeight: 1.3 }}>
                        {ticket.equipment}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#94a3b8",
                          borderTop: "1px solid #f1f5f9",
                          paddingTop: 6,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>👤 {ticket.assignedEngineerName.split(" ")[0]}</span>
                        {ticket.amcCovered && <span style={{ color: "#059669", fontWeight: 600 }}>AMC ✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 3. LIST VIEW ─── */}
      {view === "list" && (
        <div className="card" style={{ padding: 0, borderRadius: 14, overflow: "hidden" }}>
          <div className="table-container">
            <table className="service-ticket-mobile-list" data-mobile-cards="true">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Client</th>
                  <th>Equipment</th>
                  <th>Complaint</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Engineer</th>
                  <th>AMC</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} onClick={() => { if (window.innerWidth < 768) setSelected(t); }}>
                    <td data-label="Ticket #" style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{t.ticketNumber}</td>
                    <td data-label="Client" style={{ fontWeight: 600, fontSize: 13 }}>
                      <div>{t.clientName}</div>
                      {t.concernedPerson && (
                        <div style={{ fontSize: 11, color: "#0284c7", fontWeight: 600, marginTop: 2 }}>
                          👤 {t.concernedPerson}
                        </div>
                      )}
                    </td>
                    <td data-label="Equipment">
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{t.equipment}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.serialNumber}</div>
                    </td>
                    <td data-label="Complaint" style={{ fontSize: 12, maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.complaint}
                      </div>
                    </td>
                    <td data-label="Priority">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: priorityColors[t.priority],
                          }}
                        />
                        <span style={{ fontSize: 12 }}>{t.priority}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span>
                    </td>
                    <td data-label="Engineer" style={{ fontSize: 12 }}>{t.assignedEngineerName}</td>
                    <td data-label="AMC">
                      {t.amcCovered ? (
                        <span className="badge" style={{ background: "#d1fae5", color: "#059669" }}>
                          Covered
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "#f1f5f9", color: "#94a3b8" }}>
                          No
                        </span>
                      )}
                    </td>
                    <td data-label="Date" style={{ fontSize: 12 }}>{t.visitDate || t.createdAt}</td>
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "5px 12px", fontSize: 12 }}
                        onClick={() => setSelected(t)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TICKET DETAIL MODAL ─── */}
      {selected && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 20,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflow: "auto",
              animation: "fadeIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{selected.ticketNumber}</h2>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge ${getStatusColor(selected.status)}`}>{selected.status}</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {selected.priority === "Critical" && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span>🚨</span>
                  <span style={{ fontWeight: 600, color: "#dc2626", fontSize: 13 }}>
                    CRITICAL PRIORITY — Requires immediate clinical intervention
                  </span>
                </div>
              )}

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Client", value: selected.clientName },
                  {
                    label: "Concerned Person / In-Charge",
                    value: selected.concernedPerson
                      ? `${selected.concernedPerson}${selected.contactPhone ? ` (${selected.contactPhone})` : ""}`
                      : "General Biomedical Staff",
                  },
                  { label: "Equipment", value: selected.equipment },
                  { label: "Model", value: selected.model },
                  { label: "Serial Number", value: selected.serialNumber },
                  { label: "Assigned Engineer", value: selected.assignedEngineerName },
                  { label: "Visit Date", value: selected.visitDate || "TBD" },
                  { label: "Priority", value: selected.priority },
                  { label: "AMC Covered", value: selected.amcCovered ? "Yes ✅" : "No" },
                  { label: "Created At", value: selected.createdAt, span: true },
                ].map((f) => (
                  <div key={f.label} style={{ gridColumn: (f as { span?: boolean }).span ? "1 / -1" : undefined }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Complaint Description</div>
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
                  {selected.complaint}
                </div>
              </div>

              {selected.spareParts && selected.spareParts.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Spare Parts Required</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.spareParts.map((p) => (
                      <span
                        key={p}
                        style={{
                          background: "#fed7aa",
                          color: "#92400e",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.engineerNotes && (
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Engineer Notes</div>
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 13,
                    }}
                  >
                    {selected.engineerNotes}
                  </div>
                </div>
              )}

              {selected.customerFeedback && (
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Customer Rating</div>
                  <div style={{ fontSize: 20 }}>{"⭐".repeat(selected.customerFeedback)}</div>
                </div>
              )}

              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Update Status:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        updateStatus(selected.id, s);
                        setSelected({ ...selected, status: s });
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${STATUS_COLORS[s]}50`,
                        background: selected.status === s ? STATUS_COLORS[s] : `${STATUS_COLORS[s]}15`,
                        color: selected.status === s ? "white" : STATUS_COLORS[s],
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD TICKET MODAL ─── */}
      {showAdd && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 20,
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 540, animation: "fadeIn 0.2s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Create Service Ticket</h2>
              <button
                onClick={() => setShowAdd(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit}>
              <div data-mobile-grid="stack" style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Client / Hospital Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Cleveland Clinic Abu Dhabi"
                    value={newClient}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClient(val);
                      const matched = clients.find((c) => c.name.toLowerCase() === val.toLowerCase());
                      if (matched) {
                        if (matched.contacts && matched.contacts.length > 0) {
                          const c = matched.contacts[0];
                          setNewConcernedPerson(`${c.name}${c.designation ? ` (${c.designation})` : ""}`);
                          if (c.phone) setNewContactPhone(c.phone);
                        } else if (matched.phone) {
                          setNewContactPhone(matched.phone);
                        }
                      }
                    }}
                    list="client-list-modal"
                  />
                  <datalist id="client-list-modal">
                    {clients.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

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

                <div>
                  <label className="form-label">Equipment</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ventilator SV-300"
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MR-SV300-20240120"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Complaint / Technical Scope *</label>
                  <textarea
                    className="form-input"
                    required
                    placeholder="Describe the issue, failure symptom, or preventative visit..."
                    rows={3}
                    style={{ resize: "vertical" }}
                    value={newComplaint}
                    onChange={(e) => setNewComplaint(e.target.value)}
                  />
                </div>

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

                <div>
                  <label className="form-label">Assign Engineer</label>
                  <select
                    className="form-input"
                    value={newEngineer}
                    onChange={(e) => setNewEngineer(e.target.value)}
                  >
                    {mockEmployees.map((e) => (
                      <option key={e.id} value={e.name}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Scheduled Visit Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
                  <input
                    type="checkbox"
                    id="amc-modal"
                    checked={newAmc}
                    onChange={(e) => setNewAmc(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label htmlFor="amc-modal" style={{ fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    AMC Contract Active
                  </label>
                </div>
              </div>

              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
