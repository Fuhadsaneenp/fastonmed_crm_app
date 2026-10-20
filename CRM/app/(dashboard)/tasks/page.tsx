"use client";
import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { mockEmployees } from "@/lib/mock-data";
import { apiRequest } from "@/lib/api-client";
import { getStoredTasks, saveStoredTasks, clearDummyTasks, syncLiveTasksFromApi, addStoredTask, updateStoredTask, deleteStoredTask, canUserEditTask } from "@/lib/task-store";
import { syncStoredServiceTicketsToTasks } from "@/lib/service-store";
import { getStoredClients, addClientFromLead, saveStoredClients } from "@/lib/client-store";
import { getStatusColor } from "@/lib/utils";
import type { Task, TaskType, Client, OrgType, ClientStatus } from "@/types";
import toast from "react-hot-toast";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  User,
  UserCheck,
  Users,
  Search,
  Check,
  RotateCcw,
  Play,
  Briefcase,
  Layers,
  Building2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  X,
  CalendarDays,
  Eye,
  AlertCircle,
  Filter,
  Lock,
  Pencil,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import CustomLightSelect from "@/components/CustomLightSelect";
import OrganisationAvatar from "@/components/OrganisationAvatar";
import ClientModal from "@/components/ClientModal";

const DEFAULT_TASK_TYPES: string[] = [
  "Call",
  "Site Visit",
  "Demo",
  "Installation",
  "Service Visit",
  "Meeting",
  "Follow-up",
  "Documentation",
];

const TYPE_EMOJIS: Record<string, string> = {
  Call: "📞",
  "Site Visit": "🏢",
  Demo: "💻",
  Installation: "🔩",
  "Service Visit": "🔧",
  Meeting: "👥",
  "Follow-up": "📋",
  Documentation: "📄",
  Maintenance: "🛠️",
  Quotation: "📝",
  Delivery: "🚚",
  Audit: "🔍",
  Training: "🎓",
  Inspection: "🔎",
  Survey: "📊",
  Support: "🛟",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#f97316",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
          Loading tasks workspace...
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}

function TasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberParam = searchParams.get("member") || "my";
  const archiveSection = searchParams.get("section");
  const [archivePeriod, setArchivePeriod] = useState("all");
  const [archiveDate, setArchiveDate] = useState(() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`; });
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [declineTask, setDeclineTask] = useState<Task | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archivePriorityFilter, setArchivePriorityFilter] = useState<string>("All");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [mobileTaskFiltersOpen, setMobileTaskFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);

  // When in My Team Tasks (all scope), view directory list (matching screenshot) or board
  const [teamViewMode, setTeamViewMode] = useState<"directory" | "board">("directory");

  // Active Logged-in User
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
    id?: string;
  }>({
    name: "Fuhad",
    email: "fuhad@fastonmed.com",
    role: "Super Admin",
    id: "emp-fuhad",
  });

  const [employeeList, setEmployeeList] = useState<{
    id: string;
    name: string;
    role: string;
    email?: string;
  }[]>(mockEmployees);

  const [employeeLoadError, setEmployeeLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTeam = async () => {
      try {
        const employees = await apiRequest<{ id: string; name: string; role: string; email?: string; status?: string }[]>("/api/employees");
        if (!active) return;
        const members = new Map<string, { id: string; name: string; role: string; email?: string }>();
        for (const employee of employees) {
          const name = employee.name?.trim();
          if (!name || !employee.id || employee.status?.toUpperCase() === "TERMINATED") continue;
          members.set(name.toLowerCase(), { ...employee, name, role: employee.role || "Team Member" });
        }
        setEmployeeList(Array.from(members.values()));
        setEmployeeLoadError(false);
      } catch {
        if (active) setEmployeeLoadError(true);
      }
    };
    void loadTeam();
    window.addEventListener("focus", loadTeam);
    return () => {
      active = false;
      window.removeEventListener("focus", loadTeam);
    };
  }, []);

  const isMyScope = memberParam.toLowerCase() === "my";
  const isAllScope = memberParam.toLowerCase() === "all" || memberParam.toLowerCase() === "team";
  const selectedEmployee =
    !isMyScope && !isAllScope
      ? employeeList.find(
          (e) => e.name.toLowerCase() === decodeURIComponent(memberParam).toLowerCase()
        ) || {
          name: decodeURIComponent(memberParam),
          role: "Team Member",
          id: `emp-${decodeURIComponent(memberParam).toLowerCase()}`,
        }
      : null;

  // Form State for Adding Task
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<TaskType>("Follow-up");
  const [taskTypes, setTaskTypes] = useState<string[]>(DEFAULT_TASK_TYPES);
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [editingTypeKey, setEditingTypeKey] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("10:00");
  const [newPriority, setNewPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [newClientName, setNewClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [newNotes, setNewNotes] = useState("");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);

  // Edit Task State for Task Detail Dialog
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<TaskType>("Follow-up");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDueTime, setEditDueTime] = useState("10:00");
  const [editPriority, setEditPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [mobileTaskStatus, setMobileTaskStatus] = useState("Pending");
  const [editStatus, setEditStatus] = useState<Task["status"]>("Pending");
  const [editClientId, setEditClientId] = useState<string | undefined>(undefined);
  const [editClientName, setEditClientName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editClientSearchOpen, setEditClientSearchOpen] = useState(false);
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const editClientDropdownRef = useRef<HTMLDivElement>(null);

  // Load user session, stored tasks & clients on mount
  useEffect(() => {
    // 1. Detect logged-in user from localStorage
    const storedUser = localStorage.getItem("fastonmed_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const name = parsed?.name || parsed?.fullName || parsed?.username;
        if (name) {
          setCurrentUser({
            name,
            email: parsed.email || `${name.toLowerCase()}@fastonmed.com`,
            role: parsed.role || parsed.designation || "User",
            id: parsed.id || `emp-${name.toLowerCase().split(" ")[0]}`,
          });
        }
      } catch (err) {
        console.error("Failed to parse user session:", err);
      }
    }

    // 2. Fetch live task types from API (synced across all team members in MySQL CompanySetting)
    const loadTaskTypes = async () => {
      try {
        const res = await fetch("/api/tasks/types");
        const json = await res.json();
        if (json?.success && Array.isArray(json.types) && json.types.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_TASK_TYPES, ...json.types]));
          setTaskTypes(merged);
          try {
            localStorage.setItem("fastonmed_task_types", JSON.stringify(merged));
          } catch {}
          return;
        }
      } catch (err) {
        console.error("Failed to load live task types:", err);
      }
      // Fallback to localStorage
      const storedTypes = localStorage.getItem("fastonmed_task_types");
      if (storedTypes) {
        try {
          const parsed = JSON.parse(storedTypes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTaskTypes(Array.from(new Set([...DEFAULT_TASK_TYPES, ...parsed])));
          }
        } catch {}
      }
    };
    loadTaskTypes();

    // 3. Load clients and tasks from the shared stores.
    clearDummyTasks();
    setClients(getStoredClients());
    syncStoredServiceTicketsToTasks();
    setTasks(getStoredTasks());

    const loadLiveTasks = () => {
      syncLiveTasksFromApi().then((live) => {
        if (Array.isArray(live)) {
          setTasks(live);
        }
      });
    };
    loadLiveTasks();
    const livePoll = setInterval(() => {
      loadLiveTasks();
      loadTaskTypes();
    }, 6000);

    window.addEventListener("focus", loadTaskTypes);

    const handleClientsUpdated = () => {
      setClients(getStoredClients());
    };

    const handleTasksUpdated = () => {
      setTasks(getStoredTasks());
    };

    const handleServicesUpdated = () => {
      syncStoredServiceTicketsToTasks();
      setTasks(getStoredTasks());
    };

    const handleUserUpdated = () => {
      const storedUser = localStorage.getItem("fastonmed_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const name = parsed?.name || parsed?.fullName || parsed?.username;
          if (name) {
            setCurrentUser({
              name,
              email: parsed.email || `${name.toLowerCase()}@fastonmed.com`,
              role: parsed.role || parsed.designation || "User",
              id: parsed.id || `emp-${name.toLowerCase().split(" ")[0]}`,
            });
          }
        } catch {}
      }
      loadLiveTasks();
    };

    window.addEventListener("fastonmed_clients_updated", handleClientsUpdated);
    window.addEventListener("fastonmed_tasks_updated", handleTasksUpdated);
    window.addEventListener("fastonmed_services_updated", handleServicesUpdated);
    window.addEventListener("fastonmed_user_updated", handleUserUpdated);

    return () => {
      clearInterval(livePoll);
      window.removeEventListener("focus", loadTaskTypes);
      window.removeEventListener("fastonmed_clients_updated", handleClientsUpdated);
      window.removeEventListener("fastonmed_tasks_updated", handleTasksUpdated);
      window.removeEventListener("fastonmed_services_updated", handleServicesUpdated);
      window.removeEventListener("fastonmed_user_updated", handleUserUpdated);
    };
  }, []);

  // Close client dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientSearchOpen(false);
      }
      if (editClientDropdownRef.current && !editClientDropdownRef.current.contains(e.target as Node)) {
        setEditClientSearchOpen(false);
      }
    }
    if (clientSearchOpen || editClientSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clientSearchOpen, editClientSearchOpen]);

  const matchingClients = useMemo(() => {
    const q = newClientName.trim().toLowerCase();
    if (!q) {
      return clients.slice(0, 8);
    }
    return clients
      .filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const cityMatch = (c.city || "").toLowerCase().includes(q) || (c.state || "").toLowerCase().includes(q);
        const typeMatch = (c.orgType || "").toLowerCase().includes(q);
        return nameMatch || cityMatch || typeMatch;
      })
      .slice(0, 10);
  }, [clients, newClientName]);

  const hasExactMatch = useMemo(() => {
    const q = newClientName.trim().toLowerCase();
    if (!q) return false;
    return clients.some((c) => c.name.toLowerCase() === q);
  }, [clients, newClientName]);

  const handleSelectClient = (client: Client) => {
    setNewClientName(client.name);
    setSelectedClientId(client.id);
    setClientSearchOpen(false);
    toast.success(`Selected facility: "${client.name}"`);
  };

  const handleSaveClientFromModal = async (
    data: Partial<Client> & { repName?: string; repRole?: string; repPhone?: string; repEmail?: string }
  ) => {
    const newClientId = `c-${Date.now()}`;
    const primaryPhone = data.phones && data.phones.length > 0 ? data.phones[0] : data.phone || "";
    const primaryEmail = data.emails && data.emails.length > 0 ? data.emails[0] : data.email || "";

    const newClient: Client = {
      id: newClientId,
      name: data.name || "New Healthcare Facility",
      photo: data.photo || data.logo,
      logo: data.logo || data.photo,
      orgType: (data.orgType || "Hospital") as OrgType,
      status: (data.status || "Lead") as ClientStatus,
      operationalStatus: data.operationalStatus || "Running",
      state: data.state || "Dubai",
      city: data.city || "Dubai Healthcare City (DHCC)",
      address: data.address || `${data.city || ""}, ${data.state || "Dubai"}`,
      pincode: "00000",
      phone: primaryPhone,
      phones: data.phones?.filter(Boolean) || (primaryPhone ? [primaryPhone] : []),
      email: primaryEmail,
      emails: data.emails?.filter(Boolean) || (primaryEmail ? [primaryEmail] : []),
      gst: data.gst || "",
      vatNumber: data.gst || "",
      source: data.source || "Direct Enquiry",
      connectedAs: data.connectedAs || [],
      assignedTo: (currentUser as any)?.name || "Hashim",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: currentUser.name || "User not recorded",
      createdById: (currentUser as { id?: string }).id,
      totalRevenue: 0,
      contacts:
        data.contacts && data.contacts.length > 0
          ? data.contacts
          : data.repName?.trim()
          ? [
              {
                id: `ct-${Date.now()}`,
                clientId: newClientId,
                name: data.repName.trim(),
                designation: data.repRole?.trim() || "Procurement Lead",
                department: "Purchase",
                phone: data.repPhone?.trim() || primaryPhone,
                whatsapp: data.repPhone?.trim() || primaryPhone,
                email: data.repEmail?.trim() || primaryEmail,
                lastContacted: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                createdBy: currentUser.name || "User not recorded",
                createdById: (currentUser as { id?: string }).id,
              },
            ]
          : [],
      purchases: [],
      requirements: [],
      tags: [data.orgType || "Hospital", data.state || "Dubai"],
      googleMapsUrl:
        data.googleMapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${data.name || ""} ${data.city || ""} ${data.state || "Dubai"} UAE`
        )}`,
      place: data.city || "Dubai Healthcare City (DHCC)",
      emirate: data.state || "Dubai",
      notes: data.notes || "",
    };

    const currentClients = getStoredClients();
    const updated = [newClient, ...currentClients.filter((c) => c.id !== newClientId)];
    saveStoredClients(updated);
    setClients(updated);

    try {
      fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      }).catch(() => {});
    } catch (err) {}

    // Auto-select newly created organisation in Task form & Edit form
    setSelectedClientId(newClientId);
    setNewClientName(newClient.name);
    setEditClientId(newClientId);
    setEditClientName(newClient.name);
    setShowAddClientModal(false);
    toast.success(`Client "${newClient.name}" created and selected!`);
  };

  const handleClearClient = () => {
    setNewClientName("");
    setSelectedClientId(undefined);
    setClientSearchOpen(false);
  };

  const startEditTask = (task: Task) => {
    setEditTitle(task.title);
    setEditType(task.type);
    setEditAssignedTo(task.assignedTo || currentUser.name || "Hashim");
    setEditDueDate(task.dueDate || getTodayIso());
    setEditDueTime(task.dueTime || "10:00");
    setEditPriority((task.priority as any) || "Medium");
    setEditStatus(task.status || "Pending");
    setEditClientId(task.clientId);
    setEditClientName(task.clientName || "");
    setEditNotes(task.notes || "");
    setEditClientSearchOpen(false);
    setIsEditingDetail(true);
  };

  const handleSaveEditedTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!detailTask) return;
    if (!editTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    const assignedEmp = employeeList.find((emp) => emp.name.toLowerCase() === editAssignedTo.toLowerCase());

    const updatedTask: Task = {
      ...detailTask,
      title: editTitle.trim(),
      type: editType,
      assignedTo: editAssignedTo,
      assignedToId: assignedEmp?.id || `emp-${editAssignedTo.toLowerCase().replace(/\s+/g, "")}`,
      dueDate: editDueDate,
      dueTime: editDueTime || undefined,
      priority: editPriority,
      status: editStatus,
      clientId: editClientId || undefined,
      clientName: editClientName.trim() || undefined,
      notes: editNotes.trim() || undefined,
    };

    const updatedList = updateStoredTask(updatedTask);
    setTasks(updatedList);
    setDetailTask(updatedTask);
    setIsEditingDetail(false);
    toast.success("Task updated successfully!");

    try {
      fetch(`/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      }).catch(() => {});
    } catch (err) {}
  };

  const handleAddNewType = async (typeName?: string) => {
    const raw = (typeName !== undefined ? typeName : customTypeInput).trim();
    if (!raw) {
      toast.error("Please enter an option name");
      return;
    }
    const existing = taskTypes.find(
      (t) => t.toLowerCase() === raw.toLowerCase()
    );
    if (existing) {
      setNewType(existing as TaskType);
      setShowAddTypeInput(false);
      setCustomTypeInput("");
      toast.success(`Selected existing option "${existing}"`);
      return;
    }

    const updated = [...taskTypes, raw];
    setTaskTypes(updated);
    try {
      localStorage.setItem("fastonmed_task_types", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setNewType(raw as TaskType);
    setShowAddTypeInput(false);
    setCustomTypeInput("");

    // Sync to MySQL database via API so everyone (Hashim, etc.) sees it immediately
    try {
      const res = await fetch("/api/tasks/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: raw }),
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.types)) {
        setTaskTypes(json.types);
        localStorage.setItem("fastonmed_task_types", JSON.stringify(json.types));
      }
    } catch (err) {
      console.error("Failed to sync new task type to server:", err);
    }

    toast.success(`Option "${raw}" added!`);
  };

  const handleRenameType = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Option name cannot be empty");
      return;
    }
    if (trimmed.toLowerCase() === oldName.toLowerCase()) {
      setEditingTypeKey(null);
      return;
    }
    if (taskTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase() && t.toLowerCase() !== oldName.toLowerCase())) {
      toast.error(`Option "${trimmed}" already exists`);
      return;
    }

    const updated = taskTypes.map((t) => (t === oldName ? trimmed : t));
    setTaskTypes(updated);
    if (newType === oldName) {
      setNewType(trimmed as TaskType);
    }
    try {
      localStorage.setItem("fastonmed_task_types", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Also update any existing tasks in memory and localStorage with the new type
    const updatedTasks = tasks.map((tk) => (tk.type === oldName ? { ...tk, type: trimmed as TaskType } : tk));
    saveTasks(updatedTasks);

    setEditingTypeKey(null);

    // Sync rename to server
    try {
      const res = await fetch("/api/tasks/types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldType: oldName, newType: trimmed }),
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.types)) {
        setTaskTypes(json.types);
        localStorage.setItem("fastonmed_task_types", JSON.stringify(json.types));
      }
    } catch (err) {
      console.error("Failed to sync renamed task type to server:", err);
    }

    toast.success(`Renamed "${oldName}" to "${trimmed}"!`);
  };

  const handleDeleteType = async (typeToDelete: string) => {
    if (taskTypes.length <= 1) {
      toast.error("You must have at least one task type option");
      return;
    }
    if (!confirm(`Are you sure you want to remove "${typeToDelete}" from options?`)) {
      return;
    }

    const updated = taskTypes.filter((t) => t !== typeToDelete);
    setTaskTypes(updated);
    if (newType === typeToDelete) {
      setNewType((updated[0] || "Follow-up") as TaskType);
    }
    try {
      localStorage.setItem("fastonmed_task_types", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    try {
      const res = await fetch(`/api/tasks/types?type=${encodeURIComponent(typeToDelete)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.types)) {
        setTaskTypes(json.types);
        localStorage.setItem("fastonmed_task_types", JSON.stringify(json.types));
      }
    } catch (err) {
      console.error("Failed to delete task type from server:", err);
    }

    toast.success(`Option "${typeToDelete}" removed`);
  };

  // Save tasks helper
  const saveTasks = (newTaskList: Task[]) => {
    setTasks(newTaskList);
    saveStoredTasks(newTaskList);
  };

  // ─── DATE-WISE FILTERING WITH FORWARD ROLLOVER ─────────────────────────
  const getTodayIso = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [dateFilterMode, setDateFilterMode] = useState<"today" | "yesterday" | "tomorrow" | "custom" | "all">("today");
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayIso());

  const formatDisplayDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  };

  const shiftDate = (deltaDays: number) => {
    try {
      const parts = selectedDate.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + deltaDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const newDateStr = `${y}-${m}-${day}`;
      setSelectedDate(newDateStr);
      setDateFilterMode(newDateStr === getTodayIso() ? "today" : "custom");
    } catch (e) {
      console.error(e);
    }
  };

  const handlePresetSelect = (preset: "today" | "yesterday" | "tomorrow" | "all") => {
    setDateFilterMode(preset);
    const today = new Date(getTodayIso());
    if (preset === "today") {
      setSelectedDate(getTodayIso());
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const m = String(y.getMonth() + 1).padStart(2, "0");
      const d = String(y.getDate()).padStart(2, "0");
      setSelectedDate(`${y.getFullYear()}-${m}-${d}`);
    } else if (preset === "tomorrow") {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      const m = String(t.getMonth() + 1).padStart(2, "0");
      const d = String(t.getDate()).padStart(2, "0");
      setSelectedDate(`${t.getFullYear()}-${m}-${d}`);
    }
  };

  // Rollover rule:
  // - Completed tasks ONLY show on the exact day completed.
  // - Pending and In Progress tasks roll forward into subsequent days until completed.
  const isTaskVisibleOnDate = (task: Task, targetDate: string) => {
    if (dateFilterMode === "all") return true;

    if (task.status === "Completed") {
      const compDate =
        task.completedDate ||
        (task.completedAt ? task.completedAt.split("T")[0] : task.dueDate);
      return compDate === targetDate;
    }

    if (task.status === "Pending" || task.status === "In Progress") {
      // Moves forward to targetDate if originally scheduled on or before targetDate!
      return task.dueDate <= targetDate;
    }

    return task.dueDate === targetDate;
  };

  const isTaskRolledForward = (task: Task) => {
    if (dateFilterMode === "all") return false;
    if (task.status !== "Pending" && task.status !== "In Progress") return false;
    return task.dueDate < selectedDate;
  };

  const updateStatus = (taskId: string, status: Task["status"]) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask && !canUserEditTask(targetTask, currentUser)) {
      toast.error(`Permission denied: Only creator (${targetTask.createdBy || "Creator"}) and assignee (${targetTask.assignedTo || "Assignee"}) can edit this task.`);
      return;
    }

    const todayIso = getTodayIso();
    const effectiveDate = dateFilterMode === "all" ? todayIso : selectedDate;

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status,
          ...(status === "Completed"
            ? {
                completedDate: effectiveDate,
                completedAt: new Date().toISOString(),
              }
            : {
                completedDate: undefined,
                completedAt: undefined,
              }),
          ...(status !== "Declined"
            ? {
                declineReason: undefined,
                declinedAt: undefined,
              }
            : {}),
        };
      }
      return t;
    });
    saveTasks(updated);
    const updatedItem = updated.find((t) => t.id === taskId);
    if (updatedItem) {
      updateStoredTask(updatedItem);
    }
    if (status === "Completed") {
      toast.success(`Task marked as Completed on ${effectiveDate}!`);
    } else if (status === "Pending") {
      toast.success("Task restored to Pending!");
    } else {
      toast.success(`Task marked as ${status}!`);
    }
  };

  // ─── DYNAMIC WORKLOAD FILTERING ──────────────────────────────────────────
  const getMemberTaskCount = (name: string) => {
    const target = (name || "").trim().toLowerCase();
    const tFirst = target.split(" ")[0];
    return tasks.filter((t) => {
      const assigned = (t.assignedTo || "").trim().toLowerCase();
      const aFirst = assigned.split(" ")[0];
      const aId = (t.assignedToId || "").trim().toLowerCase();
      const created = (t.createdBy || "").trim().toLowerCase();
      const cFirst = created.split(" ")[0];
      const cId = (t.createdById || "").trim().toLowerCase();

      const isAssigned =
        assigned === target ||
        target.includes(assigned) ||
        assigned.includes(target) ||
        (tFirst && aFirst && tFirst === aFirst) ||
        Boolean(aId && (aId === `emp-${tFirst}` || aId === `u-${tFirst}` || aId.includes(tFirst)));

      const isCreated =
        created === target ||
        target.includes(created) ||
        created.includes(target) ||
        (tFirst && cFirst && tFirst === cFirst) ||
        Boolean(cId && (cId === `emp-${tFirst}` || cId === `u-${tFirst}` || cId.includes(tFirst)));

      return isAssigned || isCreated;
    }).length;
  };

  const myTasksCount = getMemberTaskCount(currentUser.name || "Fuhad");
  const allTasksCount = tasks.length;

  const baseTasks = tasks.filter((t) => {
    if (isAllScope) return true;
    if (isMyScope) {
      const current = (currentUser.name || "Fuhad").trim().toLowerCase();
      const currentId = ((currentUser as any).id || "").trim().toLowerCase();
      const currentEmail = (currentUser.email || "").trim().toLowerCase();
      const cEmailPrefix = currentEmail ? currentEmail.split("@")[0] : "";
      const cFirst = current.split(" ")[0];

      const assigned = (t.assignedTo || "").trim().toLowerCase();
      const assignedId = (t.assignedToId || "").trim().toLowerCase();
      const created = (t.createdBy || "").trim().toLowerCase();
      const createdId = (t.createdById || "").trim().toLowerCase();
      const aFirst = assigned.split(" ")[0];
      const crFirst = created.split(" ")[0];

      const isAssigned =
        assigned === current ||
        current.includes(assigned) ||
        assigned.includes(current) ||
        (cFirst && aFirst && cFirst === aFirst) ||
        (cEmailPrefix && (assigned === cEmailPrefix || assigned.includes(cEmailPrefix))) ||
        Boolean(assignedId && (
          (currentId && (assignedId === currentId || assignedId.includes(currentId))) ||
          (cFirst && (assignedId === `emp-${cFirst}` || assignedId === `u-${cFirst}` || assignedId.includes(cFirst))) ||
          (cEmailPrefix && assignedId.includes(cEmailPrefix))
        ));

      const isCreated =
        created === current ||
        current.includes(created) ||
        created.includes(current) ||
        (cFirst && crFirst && cFirst === crFirst) ||
        (cEmailPrefix && (created === cEmailPrefix || created.includes(cEmailPrefix))) ||
        Boolean(createdId && (
          (currentId && (createdId === currentId || createdId.includes(currentId))) ||
          (cFirst && (createdId === `emp-${cFirst}` || createdId === `u-${cFirst}` || createdId.includes(cFirst))) ||
          (cEmailPrefix && createdId.includes(cEmailPrefix))
        ));

      return isAssigned || isCreated;
    }
    if (selectedEmployee) {
      const target = selectedEmployee.name.trim().toLowerCase();
      const assigned = (t.assignedTo || "").trim().toLowerCase();
      const assignedId = (t.assignedToId || "").trim().toLowerCase();
      const created = (t.createdBy || "").trim().toLowerCase();
      const createdId = (t.createdById || "").trim().toLowerCase();
      const tFirst = target.split(" ")[0];
      const aFirst = assigned.split(" ")[0];
      const cFirst = created.split(" ")[0];

      const isAssigned =
        assigned === target ||
        target.includes(assigned) ||
        assigned.includes(target) ||
        (tFirst && aFirst && tFirst === aFirst) ||
        Boolean(assignedId && (assignedId === selectedEmployee.id.toLowerCase() || assignedId === `emp-${tFirst}` || assignedId === `u-${tFirst}`));

      const isCreated =
        created === target ||
        target.includes(created) ||
        created.includes(target) ||
        (tFirst && cFirst && tFirst === cFirst) ||
        Boolean(createdId && (createdId === selectedEmployee.id.toLowerCase() || createdId === `emp-${tFirst}` || createdId === `u-${tFirst}`));

      return isAssigned || isCreated;
    }
    return true;
  });

  const archiveTasks = (archiveSection === "declined" ? tasks : baseTasks).filter((task) => {
    if (archiveSection === "completed" ? !["Completed", "Approved"].includes(task.status) : task.status !== "Declined") return false;
    if (archivePeriod === "all") return true;
    const eventDate = archiveSection === "completed" 
      ? (task.completedDate || task.completedAt?.slice(0, 10)) 
      : (task.declinedAt?.slice(0, 10) || task.dueDate?.slice(0, 10));
    if (!eventDate || !archiveDate) return false;
    const declined = new Date(`${eventDate}T00:00:00`);
    const start = new Date(`${archiveDate}T00:00:00`);
    if (archivePeriod === "weekly") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    if (archivePeriod === "monthly") start.setDate(1);
    const end = new Date(start);
    if (archivePeriod === "monthly") end.setMonth(end.getMonth() + 1);
    else end.setDate(end.getDate() + (archivePeriod === "weekly" ? 7 : 1));
    return declined >= start && declined < end;
  }).sort((a, b) => (archiveSection === "completed" ? b.completedDate || "" : b.declinedAt || "").localeCompare(archiveSection === "completed" ? a.completedDate || "" : a.declinedAt || ""));

  const filteredArchiveTasks = archiveTasks.filter((task) => {
    const matchSearch =
      !archiveSearch.trim() ||
      task.title.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      (task.clientName && task.clientName.toLowerCase().includes(archiveSearch.toLowerCase())) ||
      (task.assignedTo && task.assignedTo.toLowerCase().includes(archiveSearch.toLowerCase())) ||
      (task.notes && task.notes.toLowerCase().includes(archiveSearch.toLowerCase())) ||
      (task.declineReason && task.declineReason.toLowerCase().includes(archiveSearch.toLowerCase())) ||
      (task.type && task.type.toLowerCase().includes(archiveSearch.toLowerCase()));

    const matchPriority = archivePriorityFilter === "All" || task.priority === archivePriorityFilter;
    return matchSearch && matchPriority;
  });

  const filtered = baseTasks.filter((t) => {
    const matchDate = isTaskVisibleOnDate(t, selectedDate);
    const matchType = filterType === "All" || t.type === filterType;
    const matchPriority = filterPriority === "All" || t.priority === filterPriority;
    const matchSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchDate && matchType && matchPriority && matchSearch;
  });

  const pending = filtered.filter((t) => t.status === "Pending");
  const inProgress = filtered.filter((t) => t.status === "In Progress");
  const completed = filtered.filter((t) => t.status === "Completed");

  const openAddTask = (dateStr?: string | React.MouseEvent) => {
    const targetDate = typeof dateStr === "string" ? dateStr : (dateFilterMode === "all" ? getTodayIso() : selectedDate);
    setNewDueDate(targetDate);
    setNewAssignees([selectedEmployee ? selectedEmployee.name : currentUser.name]);
    setShowAddTypeInput(false);
    setCustomTypeInput("");
    setSelectedClientId(undefined);
    setNewClientName("");
    setClientSearchOpen(false);
    setShowAddClientModal(false);
    setShowAdd(true);
  };

  // Add Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingTask) return;
    if (!newTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    if (newAssignees.length === 0) {
      toast.error("Please select at least one person");
      return;
    }

    let finalClientId = selectedClientId;
    let finalClientName = newClientName.trim();

    if (finalClientName && !finalClientId) {
      const existing = clients.find(
        (c) => c.name.toLowerCase() === finalClientName.toLowerCase()
      );
      if (existing) {
        finalClientId = existing.id;
        finalClientName = existing.name;
      } else {
        const created = addClientFromLead({ name: finalClientName });
        finalClientId = created.id;
        finalClientName = created.name;
        setClients(getStoredClients());
      }
    }

    const assignmentId = `task-${Date.now()}`;
    const assignments: Task[] = [];
    for (const [index, assignedName] of newAssignees.entries()) {
      const assignedEmp = employeeList.find((emp) => emp.name.toLowerCase() === assignedName.toLowerCase());
      const newTask: Task = {
      id: `${assignmentId}-${index}`,
      title: newTitle.trim(),
      type: newType,
      assignedTo: assignedName,
      assignedToId: assignedEmp?.id || `emp-${assignedName.toLowerCase()}`,
      clientId: finalClientId || undefined,
      clientName: finalClientName || undefined,
      dueDate: newDueDate || new Date().toISOString().split("T")[0],
      dueTime: newDueTime || undefined,
      priority: newPriority,
      status: "Pending",
      notes: newNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name || "Hashim",
      createdById: (currentUser as any)?.id || `emp-${(currentUser.name || "hashim").toLowerCase().split(" ")[0]}`,
    };

      assignments.push(newTask);
    }
    setCreatingTask(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: assignments }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Could not assign the task. Please try again.");
      const ids = new Set(assignments.map((task) => task.id));
      const updated = [...assignments, ...getStoredTasks().filter((task) => !ids.has(task.id))];
      saveStoredTasks(updated);
      setTasks(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign the task");
      return;
    } finally {
      setCreatingTask(false);
    }
    toast.success(`Task assigned to ${newAssignees.join(", ")}!`);

    // Reset Form & Close
    setNewTitle("");
    setNewClientName("");
    setSelectedClientId(undefined);
    setClientSearchOpen(false);
    setShowAddClientModal(false);
    setNewNotes("");
    setShowAddTypeInput(false);
    setCustomTypeInput("");
    setShowAdd(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.3s ease" }}>
      <Dialog.Root
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTask(null);
            setIsEditingDetail(false);
            setForceUnlocked(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay data-mobile-overlay="true" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.48)", backdropFilter: "blur(5px)", zIndex: 220 }} />
          <Dialog.Content className={`task-detail-dialog${isEditingDetail ? " task-edit-dialog" : ""}`}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(760px, calc(100vw - 32px))",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 18,
              zIndex: 221,
              boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
              border: "1px solid #e2e8f0",
            }}
          >
            {isEditingDetail ? (
              /* ─── EDIT TASK MODE ─── */
              <div className="task-edit-shell">
                <div
                  style={{
                    padding: "20px 26px",
                    background: "linear-gradient(135deg, #004d66 0%, #006680 50%, #0284c7 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Pencil size={18} color="#ffffff" />
                    </div>
                    <div>
                      <Dialog.Title style={{ margin: 0, fontSize: 19, fontWeight: 900, lineHeight: 1.25 }}>
                        Edit Task
                      </Dialog.Title>
                      <Dialog.Description style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, margin: "2px 0 0 0" }}>
                        Update task details, due schedule, client, or workflow status
                      </Dialog.Description>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(false)}
                    aria-label="Cancel editing"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.28)",
                      background: "rgba(255,255,255,0.16)",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form className="task-edit-form" onSubmit={handleSaveEditedTask}>
                  <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Task Title */}
                    <div>
                      <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                        Task Title *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                        style={{ fontSize: 13, height: 38 }}
                      />
                    </div>

                    {/* Type, Priority, Status */}
                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Task Type
                        </label>
                        <select
                          className="form-input"
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as TaskType)}
                          style={{ fontSize: 13, height: 38 }}
                        >
                          {taskTypes.map((t) => (
                            <option key={t} value={t}>
                              {TYPE_EMOJIS[t] || "📋"} {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Priority
                        </label>
                        <select
                          className="form-input"
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as any)}
                          style={{ fontSize: 13, height: 38 }}
                        >
                          <option value="Low">Low Priority</option>
                          <option value="Medium">Medium Priority</option>
                          <option value="High">High Priority</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Status
                        </label>
                        <select
                          className="form-input"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as any)}
                          style={{ fontSize: 13, height: 38 }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Approved">Approved</option>
                          <option value="Declined">Declined</option>
                        </select>
                      </div>
                    </div>

                    {/* Assignee, Due Date, Due Time */}
                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Assigned To
                        </label>
                        <select
                          className="form-input"
                          value={editAssignedTo}
                          onChange={(e) => setEditAssignedTo(e.target.value)}
                          style={{ fontSize: 13, height: 38 }}
                        >
                          {employeeList.map((emp) => (
                            <option key={emp.id} value={emp.name}>
                              {emp.name} ({emp.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Due Date *
                        </label>
                        <input
                          type="date"
                          className="form-input"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          required
                          style={{ fontSize: 13, height: 38 }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                          Due Time
                        </label>
                        <input
                          type="time"
                          className="form-input"
                          value={editDueTime}
                          onChange={(e) => setEditDueTime(e.target.value)}
                          style={{ fontSize: 13, height: 38 }}
                        />
                      </div>
                    </div>

                    {/* Client / Facility */}
                    <div ref={editClientDropdownRef} style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <label className="form-label" style={{ fontSize: 12, margin: 0 }}>
                          Client / Facility (optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddClientModal(true);
                            setEditClientSearchOpen(false);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#004d66",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "1px 4px",
                            borderRadius: 4,
                          }}
                        >
                          <Plus size={12} color="#004d66" />
                          <span>Add New Client</span>
                        </button>
                      </div>

                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search existing facility or type new..."
                          value={editClientName}
                          onFocus={() => setEditClientSearchOpen(true)}
                          onChange={(e) => {
                            setEditClientName(e.target.value);
                            setEditClientId(undefined);
                            setEditClientSearchOpen(true);
                          }}
                          style={{
                            fontSize: 13,
                            paddingLeft: 32,
                            paddingRight: editClientName ? 30 : 12,
                            height: 38,
                            borderColor: editClientId ? "#10b981" : undefined,
                            backgroundColor: editClientId ? "#f0fdf4" : undefined,
                          }}
                        />
                        <Building2
                          size={14}
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: editClientId ? "#059669" : "#94a3b8",
                            pointerEvents: "none",
                          }}
                        />
                        {editClientName && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditClientName("");
                              setEditClientId(undefined);
                              setEditClientSearchOpen(false);
                            }}
                            title="Clear client"
                            style={{
                              position: "absolute",
                              right: 8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "transparent",
                              border: "none",
                              color: "#94a3b8",
                              cursor: "pointer",
                              padding: 4,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Suggestions */}
                      {editClientSearchOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: 4,
                            backgroundColor: "#ffffff",
                            borderRadius: 8,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                            border: "1px solid #e2e8f0",
                            zIndex: 50,
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {editClientName.trim() &&
                            !clients.some((c) => c.name.toLowerCase() === editClientName.trim().toLowerCase()) && (
                              <div
                                onClick={() => {
                                  setEditClientSearchOpen(false);
                                  setShowAddClientModal(true);
                                }}
                                style={{
                                  padding: "9px 12px",
                                  backgroundColor: "#f0fdf4",
                                  borderBottom: "1px solid #dcfce7",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: "#15803d",
                                }}
                              >
                                <Plus size={14} color="#15803d" />
                                <div style={{ flex: 1 }}>
                                  <span>Add &quot;{editClientName.trim()}&quot; as new client</span>
                                  <div style={{ fontSize: 10.5, color: "#166534", fontWeight: 400 }}>
                                    Open full UAE healthcare client directory form
                                  </div>
                                </div>
                              </div>
                            )}

                          {clients
                            .filter(
                              (c) =>
                                !editClientName.trim() ||
                                c.name.toLowerCase().includes(editClientName.toLowerCase()) ||
                                (c.city && c.city.toLowerCase().includes(editClientName.toLowerCase())) ||
                                (c.state && c.state.toLowerCase().includes(editClientName.toLowerCase()))
                            )
                            .slice(0, 8)
                            .map((client) => (
                              <div
                                key={client.id}
                                onClick={() => {
                                  setEditClientId(client.id);
                                  setEditClientName(client.name);
                                  setEditClientSearchOpen(false);
                                }}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  backgroundColor: editClientId === client.id ? "#eff6ff" : "#ffffff",
                                  borderBottom: "1px solid #f1f5f9",
                                }}
                              >
                                <Building2 size={14} style={{ color: "#64748b" }} />
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{client.name}</div>
                                  <div style={{ fontSize: 11, color: "#64748b" }}>
                                    {client.city || client.state || "UAE"} · {client.orgType}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Notes / Description */}
                    <div>
                      <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                        Details / Notes
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Record additional task instructions, client requirements, or notes..."
                        style={{ fontSize: 13, resize: "vertical" }}
                      />
                    </div>

                    {/* Footer Actions */}
                    <div className="task-edit-actions"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 8,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (detailTask && confirm(`Are you sure you want to delete task "${detailTask.title}"?`)) {
                            const updated = deleteStoredTask(detailTask.id);
                            setTasks(updated);
                            setDetailTask(null);
                            setIsEditingDetail(false);
                            toast.success("Task deleted successfully!");
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#dc2626",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Task</span>
                      </button>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setIsEditingDetail(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ backgroundColor: "#004d66", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Check size={14} />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              /* ─── VIEW TASK MODE ─── */
              <div className="task-detail-view">
                <div className="task-detail-heading"
                  style={{
                    padding: "22px 26px",
                    background: "linear-gradient(135deg, #064e5f 0%, #075985 45%, #4f46e5 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Dialog.Title style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.25 }}>
                      {detailTask?.title}
                    </Dialog.Title>
                    <Dialog.Description style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, marginTop: 8 }}>
                      {detailTask?.clientName || "General task"} · Assigned to {detailTask?.assignedTo} · Created by {detailTask?.createdBy || "Hashim"}
                    </Dialog.Description>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (detailTask) {
                          if (!canUserEditTask(detailTask, currentUser)) setForceUnlocked(true);
                          startEditTask(detailTask);
                        }
                      }}
                      style={{
                        height: 38,
                        padding: "0 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.3)",
                        background: "rgba(255,255,255,0.18)",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
                    >
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Close task details"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.28)",
                          background: "rgba(255,255,255,0.16)",
                          color: "#ffffff",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <X size={18} />
                      </button>
                    </Dialog.Close>
                  </div>
                </div>

                <div className="task-detail-body" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                    {[
                      { label: "Status", value: detailTask?.status || "-" },
                      { label: "Priority", value: `${detailTask?.priority || "-"} priority` },
                      { label: "Due date", value: `${detailTask?.dueDate ? new Date(`${detailTask.dueDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}${detailTask?.dueTime ? ` · ${detailTask.dueTime}` : ""}` },
                      { label: "Type", value: detailTask?.type || "-" },
                    ].map((item) => (
                      <div key={item.label} style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>{item.label}</div>
                        <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 800 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {detailTask?.notes && (
                    <div style={{ padding: 16, borderRadius: 12, background: "#ffffff", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>Details</div>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.65, color: "#1e293b" }}>{detailTask.notes}</div>
                    </div>
                  )}

                  <div className="task-detail-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                      {detailTask?.clientName || "General task"} · Assigned: {detailTask?.assignedTo || "Unassigned"} · Created by: {detailTask?.createdBy || "Hashim"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (detailTask) {
                            if (!canUserEditTask(detailTask, currentUser)) setForceUnlocked(true);
                            startEditTask(detailTask);
                          }
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#004d66" }}
                      >
                        <Pencil size={13} />
                        <span>Edit Task</span>
                      </button>

                      {detailTask && !["Completed", "Approved", "Declined"].includes(detailTask.status) && (
                        canUserEditTask(detailTask, currentUser) ? (
                          <>
                            <button className="btn btn-primary" onClick={() => { updateStatus(detailTask.id, "Completed"); setDetailTask(null); }}>Done</button>
                            <button className="btn btn-secondary" onClick={() => { setDeclineTask(detailTask); setDeclineReason(""); setDetailTask(null); }}>Decline</button>
                          </>
                        ) : (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f1f5f9", borderRadius: 8, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                            <Lock size={13} color="#94a3b8" />
                            <span>View Only (Only {detailTask?.createdBy || "Creator"} &amp; {detailTask?.assignedTo || "Assignee"} can edit)</span>
                          </div>
                        )
                      )}
                      <Dialog.Close asChild><button className="btn btn-secondary">Close</button></Dialog.Close>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={!!declineTask} onOpenChange={(open) => { if (!open) setDeclineTask(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay data-mobile-overlay="true" style={{ position: "fixed", inset: 0, background: "rgba(0,37,51,.4)", zIndex: 220 }} />
          <Dialog.Content style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(460px, calc(100vw - 32px))", background: "white", padding: 24, borderRadius: 12, zIndex: 221 }}>
            <Dialog.Title style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Decline task</Dialog.Title>
            <Dialog.Description style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{declineTask?.title}</Dialog.Description>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (!declineTask || !declineReason.trim()) return;
              const declinedItem: Task = {
                ...declineTask,
                status: "Declined",
                declineReason: declineReason.trim(),
                declinedAt: new Date().toISOString(),
              };
              const updated = updateStoredTask(declinedItem);
              setTasks(updated);
              setDeclineTask(null);
              setDeclineReason("");
              toast.success("Task declined");
            }}>
              <label htmlFor="decline-reason" className="form-label" style={{ fontWeight: 700, marginBottom: 6 }}>Reason (required)</label>
              
              {/* Quick Select Reason Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
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
                    onClick={() => setDeclineReason(chip)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: declineReason === chip ? "1px solid #b91c1c" : "1px solid #e2e8f0",
                      backgroundColor: declineReason === chip ? "#fee2e2" : "#f8fafc",
                      color: declineReason === chip ? "#991b1b" : "#475569",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <textarea id="decline-reason" className="form-input" required rows={3} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Enter detailed reason for declining..." />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <Dialog.Close asChild><button type="button" className="btn btn-secondary">Cancel</button></Dialog.Close>
                <button className="btn btn-primary" disabled={!declineReason.trim()}>Decline task</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* ─── WHEN IN MY TEAM TASKS: SHOW TEAM TASKS BOARD DIRECTORY (MATCHING SCREENSHOT) ── */}
      {/* ─── WHEN IN COMPLETED WORK OR DECLINED TASKS: EXECUTIVE CARDS & LIST VIEWS ── */}
      {archiveSection === "completed" || archiveSection === "declined" ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Executive Header Banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              padding: "16px 20px",
              backgroundColor: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: archiveSection === "completed"
                    ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                    : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: archiveSection === "completed"
                    ? "0 4px 12px rgba(16, 185, 129, 0.25)"
                    : "0 4px 12px rgba(239, 68, 68, 0.25)",
                }}
              >
                {archiveSection === "completed" ? (
                  <CheckCircle2 size={22} color="#ffffff" strokeWidth={2.2} />
                ) : (
                  <X size={22} color="#ffffff" strokeWidth={2.5} />
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1
                    style={{
                      fontSize: 21,
                      fontWeight: 800,
                      color: "#0f172a",
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {archiveSection === "completed" ? "My Completed Work" : "Declined Tasks"}
                  </h1>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      backgroundColor: archiveSection === "completed" ? "#ecfdf5" : "#fef2f2",
                      color: archiveSection === "completed" ? "#065f46" : "#991b1b",
                      border: `1px solid ${archiveSection === "completed" ? "#a7f3d0" : "#fee2e2"}`,
                    }}
                  >
                    {archiveSection === "completed" ? "Archive" : "Audit Trail"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0 0" }}>
                  {archiveSection === "completed"
                    ? "Verified medical assignments, site visits, installations, and approved deliverables"
                    : "Tasks rejected with formal decline reasons and employee audit trails"}
                </p>
              </div>
            </div>

            {/* Quick Metrics Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  backgroundColor: archiveSection === "completed" ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${archiveSection === "completed" ? "#a7f3d0" : "#fecaca"}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: archiveSection === "completed" ? "#10b981" : "#ef4444",
                  }}
                />
                <span style={{ fontSize: 13.5, fontWeight: 800, color: archiveSection === "completed" ? "#065f46" : "#991b1b" }}>
                  {archiveTasks.length}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: archiveSection === "completed" ? "#047857" : "#b91c1c" }}>
                  {archiveSection === "completed" ? "Completed" : "Declined"}
                </span>
              </div>

              {archiveTasks.filter((t) => t.priority === "High").length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f97316" }} />
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "#9a3412" }}>
                    {archiveTasks.filter((t) => t.priority === "High").length}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#c2410c" }}>High Priority</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Controls & Filters Toolbar */}
          <div
            className="card archive-task-toolbar"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 16px",
              backgroundColor: "#ffffff",
              borderRadius: 12,
            }}
          >
            {/* Left: Search & Filter Dropdowns */}
            <div className="archive-task-filter-fields" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, flex: 1, minWidth: 280 }}>
              {/* Search Box */}
              <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px", maxWidth: 360 }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by title, client, or type..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  style={{
                    paddingLeft: 34,
                    paddingRight: archiveSearch ? 30 : 12,
                    height: 36,
                    fontSize: 13,
                    width: "100%",
                  }}
                />
                {archiveSearch && (
                  <button
                    type="button"
                    onClick={() => setArchiveSearch("")}
                    aria-label="Clear search"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      padding: 2,
                      color: "#94a3b8",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Reporting Period */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ minWidth: 120 }}>
                  <CustomLightSelect
                    value={archivePeriod}
                    options={[
                      { value: "all", label: "All time" },
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    onChange={(val) => setArchivePeriod(val || "all")}
                    clearable={false}
                    buttonStyle={{ height: 36, fontSize: 12.5, borderRadius: 8 }}
                  />
                </div>

                {archivePeriod !== "all" && (
                  <input
                    className="form-input"
                    aria-label="Date within reporting period"
                    type="date"
                    value={archiveDate}
                    onChange={(event) => setArchiveDate(event.target.value)}
                    style={{ width: 145, height: 36, fontSize: 12.5, borderRadius: 8 }}
                  />
                )}
              </div>

              {/* Priority Filter */}
              <div style={{ minWidth: 130 }}>
                <CustomLightSelect
                  value={archivePriorityFilter}
                  options={[
                    { value: "All", label: "All Priorities" },
                    { value: "High", label: "High" },
                    { value: "Medium", label: "Medium" },
                    { value: "Low", label: "Low" },
                  ]}
                  onChange={(val) => setArchivePriorityFilter(val || "All")}
                  clearable={false}
                  buttonStyle={{ height: 36, fontSize: 12.5, borderRadius: 8 }}
                />
              </div>
            </div>


          </div>

          {/* ─── LIST (TABLE) VIEW ONLY ─── */}
          {filteredArchiveTasks.length > 0 && (
            <div
              className="card"
              style={{
                padding: 0,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table data-mobile-cards="true" style={{ width: "100%", minWidth: 1020, borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                      <th
                        style={{
                          padding: "13px 18px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "23%",
                        }}
                      >
                        Task Title & Type
                      </th>
                      <th
                        style={{
                          padding: "13px 16px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "21%",
                        }}
                      >
                        Client / Facility
                      </th>
                      <th
                        style={{
                          padding: "13px 14px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "12%",
                        }}
                      >
                        Assignee
                      </th>
                      <th
                        style={{
                          padding: "13px 14px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "10%",
                        }}
                      >
                        Priority
                      </th>
                      <th
                        style={{
                          padding: "13px 14px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "11%",
                        }}
                      >
                        {archiveSection === "completed" ? "Completed Date" : "Declined Date"}
                      </th>
                      {archiveSection === "declined" && (
                        <th
                          style={{
                            padding: "13px 14px",
                            textAlign: "left",
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "#475569",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            borderBottom: "1.5px solid #e2e8f0",
                            width: "13%",
                          }}
                        >
                          Decline Reason
                        </th>
                      )}
                      <th
                        style={{
                          padding: "13px 14px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "8%",
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "13px 18px",
                          textAlign: "right",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          borderBottom: "1.5px solid #e2e8f0",
                          width: "12%",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchiveTasks.map((task, index) => {
                      const isLast = index === filteredArchiveTasks.length - 1;
                      const priorityCfg = task.priority === "High"
                        ? { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", dot: "#ef4444" }
                        : task.priority === "Low"
                        ? { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" }
                        : { bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#f59e0b" };

                      return (
                        <tr
                          key={task.id}
                          style={{
                            borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          {/* Task Title & Type */}
                          <td data-label="Task Title & Type" style={{ padding: "13px 18px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => setDetailTask(task)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  lineHeight: 1.35,
                                  maxWidth: 270,
                                  transition: "color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#004d66")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                              >
                                {task.title}
                              </button>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#475569",
                                    backgroundColor: "#f1f5f9",
                                    border: "1px solid #e2e8f0",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                  }}
                                >
                                  <span>{TYPE_EMOJIS[task.type] || "📋"}</span>
                                  <span>{task.type}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Client / Facility */}
                          <td data-label="Client / Facility" style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <OrganisationAvatar
                                name={task.clientName || "General Task"}
                                size={28}
                                style={{ flexShrink: 0 }}
                              />
                              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                <span
                                  title={task.clientName || "General Task"}
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: task.clientName ? "#0f172a" : "#64748b",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 220,
                                  }}
                                >
                                  {task.clientName || "General Task"}
                                </span>
                                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                  {task.clientName ? "Healthcare Client" : "Internal Activity"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Assignee */}
                          <td data-label="Assignee" style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: "50%",
                                  backgroundColor: "#004d66",
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  boxShadow: "0 1px 2px rgba(0,77,102,0.2)",
                                }}
                              >
                                {getInitials(task.assignedTo || currentUser.name)}
                              </div>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                                {task.assignedTo || currentUser.name}
                              </span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td data-label="Priority" style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "3px 9px",
                                borderRadius: 999,
                                backgroundColor: priorityCfg.bg,
                                border: `1px solid ${priorityCfg.border}`,
                                color: priorityCfg.text,
                                fontSize: 11.5,
                                fontWeight: 700,
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: priorityCfg.dot }} />
                              <span>{task.priority || "Medium"}</span>
                            </span>
                          </td>

                          {/* Completed / Declined Date */}
                          <td data-label="" style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                color: "#475569",
                                fontWeight: 500,
                                backgroundColor: "#f8fafc",
                                padding: "3px 8px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              {archiveSection === "completed" ? (
                                <CheckCircle2 size={12} color="#059669" />
                              ) : (
                                <CalendarIcon size={12} color="#64748b" />
                              )}
                              <span>
                                {archiveSection === "completed"
                                  ? task.completedDate || task.completedAt?.slice(0, 10) || "—"
                                  : task.declinedAt?.slice(0, 10) || "—"}
                              </span>
                            </div>
                          </td>

                          {/* Decline Reason Column */}
                          {archiveSection === "declined" && (
                            <td data-label="Decline Reason" style={{ padding: "13px 14px", verticalAlign: "middle", maxWidth: 220 }}>
                              {task.declineReason ? (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: "#fef2f2",
                                    border: "1px solid #fecaca",
                                    color: "#991b1b",
                                    padding: "4px 10px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    maxWidth: 200,
                                    boxShadow: "0 1px 2px rgba(220, 38, 38, 0.03)",
                                  }}
                                  title={task.declineReason}
                                >
                                  <AlertCircle size={13} color="#dc2626" style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {task.declineReason}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                          )}

                          {/* Status */}
                          <td data-label="Status" style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {archiveSection === "completed" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  backgroundColor: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  color: "#065f46",
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                }}
                              >
                                <CheckCircle2 size={12} color="#059669" />
                                <span>{task.status === "Approved" ? "Approved" : "Completed"}</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  backgroundColor: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  color: "#991b1b",
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#ef4444" }} />
                                <span>Declined</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td data-label="Actions" style={{ padding: "13px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 7 }}>
                              <button
                                type="button"
                                onClick={() => setDetailTask(task)}
                                title="View full task details"
                                style={{
                                  padding: "5px 11px",
                                  borderRadius: 7,
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#ffffff",
                                  color: "#0f172a",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#f0fdfa";
                                  e.currentTarget.style.borderColor = "#004d66";
                                  e.currentTarget.style.color = "#004d66";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "#ffffff";
                                  e.currentTarget.style.borderColor = "#cbd5e1";
                                  e.currentTarget.style.color = "#0f172a";
                                }}
                              >
                                <Eye size={13} color="#004d66" />
                                <span>View</span>
                              </button>

                              {archiveSection === "declined" && (
                                <button
                                  type="button"
                                  onClick={() => updateStatus(task.id, "Pending")}
                                  title="Restore declined task back to Pending"
                                  style={{
                                    padding: "5px 11px",
                                    borderRadius: 7,
                                    border: "1px solid #fed7aa",
                                    backgroundColor: "#fff7ed",
                                    color: "#c2410c",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    boxShadow: "0 1px 2px rgba(194, 65, 12, 0.05)",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#ffedd5";
                                    e.currentTarget.style.borderColor = "#fdba74";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#fff7ed";
                                    e.currentTarget.style.borderColor = "#fed7aa";
                                  }}
                                >
                                  <RotateCcw size={12} color="#c2410c" />
                                  <span>Restore</span>
                                </button>
                              )}

                              {archiveSection === "completed" && (
                                <button
                                  type="button"
                                  onClick={() => updateStatus(task.id, "In Progress")}
                                  title="Reopen task into In Progress"
                                  style={{
                                    padding: "5px 11px",
                                    borderRadius: 7,
                                    border: "1px solid #ccfbf1",
                                    backgroundColor: "#f0fdfa",
                                    color: "#0f766e",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    boxShadow: "0 1px 2px rgba(15, 118, 110, 0.05)",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#ccfbf1";
                                    e.currentTarget.style.borderColor = "#99f6e4";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#f0fdfa";
                                    e.currentTarget.style.borderColor = "#ccfbf1";
                                  }}
                                >
                                  <RotateCcw size={12} color="#0f766e" />
                                  <span>Reopen</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── EMPTY STATE ─── */}
          {filteredArchiveTasks.length === 0 && (
            <div
              className="card"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <CheckCircle2 size={26} color="#94a3b8" />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                No {archiveSection} tasks found
              </h4>
              <p style={{ fontSize: 13, color: "#64748b", maxWidth: 420, margin: "0 0 16px" }}>
                {archiveSearch || archivePriorityFilter !== "All"
                  ? "No tasks match your search query or selected priority filter."
                  : `No ${archiveSection} tasks recorded for the selected period (${archivePeriod}).`}
              </p>
              {(archiveSearch || archivePriorityFilter !== "All" || archivePeriod !== "all") && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setArchiveSearch("");
                    setArchivePriorityFilter("All");
                    setArchivePeriod("all");
                  }}
                  style={{ fontSize: 12.5 }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </section>
      ) : isAllScope && teamViewMode === "directory" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header matching Screenshot 2 */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                Team Tasks Board
              </h1>
            </div>


          </div>

          {/* Directory Table matching Screenshot 2 */}
          <div
            className="card"
            style={{
              padding: 0,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <table data-mobile-cards="true" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: "#fafbfc" }}>
                  <th
                    style={{
                      padding: "14px 24px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    EMPLOYEE NAME
                  </th>
                  <th
                    style={{
                      padding: "14px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    ROLE
                  </th>
                  <th
                    style={{
                      padding: "14px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    ACTIVE TASKS
                  </th>
                  <th
                    style={{
                      padding: "14px 24px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {employeeList.map((emp, index) => {
                  const activeCount = tasks.filter((t) => {
                    const target = (emp.name || "").trim().toLowerCase();
                    const tFirst = target.split(" ")[0];
                    const assigned = (t.assignedTo || "").trim().toLowerCase();
                    const aFirst = assigned.split(" ")[0];
                    const aId = (t.assignedToId || "").trim().toLowerCase();
                    const matchesEmp =
                      assigned === target ||
                      target.includes(assigned) ||
                      assigned.includes(target) ||
                      (tFirst && aFirst && tFirst === aFirst) ||
                      (aId && tFirst && aId === `emp-${tFirst}`);
                    return (
                      matchesEmp &&
                      t.status !== "Completed" &&
                      t.status !== "Cancelled" &&
                      t.status !== "Declined" &&
                      t.status !== "Approved"
                    );
                  }).length;
                  const initials = getInitials(emp.name);

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom:
                          index < employeeList.length - 1 ? "1px solid #f1f5f9" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#fafbfc")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      {/* EMPLOYEE NAME */}
                      <td data-label="EMPLOYEE NAME" style={{ padding: "16px 24px" }}>
                        <button
                          type="button"
                          onClick={() => router.push(`/tasks?member=${encodeURIComponent(emp.name)}`)}
                          aria-label={`Open ${emp.name}'s tasks`}
                          style={{ display: "flex", alignItems: "center", gap: 14, border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit" }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              backgroundColor: "#1e293b",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 13.5,
                              letterSpacing: "0.02em",
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                              {emp.email}
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* ROLE */}
                      <td data-label="ROLE" style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            padding: "5px 14px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-block",
                          }}
                        >
                          {emp.role}
                        </span>
                      </td>

                      {/* ACTIVE TASKS */}
                      <td data-label="ACTIVE TASKS" style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            backgroundColor: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "4px 14px",
                            borderRadius: 9999,
                            fontSize: 12.5,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: "#2563eb",
                            }}
                          />
                          {activeCount} active tasks
                        </span>
                      </td>

                      {/* ACTION */}
                      <td data-label="ACTION" style={{ padding: "16px 24px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/tasks?member=${encodeURIComponent(emp.name)}`)
                          }
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "7px 16px",
                            backgroundColor: "#ffffff",
                            color: "#0f172a",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                            e.currentTarget.style.borderColor = "#cbd5e1";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.borderColor = "#e2e8f0";
                          }}
                        >
                          <span>Open</span>
                          <ChevronRight size={14} style={{ color: "#64748b" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {selectedEmployee && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                {selectedEmployee.name}&apos;s Tasks
              </h2>
              <button
                type="button"
                onClick={() => router.push("/tasks?member=all")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#004d66",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
              >
                <ChevronLeft size={14} />
                <span>Team Tasks Board</span>
              </button>
            </div>
          )}
          {/* If in My Team Tasks consolidated board mode, show return to directory */}
          {isAllScope && (
            <div>
              <button
                type="button"
                onClick={() => setTeamViewMode("directory")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#004d66",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  transition: "all 0.15s ease",
                }}
              >
                <ChevronLeft size={14} />
                <span>Back to Team Directory</span>
              </button>
            </div>
          )}



      {/* Controls Bar */}
      <div
        className={`card task-mobile-controls ${mobileTaskFiltersOpen ? "task-filters-open" : ""}`}
        style={{
          padding: "6px 10px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div className="task-control-fields" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {/* ─── DATE-WISE FILTER STEPPER & PICKER ───────────────────────── */}
          <div className="task-date-picker"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 4px",
            }}
          >
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              title="Previous Day"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
                color: "#475569",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
              <CalendarIcon size={13} color="#004d66" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    setDateFilterMode(e.target.value === getTodayIso() ? "today" : "custom");
                  }
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => shiftDate(1)}
              title="Next Day"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
                color: "#475569",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="task-date-presets" style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <button
              type="button"
              onClick={() => handlePresetSelect("today")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: dateFilterMode === "today" ? 700 : 500,
                background: dateFilterMode === "today" ? "#004d66" : "#f1f5f9",
                color: dateFilterMode === "today" ? "#ffffff" : "#475569",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect("tomorrow")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: dateFilterMode === "tomorrow" ? 700 : 500,
                background: dateFilterMode === "tomorrow" ? "#004d66" : "#f1f5f9",
                color: dateFilterMode === "tomorrow" ? "#ffffff" : "#475569",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Tomorrow
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect("all")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: dateFilterMode === "all" ? 700 : 500,
                background: dateFilterMode === "all" ? "#004d66" : "#f1f5f9",
                color: dateFilterMode === "all" ? "#ffffff" : "#475569",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              All Dates
            </button>
          </div>

          <button type="button" className="task-filter-toggle" aria-label="Task filters" aria-expanded={mobileTaskFiltersOpen} onClick={() => setMobileTaskFiltersOpen(value => !value)}><Filter size={18} /></button>
          {/* Type Filter */}
          <select
            aria-label="Task type" className="form-input task-type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 130, height: 32, fontSize: 12 }}
          >
            <option value="All">All Types</option>
            {taskTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            aria-label="Task priority" className="form-input task-priority-filter"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{ width: 120, height: 32, fontSize: 12 }}
          >
            <option value="All">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          {/* Search Bar */}
          <div className="task-search-field" style={{ position: "relative", flex: "1 1 180px" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              aria-label="Search tasks" className="form-input"
              placeholder={
                isMyScope
                  ? "Search my tasks..."
                  : isAllScope
                  ? "Search team tasks..."
                  : `Search ${selectedEmployee?.name}'s tasks...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 28, width: "100%", height: 32, fontSize: 12.5 }}
            />
          </div>
        </div>

        {/* Right: Add Task */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="btn btn-primary"
            aria-label="Add task"
            onClick={openAddTask}
            style={{
              backgroundColor: "#004d66",
              height: 34,
              fontSize: 12.5,
              padding: "0 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Notice when tasks exist on other dates */}
      {dateFilterMode !== "all" && filtered.length === 0 && baseTasks.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: "#1e40af",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={16} color="#3b82f6" />
            <span>
              No tasks scheduled for <strong>{dateFilterMode === "today" ? "Today" : selectedDate}</strong>, but {selectedEmployee ? selectedEmployee.name : "this view"} has <strong>{baseTasks.length}</strong> {baseTasks.length === 1 ? "task" : "tasks"} scheduled on other dates.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handlePresetSelect("all")}
            style={{
              padding: "4px 12px",
              borderRadius: 5,
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            View All Dates ({baseTasks.length})
          </button>
        </div>
      )}

      <div className="mobile-task-status-tabs" role="tablist" aria-label="Task status">
        {[{status:"Pending", count:pending.length}, {status:"In Progress", count:inProgress.length}, {status:"Completed", count:completed.length}].map(item => (
          <button key={item.status} type="button" role="tab" aria-selected={mobileTaskStatus === item.status} aria-controls={`mobile-task-panel-${item.status.replaceAll(" ", "-")}`} id={`mobile-task-tab-${item.status.replaceAll(" ", "-")}`} onClick={() => setMobileTaskStatus(item.status)}>{item.status}<span>{item.count}</span></button>
        ))}
      </div>

      {/* ─── BOARD VIEW ────────────────────────────────────────────────────── */}
      <div className="task-mobile-board" data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {[
          { title: "Pending" as const, status: "Pending" as const, tasks: pending, dotColor: "#f59e0b" },
          { title: "In Progress" as const, status: "In Progress" as const, tasks: inProgress, dotColor: "#6366f1" },
          { title: "Completed" as const, status: "Completed" as const, tasks: completed, dotColor: "#10b981" },
        ].map((col) => {
          const isOver = dragOverCol === col.status;

          return (
            <div
              key={col.title}
              className={`task-status-section ${mobileTaskStatus === col.status ? "mobile-task-status-active" : ""}`}
              id={`mobile-task-panel-${col.status.replaceAll(" ", "-")}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverCol !== col.status) {
                  setDragOverCol(col.status);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol((curr) => (curr === col.status ? null : curr));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData("text/plain") || draggedTaskId;
                setDragOverCol(null);
                setDraggedTaskId(null);
                if (droppedId) {
                  const task = tasks.find((t) => t.id === droppedId);
                  if (task && task.status !== col.status) {
                    updateStatus(droppedId, col.status);
                  }
                }
              }}
              style={{
                backgroundColor: isOver ? "#f1f5f9" : "#f8fafc",
                borderRadius: 10,
                padding: "10px 12px",
                border: isOver ? "2px dashed #004d66" : "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                minHeight: 450,
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  padding: "2px 2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: col.dotColor,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                    {col.title}
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "1px 7px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {col.tasks.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {col.tasks.map((task) => {
                  const isDragging = draggedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="mobile-task-card"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open task: ${task.title}`}
                      onClick={() => setDetailTask(task)}
                      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setDetailTask(task); } }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverCol(null);
                      }}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        padding: "10px 12px",
                        boxShadow: isDragging
                          ? "0 8px 20px rgba(0,0,0,0.1)"
                          : "0 1px 2px rgba(0,0,0,0.03)",
                        border: isDragging ? "1.5px solid #004d66" : "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        cursor: "grab",
                        opacity: isDragging ? 0.35 : 1,
                        transform: isDragging ? "scale(0.98)" : "scale(1)",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                      }}
                    >
                      {/* Header: Type Chip, Rollover Tag & Priority */}
                      <div className="mobile-task-card-header"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                          <GripVertical
                            size={12}
                            style={{ color: "#cbd5e1", cursor: "grab", flexShrink: 0 }}
                          />
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              backgroundColor: "#f1f5f9",
                              color: "#475569",
                              padding: "1.5px 6px",
                              borderRadius: 4,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.type}
                          </span>

                          {isTaskRolledForward(task) && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "#c2410c",
                                backgroundColor: "#fff7ed",
                                border: "1px solid #fed7aa",
                                padding: "1px 5px",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                whiteSpace: "nowrap",
                              }}
                              title={`Carried forward from ${task.dueDate}`}
                            >
                              <span>Rollover</span>
                            </span>
                          )}
                        </div>

                        {/* Priority */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: PRIORITY_COLORS[task.priority],
                            }}
                          />
                          <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>
                            {task.priority}
                          </span>
                        </div>
                      </div>

                      {/* Task Title */}
                      <div className="mobile-task-card-title"
                        style={{
                          fontWeight: 600,
                          fontSize: 12.5,
                          lineHeight: 1.35,
                          color: "#0f172a",
                        }}
                      >
                        {task.title}
                      </div>

                      {/* Client Facility (single clean line) */}
                      {task.clientName && (
                        <div className="mobile-task-card-client"
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={task.clientName}
                        >
                          <Building2 size={11} style={{ color: "#94a3b8", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {task.clientName}
                          </span>
                        </div>
                      )}

                      {/* Footer: Date & Assignee + Quick Inline Action Buttons */}
                      <div className="mobile-task-card-footer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 2,
                          paddingTop: 6,
                          borderTop: "1px solid #f8fafc",
                          gap: 6,
                        }}
                      >
                        {/* Left: Due Date & Assignee */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: "#64748b",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <CalendarIcon size={10.5} style={{ color: "#94a3b8" }} />
                            <span>{task.dueDate.substring(5)}</span>
                            {task.dueTime && <span>· {task.dueTime}</span>}
                          </div>

                          {task.assignedTo && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "#004d66",
                                backgroundColor: "#eaf8f4",
                                padding: "1px 5px",
                                borderRadius: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 80,
                              }}
                              title={`Assigned: ${task.assignedTo}`}
                            >
                              {task.assignedTo}
                            </span>
                          )}
                        </div>

                        {/* Right: Minimal Action Buttons */}
                        <div
                          onClick={(event) => event.stopPropagation()}
                          style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                        >
                          {col.title !== "Completed" && (
                            <button
                              type="button"
                              onClick={() => { setDeclineTask(task); setDeclineReason(""); }}
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: "none",
                                background: "transparent",
                                color: "#94a3b8",
                                fontSize: 10.5,
                                cursor: "pointer",
                                fontWeight: 500,
                                transition: "color 0.12s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                              title="Decline task"
                            >
                              Decline
                            </button>
                          )}

                          {col.title === "Pending" && (
                            <button
                              type="button"
                              style={{
                                padding: "2.5px 7px",
                                borderRadius: 4,
                                border: "1px solid #ddd6fe",
                                backgroundColor: "#f5f3ff",
                                color: "#7c3aed",
                                fontSize: 10.5,
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.12s ease",
                              }}
                              onClick={() => updateStatus(task.id, "In Progress")}
                              title="Move to In Progress"
                            >
                              <Play size={9} />
                              <span>Start</span>
                            </button>
                          )}

                          {col.title !== "Completed" && (
                            <button
                              type="button"
                              style={{
                                padding: "2.5px 7px",
                                borderRadius: 4,
                                border: "1px solid #bbf7d0",
                                backgroundColor: "#ecfdf5",
                                color: "#059669",
                                fontSize: 10.5,
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.12s ease",
                              }}
                              onClick={() => updateStatus(task.id, "Completed")}
                              title="Mark Completed"
                            >
                              <Check size={10} />
                              <span>Done</span>
                            </button>
                          )}

                          {col.title === "Completed" && (
                            <button
                              type="button"
                              style={{
                                padding: "2.5px 7px",
                                borderRadius: 4,
                                border: "1px solid #e2e8f0",
                                backgroundColor: "#f8fafc",
                                color: "#64748b",
                                fontSize: 10.5,
                                cursor: "pointer",
                                fontWeight: 500,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                              onClick={() => updateStatus(task.id, "Pending")}
                              title="Reopen task"
                            >
                              <RotateCcw size={9.5} />
                              <span>Reopen</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Visual Drop Target Placeholder */}
                {isOver && (
                  <div
                    style={{
                      border: "2px dashed #004d66",
                      borderRadius: 8,
                      padding: "12px",
                      textAlign: "center",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#004d66",
                      backgroundColor: "rgba(255,255,255,0.85)",
                    }}
                  >
                    Drop here to move to {col.title}
                  </div>
                )}

                {col.tasks.length === 0 && !isOver && (
                  <div
                    style={{
                      padding: "24px 12px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: 11.5,
                      border: "1px dashed #e2e8f0",
                      borderRadius: 8,
                      backgroundColor: "#ffffff",
                    }}
                  >
                    No {col.title.toLowerCase()} tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  )}

      {/* ─── ADD TASK MODAL (PERSONALIZED ASSIGNMENT) ────────────────────────── */}
      {showAdd && (
        <div className="task-create-overlay" data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 20,
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="card task-create-dialog"
            style={{
              width: "100%",
              maxWidth: 800,
              padding: 0,
              borderRadius: 16,
              overflow: "hidden",
              animation: "fadeIn 0.2s ease",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0, color: "#0f172a" }}>
                  Create Task
                </h2>
                <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Assign this task to one or more team members
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
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

            <form className="task-create-form" onSubmit={handleCreateTask}>
              <div className="task-create-fields" data-mobile-grid="stack"
                style={{
                  padding: "24px 28px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Task Title *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Follow-up call with Mediclinic regarding ventilator quotation"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 12, margin: 0 }}>
                      Task Type
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setShowManageTypesModal(true)}
                        title="Manage and Edit Task Type Options"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#64748b",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          padding: "1px 4px",
                          borderRadius: 4,
                        }}
                      >
                        <SlidersHorizontal size={11} color="#64748b" />
                        <span>Edit Options</span>
                      </button>
                      {!showAddTypeInput && (
                        <button
                          type="button"
                          onClick={() => setShowAddTypeInput(true)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#004d66",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "1px 4px",
                            borderRadius: 4,
                          }}
                        >
                          <Plus size={12} color="#004d66" />
                          <span>+ Add</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {showAddTypeInput ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Maintenance, Quotation, Audit..."
                        value={customTypeInput}
                        onChange={(e) => setCustomTypeInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddNewType();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setShowAddTypeInput(false);
                            setCustomTypeInput("");
                          }
                        }}
                        style={{ fontSize: 13, flex: 1, height: 38 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleAddNewType()}
                        style={{
                          backgroundColor: "#004d66",
                          padding: "0 12px",
                          height: 38,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowAddTypeInput(false);
                          setCustomTypeInput("");
                        }}
                        style={{
                          padding: "0 10px",
                          height: 38,
                          fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <CustomLightSelect
                      value={newType}
                      options={taskTypes.map((t) => ({
                        value: t,
                        label: `${TYPE_EMOJIS[t] || "📋"}  ${t}`,
                      }))}
                      onChange={(val) => {
                        if (val) setNewType(val as TaskType);
                      }}
                      clearable={false}
                      searchable={false}
                      onAddNew={() => setShowAddTypeInput(true)}
                      addNewLabel="+ Add New Option..."
                      buttonStyle={{ height: 38, fontSize: 13 }}
                    />
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Assign To
                  </label>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" aria-label="Assign team members" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 38, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#334155", fontSize: 13, textAlign: "left", cursor: "pointer" }}>
                        <Users size={16} aria-hidden="true" style={{ color: "#64748b", flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {newAssignees.length ? newAssignees.join(", ") : "Select team members"}
                        </span>
                        {newAssignees.length > 1 && <span style={{ borderRadius: 4, background: "#e9f7f4", color: "#005468", padding: "1px 6px", fontSize: 11 }}>{newAssignees.length}</span>}
                        <ChevronRight size={14} aria-hidden="true" style={{ transform: "rotate(90deg)", flexShrink: 0 }} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="start" sideOffset={5} collisionPadding={12} aria-label="Team members" style={{ width: "var(--radix-dropdown-menu-trigger-width)", maxHeight: "min(280px, var(--radix-dropdown-menu-content-available-height))", overflowY: "auto", padding: 5, background: "white", border: "1px solid #dbe3ec", borderRadius: 10, boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)", zIndex: 10000 }}>
                        <DropdownMenu.Label style={{ padding: "7px 9px", fontSize: 11, color: "#64748b" }}>Select one or more team members</DropdownMenu.Label>
                        {[
                          { id: currentUser.id || "myself", name: currentUser.name, role: currentUser.role },
                          ...employeeList.filter((employee) => employee.name.toLowerCase() !== currentUser.name.toLowerCase()),
                        ].map((employee) => (
                          <DropdownMenu.CheckboxItem key={employee.id} checked={newAssignees.includes(employee.name)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => setNewAssignees((selected) => checked ? Array.from(new Set([...selected, employee.name])) : selected.filter((name) => name !== employee.name))} className="team-assignee-option" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px", borderRadius: 6, fontSize: 13, color: "#334155", cursor: "pointer", outline: "none" }}>
                            <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, border: "1px solid", borderColor: newAssignees.includes(employee.name) ? "#005468" : "#cbd5e1", borderRadius: 4, background: newAssignees.includes(employee.name) ? "#005468" : "#fff", color: "#fff", flexShrink: 0 }}><DropdownMenu.ItemIndicator><Check size={12} /></DropdownMenu.ItemIndicator></span>
                            <span style={{ flex: 1 }}>{employee.name}{employee.name === currentUser.name ? " (Myself)" : ""}<span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>{employee.role}</span></span>
                          </DropdownMenu.CheckboxItem>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                  <style jsx global>{`.team-assignee-option[data-highlighted] { background: #eef8f6; }`}</style>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Select one or more people. Each person receives their own task.</p>
                  {employeeLoadError && (
                    <p role="status" style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>
                      Could not load your team. Return to this tab to retry.
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Due Time
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Priority
                  </label>
                  <select
                    className="form-input"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>

                <div ref={clientDropdownRef} style={{ position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 12, margin: 0 }}>
                      Client / Facility (optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddClientModal(true);
                        setClientSearchOpen(false);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#004d66",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "1px 4px",
                        borderRadius: 4,
                      }}
                    >
                      <Plus size={12} color="#004d66" />
                      <span>Add New Client</span>
                    </button>
                  </div>

                  {/* Search / Select Client Input */}
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search existing facility or type new..."
                      value={newClientName}
                      onFocus={() => setClientSearchOpen(true)}
                      onChange={(e) => {
                        setNewClientName(e.target.value);
                        setSelectedClientId(undefined);
                        setClientSearchOpen(true);
                      }}
                      style={{
                        fontSize: 13,
                        paddingLeft: 32,
                        paddingRight: newClientName ? 30 : 12,
                        height: 38,
                        borderColor: selectedClientId ? "#10b981" : undefined,
                        backgroundColor: selectedClientId ? "#f0fdf4" : undefined,
                      }}
                    />
                    <Building2
                      size={14}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: selectedClientId ? "#059669" : "#94a3b8",
                        pointerEvents: "none",
                      }}
                    />
                    {newClientName && (
                      <button
                        type="button"
                        onClick={handleClearClient}
                        title="Clear client"
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions & Quick Add */}
                  {clientSearchOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        border: "1px solid #e2e8f0",
                        zIndex: 50,
                        maxHeight: 250,
                        overflowY: "auto",
                      }}
                    >
                      {/* Option to create new client if typed name doesn't match an existing facility */}
                      {newClientName.trim() && !hasExactMatch && (
                        <div
                          onClick={() => {
                            setClientSearchOpen(false);
                            setShowAddClientModal(true);
                          }}
                          style={{
                            padding: "9px 12px",
                            backgroundColor: "#f0fdf4",
                            borderBottom: "1px solid #dcfce7",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#15803d",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dcfce7")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
                        >
                          <Plus size={14} color="#15803d" />
                          <div style={{ flex: 1 }}>
                            <span>Add &quot;{newClientName.trim()}&quot; as new client</span>
                            <div style={{ fontSize: 10.5, color: "#166534", fontWeight: 400 }}>
                              Save to company client database
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          backgroundColor: "#f8fafc",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {newClientName.trim() ? "Matching Existing Clients" : "Recent / Registered Facilities"}
                      </div>

                      {matchingClients.map((client) => {
                        const isSelected = selectedClientId === client.id;
                        return (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            style={{
                              padding: "9px 14px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                              borderBottom: "1px solid #f8fafc",
                              transition: "background-color 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "#ffffff";
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                              <Building2 size={15} style={{ color: isSelected ? "#2563eb" : "#64748b", flexShrink: 0 }} />
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: "#0f172a" }}>
                                  {client.name}
                                </div>
                                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                                  {client.state || client.city || "UAE"} · {client.orgType || "Hospital"}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check size={15} color="#2563eb" style={{ flexShrink: 0, marginLeft: 8 }} />}
                          </div>
                        );
                      })}

                      {matchingClients.length === 0 && !newClientName.trim() && (
                        <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
                          No facilities registered yet
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Notes / Description
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Provide details or clinical context..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  backgroundColor: "#fafbfc",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66" }}
                >
                  {creatingTask ? "Assigning…" : "Create & Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD HEALTHCARE CLIENT MODAL (UAE DIRECTORY) ───────────────────── */}
      {showAddClientModal && (
        <ClientModal
          mode="create"
          clientToEdit={newClientName.trim() ? ({ name: newClientName.trim() } as Client) : null}
          onClose={() => setShowAddClientModal(false)}
          onSave={handleSaveClientFromModal}
          zIndex={1000}
        />
      )}

      {/* ─── MANAGE TASK TYPES MODAL ────────────────────────────────────────── */}
      {showManageTypesModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowManageTypesModal(false);
              setEditingTypeKey(null);
            }
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 500,
              width: "100%",
              borderRadius: 16,
              backgroundColor: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Manage Task Types
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                  Options are synced to the database for all team members in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setEditingTypeKey(null);
                }}
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

            {/* Content */}
            <div style={{ padding: "20px 24px", maxHeight: "65vh", overflowY: "auto" }}>
              {/* Add new option bar */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Add New Task Type
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Demonstration, Audit, Delivery..."
                    value={customTypeInput}
                    onChange={(e) => setCustomTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewType();
                      }
                    }}
                    style={{ fontSize: 13, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleAddNewType()}
                    style={{
                      backgroundColor: "#004d66",
                      padding: "0 16px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Add
                  </button>
                </div>
              </div>

              {/* List of existing options */}
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
                Current Options ({taskTypes.length})
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 8,
                  backgroundColor: "#fafbfc",
                }}
              >
                {taskTypes.map((type) => {
                  const isEditing = editingTypeKey === type;
                  const emoji = TYPE_EMOJIS[type] || "📋";

                  return (
                    <div
                      key={type}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 8,
                        backgroundColor: "#ffffff",
                        border: "1px solid #f1f5f9",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 8, flex: 1, alignItems: "center" }}>
                          <span style={{ fontSize: 16 }}>{emoji}</span>
                          <input
                            type="text"
                            className="form-input"
                            value={editingTypeValue}
                            onChange={(e) => setEditingTypeValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleRenameType(type, editingTypeValue);
                              } else if (e.key === "Escape") {
                                setEditingTypeKey(null);
                              }
                            }}
                            style={{ height: 32, fontSize: 13, flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameType(type, editingTypeValue)}
                            style={{
                              backgroundColor: "#004d66",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTypeKey(null)}
                            style={{
                              backgroundColor: "#f1f5f9",
                              color: "#64748b",
                              border: "none",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{emoji}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                              {type}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTypeKey(type);
                                setEditingTypeValue(type);
                              }}
                              title={`Edit / Rename "${type}"`}
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 6,
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                color: "#475569",
                                fontSize: 11.5,
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              <Pencil size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteType(type)}
                              title={`Remove "${type}"`}
                              style={{
                                background: "#fef2f2",
                                border: "1px solid #fee2e2",
                                borderRadius: 6,
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                color: "#dc2626",
                                fontSize: 11.5,
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "flex-end",
                backgroundColor: "#f8fafc",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setEditingTypeKey(null);
                }}
                style={{ backgroundColor: "#004d66", padding: "6px 18px", fontSize: 13 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
