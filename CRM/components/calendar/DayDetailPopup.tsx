"use client";
import "./day-page-mobile.css";

import React, { useState, useEffect } from "react";
import type { Task, TaskStatus, Client } from "@/types";
import { X, Plus, XCircle, Calendar as CalendarIcon, User, Lock, AlertTriangle, AlertCircle } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { canUserEditTask, declineStoredTask, getCurrentUser } from "@/lib/task-store";
import toast from "react-hot-toast";

interface DayDetailPopupProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onAddTask: (dateStr: string) => void;
  onEditTask: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: string) => void;
  onDeclineTask?: (taskId: string, reason?: string) => void;
  onDeleteTask?: (taskId: string) => void;
  clientContext?: Client;
}

const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const STATUS_SELECT_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string; leftBorder: string }> = {
  "Pending": {
    label: "Pending",
    bg: "#fef9c3",
    border: "#fde047",
    text: "#854d0e",
    dot: "#eab308",
    leftBorder: "#eab308",
  },
  "In Progress": {
    label: "In Progress",
    bg: "#e0f2fe",
    border: "#7dd3fc",
    text: "#0369a1",
    dot: "#0284c7",
    leftBorder: "#0284c7",
  },
  "Completed": {
    label: "Completed",
    bg: "#dcfce7",
    border: "#86efac",
    text: "#15803d",
    dot: "#22c55e",
    leftBorder: "#22c55e",
  },
  "Approved": {
    label: "Completed",
    bg: "#dcfce7",
    border: "#86efac",
    text: "#15803d",
    dot: "#22c55e",
    leftBorder: "#22c55e",
  },
};

export default function DayDetailPopup({
  dateStr,
  tasks,
  onClose,
  onAddTask,
  onEditTask,
  onStatusChange,
  onDeclineTask,
  onDeleteTask,
  clientContext,
}: DayDetailPopupProps) {
  // Current user session for 2-party edit authorization
  const [currentUser, setCurrentUser] = useState<any>(() => getCurrentUser());
  const [declineTargetTask, setDeclineTargetTask] = useState<Task | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  useEffect(() => {
    const handleUserSync = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener("fastonmed_user_updated", handleUserSync);
    return () => window.removeEventListener("fastonmed_user_updated", handleUserSync);
  }, []);

  // Parse date string (YYYY-MM-DD) safely
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10) || 2026;
  const monthIndex = (parseInt(monthStr, 10) || 9) - 1;
  const dayNum = parseInt(dayStr, 10) || 1;

  const dateObj = new Date(year, monthIndex, dayNum);
  const weekdayName = WEEKDAY_NAMES[dateObj.getDay()] || "Tuesday";
  const monthShort = MONTH_NAMES_SHORT[monthIndex] || "SEP";
  const monthFull = MONTH_NAMES_FULL[monthIndex] || "September";

  // Status breakdown counts (3 Stages Only)
  const pendingCount = tasks.filter((t) => t.status === "Pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const completedCount = tasks.filter((t) => t.status === "Completed" || t.status === "Approved").length;

  return (
    <div className="task-day-overlay" data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="task-day-dialog" role="dialog" aria-modal="true" aria-label="Tasks for selected date"
        style={{
          width: "100%",
          maxWidth: 580,
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* ─── 1. GRADIENT HEADER ─────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 45%, #4f46e5 80%, #6366f1 100%)",
            padding: "20px 24px",
            color: "#ffffff",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Date Badge (e.g. SEP 1) */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 12,
                backgroundColor: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.2)",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", opacity: 0.9, lineHeight: 1 }}>
                {monthShort}
              </span>
              <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.15, marginTop: 2 }}>
                {dayNum}
              </span>
            </div>

            {/* Title & Subtitle */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em", color: "#ffffff" }}>
                  {weekdayName}
                </h2>
                <span
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    color: "#ffffff",
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 9px",
                    borderRadius: 999,
                  }}
                >
                  {monthFull} {year}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "rgba(255, 255, 255, 0.85)", fontWeight: 500 }}>
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} assigned
              </p>
            </div>
          </div>

          {/* Close Button (White square/circle button like in screenshot) */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#ffffff",
              border: "none",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              transition: "transform 0.12s ease, background-color 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            title="Close popup"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* ─── 2. STATUS BREAKDOWN STRIP ──────────────────────────────────── */}
        {/* ─── 2. STATUS BREAKDOWN STRIP (3 Stages Only) ─────────────────── */}
        <div className={tasks.length === 0 ? "task-day-status empty" : "task-day-status"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "10px 20px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #f1f5f9",
            fontSize: 12,
            overflowX: "auto",
            gap: 20,
          }}
        >
          {/* Pending */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#eab308" }} />
            <span style={{ color: "#475569", fontWeight: 500 }}>Pending</span>
            <span style={{ fontWeight: 800, color: "#d97706", marginLeft: 2 }}>{pendingCount}</span>
          </div>

          {/* In Progress */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: inProgressCount > 0 ? "#0284c7" : "#94a3b8" }} />
            <span style={{ color: "#475569", fontWeight: 500 }}>In Progress</span>
            <span style={{ fontWeight: 800, color: inProgressCount > 0 ? "#0284c7" : "#94a3b8", marginLeft: 2 }}>{inProgressCount}</span>
          </div>

          {/* Completed */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: completedCount > 0 ? "#22c55e" : "#94a3b8" }} />
            <span style={{ color: "#475569", fontWeight: 500 }}>Completed</span>
            <span style={{ fontWeight: 800, color: completedCount > 0 ? "#16a34a" : "#94a3b8", marginLeft: 2 }}>{completedCount}</span>
          </div>
        </div>

        {/* ─── 3. TASK LIST ITEMS ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxHeight: "calc(90vh - 210px)",
            backgroundColor: "#f8fafc",
          }}
        >
          {tasks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#64748b",
                backgroundColor: "#ffffff",
                borderRadius: 12,
                border: "1px dashed #cbd5e1",
              }}
            >
              <CalendarIcon size={32} color="#94a3b8" style={{ margin: "0 auto 10px auto" }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                No tasks scheduled
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                Add a task to plan this day.
              </p>
            </div>
          ) : (
            tasks.map((task) => {
              const normStatus = task.status === "Approved" ? "Completed" : task.status;
              const cfg = STATUS_SELECT_CONFIG[normStatus] || STATUS_SELECT_CONFIG["Pending"];
              const isUrgent = task.priority === "High";
              const canEdit = canUserEditTask(task, currentUser);

              return (
                <div
                  key={task.id}
                  className="day-task-card"
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = e.target as HTMLElement;
                    if (
                      target.tagName !== "SELECT" &&
                      target.tagName !== "BUTTON" &&
                      target.tagName !== "OPTION" &&
                      !target.closest("button") &&
                      !target.closest("select")
                    ) {
                      onEditTask(task);
                    }
                  }}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    borderLeft: `4.5px solid ${cfg.leftBorder}`,
                    padding: "12px 14px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {/* Row 1: Title & Type Pill */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <h4
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask(task);
                      }}
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#0f172a",
                        lineHeight: 1.35,
                        flex: 1,
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#4f46e5")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                      title={canEdit ? "Click to edit task details" : "Click to view task details (Read-only for 3rd user)"}
                    >
                      {task.title}
                    </h4>

                    {/* Task Type / Category Pill on right */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        padding: "3px 8px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {task.type || "TASK"}
                    </span>
                  </div>

                  {/* Row 2: Client Name • Created By • Priority • Date */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#64748b",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                      {task.clientName || clientContext?.name || "General Client"}
                    </span>

                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span style={{ color: "#4f46e5", fontWeight: 600 }}>
                      Created by {task.createdBy || "Hashim"}
                    </span>

                    {isUrgent && (
                      <>
                        <span style={{ color: "#cbd5e1" }}>•</span>
                        <span style={{ color: "#dc2626", fontWeight: 800, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#dc2626" }} />
                          URGENT
                        </span>
                      </>
                    )}

                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4f46e5", fontWeight: 600 }}>
                      <CalendarIcon size={12} color="#4f46e5" />
                      <span>{monthShort} {dayNum}{task.dueTime ? ` (${task.dueTime})` : ""}</span>
                    </span>
                  </div>

                  {/* Row 3: Assignee on left + Status dropdown & Decline on right */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 2,
                      paddingTop: 8,
                      borderTop: "1px solid #f8fafc",
                    }}
                  >
                    {/* Assignee Avatar + Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: "#4f46e5",
                          color: "#ffffff",
                          fontSize: 10,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(task.assignedTo || "Unassigned")}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>
                        {task.assignedTo || "Unassigned"}
                      </span>
                    </div>

                    {/* Right Controls: Quick Status Select + Decline */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Status Dropdown Pill (Editable only by creator or assignee) */}
                      <select
                        value={task.status === "Approved" ? "Completed" : task.status}
                        disabled={!canEdit}
                        onChange={(e) => canEdit && onStatusChange(task, e.target.value)}
                        title={
                          canEdit
                            ? "Update task status"
                            : `Only creator (${task.createdBy || "Creator"}) and assignee (${task.assignedTo || "Assignee"}) can update status`
                        }
                        style={{
                          backgroundColor: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          color: cfg.text,
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          cursor: canEdit ? "pointer" : "not-allowed",
                          opacity: canEdit ? 1 : 0.65,
                          outline: "none",
                        }}
                      >
                        <option value="Pending">Pending ▾</option>
                        <option value="In Progress">In Progress ▾</option>
                        <option value="Completed">Completed ▾</option>
                      </select>

                      {/* Decline Task Button: Opens Reason Popup when clicked; locked for 3rd users */}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeclineTargetTask(task);
                            setDeclineReason("");
                          }}
                          style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: "3px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            transition: "all 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#fee2e2";
                            e.currentTarget.style.borderColor = "#f87171";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fef2f2";
                            e.currentTarget.style.borderColor = "#fecaca";
                          }}
                          title="Decline task with reason (moves to Declined Tasks section)"
                        >
                          <XCircle size={13} />
                          <span>Decline</span>
                        </button>
                      ) : (
                        <div
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#94a3b8",
                            padding: "3px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "not-allowed",
                          }}
                          title={`Only creator (${task.createdBy || "Creator"}) and assignee (${task.assignedTo || "Assignee"}) can edit or decline this task`}
                        >
                          <Lock size={12} color="#94a3b8" />
                          <span>View only</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── 4. BOTTOM ACTION FOOTER (+ Add New Task) ───────────────────── */}
        <div
          style={{
            padding: "14px 20px",
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={() => onAddTask(dateStr)}
            style={{
              width: "100%",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#4338ca";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#4f46e5";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add task</span>
          </button>
        </div>
      </div>

      {/* ─── 5. DECLINE REASON MODAL POPUP ─────────────────────────────── */}
      {declineTargetTask && (
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
            if (e.target === e.currentTarget) {
              setDeclineTargetTask(null);
              setDeclineReason("");
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
              border: "1px solid #fee2e2",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <XCircle size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                    Decline Task
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>
                    Provide a reason to decline and archive this task
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeclineTargetTask(null);
                  setDeclineReason("");
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  borderRadius: 6,
                  color: "#ffffff",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 22px" }}>
              {/* Task Details Banner */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                  {declineTargetTask.title}
                </div>
                <div style={{ fontSize: 11.5, color: "#7f1d1d", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span>{declineTargetTask.clientName || clientContext?.name || "General Task"}</span>
                  <span style={{ color: "#f87171" }}>•</span>
                  <span>Created by: <b>{declineTargetTask.createdBy || "Hashim"}</b></span>
                  <span style={{ color: "#f87171" }}>•</span>
                  <span>Assigned to: <b>{declineTargetTask.assignedTo || "Unassigned"}</b></span>
                </div>
              </div>

              {/* Quick Select Reason Tags */}
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Quick Select Reason:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  "Client Rescheduled",
                  "Equipment Unavailable",
                  "Assigned to Wrong Rep",
                  "Client Cancelled Requirement",
                  "Duplicate Task",
                  "Other Priorities",
                ].map((chip) => {
                  const isSelected = declineReason === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDeclineReason(chip)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: isSelected ? "1px solid #b91c1c" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "#fee2e2" : "#f8fafc",
                        color: isSelected ? "#991b1b" : "#475569",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>

              {/* Custom Reason Input */}
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Reason for Declining *
              </label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter detailed reason for declining this task..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#0f172a",
                  outline: "none",
                  resize: "vertical",
                }}
              />

              {/* Footer Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => {
                    setDeclineTargetTask(null);
                    setDeclineReason("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!declineReason.trim() || isSubmittingDecline}
                  onClick={() => {
                    if (!declineReason.trim()) return;
                    setIsSubmittingDecline(true);
                    const reason = declineReason.trim();
                    declineStoredTask(declineTargetTask.id, reason);
                    if (onDeclineTask) {
                      onDeclineTask(declineTargetTask.id, reason);
                    } else if (onDeleteTask) {
                      onDeleteTask(declineTargetTask.id);
                    }
                    toast.success(`Task declined: ${reason}`);
                    setIsSubmittingDecline(false);
                    setDeclineTargetTask(null);
                    setDeclineReason("");
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: declineReason.trim() ? "#dc2626" : "#fca5a5",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: declineReason.trim() ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: declineReason.trim() ? "0 2px 6px rgba(220, 38, 38, 0.3)" : "none",
                  }}
                >
                  <XCircle size={15} />
                  <span>Confirm Decline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
