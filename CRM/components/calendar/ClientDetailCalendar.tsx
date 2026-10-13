"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Task, Client, TaskStatus, TaskPriority, TaskType } from "@/types";
import { getStoredTasks, addStoredTask, updateStoredTask, deleteStoredTask, declineStoredTask, syncLiveTasksFromApi, canUserEditTask, getCurrentUser } from "@/lib/task-store";
import { mockEmployees } from "@/lib/mock-data";
import CustomLightSelect from "@/components/CustomLightSelect";
import toast from "react-hot-toast";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Clock,
  Building2,
  X,
  XCircle,
  Trash2,
  CheckCircle2,
  Calendar as CalendarIcon,
  Lock,
  Pencil,
} from "lucide-react";
import DayDetailPopup from "./DayDetailPopup";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_TASK_TYPES = [
  "Call", "Site Visit", "Demo", "Installation", "Service Visit", "Quotation", "Meeting", "Follow-up"
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

interface ClientDetailCalendarProps {
  client: Client;
}

export default function ClientDetailCalendar({ client }: ClientDetailCalendarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // September (0-indexed: 8 = Sep)
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Modal states
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
    declineStoredTask(taskId, reason || "Declined from client calendar");
    setTasks(getStoredTasks());
    toast.success("Task declined and moved to Declined Tasks");
  };

  const toggleDayExpand = (dateStr: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Sync tasks from store & listen for global updates
  useEffect(() => {
    setTasks(getStoredTasks());
    syncLiveTasksFromApi().then((live) => {
      if (Array.isArray(live)) setTasks(live);
    });

    const handleSync = () => {
      setTasks(getStoredTasks());
    };

    window.addEventListener("fastonmed_tasks_updated", handleSync);
    return () => {
      window.removeEventListener("fastonmed_tasks_updated", handleSync);
    };
  }, []);

  // Filter tasks strictly for THIS client
  const clientTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Exclude declined tasks from calendar
      if (t.status === "Declined") return false;

      // Must match client
      const matchId = t.clientId && t.clientId === client.id;
      const tName = (t.clientName || "").trim().toLowerCase();
      const cName = (client.name || "").trim().toLowerCase();
      const matchName = tName && cName && (tName === cName || tName.includes(cName) || cName.includes(tName));

      if (!matchId && !matchName) return false;

      // Status filter
      if (selectedStatus !== "All") {
        const normStatus = t.status === "Completed" ? "Approved" : t.status;
        if (normStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [tasks, client.id, client.name, selectedStatus]);

  // Calendar cells for current year/month
  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: Task[];
    }[] = [];

    // Preceding empty/inactive days
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

      const dayTasks = clientTasks.filter((t) => t.dueDate === dStr);

      cells.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday,
        tasks: dayTasks,
      });
    }

    // Trailing days
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
  }, [currentYear, currentMonth, clientTasks]);

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
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const handleOpenCreateForDate = (dateStr: string) => {
    setModalDatePrefill(dateStr);
    setEditingTask(null);
    setShowCreateModal(true);
  };

  return (
    <div className="mobile-client-calendar" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ─── HEADER & CONTROLS BAR ─────────────────────────────────────────── */}
      <div className="client-calendar-controls"
        style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: "#f0fdf9",
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#004d66",
                }}
              >
                <CalendarDays size={18} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Work calendar
              </h3>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: "1px solid #dbeafe",
                }}
              >
                {clientTasks.length} {clientTasks.length === 1 ? "Task" : "Tasks"} Scheduled
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
              Dedicated schedule of follow-ups, demos, meetings &amp; AMC service visits specifically for <strong>{client.name}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => { const today = new Date(); handleOpenCreateForDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`); }}
            style={{
              backgroundColor: "#004d66",
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(0,77,102,0.2)",
              transition: "all 0.15s ease",
            }}
          >
            <Plus size={15} />
            <span>Schedule task</span>
          </button>
        </div>

        {/* Navigator & Status Filters Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #f1f5f9",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Month Navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "2px 4px",
              }}
            >
              <button
                type="button"
                aria-label="Previous month"
                onClick={handlePrevMonth}
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", padding: "0 8px", minWidth: 120, textAlign: "center" }}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={handleNextMonth}
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              style={{
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 7,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CalendarIcon size={12} color="#004d66" />
              <span>Today</span>
            </button>
          </div>

          {/* Status Filter Pills */}
          <select className="client-calendar-status-select" aria-label="Filter calendar by task status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="All">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
          </select>
          <div className="client-calendar-status-pills" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStatus("All")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: selectedStatus === "All" ? "#0f172a" : "#f1f5f9",
                color: selectedStatus === "All" ? "#ffffff" : "#475569",
                border: "1px solid transparent",
                cursor: "pointer",
              }}
            >
              All Statuses
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const isSelected = selectedStatus === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStatus(isSelected ? "All" : key)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: cfg.bg,
                    color: cfg.text,
                    border: `1px solid ${isSelected ? cfg.badgeBg : cfg.border}`,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: cfg.badgeBg,
                      color: cfg.badgeText,
                      width: 15,
                      height: 15,
                      borderRadius: 3,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9.5,
                      fontWeight: 800,
                    }}
                  >
                    {cfg.pillShort || cfg.short}
                  </span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── CALENDAR MONTH GRID (COMPACT CARD GRID) ────────────────────────── */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "16px 18px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          overflowX: "auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div className="client-calendar-month" style={{ minWidth: 780, width: "100%" }}>
          <p className="client-calendar-mobile-hint">Tap a date to view or schedule tasks</p>
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
              // Out-of-month empty placeholder card
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
                  role="button"
                  tabIndex={0}
                  aria-label={`${cell.dateStr}: ${cell.tasks.length} tasks`}
                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedDayPopup({dateStr:cell.dateStr,dayNum:cell.dayNum}); } }}
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
                        title={`Schedule task for ${client.name} on ${cell.dateStr}`}
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
                          title={`${task.title}\nStatus: ${task.status}\nAssigned: ${task.assignedTo}`}
                        >
                          {/* Row 1: Task Type + Status Letter Badge */}
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
                              {task.type}
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

                          {/* Row 2: Task Title */}
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
          tasks={clientTasks.filter((t) => t.dueDate === selectedDayPopup.dateStr)}
          clientContext={client}
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

      {/* ─── CREATE TASK MODAL FOR THIS CLIENT ──────────────────────────────── */}
      {showCreateModal && (
        <ClientTaskCreateModal
          client={client}
          initialDate={modalDatePrefill}
          onClose={() => setShowCreateModal(false)}
          onSave={(newTask) => {
            const updated = addStoredTask(newTask);
            setTasks(updated);
            setShowCreateModal(false);
            toast.success(`Task scheduled for ${client.name}!`);
          }}
        />
      )}

      {/* ─── EDIT TASK MODAL ─────────────────────────────────────────────────── */}
      {editingTask && (
        <ClientTaskEditModal
          task={editingTask}
          clientName={client.name}
          onClose={() => setEditingTask(null)}
          onSave={(updatedTask) => {
            const updated = updateStoredTask(updatedTask);
            setTasks(updated);
            setEditingTask(null);
            toast.success("Task updated!");
          }}
          onDecline={(taskId, reason) => {
            const updated = declineStoredTask(taskId, reason || "Declined from Client Task Details");
            setTasks(updated);
            setEditingTask(null);
            toast.success("Task declined and moved to Declined Tasks");
          }}
        />
      )}
    </div>
  );
}

// ─── CLIENT TASK CREATE MODAL (800PX WIDE, PRELOCKED TO THIS CLIENT) ─────────
function ClientTaskCreateModal({
  client,
  initialDate,
  onClose,
  onSave,
}: {
  client: Client;
  initialDate: string;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<string>("Follow-up");
  const [allTypes, setAllTypes] = useState<string[]>(DEFAULT_TASK_TYPES);
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [assignTo, setAssignTo] = useState("Fuhad");
  const [dueDate, setDueDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState("10:00");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [status, setStatus] = useState<TaskStatus>("Pending");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let creator: { id?: string; name?: string } = {};
    try {
      creator = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
    } catch {}

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      type: taskType as TaskType,
      assignedTo: assignTo,
      assignedToId: assignTo.toLowerCase().replace(/\s+/g, "-"),
      dueDate,
      dueTime: dueTime || undefined,
      priority,
      status,
      clientId: client.id,
      clientName: client.name,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: creator.name || "User not recorded",
      createdById: creator.id || undefined,
    };

    onSave(newTask);
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 800,
          width: "100%",
          padding: 0,
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          animation: "scaleUp 0.2s ease",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fafbfc",
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Schedule Task for {client.name}
            </h3>
            <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
              Task will be attached to {client.name} and scheduled on the team calendar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#94a3b8",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div data-mobile-grid="stack"
            style={{
              padding: "24px 28px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {/* Title */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Task Title *
              </label>
              <input
                className="form-input"
                required
                placeholder="e.g. Demonstration of LOGIQ-S8 ultrasound to Biomedical Dept"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", fontSize: 13.5, height: 40 }}
              />
            </div>

            {/* Task Type with + Add Option */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Task Type</label>
                {!isAddingType && (
                  <button
                    type="button"
                    onClick={() => setIsAddingType(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#004d66",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Add Option
                  </button>
                )}
              </div>
              {isAddingType ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="form-input"
                    placeholder="New type..."
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    style={{ flex: 1, fontSize: 12.5, height: 38 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: "#004d66", padding: "0 12px", height: 38, fontSize: 12 }}
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
                  buttonStyle={{ width: "100%", fontSize: 13, height: 38 }}
                />
              )}
            </div>

            {/* Assign To */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Assign To
              </label>
              <CustomLightSelect
                value={assignTo}
                searchable={true}
                placeholder="Select Assignee..."
                options={mockEmployees.map((e) => ({
                  value: e.name,
                  label: e.name === "Fuhad" ? "Fuhad (Myself)" : e.name,
                  subtext: [e.role, e.department].filter(Boolean).join(" • "),
                }))}
                onChange={(val) => setAssignTo(val)}
                buttonStyle={{ width: "100%", fontSize: 13, height: 38 }}
              />
            </div>

            {/* Due Date & Due Time */}
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
                style={{ width: "100%", fontSize: 13, height: 38 }}
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
                style={{ width: "100%", fontSize: 13, height: 38 }}
              />
            </div>

            {/* Priority & Status */}
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
                buttonStyle={{ width: "100%", fontSize: 13, height: 38 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Initial Status
              </label>
              <CustomLightSelect
                value={status}
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "In Progress", label: "In Progress" },
                  { value: "Under Review", label: "Under Review" },
                  { value: "Edit / Rework", label: "Edit / Rework" },
                  { value: "Approved", label: "Approved" },
                ]}
                onChange={(val) => setStatus(val as any)}
                buttonStyle={{ width: "100%", fontSize: 13, height: 38 }}
              />
            </div>

            {/* Pre-locked Client Box */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Connected Client / Facility
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Building2 size={16} color="#166534" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#15803d" }}>
                    {client.city}, {client.state} · {client.orgType}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "#dcfce7",
                    color: "#166534",
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  Pre-linked
                </span>
              </div>
            </div>

            {/* Notes */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Notes &amp; Clinical Context
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Provide clinical context, equipment requirements, or meeting agenda..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "10px 12px" }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "16px 28px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              backgroundColor: "#fafbfc",
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ backgroundColor: "#004d66", padding: "8px 20px" }}
            >
              Schedule Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CLIENT TASK EDIT MODAL (800PX WIDE) ──────────────────────────────────────
function ClientTaskEditModal({
  task,
  clientName,
  onClose,
  onSave,
  onDecline,
}: {
  task: Task;
  clientName: string;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDecline: (id: string, reason?: string) => void;
}) {
  const [currentUser, setCurrentUser] = useState<any>(() => getCurrentUser());
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const canEdit = canUserEditTask(task, currentUser) || forceUnlocked;

  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState<string>(task.type || "Follow-up");
  const [assignTo, setAssignTo] = useState(task.assignedTo);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [dueTime, setDueTime] = useState(task.dueTime || "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
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
    if (!title.trim()) return;

    onSave({
      ...task,
      title: title.trim(),
      type: taskType as TaskType,
      assignedTo: assignTo,
      assignedToId: assignTo.toLowerCase().replace(/\s+/g, "-"),
      dueDate,
      dueTime: dueTime || undefined,
      priority,
      status,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 20,
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
          padding: 0,
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          animation: "scaleUp 0.2s ease",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fafbfc",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Task Details · {clientName}
              </h3>
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
            <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
              Created by: <strong style={{ color: "#4f46e5" }}>{task.createdBy || "Hashim"}</strong> · Assigned to: <strong style={{ color: "#0284c7" }}>{task.assignedTo || "Unassigned"}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Third-party permission warning banner */}
        {!canEdit && (
          <div
            style={{
              margin: "16px 28px 0 28px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
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

        <form onSubmit={handleUpdate}>
          <div data-mobile-grid="stack" style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Title */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Task Title *
              </label>
              <input
                className="form-input"
                required
                disabled={!canEdit}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "9px 12px", opacity: canEdit ? 1 : 0.8 }}
              />
            </div>

            {/* Type & Assignee */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Type
              </label>
              <CustomLightSelect
                value={taskType}
                options={[
                  { value: "Follow-up", label: "Follow-up" },
                  { value: "Meeting", label: "Meeting" },
                  { value: "Demo", label: "Demo" },
                  { value: "Maintenance", label: "Maintenance" },
                  { value: "Urgent", label: "Urgent" },
                ]}
                onChange={(val) => canEdit && setTaskType(val)}
                buttonStyle={{ width: "100%", fontSize: 13, height: 38, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Assign To
              </label>
              <CustomLightSelect
                value={assignTo}
                searchable={canEdit}
                options={mockEmployees.map((e) => ({
                  value: e.name,
                  label: e.name === "Fuhad" ? "Fuhad (Myself)" : e.name,
                  subtext: [e.role, e.department].filter(Boolean).join(" • "),
                }))}
                onChange={(val) => canEdit && setAssignTo(val)}
                buttonStyle={{ width: "100%", fontSize: 13, height: 38, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>

            {/* Date & Time */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Due Date
              </label>
              <input
                type="date"
                className="form-input"
                disabled={!canEdit}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "9px 12px", opacity: canEdit ? 1 : 0.8 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Time (optional)
              </label>
              <input
                type="time"
                className="form-input"
                disabled={!canEdit}
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "9px 12px", opacity: canEdit ? 1 : 0.8 }}
              />
            </div>

            {/* Priority & Status */}
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
                onChange={(val) => canEdit && setPriority(val as any)}
                buttonStyle={{ width: "100%", fontSize: 13, height: 38, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>

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
                buttonStyle={{ width: "100%", fontSize: 13, height: 38, opacity: canEdit ? 1 : 0.8, cursor: canEdit ? "pointer" : "not-allowed" }}
              />
            </div>

            {/* Notes */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                Notes / Activity Log
              </label>
              <textarea
                className="form-input"
                rows={3}
                disabled={!canEdit}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "10px 12px", opacity: canEdit ? 1 : 0.8 }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "16px 28px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#fafbfc",
            }}
          >
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setDeclineReasonText("");
                  setShowDeclinePrompt(true);
                }}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: 6,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {canEdit ? "Cancel" : "Close"}
              </button>
              {canEdit ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", padding: "8px 20px" }}
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
                    padding: "8px 18px",
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

      {/* Decline Reason Modal inside Client Task Details */}
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
