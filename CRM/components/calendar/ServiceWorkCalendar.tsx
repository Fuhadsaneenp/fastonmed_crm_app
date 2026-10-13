"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  getStoredServiceTickets,
  fetchStoredServiceTicketsFromServer,
  saveStoredServiceTickets,
  addStoredServiceTicket,
  updateStoredServiceTicket,
  updateStoredServiceTicketStatus,
  deleteStoredServiceTicket,
  getStoredEngineers,
  addStoredEngineer,
  getStoredServiceTypes,
  addStoredServiceType,
  DEFAULT_ENGINEERS,
} from "@/lib/service-store";
import { addStandalonePerson, getStoredClients, syncLiveClientsFromApi } from "@/lib/client-store";
import { apiRequest } from "@/lib/api-client";
import { mockEmployees } from "@/lib/mock-data";
import type { ServiceTicket, ServiceStatus, Client, ContactPerson, Employee } from "@/types";
import toast from "react-hot-toast";
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
  Trash2,
  CheckCircle2,
  AlertCircle,
  Filter,
  Wrench,
  ShieldCheck,
  Tag,
  Star,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

function getFirstWords(text?: string, count: number = 5): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= count) return text;
  return words.slice(0, count).join(" ") + "...";
}

const SERVICE_STATUSES: ServiceStatus[] = [
  "New Request",
  "Assigned",
  "Visit Scheduled",
  "Under Repair",
  "Waiting Parts",
  "Completed",
  "Closed",
];

const SERVICE_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    short: string;
    pillShort: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    cardBg: string;
    cardBorder: string;
    leftBorder: string;
  }
> = {
  "New Request": {
    label: "New Request",
    short: "NR",
    pillShort: "NR",
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    badgeBg: "#3b82f6",
    badgeText: "#ffffff",
    cardBg: "#f8faff",
    cardBorder: "#3b82f6",
    leftBorder: "#3b82f6",
  },
  "Assigned": {
    label: "Assigned",
    short: "AS",
    pillShort: "AS",
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    badgeBg: "#8b5cf6",
    badgeText: "#ffffff",
    cardBg: "#faf5ff",
    cardBorder: "#8b5cf6",
    leftBorder: "#8b5cf6",
  },
  "Visit Scheduled": {
    label: "Visit Scheduled",
    short: "VS",
    pillShort: "VS",
    bg: "#fefce8",
    text: "#a16207",
    border: "#fde047",
    badgeBg: "#f59e0b",
    badgeText: "#ffffff",
    cardBg: "#fefce8",
    cardBorder: "#f59e0b",
    leftBorder: "#f59e0b",
  },
  "Under Repair": {
    label: "Under Repair",
    short: "UR",
    pillShort: "UR",
    bg: "#fff7ed",
    text: "#c2410c",
    border: "#fed7aa",
    badgeBg: "#f97316",
    badgeText: "#ffffff",
    cardBg: "#fff7ed",
    cardBorder: "#f97316",
    leftBorder: "#f97316",
  },
  "Waiting Parts": {
    label: "Waiting Parts",
    short: "WP",
    pillShort: "WP",
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    badgeBg: "#ef4444",
    badgeText: "#ffffff",
    cardBg: "#fff5f5",
    cardBorder: "#ef4444",
    leftBorder: "#ef4444",
  },
  "Completed": {
    label: "Completed",
    short: "CP",
    pillShort: "CP",
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    badgeBg: "#10b981",
    badgeText: "#ffffff",
    cardBg: "#f0fdf4",
    cardBorder: "#10b981",
    leftBorder: "#10b981",
  },
  "Closed": {
    label: "Closed",
    short: "CL",
    pillShort: "CL",
    bg: "#f8fafc",
    text: "#475569",
    border: "#cbd5e1",
    badgeBg: "#94a3b8",
    badgeText: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#94a3b8",
    leftBorder: "#94a3b8",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#ef4444",
};

interface ServiceWorkCalendarProps {
  onSelectTicket?: (ticket: ServiceTicket) => void;
}

export default function ServiceWorkCalendar({ onSelectTicket }: ServiceWorkCalendarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [emsEmployees, setEmsEmployees] = useState<Employee[]>(mockEmployees);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // September (0-indexed: 8 = Sep)

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>("All");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedEngineer, setSelectedEngineer] = useState<string>("All");
  const [selectedAmc, setSelectedAmc] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
  const [modalDatePrefill, setModalDatePrefill] = useState<string>("2026-09-06");
  const [selectedDayPopup, setSelectedDayPopup] = useState<{
    dateStr: string;
    dayNum: number;
  } | null>(null);

  // New Ticket Form
  const [newClientId, setNewClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientSearch, setNewClientSearch] = useState("");
  const [newClientPickerOpen, setNewClientPickerOpen] = useState(false);
  const [newConcernedPersonId, setNewConcernedPersonId] = useState("");
  const [newConcernedPerson, setNewConcernedPerson] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [showAddContactPanel, setShowAddContactPanel] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhoneInput, setNewContactPhoneInput] = useState("");
  const [newServiceType, setNewServiceType] = useState("");
  const [showAddServiceType, setShowAddServiceType] = useState(false);
  const [newServiceTypeName, setNewServiceTypeName] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newComplaint, setNewComplaint] = useState("");
  const [newPriority, setNewPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [newStatus, setNewStatus] = useState<ServiceStatus>("Visit Scheduled");
  const [newEngineer, setNewEngineer] = useState("");
  const [newVisitDate, setNewVisitDate] = useState("");
  const [newAmcCovered, setNewAmcCovered] = useState(false);
  const [customEngineers, setCustomEngineers] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  // Load stored tickets, clients & team members
  useEffect(() => {
    let isMounted = true;

    setTickets(getStoredServiceTickets());
    setClients(getStoredClients());
    setCustomEngineers(getStoredEngineers());
    setServiceTypes(getStoredServiceTypes());

    fetchStoredServiceTicketsFromServer().then((liveTickets) => {
      if (isMounted && liveTickets && liveTickets.length > 0) {
        setTickets(liveTickets);
      }
    });

    apiRequest<Employee[]>("/api/employees")
      .then((employees) => {
        if (isMounted && employees.length > 0) {
          setEmsEmployees(employees.filter((employee) => employee.status !== "Inactive"));
        }
      })
      .catch(() => {
        if (isMounted) setEmsEmployees(mockEmployees);
      });

    const handleSync = () => {
      setTickets(getStoredServiceTickets());
      setClients(getStoredClients());
      setCustomEngineers(getStoredEngineers());
      setServiceTypes(getStoredServiceTypes());
    };

    window.addEventListener("fastonmed_services_updated", handleSync);
    window.addEventListener("fastonmed_clients_updated", handleSync);
    window.addEventListener("fastonmed_engineers_updated", handleSync);
    window.addEventListener("fastonmed_service_types_updated", handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener("fastonmed_services_updated", handleSync);
      window.removeEventListener("fastonmed_clients_updated", handleSync);
      window.removeEventListener("fastonmed_engineers_updated", handleSync);
      window.removeEventListener("fastonmed_service_types_updated", handleSync);
    };
  }, []);

  // Internal team members only: do not include CRM healthcare contacts here.
  const engineers = useMemo(() => {
    const stored = customEngineers.length > 0 ? customEngineers : getStoredEngineers();
    const empNames = emsEmployees.map((e) => e.name);
    const legacyDummies = ["Rahul Kumar", "Sneha Pillai", "Deepa Suresh"];
    const fromTickets = tickets
      .map((t) => t.assignedEngineerName)
      .filter((n) => Boolean(n) && !legacyDummies.includes(n));
    return Array.from(new Set([...empNames, ...stored, ...fromTickets]));
  }, [customEngineers, emsEmployees, tickets]);

  const organisationClients = useMemo(
    () => clients.filter((client) => client.entityType === "Company"),
    [clients]
  );

  const filteredOrganisationClients = useMemo(() => {
    const query = newClientSearch.trim().toLowerCase();
    if (!query) return organisationClients;
    return organisationClients.filter((client) =>
      [
        client.name,
        client.orgType,
        client.city,
        client.state,
        client.phone,
        client.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [newClientSearch, organisationClients]);

  const selectedTicketClient = useMemo(
    () =>
      organisationClients.find((client) => client.id === newClientId) ||
      organisationClients.find((client) => client.name.toLowerCase() === newClientSearch.trim().toLowerCase()),
    [newClientId, newClientSearch, organisationClients]
  );

  const selectedClientContacts = useMemo(
    () => selectedTicketClient?.contacts?.filter((contact) => Boolean(contact.name?.trim())) || [],
    [selectedTicketClient]
  );

  const formatContactOption = (contact: ContactPerson) =>
    `${contact.name}${contact.designation ? ` (${contact.designation})` : ""}`;

  const selectConcernedPerson = (contact: ContactPerson) => {
    setNewConcernedPersonId(contact.id);
    setNewConcernedPerson(formatContactOption(contact));
    setNewContactPhone(contact.phone || contact.whatsapp || selectedTicketClient?.phone || "");
  };

  const handleAddConcernedPerson = () => {
    if (!selectedTicketClient) {
      toast.error("Please select an organisation first");
      return;
    }

    setNewContactName("");
    setNewContactRole("");
    setNewContactEmail("");
    setNewContactPhoneInput(newContactPhone || selectedTicketClient.phone || "");
    setShowAddContactPanel(true);
  };

  const handleSaveConcernedPerson = () => {
    if (!selectedTicketClient) {
      toast.error("Please select an organisation first");
      return;
    }

    const name = newContactName.trim();
    if (!name) {
      toast.error("Please enter contact person name");
      return;
    }

    const newPerson = addStandalonePerson({
      clientId: selectedTicketClient.id,
      clientName: selectedTicketClient.name,
      name,
      designation: newContactRole.trim() || "Contact Person",
      department: "Biomedical Engineering",
      phone: newContactPhoneInput.trim(),
      whatsapp: newContactPhoneInput.trim(),
      email: newContactEmail.trim(),
      status: "Active at Organisation",
    });

    setClients(getStoredClients());
    selectConcernedPerson(newPerson);
    setShowAddContactPanel(false);
    toast.success(`Added ${newPerson.name} to ${selectedTicketClient.name}`);
  };

  const getAssignedPersonLabel = (name: string) => {
    const employee = emsEmployees.find((emp) => emp.name.toLowerCase() === name.toLowerCase());
    if (employee?.role) return `${name} (${employee.role})`;

    return name;
  };

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status filter
      if (selectedStatus !== "All" && t.status !== selectedStatus) return false;
      // Client filter
      if (selectedClient !== "All") {
        if (t.clientId !== selectedClient && t.clientName !== selectedClient) return false;
      }
      // Engineer filter
      if (selectedEngineer !== "All") {
        if (t.assignedEngineerName.toLowerCase() !== selectedEngineer.toLowerCase()) return false;
      }
      // AMC filter
      if (selectedAmc === "AMC" && !t.amcCovered) return false;
      if (selectedAmc === "Non-AMC" && t.amcCovered) return false;

      return true;
    });
  }, [tickets, selectedStatus, selectedClient, selectedEngineer, selectedAmc]);

  // Calendar Grid Cells Calculation
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
      tickets: ServiceTicket[];
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
        tickets: [],
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

      const dayTickets = filteredTickets.filter((t) => {
        const ticketDate = t.visitDate || t.createdAt?.slice(0, 10);
        return ticketDate === dStr;
      });

      cells.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday,
        tickets: dayTickets,
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
        tickets: [],
      });
    }

    return cells;
  }, [currentYear, currentMonth, filteredTickets]);

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
    setCurrentMonth(8); // Sep 2026
  };

  const openCreateModalForDate = (dateStr: string) => {
    setNewVisitDate(dateStr);
    setNewClientId("");
    setNewClientName("");
    setNewClientSearch("");
    setNewClientPickerOpen(false);
    setNewConcernedPersonId("");
    setNewConcernedPerson("");
    setNewContactPhone("");
    setNewServiceType("");
    setShowAddServiceType(false);
    setNewServiceTypeName("");
    setNewEquipment("");
    setNewModel("");
    setNewSerial("");
    setNewComplaint("");
    setNewPriority("Medium");
    setNewStatus("Visit Scheduled");
    setNewEngineer("");
    setNewAmcCovered(false);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedClient =
      organisationClients.find((c) => c.id === newClientId) ||
      organisationClients.find((c) => c.name.toLowerCase() === newClientName.toLowerCase() || c.name.toLowerCase() === newClientSearch.toLowerCase());

    if (!matchedClient) {
      toast.error("Please select an organisation from CRM");
      return;
    }

    if (!newEquipment) {
      toast.error("Please specify equipment details");
      return;
    }

    if (!newServiceType) {
      toast.error("Please select type of service");
      return;
    }

    if (!newConcernedPerson) {
      toast.error("Please select or add concerned person");
      return;
    }

    if (!newEngineer) {
      toast.error("Please select assigned person");
      return;
    }

    const newTicket: ServiceTicket = {
      id: `st-${Date.now()}`,
      ticketNumber: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: matchedClient.id,
      clientName: matchedClient.name,
      concernedPerson: newConcernedPerson.trim(),
      contactPhone: newContactPhone.trim(),
      serviceType: newServiceType,
      equipment: newEquipment,
      model: newModel,
      serialNumber: newSerial,
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
    toast.success(`Ticket ${newTicket.ticketNumber} scheduled for ${newVisitDate}!`);
  };

  const handleUpdateStatus = (ticketId: string, status: ServiceStatus) => {
    updateStoredServiceTicketStatus(ticketId, status);
    setTickets(getStoredServiceTickets());
    toast.success(`Status updated to ${status}`);
  };

  const handleDeleteTicket = (ticketId: string) => {
    deleteStoredServiceTicket(ticketId);
    setTickets(getStoredServiceTickets());
    setEditingTicket(null);
    toast.success("Service ticket deleted");
  };

  const handleSelectTicket = (ticket: ServiceTicket) => {
    if (onSelectTicket) {
      onSelectTicket(ticket);
      return;
    }
    setEditingTicket(ticket);
  };

  const handleSaveTicket = () => {
    if (!editingTicket) return;
    updateStoredServiceTicket(editingTicket);
    setTickets(getStoredServiceTickets());
    setEditingTicket(null);
    toast.success("Service ticket updated");
  };

  return (
    <div className={`service-mobile-calendar ${mobileFiltersOpen ? "service-filters-open" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ─── 1. TOP CONTROLS TOOLBAR (MATCHING SCREENSHOT 3) ─── */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          borderRadius: 14,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <button type="button" className="service-mobile-filter-toggle" aria-expanded={mobileFiltersOpen} onClick={() => setMobileFiltersOpen(value => !value)}>{mobileFiltersOpen ? "Close filters" : "Filters"}</button>
        {/* Left: Month Navigator & Today Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "3px 8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 6,
                color: "#64748b",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Month Dropdown */}
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              style={{
                border: "none",
                background: "transparent",
                fontWeight: 700,
                fontSize: 14,
                color: "#0f172a",
                cursor: "pointer",
                outline: "none",
                padding: "4px 6px",
              }}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              style={{
                border: "none",
                background: "transparent",
                fontWeight: 700,
                fontSize: 14,
                color: "#0f172a",
                cursor: "pointer",
                outline: "none",
                padding: "4px 6px",
              }}
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 6,
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
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <CalendarIcon size={14} color="#64748b" />
            <span>Today</span>
          </button>
        </div>

        {/* Right: Client, Engineer, AMC, & Create Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Client Filter */}
          <Popover.Root open={clientMenuOpen} onOpenChange={setClientMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  backgroundColor: selectedClient !== "All" ? "#eff6ff" : "#ffffff",
                  color: selectedClient !== "All" ? "#1d4ed8" : "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  maxWidth: 200,
                }}
              >
                <Building2 size={14} color={selectedClient !== "All" ? "#2563eb" : "#64748b"} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedClient === "All" ? `All Clients (${clients.length || 175})` : selectedClient}
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  padding: 10,
                  width: 280,
                  zIndex: 100,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", backgroundColor: "#f8fafc", borderRadius: 8, marginBottom: 8, border: "1px solid #e2e8f0" }}>
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search hospitals..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, width: "100%" }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedClient("All"); setClientMenuOpen(false); }}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      backgroundColor: selectedClient === "All" ? "#f1f5f9" : "transparent",
                      fontSize: 12.5,
                      fontWeight: selectedClient === "All" ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    All Clients ({clients.length || 175})
                  </button>
                  {clients
                    .filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .slice(0, 30)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedClient(c.name); setClientMenuOpen(false); }}
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "none",
                          backgroundColor: selectedClient === c.name ? "#eff6ff" : "transparent",
                          color: selectedClient === c.name ? "#1d4ed8" : "#1e293b",
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Engineer Filter */}
          <select
            value={selectedEngineer}
            onChange={(e) => setSelectedEngineer(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="All">All Assigned Staff</option>
            {engineers.map((eng) => (
              <option key={eng} value={eng}>
                👤 {getAssignedPersonLabel(eng)}
              </option>
            ))}
          </select>

          {/* AMC Coverage Filter */}
          <select
            value={selectedAmc}
            onChange={(e) => setSelectedAmc(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="All">All Coverage</option>
            <option value="AMC">AMC Covered Only</option>
            <option value="Non-AMC">Non-AMC Only</option>
          </select>

          {/* Create Ticket Button */}
          <button
            type="button"
            onClick={() => openCreateModalForDate("2026-09-06")}
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            <span>+ Create Ticket</span>
          </button>
        </div>
      </div>

      {/* ─── 2. STATUS FILTER PILLS STRIP (MATCHING SCREENSHOT 2/3) ─── */}
      <div
        className="card"
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          borderRadius: 12,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginRight: 4,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          FILTER BY STATUS:
        </span>

        {/* All Statuses Button */}
        <button
          type="button"
          onClick={() => setSelectedStatus("All")}
          style={{
            height: 30,
            padding: "0 12px",
            borderRadius: 20,
            border: selectedStatus === "All" ? "1px solid #004d66" : "1px solid #e2e8f0",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            backgroundColor: selectedStatus === "All" ? "#004d66" : "#f8fafc",
            color: selectedStatus === "All" ? "#ffffff" : "#475569",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: selectedStatus === "All" ? "0 2px 5px rgba(0,77,102,0.25)" : "none",
          }}
        >
          <span>All Statuses</span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 10,
              backgroundColor: selectedStatus === "All" ? "rgba(255,255,255,0.22)" : "#e2e8f0",
              color: selectedStatus === "All" ? "#ffffff" : "#64748b",
            }}
          >
            {tickets.length}
          </span>
        </button>

        {/* Status Pills */}
        {SERVICE_STATUSES.map((status) => {
          const cfg = SERVICE_STATUS_CONFIG[status];
          if (!cfg) return null;
          const isActive = selectedStatus === status;
          const count = tickets.filter((t) => t.status === status).length;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(isActive ? "All" : status)}
              style={{
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 12px",
                borderRadius: 20,
                border: isActive ? `1px solid ${cfg.badgeBg}` : "1px solid #e2e8f0",
                backgroundColor: isActive ? cfg.badgeBg : "#ffffff",
                color: isActive ? "#ffffff" : "#334155",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isActive ? `0 2px 6px ${cfg.badgeBg}40` : "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: isActive ? "#ffffff" : cfg.badgeBg,
                  flexShrink: 0,
                }}
              />
              <span>{status}</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 10,
                  backgroundColor: isActive
                    ? "rgba(255,255,255,0.22)"
                    : count > 0
                    ? `${cfg.badgeBg}18`
                    : "#f1f5f9",
                  color: isActive ? "#ffffff" : count > 0 ? cfg.text : "#94a3b8",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── 3. SEVEN-COLUMN CALENDAR GRID ─── */}
      <div
        className="card"
        style={{
          padding: 14,
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 780, width: "100%" }}>
            {/* Weekdays Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 8,
                marginBottom: 8,
                padding: "6px 4px",
              }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                <div
                  key={dayName}
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {calendarCells.map((cell, idx) => {
                const isCurrentMonth = cell.isCurrentMonth;
                const isToday = cell.isToday;
                const cellTickets = cell.tickets;
                const maxVisible = 3;
                const visibleTickets = cellTickets.slice(0, maxVisible);
                const remainingCount = cellTickets.length - maxVisible;

                return (
                  <div
                    className={`service-date-cell ${isCurrentMonth ? "current-month" : "outside-month"} ${isToday ? "today" : ""}`}
                    role={isCurrentMonth ? "button" : undefined}
                    tabIndex={isCurrentMonth ? 0 : undefined}
                    aria-label={`${cell.dateStr}: ${cellTickets.length} service tickets`}
                    onKeyDown={(event) => { if (isCurrentMonth && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedDayPopup({ dateStr: cell.dateStr, dayNum: cell.dayNum }); } }}
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => {
                      if (isCurrentMonth) {
                        setSelectedDayPopup({ dateStr: cell.dateStr, dayNum: cell.dayNum });
                      }
                    }}
                    style={{
                      minHeight: 155,
                      borderRadius: 12,
                      border: isToday
                        ? "2px solid #6366f1"
                        : isCurrentMonth
                        ? "1px solid #e2e8f0"
                        : "1px dashed #f1f5f9",
                      backgroundColor: isToday
                        ? "#faf5ff"
                        : isCurrentMonth
                        ? "#ffffff"
                        : "#fbfcfd",
                      padding: "8px 6px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                      position: "relative",
                      boxShadow: isToday ? "0 0 0 1px #818cf8, 0 4px 12px rgba(99,102,241,0.08)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (isCurrentMonth && !isToday) {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.backgroundColor = "#fafafa";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isCurrentMonth && !isToday) {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }
                    }}
                  >
                    {cellTickets.length > 0 && <span className="service-date-marker" aria-hidden="true">{cellTickets.length}</span>}
                    {/* Top Row: Day Number & + Button */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        padding: "0 2px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isToday ? 800 : 700,
                            color: isToday ? "#4f46e5" : isCurrentMonth ? "#0f172a" : "#cbd5e1",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isToday ? "#e0e7ff" : "transparent",
                          }}
                        >
                          {cell.dayNum}
                        </span>

                        {/* Ticket count pill */}
                        {cellTickets.length > 0 && isCurrentMonth && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#4f46e5",
                              backgroundColor: "#eef2ff",
                              border: "1px solid #e0e7ff",
                              borderRadius: 10,
                              padding: "1px 6px",
                            }}
                          >
                            {cellTickets.length}
                          </span>
                        )}
                      </div>

                      {/* Quick + Add Button */}
                      {isCurrentMonth && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateModalForDate(cell.dateStr);
                          }}
                          title={`Schedule ticket for ${cell.dateStr}`}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 2,
                            color: "#94a3b8",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#4f46e5")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Ticket Cards List */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {visibleTickets.map((ticket) => {
                        const cfg = SERVICE_STATUS_CONFIG[ticket.status] || SERVICE_STATUS_CONFIG["Assigned"];

                        return (
                          <div
                            key={ticket.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTicket(ticket);
                            }}
                            title={`${ticket.ticketNumber}: ${ticket.clientName} - ${ticket.equipment} (${ticket.status})`}
                            style={{
                              backgroundColor: cfg.cardBg,
                              border: `1px solid ${cfg.border}`,
                              borderLeft: `3px solid ${cfg.cardBorder}`,
                              borderRadius: 6,
                              padding: "4px 6px",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              minWidth: 0,
                              overflow: "hidden",
                              transition: "transform 0.1s ease, box-shadow 0.1s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-1px)";
                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "none";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            {/* Line 1: Facility name & Status pill */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 4,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  textTransform: "uppercase",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                }}
                              >
                                {getFirstWords(ticket.clientName, 3)}
                              </span>

                              <span
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: 800,
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  backgroundColor: cfg.badgeBg,
                                  color: "#ffffff",
                                  flexShrink: 0,
                                }}
                              >
                                {cfg.pillShort}
                              </span>
                            </div>

                            {/* Line 2: Equipment & Service Type */}
                            <div
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: "#334155",
                                lineHeight: 1.25,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getFirstWords(`${ticket.equipment} - ${ticket.serviceType || ticket.complaint}`, 5)}
                            </div>

                            {/* Line 3: Engineer & AMC */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 4,
                                fontSize: 9.5,
                                color: "#64748b",
                                marginTop: 1,
                              }}
                            >
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <span style={{ fontSize: 9 }}>👤</span>
                                <span>{ticket.assignedEngineerName.split(" ")[0]}</span>
                              </span>

                              <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                                {ticket.amcCovered && (
                                  <span
                                    style={{
                                      fontSize: 8.5,
                                      fontWeight: 700,
                                      color: "#059669",
                                      backgroundColor: "#ecfdf5",
                                      padding: "0 3px",
                                      borderRadius: 3,
                                    }}
                                  >
                                    AMC ✓
                                  </span>
                                )}
                                <div
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    backgroundColor: PRIORITY_COLORS[ticket.priority] || "#94a3b8",
                                  }}
                                  title={ticket.priority}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom: +X More Works Button (opens DayDetailPopup) */}
                    {remainingCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayPopup({ dateStr: cell.dateStr, dayNum: cell.dayNum });
                        }}
                        style={{
                          marginTop: 4,
                          width: "100%",
                          padding: "3px 6px",
                          borderRadius: 6,
                          border: "1px solid #e0e7ff",
                          backgroundColor: "#f5f3ff",
                          color: "#6d28d9",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ede9fe")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f5f3ff")}
                      >
                        +{remainingCount} more works
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. DAY DETAIL POPUP (MATCHING SCREENSHOT 2) ─── */}
      {selectedDayPopup && (
        <div className="service-day-overlay" data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 220,
            padding: 16,
          }}
          onClick={() => setSelectedDayPopup(null)}
        >
          <div className="service-day-dialog"
            style={{
              width: "min(580px, 95vw)",
              maxHeight: "85vh",
              backgroundColor: "#ffffff",
              borderRadius: 18,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Gradient Banner */}
            {(() => {
              const [y, m, d] = selectedDayPopup.dateStr.split("-");
              const dObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
              const dayTickets = tickets.filter((t) => (t.visitDate || t.createdAt?.slice(0, 10)) === selectedDayPopup.dateStr);

              return (
                <>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #7c3aed 100%)",
                      padding: "20px 24px",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* Date Block */}
                      <div
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.18)",
                          backdropFilter: "blur(6px)",
                          borderRadius: 12,
                          padding: "6px 14px",
                          textAlign: "center",
                          border: "1px solid rgba(255, 255, 255, 0.25)",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.9 }}>
                          {MONTH_NAMES_SHORT[parseInt(m, 10) - 1]}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{d}</div>
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                            {WEEKDAY_NAMES[dObj.getDay()]}
                          </h3>
                          <span
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.2)",
                              borderRadius: 20,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {MONTH_NAMES[parseInt(m, 10) - 1]} {y}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
                          {dayTickets.length} service {dayTickets.length === 1 ? "ticket" : "tickets"} scheduled
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedDayPopup(null)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Status Counters Strip */}
                  <div
                    style={{
                      padding: "10px 24px",
                      backgroundColor: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      overflowX: "auto",
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    {SERVICE_STATUSES.slice(0, 5).filter(st => dayTickets.some(ticket => ticket.status === st)).map((st) => {
                      const count = dayTickets.filter((t) => t.status === st).length;
                      const cfg = SERVICE_STATUS_CONFIG[st];
                      return (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 5, color: "#475569" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.badgeBg }} />
                          <span>{st}:</span>
                          <span style={{ color: "#0f172a" }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tickets List */}
                  <div style={{ padding: "16px 24px", overflowY: "auto", maxHeight: "45vh", display: "flex", flexDirection: "column", gap: 10 }}>
                    {dayTickets.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                        No service tickets scheduled on this day.
                      </div>
                    ) : (
                      dayTickets.map((ticket) => {
                        const cfg = SERVICE_STATUS_CONFIG[ticket.status] || SERVICE_STATUS_CONFIG["Assigned"];

                        return (
                          <div
                            key={ticket.id}
                            onClick={() => {
                              setSelectedDayPopup(null);
                              handleSelectTicket(ticket);
                            }}
                            style={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderLeft: `4px solid ${cfg.cardBorder}`,
                              borderRadius: 10,
                              padding: "12px 14px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b", fontWeight: 700 }}>
                                    {ticket.ticketNumber}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                    {ticket.clientName}
                                  </span>
                                  {ticket.amcCovered && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#ecfdf5", padding: "1px 6px", borderRadius: 4 }}>
                                      AMC Covered
                                    </span>
                                  )}
                                  {ticket.serviceType && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "1px 6px", borderRadius: 4 }}>
                                      {ticket.serviceType}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                                  {ticket.equipment} ({ticket.model})
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                                  {ticket.complaint}
                                </div>
                              </div>

                              {/* Priority Badge */}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: PRIORITY_COLORS[ticket.priority],
                                  backgroundColor: "#fff",
                                  border: `1px solid ${PRIORITY_COLORS[ticket.priority]}40`,
                                  borderRadius: 6,
                                  padding: "2px 7px",
                                  flexShrink: 0,
                                }}
                              >
                                ● {ticket.priority.toUpperCase()}
                              </span>
                            </div>

                            {/* Footer inside ticket item */}
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: "#475569" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span>👤</span>
                                  <span>Engineer: <strong>{ticket.assignedEngineerName}</strong></span>
                                </div>
                                {ticket.concernedPerson && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#0369a1" }}>
                                    <span>🏥</span>
                                    <span>Concerned: <strong>{ticket.concernedPerson}</strong></span>
                                    {ticket.contactPhone && <span style={{ color: "#64748b" }}>({ticket.contactPhone})</span>}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {/* Quick Status Dropdown */}
                                <select
                                  value={ticket.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateStatus(ticket.id, e.target.value as ServiceStatus)}
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    border: `1px solid ${cfg.border}`,
                                    backgroundColor: cfg.bg,
                                    color: cfg.text,
                                    cursor: "pointer",
                                  }}
                                >
                                  {SERVICE_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>

                                {/* View Details Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDayPopup(null);
                                    handleSelectTicket(ticket);
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid #e2e8f0",
                                    backgroundColor: "#ffffff",
                                    color: "#334155",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  View
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTicket(ticket.id);
                                  }}
                                  style={{
                                    padding: 4,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    color: "#94a3b8",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Action: Create Ticket for this day */}
                  <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDayPopup(null);
                        openCreateModalForDate(selectedDayPopup.dateStr);
                      }}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: 13,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Plus size={16} />
                      <span>Schedule ticket</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── 5. CREATE TICKET MODAL ─── */}
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
            zIndex: 250,
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
                  Schedule Service Ticket
                </h2>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Add a clinical repair, maintenance, or calibration ticket to the calendar
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
              <div style={{ position: "relative" }}>
                <label className="form-label">Client / Healthcare Institution</label>
                <div
                  style={{
                    position: "relative",
                    border: `1px solid ${newClientPickerOpen ? "#5eead4" : "#dbe3ef"}`,
                    borderRadius: 10,
                    background: "#ffffff",
                    boxShadow: newClientPickerOpen ? "0 0 0 4px rgba(45, 212, 191, 0.15)" : "none",
                  }}
                >
                  <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    className="form-input"
                    value={newClientSearch}
                    onFocus={() => setNewClientPickerOpen(true)}
                    onChange={(e) => {
                      setNewClientSearch(e.target.value);
                      setNewClientPickerOpen(true);
                      setNewClientId("");
                      setNewClientName("");
                      setNewConcernedPersonId("");
                      setNewConcernedPerson("");
                      setNewContactPhone("");
                    }}
                    placeholder="Search registered organisation from CRM..."
                    style={{
                      border: "none",
                      boxShadow: "none",
                      paddingLeft: 38,
                      paddingRight: 36,
                      height: 42,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewClientPickerOpen((open) => !open)}
                    aria-label="Show CRM organisations"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#475569",
                      fontSize: 14,
                      width: 26,
                      height: 26,
                    }}
                  >
                    ▾
                  </button>
                </div>

                {newClientPickerOpen && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 320,
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      maxHeight: 260,
                      overflowY: "auto",
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      background: "#ffffff",
                      boxShadow: "0 16px 36px rgba(15, 23, 42, 0.18)",
                    }}
                  >
                    {filteredOrganisationClients.length > 0 ? (
                      filteredOrganisationClients.slice(0, 80).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setNewClientId(client.id);
                            setNewClientName(client.name);
                            setNewClientSearch(client.name);
                            setNewClientPickerOpen(false);
                            setNewConcernedPersonId("");
                            setNewConcernedPerson("");
                            setNewContactPhone(client.phone || "");
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            borderBottom: "1px solid #eef2f7",
                            background: newClientId === client.id ? "#f0fdfa" : "#ffffff",
                            padding: "10px 12px",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <Building2 size={16} color="#64748b" />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {client.name}
                            </span>
                            <span style={{ display: "block", fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                              {[client.city || client.state, client.orgType].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: 14, color: "#64748b", fontSize: 13, textAlign: "center" }}>
                        No CRM organisation found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Concerned Person & Contact Phone */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                <div>
                  <label className="form-label">Concerned Person / In-Charge</label>
                  <select
                    className="form-input"
                    value={newConcernedPersonId}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        handleAddConcernedPerson();
                        return;
                      }
                      const contact = selectedClientContacts.find((item) => item.id === e.target.value);
                      if (contact) {
                        selectConcernedPerson(contact);
                      } else {
                        setNewConcernedPersonId("");
                        setNewConcernedPerson("");
                        setNewContactPhone(selectedTicketClient?.phone || "");
                      }
                    }}
                    disabled={!selectedTicketClient}
                  >
                    <option value="">
                      {selectedTicketClient ? "Select contact person" : "Select organisation first"}
                    </option>
                    {selectedClientContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {formatContactOption(contact)}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add new contact person</option>
                  </select>
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

              {showAddContactPanel && selectedTicketClient && (
                <div
                  style={{
                    border: "1px solid #bae6fd",
                    background: "#f0f9ff",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: "#075985" }}>Add Contact Person</div>
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{selectedTicketClient.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddContactPanel(false)}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        borderRadius: 8,
                        width: 30,
                        height: 30,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label="Close add contact form"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="form-label">Name</label>
                      <input
                        className="form-input"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="form-label">Role / Title</label>
                      <input
                        className="form-input"
                        value={newContactRole}
                        onChange={(e) => setNewContactRole(e.target.value)}
                        placeholder="Biomedical Head"
                      />
                    </div>
                    <div>
                      <label className="form-label">Phone / WhatsApp</label>
                      <input
                        className="form-input"
                        value={newContactPhoneInput}
                        onChange={(e) => setNewContactPhoneInput(e.target.value)}
                        placeholder="+971 50 123 4567"
                      />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        className="form-input"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        placeholder="name@organisation.com"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddContactPanel(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSaveConcernedPerson}>
                      Add & Select
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Type of Service</label>
                <select
                  className="form-input"
                  required
                  value={newServiceType}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setShowAddServiceType(true);
                      setNewServiceTypeName("");
                      return;
                    }
                    setNewServiceType(e.target.value);
                  }}
                >
                  <option value="" disabled>Select type of service</option>
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add service type...</option>
                </select>
                {showAddServiceType && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      className="form-input"
                      value={newServiceTypeName}
                      onChange={(e) => setNewServiceTypeName(e.target.value)}
                      placeholder="New service type"
                      style={{ height: 40 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const name = newServiceTypeName.trim();
                        if (!name) {
                          toast.error("Please enter service type");
                          return;
                        }
                        const updated = addStoredServiceType(name);
                        setServiceTypes(updated);
                        setNewServiceType(name);
                        setShowAddServiceType(false);
                        setNewServiceTypeName("");
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowAddServiceType(false);
                        setNewServiceTypeName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
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
                <label className="form-label">Complaint / Service Scope</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  placeholder="Describe technical issue, required calibration, or maintenance request..."
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
                    <option value="" disabled>
                      Select assigned person
                    </option>
                    {engineers.map((eng) => (
                      <option key={eng} value={eng}>
                        {getAssignedPersonLabel(eng)}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add Person...</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Visit Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Initial Status & AMC Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    id="amc-chk"
                    checked={newAmcCovered}
                    onChange={(e) => setNewAmcCovered(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label htmlFor="amc-chk" style={{ fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    Covered under active AMC Contract
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>Status:</label>
                  <select
                    className="form-input"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ServiceStatus)}
                    style={{ width: 150 }}
                  >
                    {SERVICE_STATUSES.map((st) => (
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
                  Save & Schedule Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. SERVICE TICKET DETAIL MODAL ─── */}
      {editingTicket && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 260,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setEditingTicket(null)}
        >
          <div
            className="card"
            style={{
              width: "min(820px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: 26,
              boxShadow: "0 25px 60px rgba(15, 23, 42, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#0f172a" }}>Service Ticket Details</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                  {editingTicket.ticketNumber} • {editingTicket.clientName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "none",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Client</label>
                <input
                  className="form-input"
                  value={editingTicket.clientName}
                  onChange={(e) => setEditingTicket({ ...editingTicket, clientName: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Concerned Person</label>
                <input
                  className="form-input"
                  placeholder="e.g. Dr. Mansoor / In-Charge"
                  value={editingTicket.concernedPerson || ""}
                  onChange={(e) => setEditingTicket({ ...editingTicket, concernedPerson: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Contact Phone / Ext.</label>
                <input
                  className="form-input"
                  placeholder="e.g. +971 50 123 4567"
                  value={editingTicket.contactPhone || ""}
                  onChange={(e) => setEditingTicket({ ...editingTicket, contactPhone: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Type of Service</label>
                <select
                  className="form-input"
                  value={editingTicket.serviceType || ""}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setShowAddServiceType(true);
                      setNewServiceTypeName("");
                      return;
                    }
                    setEditingTicket({ ...editingTicket, serviceType: e.target.value });
                  }}
                >
                  <option value="">Select type of service</option>
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add service type...</option>
                </select>
                {showAddServiceType && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      className="form-input"
                      value={newServiceTypeName}
                      onChange={(e) => setNewServiceTypeName(e.target.value)}
                      placeholder="New service type"
                      style={{ height: 40 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const name = newServiceTypeName.trim();
                        if (!name) {
                          toast.error("Please enter service type");
                          return;
                        }
                        const updated = addStoredServiceType(name);
                        setServiceTypes(updated);
                        setEditingTicket({ ...editingTicket, serviceType: name });
                        setShowAddServiceType(false);
                        setNewServiceTypeName("");
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowAddServiceType(false);
                        setNewServiceTypeName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Equipment</label>
                <input
                  className="form-input"
                  value={editingTicket.equipment}
                  onChange={(e) => setEditingTicket({ ...editingTicket, equipment: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Model</label>
                <input
                  className="form-input"
                  value={editingTicket.model}
                  onChange={(e) => setEditingTicket({ ...editingTicket, model: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Serial Number</label>
                <input
                  className="form-input"
                  value={editingTicket.serialNumber}
                  onChange={(e) => setEditingTicket({ ...editingTicket, serialNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Visit Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editingTicket.visitDate || ""}
                  onChange={(e) => setEditingTicket({ ...editingTicket, visitDate: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={editingTicket.status}
                  onChange={(e) => setEditingTicket({ ...editingTicket, status: e.target.value as ServiceStatus })}
                >
                  {SERVICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Priority</label>
                <select
                  className="form-input"
                  value={editingTicket.priority}
                  onChange={(e) => setEditingTicket({ ...editingTicket, priority: e.target.value as ServiceTicket["priority"] })}
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
                  value={editingTicket.assignedEngineerName}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      const name = window.prompt("Enter name:");
                      if (name && name.trim()) {
                        const updated = addStoredEngineer(name.trim());
                        setCustomEngineers(updated);
                        setEditingTicket({
                          ...editingTicket,
                          assignedEngineerName: name.trim(),
                          assignedEngineerId: `emp-${name.trim().toLowerCase().replace(/\s+/g, "")}`,
                        });
                      }
                    } else {
                      setEditingTicket({
                        ...editingTicket,
                        assignedEngineerName: e.target.value,
                        assignedEngineerId: `emp-${e.target.value.toLowerCase().replace(/\s+/g, "")}`,
                      });
                    }
                  }}
                >
                  {engineers.map((engineer) => (
                    <option key={engineer} value={engineer}>
                      {getAssignedPersonLabel(engineer)}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add Person...</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 25 }}>
                <input
                  id="edit-amc-covered"
                  type="checkbox"
                  checked={editingTicket.amcCovered}
                  onChange={(e) => setEditingTicket({ ...editingTicket, amcCovered: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="edit-amc-covered" style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Covered under active AMC Contract
                </label>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Complaint / Service Scope</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={editingTicket.complaint}
                  onChange={(e) => setEditingTicket({ ...editingTicket, complaint: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Engineer Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={editingTicket.engineerNotes || ""}
                  onChange={(e) => setEditingTicket({ ...editingTicket, engineerNotes: e.target.value })}
                  placeholder="Add diagnosis, parts required, completion notes..."
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => handleDeleteTicket(editingTicket.id)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  padding: "9px 15px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Delete Ticket
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTicket(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveTicket}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
