"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { getStoredTasks, saveStoredTasks, addStoredTask, updateStoredTask, deleteStoredTask, declineStoredTask, syncLiveTasksFromApi, canUserEditTask, getCurrentUser } from "@/lib/task-store";
import { syncStoredServiceTicketsToTasks } from "@/lib/service-store";
import { getStoredClients, addClientFromLead } from "@/lib/client-store";
import { mockEmployees } from "@/lib/mock-data";
import CustomLightSelect, { CustomSelectOption } from "@/components/CustomLightSelect";
import type { Task, TaskType, TaskStatus, Client, OrgType } from "@/types";
import toast from "react-hot-toast";
import DayDetailPopup from "./DayDetailPopup";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Building2,
  Clock,
  User,
  X,
  XCircle,
  Trash2,
  CheckCircle2,
  Lock,
  AlertCircle,
  Edit2,
  Filter,
  Pencil,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_TASK_TYPES = [
  "Call", "Site Visit", "Demo", "Installation", "Service Visit", "Meeting", "Follow-up"
];

const STAGE_OPTIONS = [
  "All Stages", "Inquiry / Lead", "Quotation", "Negotiation", "Order / Won", "Installation", "Service & AMC"
];

function getFirstWords(text?: string, count: number = 5): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= count) return text;
  return words.slice(0, count).join(" ") + "...";
}

const STATUS_CONFIG: Record<string, { label: string; short: string; pillShort?: string; bg: string; text: string; border: string; badgeBg: string; badgeText: string; cardBg: string; cardBorder: string }> = {
  "Pending": {
    label: "Pending",
    short: "P",
    pillShort: "P",
    bg: "#fef08a",
    text: "#854d0e",
    border: "#fde047",
    badgeBg: "#eab308",
    badgeText: "#ffffff",
    cardBg: "#fefce8",
    cardBorder: "#eab308",
  },
  "In Progress": {
    label: "In Progress",
    short: "IP",
    pillShort: "IP",
    bg: "#bae6fd",
    text: "#0369a1",
    border: "#7dd3fc",
    badgeBg: "#0284c7",
    badgeText: "#ffffff",
    cardBg: "#f0f9ff",
    cardBorder: "#0284c7",
  },
  "Completed": {
    label: "Completed",
    short: "C",
    pillShort: "C",
    bg: "#bbf7d0",
    text: "#15803d",
    border: "#86efac",
    badgeBg: "#22c55e",
    badgeText: "#ffffff",
    cardBg: "#f0fdf4",
    cardBorder: "#22c55e",
  },
};

export default function ClientWorkCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // September (0-indexed: 8 = Sep)
  
  // Filters
  const [selectedClient, setSelectedClient] = useState<string>("All");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<string>("All");
  const [employeeList, setEmployeeList] = useState(mockEmployees);
  const [selectedStage, setSelectedStage] = useState<string>("All Stages");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalDatePrefill, setModalDatePrefill] = useState<string>("2026-09-06");
  const [selectedDayPopup, setSelectedDayPopup] = useState<{
    dateStr: string;
    dayNum: number;
  } | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const handlePopupStatusChange = (task: Task, newStatus: string) => {
    const updated = { ...task, status: newStatus as TaskStatus };
    updateStoredTask(updated);
    setTasks(getStoredTasks());
    toast.success(`Task status updated to ${newStatus}`);
  };

  const handlePopupDeclineTask = (taskId: string, reason?: string) => {
    declineStoredTask(taskId, reason || "Declined from calendar day view");
    setTasks(getStoredTasks());
    toast.success("Task declined and moved to Declined Tasks");
  };

  const toggleDayExpand = (dateStr: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Load persistent tasks & clients & employees
  useEffect(() => {
    syncStoredServiceTicketsToTasks();
    setTasks(getStoredTasks());
    setClients(getStoredClients());
    syncLiveTasksFromApi().catch(() => {});

    fetch("/api/ems/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.employees) && data.employees.length > 0) {
          const activeEmps = data.employees
            .filter((e: any) => e.status === "ACTIVE" || !e.status)
            .map((e: any) => ({
              id: e.id,
              name: e.name,
              role: e.designation || e.role || "Team Member",
              department: e.department || "General",
              email: e.email || "",
              phone: e.phone || "",
              status: "Active" as const,
              avatar: "",
            }));
          const existingNames = new Set(activeEmps.map((e: any) => e.name.toLowerCase()));
          const combined = [
            ...activeEmps,
            ...mockEmployees.filter((e) => !existingNames.has(e.name.toLowerCase())),
          ];
          setEmployeeList(combined);
        }
      })
      .catch(() => {});

    const handleTaskSync = () => {
      setTasks(getStoredTasks());
      setClients(getStoredClients());
    };

    const handleServiceSync = () => {
      syncStoredServiceTicketsToTasks();
      setTasks(getStoredTasks());
      setClients(getStoredClients());
    };

    window.addEventListener("fastonmed_tasks_updated", handleTaskSync);
    window.addEventListener("fastonmed_clients_updated", handleTaskSync);
    window.addEventListener("fastonmed_services_updated", handleServiceSync);
    return () => {
      window.removeEventListener("fastonmed_tasks_updated", handleTaskSync);
      window.removeEventListener("fastonmed_clients_updated", handleTaskSync);
      window.removeEventListener("fastonmed_services_updated", handleServiceSync);
    };
  }, []);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Exclude declined tasks from active calendar view
      if (t.status === "Declined") return false;

      // Status filter
      if (selectedStatus !== "All") {
        const normStatus = t.status === "Completed" ? "Approved" : t.status;
        if (normStatus !== selectedStatus) return false;
      }
      // Client filter
      if (selectedClient !== "All") {
        if (t.clientId !== selectedClient && t.clientName !== selectedClient) return false;
      }
      // Member filter (matches assigned or created by)
      if (selectedMember !== "All") {
        const mem = selectedMember.toLowerCase();
        const isAssigned = (t.assignedTo || "").toLowerCase() === mem;
        const isCreated = (t.createdBy || "").toLowerCase() === mem;
        if (!isAssigned && !isCreated) return false;
      }
      return true;
    });
  }, [tasks, selectedStatus, selectedClient, selectedMember]);

  // Calendar Grid Days Calculation
  const calendarCells = useMemo(() => {
    // 1st of month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ...
    
    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Days in previous month
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: Task[];
    }[] = [];

    // Preceding days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
      cells.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: false,
        tasks: [],
      });
    }

    const today = new Date();
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday =
        currentYear === today.getFullYear() &&
        currentMonth === today.getMonth() &&
        d === today.getDate();
      
      const dayTasks = filteredTasks.filter((t) => {
        return t.dueDate === dStr;
      });

      cells.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday,
        tasks: dayTasks,
      });
    }

    // Trailing days to fill 5 or 6 weeks (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dStr = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cells.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: false,
        tasks: [],
      });
    }

    return cells;
  }, [currentYear, currentMonth, filteredTasks]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(8); // September 2026
  };

  const handleOpenCreateForDate = (dateStr: string) => {
    setModalDatePrefill(dateStr);
    setEditingTask(null);
    setShowCreateModal(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.2s ease" }}>
      {/* Unified Compact Command Bar */}
      <div
        className="card"
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        {/* Top Controls Row: Navigator, Filters, and New Task */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* Left: Month Navigator, Today & Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 7,
                padding: "2px 4px",
                height: 32,
                boxSizing: "border-box",
              }}
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Previous Month"
              >
                <ChevronLeft size={14} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 6px", fontWeight: 700, fontSize: 12.5, color: "#0f172a" }}>
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: "#0f172a",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: "#0f172a",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Next Month"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#334155",
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CalendarIcon size={13} color="#64748b" />
              <span>Today</span>
            </button>

            <span
              style={{
                backgroundColor: "#eaf8f4",
                color: "#004d66",
                fontSize: 11.5,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 6,
                border: "1px solid rgba(0, 77, 102, 0.12)",
                whiteSpace: "nowrap",
              }}
            >
              {filteredTasks.length} Assigned
            </span>
          </div>

          {/* Right: Filters & New Task */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Searchable client filter */}
            <Popover.Root open={clientMenuOpen} onOpenChange={(open) => { setClientMenuOpen(open); if (!open) setClientSearch(""); }}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label="Filter calendar by client"
                  style={{ width: 170, height: 32, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", fontSize: 12 }}
                >
                  <Building2 size={13} color="#004d66" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                    {selectedClient === "All" ? `All Clients (${clients.length})` : selectedClient}
                  </span>
                  <ChevronRight size={12} style={{ transform: "rotate(90deg)", flexShrink: 0 }} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} collisionPadding={12} aria-label="Choose client"
                  style={{ width: 320, maxWidth: "calc(100vw - 24px)", background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,37,51,0.14)", padding: 8, zIndex: 100 }}>
                  <input autoFocus className="form-input" aria-label="Search clients" placeholder="Search clients…"
                    value={clientSearch} onChange={(event) => setClientSearch(event.target.value)}
                    style={{ width: "100%", fontSize: 12.5, marginBottom: 6, height: 32 }} />
                  <div style={{ maxHeight: "min(280px, 50vh)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                    {[{ id: "all-clients", name: "All", label: `All Clients (${clients.length})` }, ...clients.filter((client) => client.name.toLowerCase().includes(clientSearch.trim().toLowerCase())).map((client) => ({ ...client, label: client.name }))].map((client) => (
                      <button key={client.id} type="button" aria-pressed={selectedClient === client.name}
                        onClick={() => { setSelectedClient(client.name); setClientMenuOpen(false); setClientSearch(""); }}
                        style={{ textAlign: "left", padding: "7px 9px", border: "none", borderRadius: 6, background: selectedClient === client.name ? "#eaf8f4" : "white", color: selectedClient === client.name ? "#004d66" : "#334155", fontSize: 12, fontWeight: selectedClient === client.name ? 600 : 400, cursor: "pointer", lineHeight: 1.4 }}>
                        {client.label}
                      </button>
                    ))}
                    {clientSearch.trim() && !clients.some((client) => client.name.toLowerCase().includes(clientSearch.trim().toLowerCase())) && (
                      <p style={{ padding: 10, margin: 0, fontSize: 12, color: "#64748b" }}>No clients found.</p>
                    )}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* All Members Dropdown */}
            <div style={{ position: "relative" }}>
              <CustomLightSelect
                value={selectedMember}
                searchable={true}
                placeholder="All Members"
                options={[
                  { value: "All", label: "👥 All Members" },
                  ...employeeList.map((e) => ({
                    value: e.name,
                    label: e.name === "Fuhad" ? "Fuhad (Myself)" : e.name,
                    subtext: [e.role, e.department].filter(Boolean).join(" • "),
                  })),
                ]}
                onChange={(val) => setSelectedMember(val)}
                style={{ width: 140 }}
                buttonStyle={{ height: 32, fontSize: 12, padding: "0 8px" }}
              />
            </div>

            {/* All Stages Dropdown */}
            <div style={{ position: "relative" }}>
              <CustomLightSelect
                value={selectedStage}
                options={STAGE_OPTIONS.map((st) => ({ value: st, label: st }))}
                onChange={(val) => setSelectedStage(val)}
                style={{ width: 125 }}
                buttonStyle={{ height: 32, fontSize: 12, padding: "0 8px" }}
              />
            </div>

            {/* Create Task Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setModalDatePrefill("2026-09-06");
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              style={{
                backgroundColor: "#004d66",
                color: "#ffffff",
                height: 32,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0, 77, 102, 0.2)",
              }}
            >
              <Plus size={13} />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Bottom Filter Row: Minimal Inline Status Filter Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            borderTop: "1px solid #f1f5f9",
            paddingTop: 8,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginRight: 2,
            }}
          >
            Status:
          </span>

          <button
            type="button"
            onClick={() => setSelectedStatus("All")}
            style={{
              height: 26,
              padding: "0 9px",
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              backgroundColor: selectedStatus === "All" ? "#004d66" : "#f8fafc",
              color: selectedStatus === "All" ? "#ffffff" : "#475569",
              border: selectedStatus === "All" ? "1px solid #004d66" : "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "all 0.12s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>All</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "0 4px",
                borderRadius: 4,
                backgroundColor: selectedStatus === "All" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                color: selectedStatus === "All" ? "#ffffff" : "#64748b",
              }}
            >
              {tasks.length}
            </span>
          </button>

          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const isSelected = selectedStatus === key;
            const count = tasks.filter((t) => t.status === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedStatus(isSelected ? "All" : key)}
                style={{
                  height: 26,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0 9px",
                  borderRadius: 6,
                  border: isSelected ? `1px solid ${cfg.badgeBg}` : "1px solid #e2e8f0",
                  backgroundColor: isSelected ? cfg.badgeBg : "#ffffff",
                  color: isSelected ? "#ffffff" : "#334155",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
              >
                <span
                  style={{
                    width: 5.5,
                    height: 5.5,
                    borderRadius: "50%",
                    backgroundColor: isSelected ? "#ffffff" : cfg.badgeBg,
                    flexShrink: 0,
                  }}
                />
                <span>{cfg.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "0 4px",
                    borderRadius: 4,
                    backgroundColor: isSelected
                      ? "rgba(255,255,255,0.25)"
                      : count > 0
                      ? `${cfg.badgeBg}18`
                      : "#f1f5f9",
                    color: isSelected ? "#ffffff" : count > 0 ? cfg.text : "#94a3b8",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Month Calendar Grid */}
      <div
        className="card"
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          overflowX: "auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ minWidth: 780, width: "100%" }}>
          {/* Days of week header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 8,
              width: "100%",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
              <div
                key={dayName}
                style={{
                  textAlign: "center",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#64748b",
                  padding: "2px 0",
                }}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              width: "100%",
            }}
          >
            {calendarCells.map((cell, idx) => {
              // Out of current month: render empty placeholder card matching Reference Image
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={`${cell.dateStr}-${idx}`}
                    style={{
                      minHeight: 160,
                      backgroundColor: "#fafbfc",
                      border: "1px solid #f1f5f9",
                      borderRadius: 10,
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  />
                );
              }

              const hasTasks = cell.tasks.length > 0;
              const isExpanded = !!expandedDays[cell.dateStr];
              const visibleTasks = isExpanded ? cell.tasks : cell.tasks.slice(0, 3);
              const remainingCount = cell.tasks.length - 3;

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    setSelectedDayPopup({
                      dateStr: cell.dateStr,
                      dayNum: cell.dayNum,
                    });
                  }}
                  style={{
                    minHeight: 160,
                    backgroundColor: cell.isToday ? "#faf5ff" : "#ffffff",
                    border: cell.isToday ? "2px solid #818cf8" : "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "6px 6px",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    boxShadow: cell.isToday ? "0 2px 8px rgba(99, 102, 241, 0.12)" : "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                    minWidth: 0,
                    width: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  {/* Cell Header: Date + Count Badge + Quick Add */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 5,
                      padding: "0 2px",
                    }}
                  >
                    {cell.isToday ? (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: "#4f46e5",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          boxShadow: "0 2px 4px rgba(79, 70, 229, 0.3)",
                        }}
                      >
                        {cell.dayNum}
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#1e293b",
                        }}
                      >
                        {cell.dayNum}
                      </span>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      {/* Task count badge */}
                      {hasTasks && (
                        <span
                          style={{
                            height: 18,
                            minWidth: 18,
                            padding: "0 5px",
                            borderRadius: 999,
                            backgroundColor: "#eff6ff",
                            color: "#4f46e5",
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {cell.tasks.length}
                        </span>
                      )}

                      {/* Quick Add Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenCreateForDate(cell.dateStr)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          backgroundColor: "#eff6ff",
                          border: "none",
                          color: "#4f46e5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1,
                          transition: "all 0.12s ease",
                        }}
                        title={`Add task for ${cell.dateStr}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Day Tasks List (Limited to 3 tasks) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0, width: "100%", overflow: "hidden" }}>
                    {visibleTasks.map((task) => {
                      const normStatus = task.status === "Completed" ? "Approved" : task.status;
                      const cfg = STATUS_CONFIG[normStatus] || STATUS_CONFIG["Pending"];

                      return (
                        <div
                          key={task.id}
                          style={{
                            backgroundColor: cfg.cardBg,
                            border: `1px solid ${cfg.border}`,
                            borderLeft: `3px solid ${cfg.cardBorder}`,
                            borderRadius: 5,
                            padding: "4px 5px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            transition: "all 0.12s ease",
                            minWidth: 0,
                            width: "100%",
                            boxSizing: "border-box",
                            overflow: "hidden",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
                          }}
                          title={`${task.title}\nClient: ${task.clientName || "General"}\nStatus: ${task.status}\nAssigned: ${task.assignedTo}`}
                        >
                          {/* Row 1: Client Name (UPPERCASE, max 3 words) + Status Letter Badge */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, minWidth: 0, width: "100%" }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: cfg.text,
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {getFirstWords(task.clientName || "GENERAL TASK", 3)}
                            </span>
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                backgroundColor: cfg.badgeBg,
                                color: cfg.badgeText,
                                fontSize: 9,
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              {cfg.short}
                            </span>
                          </div>

                          {/* Row 2: Task Title (First 5 words only as requested) */}
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: cfg.text,
                              lineHeight: 1.25,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                              width: "100%",
                            }}
                            title={task.title}
                          >
                            {getFirstWords(task.title, 5)}
                          </div>

                          {/* Row 3: Assignee */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3.5,
                              fontSize: 9.5,
                              color: cfg.text,
                              opacity: 0.85,
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            <User size={10} color={cfg.text} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {task.assignedTo || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* +X more works button */}
                    {cell.tasks.length > 3 && !isExpanded && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(cell.dateStr)}
                        style={{
                          background: "#e0e7ff",
                          border: "1px solid #c7d2fe",
                          borderRadius: 5,
                          padding: "4px 6px",
                          textAlign: "center",
                          color: "#4338ca",
                          fontWeight: 700,
                          fontSize: 10.5,
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                          marginTop: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#c7d2fe";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#e0e7ff";
                        }}
                      >
                        +{remainingCount} more works
                      </button>
                    )}

                    {/* Show less button when expanded */}
                    {cell.tasks.length > 3 && isExpanded && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(cell.dateStr)}
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 5,
                          padding: "4px 6px",
                          textAlign: "center",
                          color: "#64748b",
                          fontWeight: 600,
                          fontSize: 10,
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                          marginTop: 1,
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day Detail Popup (Matching Reference Screenshot) */}
      {selectedDayPopup && (
        <DayDetailPopup
          dateStr={selectedDayPopup.dateStr}
          tasks={filteredTasks.filter((t) => t.dueDate === selectedDayPopup.dateStr)}
          onClose={() => setSelectedDayPopup(null)}
          onAddTask={(dateStr) => {
            setSelectedDayPopup(null);
            handleOpenCreateForDate(dateStr);
          }}
          onEditTask={(task) => {
            setSelectedDayPopup(null);
            setTimeout(() => {
              setEditingTask(task);
            }, 30);
          }}
          onStatusChange={handlePopupStatusChange}
          onDeclineTask={handlePopupDeclineTask}
        />
      )}

      {/* 5. Create Task Modal */}
      {showCreateModal && (
        <TaskFormModal
          initialDate={modalDatePrefill}
          clients={clients}
          employees={employeeList}
          onClose={() => setShowCreateModal(false)}
          onSave={(newTask) => {
            const updated = addStoredTask(newTask);
            setTasks(updated);
            setShowCreateModal(false);
            toast.success("New task created and scheduled on calendar!");
          }}
        />
      )}

      {/* 6. Edit / View Task Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          clients={clients}
          employees={employeeList}
          onClose={() => setEditingTask(null)}
          onSave={(updatedTask) => {
            const updated = updateStoredTask(updatedTask);
            setTasks(updated);
            setEditingTask(null);
            toast.success("Task updated successfully!");
          }}
          onDecline={(taskId, reason) => {
            const updated = declineStoredTask(taskId, reason || "Declined from Task Details");
            setTasks(updated);
            setEditingTask(null);
            toast.success("Task declined and moved to Declined Tasks");
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Creation Modal
// ─────────────────────────────────────────────────────────────

function TaskFormModal({
  initialDate,
  clients,
  employees,
  onClose,
  onSave,
}: {
  initialDate: string;
  clients: Client[];
  employees?: { id: string; name: string; role?: string; department?: string }[];
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<string>("Follow-up");
  const [assignTo, setAssignTo] = useState<string>("Fuhad");
  const [dueDate, setDueDate] = useState<string>(initialDate);
  const [dueTime, setDueTime] = useState<string>("10:00");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [status, setStatus] = useState<Task["status"]>("Pending");
  const [notes, setNotes] = useState("");
  
  // Client autocomplete
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [isClientOpen, setIsClientOpen] = useState(false);

  // Custom task type inline
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [allTypes, setAllTypes] = useState<string[]>(DEFAULT_TASK_TYPES);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
      .slice(0, 15);
  }, [clients, clientSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      type: taskType as TaskType,
      assignedTo: assignTo,
      assignedToId: `emp-${assignTo.toLowerCase().replace(/\s+/g, "")}`,
      dueDate,
      dueTime,
      priority,
      status,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name || (clientSearch.trim() ? clientSearch.trim() : undefined),
      notes: notes.trim(),
      createdAt: new Date().toISOString().split("T")[0],
      createdBy: typeof window !== "undefined" ? JSON.parse(localStorage.getItem("fastonmed_user") || "{}")?.name || "Hashim" : "Hashim",
      createdById: typeof window !== "undefined" ? JSON.parse(localStorage.getItem("fastonmed_user") || "{}")?.id || "emp-hashim" : "emp-hashim",
    };

    onSave(newTask);
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 800,
          width: "100%",
          padding: "26px 30px",
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          animation: "scaleUp 0.2s ease",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>Create Task</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
              Assign a new task to the team and schedule on the calendar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Task Title *
            </label>
            <input
              className="form-input"
              required
              placeholder="e.g. Follow-up call with Mediclinic regarding ventilator quotation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", fontSize: 13 }}
            />
          </div>

          {/* Type & Assignee */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Task Type</label>
                <button
                  type="button"
                  onClick={() => setIsAddingType(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4f46e5",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Add Option
                </button>
              </div>
              {isAddingType ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    className="form-input"
                    placeholder="New type..."
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    style={{ flex: 1, fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "4px 8px", fontSize: 11 }}
                    onClick={() => {
                      if (newTypeName.trim()) {
                        const trimmed = newTypeName.trim();
                        setAllTypes((prev) => [...prev, trimmed]);
                        setTaskType(trimmed);
                        setNewTypeName("");
                        setIsAddingType(false);
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <CustomLightSelect
                  value={taskType}
                  options={allTypes.map((t) => ({ value: t, label: t }))}
                  onChange={(val) => setTaskType(val)}
                  buttonStyle={{ width: "100%", height: 38, fontSize: 13 }}
                />
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Assign To
              </label>
              <CustomLightSelect
                value={assignTo}
                searchable={true}
                placeholder="Select Assignee..."
                options={(employees && employees.length > 0 ? employees : mockEmployees).map((e) => ({
                  value: e.name,
                  label: e.name === "Fuhad" ? "Fuhad (Myself)" : e.name,
                  subtext: [e.role, e.department].filter(Boolean).join(" • "),
                }))}
                onChange={(val) => setAssignTo(val)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Due Date & Time */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Due Date *
              </label>
              <input
                type="date"
                required
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: "100%", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Due Time
              </label>
              <input
                type="time"
                className="form-input"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                style={{ width: "100%", fontSize: 13 }}
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Priority
              </label>
              <CustomLightSelect
                value={priority}
                options={[
                  { value: "Low", label: "Low Priority" },
                  { value: "Medium", label: "Medium Priority" },
                  { value: "High", label: "High Priority" },
                ]}
                onChange={(val) => setPriority(val as any)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Initial Status
              </label>
              <CustomLightSelect
                value={status === "Approved" ? "Completed" : status}
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "In Progress", label: "In Progress" },
                  { value: "Completed", label: "Completed" },
                ]}
                onChange={(val) => setStatus(val as any)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Client Selection */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Client / Facility (optional)
            </label>
            <CustomLightSelect
              value={selectedClient ? selectedClient.id : ""}
              searchable={true}
              placeholder="Search or select facility (optional)..."
              options={[
                { value: "", label: "General team assignment (No specific client)" },
                ...clients.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.city ? ` (${c.city})` : ""}`,
                  subtext: [c.orgType, c.city].filter(Boolean).join(" • "),
                })),
              ]}
              onChange={(cId) => {
                if (!cId) {
                  setSelectedClient(null);
                  setClientSearch("");
                } else {
                  const matched = clients.find((c) => c.id === cId);
                  if (matched) {
                    setSelectedClient({ id: matched.id, name: matched.name });
                  }
                }
              }}
              buttonStyle={{ width: "100%", height: 38, fontSize: 13 }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Notes / Description
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Provide details or clinical context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", fontSize: 13, resize: "vertical" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                backgroundColor: "#4f46e5",
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
              }}
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Detail & Edit Modal
// ─────────────────────────────────────────────────────────────

function TaskEditModal({
  task,
  clients,
  employees,
  onClose,
  onSave,
  onDecline,
}: {
  task: Task;
  clients: Client[];
  employees?: { id: string; name: string; role?: string; department?: string }[];
  onClose: () => void;
  onSave: (updated: Task) => void;
  onDecline: (id: string, reason?: string) => void;
}) {
  const [currentUser, setCurrentUser] = useState<any>(() => getCurrentUser());
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const canEdit = canUserEditTask(task, currentUser) || forceUnlocked;

  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<Task["status"]>(task.status === "Approved" ? "Completed" : task.status);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [dueTime, setDueTime] = useState(task.dueTime || "10:00");
  const [priority, setPriority] = useState(task.priority);
  const [assignTo, setAssignTo] = useState(task.assignedTo);
  const [clientId, setClientId] = useState(task.clientId || "");
  const [clientName, setClientName] = useState(task.clientName || "");
  const [notes, setNotes] = useState(task.notes || "");

  // Decline modal state inside edit dialog
  const [showDeclinePrompt, setShowDeclinePrompt] = useState(false);
  const [declineReasonText, setDeclineReasonText] = useState("");

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error(`Permission denied: Only creator (${task.createdBy}) and assignee (${task.assignedTo}) can edit this task`);
      return;
    }
    onSave({
      ...task,
      title: title.trim(),
      status: status === "Approved" ? "Completed" : status,
      dueDate,
      dueTime,
      priority,
      assignedTo: assignTo,
      assignedToId: `emp-${assignTo.toLowerCase().replace(/\s+/g, "")}`,
      clientId: clientId || undefined,
      clientName: clientName || undefined,
      notes: notes.trim(),
    });
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 800,
          width: "100%",
          padding: "26px 30px",
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          animation: "scaleUp 0.2s ease",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>Task Details</h3>
              {!canEdit && (
                <span
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Lock size={11} /> View Only
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap", fontSize: 13, color: "#64748b" }}>
              <span style={{ fontWeight: 700, color: clientName ? "#0f172a" : "#64748b" }}>
                Client: {clientName || "General team assignment"}
              </span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span style={{ fontWeight: 600, color: "#4f46e5" }}>
                Created by: {task.createdBy || "Hashim"}
              </span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span style={{ fontWeight: 600, color: "#0284c7" }}>
                Assigned to: {task.assignedTo || "Unassigned"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Third-party permission warning banner */}
        {!canEdit && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 16,
              color: "#475569",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Lock size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <span>
                <b>View-Only Notice:</b> You are viewing this task as a third party. Only creator (<b>{task.createdBy || "Creator"}</b>) and assignee (<b>{task.assignedTo || "Assignee"}</b>) are default editors.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setForceUnlocked(true)}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#004d66",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <Pencil size={12} />
              <span>Enable Edit</span>
            </button>
          </div>
        )}

        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Task Title
            </label>
            <input
              className="form-input"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", fontSize: 13, opacity: canEdit ? 1 : 0.8 }}
              required
            />
          </div>

          {/* Client Selection */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Client / Facility
            </label>
            <CustomLightSelect
              value={clientId}
              searchable={canEdit}
              placeholder="Select Client / Facility..."
              options={[
                { value: "", label: "General team assignment (No specific client)" },
                ...clients.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.city ? ` (${c.city})` : ""}`,
                  subtext: [c.orgType, c.city].filter(Boolean).join(" • "),
                })),
              ]}
              onChange={(cId) => {
                if (!canEdit) return;
                setClientId(cId);
                const matched = clients.find((c) => c.id === cId);
                setClientName(matched ? matched.name : "");
              }}
              buttonStyle={{ width: "100%", height: 38, fontSize: 13, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
            />
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Status (3 Stages)
              </label>
              <CustomLightSelect
                value={status === "Approved" ? "Completed" : status}
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "In Progress", label: "In Progress" },
                  { value: "Completed", label: "Completed" },
                ]}
                onChange={(val) => canEdit && setStatus(val as any)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Priority
              </label>
              <CustomLightSelect
                value={priority}
                options={[
                  { value: "Low", label: "Low" },
                  { value: "Medium", label: "Medium" },
                  { value: "High", label: "High" },
                ]}
                onChange={(val) => canEdit && setPriority(val as any)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Created By
              </label>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: 38,
                  boxSizing: "border-box",
                }}
              >
                <User size={14} color="#6366f1" />
                <span>{task.createdBy || "Hashim"}</span>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Assigned To
              </label>
              <CustomLightSelect
                value={assignTo}
                searchable={canEdit}
                placeholder="Select Assignee..."
                options={(employees && employees.length > 0 ? employees : mockEmployees).map((e) => ({
                  value: e.name,
                  label: e.name === "Fuhad" ? "Fuhad (Myself)" : e.name,
                  subtext: [e.role, e.department].filter(Boolean).join(" • "),
                }))}
                onChange={(val) => canEdit && setAssignTo(val)}
                buttonStyle={{ width: "100%", height: 38, fontSize: 13, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Due Date
            </label>
            <input
              type="date"
              disabled={!canEdit}
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: "100%", fontSize: 13, opacity: canEdit ? 1 : 0.8 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
              Notes
            </label>
            <textarea
              className="form-input"
              disabled={!canEdit}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", fontSize: 13, resize: "vertical", opacity: canEdit ? 1 : 0.8 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setDeclineReasonText("");
                  setShowDeclinePrompt(true);
                }}
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#fee2e2";
                  e.currentTarget.style.borderColor = "#f87171";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fecaca";
                }}
              >
                <XCircle size={14} />
                <span>Decline Task</span>
              </button>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#94a3b8",
                  fontWeight: 600,
                }}
              >
                <Lock size={13} /> Only creator & assignee can edit
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ padding: "7px 14px", fontSize: 12.5 }}
              >
                {canEdit ? "Cancel" : "Close"}
              </button>

              {canEdit ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: "#4f46e5",
                    padding: "7px 18px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: "none",
                  }}
                >
                  Save Changes
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  style={{
                    backgroundColor: "#f1f5f9",
                    color: "#94a3b8",
                    padding: "7px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    cursor: "not-allowed",
                  }}
                >
                  🔒 Locked
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Decline Reason Modal inside Task Details */}
      {showDeclinePrompt && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100050,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeclinePrompt(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
              border: "1px solid #fee2e2",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <XCircle size={20} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                  Decline Task
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeclinePrompt(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#334155", fontWeight: 600 }}>
                Are you sure you want to decline <b>"{task.title}"</b>? Please provide a reason:
              </p>

              {/* Quick Select Reason Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[
                  "Client Rescheduled",
                  "Equipment Unavailable",
                  "Assigned to Wrong Rep",
                  "Client Cancelled",
                  "Duplicate Task",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setDeclineReasonText(chip)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: declineReasonText === chip ? "1px solid #b91c1c" : "1px solid #e2e8f0",
                      backgroundColor: declineReasonText === chip ? "#fee2e2" : "#f8fafc",
                      color: declineReasonText === chip ? "#991b1b" : "#475569",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={declineReasonText}
                onChange={(e) => setDeclineReasonText(e.target.value)}
                placeholder="Enter detailed decline reason..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowDeclinePrompt(false)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!declineReasonText.trim()}
                  onClick={() => {
                    if (!declineReasonText.trim()) return;
                    setShowDeclinePrompt(false);
                    onDecline(task.id, declineReasonText.trim());
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: declineReasonText.trim() ? "#dc2626" : "#fca5a5",
                    color: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: declineReasonText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
