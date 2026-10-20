"use client";
import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import DirectoryPagination from "@/components/DirectoryPagination";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveStoredPeople,
  getStoredPeople,
  updatePerson,
  transferPersonOrganisation,
  addStandalonePerson,
  getStoredClients,
  saveStoredClients,
  deleteStoredClient,
  classifyEntity,
  getStoredDepartments,
  saveStoredDepartments,
  INITIAL_DEPARTMENTS,
  traderCompanyToClient,
  contractOrganisationToClient,
  normalizeOrganisationName,
  syncLiveClientsFromApi,
  getStoredLeads,
} from "@/lib/client-store";
import { getStoredCompanies } from "@/lib/trader-store";
import { apiRequest } from "@/lib/api-client";
import { persistSharedDataset } from "@/lib/shared-data-client";
import { getStatusColor, formatCurrency, getInitials, formatDate } from "@/lib/utils";
import type { Client, OrgType, ClientStatus, ContactPerson, Department, ContactStatus, ClientTimelineEvent, Invoice, EntityType, ProcurementCompany, Product } from "@/types";
import toast from "react-hot-toast";
import FacilityPicker from "@/components/FacilityPicker";
import CustomLightSelect from "@/components/CustomLightSelect";
import OrganisationAvatar from "@/components/OrganisationAvatar";
import ClientProductExpiryTab, { buildCompanyExpiryRecords } from "@/components/ClientProductExpiryTab";
import ClientMaintenanceContractsTab from "@/components/ClientMaintenanceContractsTab";
import TraderCompanyProductsTab, { isTraderCompany, getCompanyProducts } from "@/components/TraderCompanyProductsTab";
import { getStoredServiceTickets } from "@/lib/service-store";
import { getStoredQuotations } from "@/lib/quotations-store";
import { getStoredContracts } from "@/lib/contract-store";
import {
  Search,
  Copy,
  Building2,
  MapPin,
  Activity,
  RotateCcw,
  LayoutGrid,
  List,
  Plus,
  X,
  Eye,
  Pencil,
  User,
  Users,
  Building,
  ArrowUpRight,
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Receipt,
  LayoutDashboard,
  ShoppingBag,
  FileText,
  History,
  DollarSign,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Camera,
  Upload,
  Trash2,
  CalendarDays,
  AlertTriangle,
  ShieldCheck,
  Package,
} from "lucide-react";
import ClientDetailCalendar from "@/components/calendar/ClientDetailCalendar";
import { getCurrentUser, getStoredTasks } from "@/lib/task-store";

type OrganisationTimelineEvent = ClientTimelineEvent & {
  actor?: string;
  category?: "task" | "lead" | "service" | "quotation" | "invoice" | "contract" | "contact" | "purchase" | "requirement" | "expiry" | "organisation";
};

const DEPARTMENTS: Department[] = [
  "Biomedical Engineering",
  "Purchase",
  "Doctor",
  "Administration",
  "Finance",
  "Management",
  "IT",
];

const DEFAULT_ORG_TYPES = [
  "Hospital",
  "Clinic",
  "Medical Equipment Trader",
  "Doctor / Practitioner",
  "Laboratory",
  "Pharmacy",
  "Diagnostic Centre",
  "Day Surgery Centre",
  "Government Institution",
];

const CLIENT_STATUSES: ClientStatus[] = [
  "Lead",
  "Prospect",
  "Existing Customer",
  "Lost Customer",
];

const OPERATIONAL_STATUS_OPTIONS = [
  { value: "All", label: "All Facility Operations" },
  { value: "Running", label: "Running" },
  { value: "Upcoming", label: "Upcoming" },
  { value: "Closed", label: "Closed" },
];

const CONNECTION_TYPES_STORAGE_KEY = "fastonmed_connection_types_v1";
const DEFAULT_CONNECTION_TYPES = ["Sales", "Service", "Trader"];

function getStoredConnectionTypes(): string[] {
  if (typeof window === "undefined") return DEFAULT_CONNECTION_TYPES;
  try {
    const raw = localStorage.getItem(CONNECTION_TYPES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CONNECTION_TYPES_STORAGE_KEY, JSON.stringify(DEFAULT_CONNECTION_TYPES));
      return DEFAULT_CONNECTION_TYPES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CONNECTION_TYPES;
    const migrated = parsed.map((item) =>
      typeof item === "string" && item.trim().toLowerCase() === "merchant" ? "Trader" : item
    );
    const result = Array.from(new Set([...DEFAULT_CONNECTION_TYPES, ...migrated.filter((item) => typeof item === "string" && item.trim())]));
    localStorage.setItem(CONNECTION_TYPES_STORAGE_KEY, JSON.stringify(result));
    return result;
  } catch {
    return DEFAULT_CONNECTION_TYPES;
  }
}

function saveStoredConnectionTypes(types: string[]): string[] {
  const cleaned = Array.from(new Set(types.map((item) => item.trim()).filter(Boolean)));
  if (typeof window !== "undefined") {
    localStorage.setItem(CONNECTION_TYPES_STORAGE_KEY, JSON.stringify(cleaned));
    void persistSharedDataset("connection-types", cleaned).catch(() => {});
  }
  return cleaned;
}

function ClientStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    "Existing Customer": {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
      dot: "#10b981",
    },
    Prospect: {
      bg: "#f5f3ff",
      border: "#ddd6fe",
      text: "#6d28d9",
      dot: "#8b5cf6",
    },
    Lead: {
      bg: "#f0f9ff",
      border: "#bae6fd",
      text: "#0369a1",
      dot: "#0284c7",
    },
    "Lost Customer": {
      bg: "#fff1f2",
      border: "#fecdd3",
      text: "#be123c",
      dot: "#f43f5e",
    },
  };

  const c = configs[status] || {
    bg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    dot: "#94a3b8",
  };

  return (
    <span
      title={`Client Account Tier: ${status}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 20,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        lineHeight: 1.25,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: c.dot,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

function OperationalStatusBadge({ status, prefix = true }: { status?: string; prefix?: boolean }) {
  const current = status || "Running";
  const configs: Record<
    string,
    { label: string; bg: string; border: string; text: string; iconColor: string; tooltip: string }
  > = {
    Running: {
      label: prefix ? "Facility: Operational" : "Operational",
      bg: "#f8fafc",
      border: "#cbd5e1",
      text: "#334155",
      iconColor: "#059669",
      tooltip: "Healthcare facility is open and actively operating",
    },
    Upcoming: {
      label: prefix ? "Facility: Opening Soon" : "Opening Soon",
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1d4ed8",
      iconColor: "#2563eb",
      tooltip: "Facility is under construction or setup",
    },
    Closed: {
      label: prefix ? "Facility: Closed" : "Closed",
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
      iconColor: "#dc2626",
      tooltip: "Facility is closed or non-operational",
    },
  };

  const c = configs[current] || {
    label: prefix ? `Facility: ${current}` : current,
    bg: "#f8fafc",
    border: "#cbd5e1",
    text: "#475569",
    iconColor: "#64748b",
    tooltip: `Facility Status: ${current}`,
  };

  return (
    <span
      title={c.tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: 6,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: 1.25,
      }}
    >
      <Building2 size={11} style={{ color: c.iconColor, flexShrink: 0 }} />
      <span>{c.label}</span>
    </span>
  );
}

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

const PLACE_TO_EMIRATE_MAP: Record<string, string> = {
  // Dubai
  "Dubai Healthcare City (DHCC)": "Dubai",
  "Oud Metha": "Dubai",
  "Dubai Hills Estate": "Dubai",
  "Al Garhoud": "Dubai",
  "Al Barsha": "Dubai",
  "Al Barsha South": "Dubai",
  "Deira": "Dubai",
  "Jumeirah": "Dubai",
  "Business Bay": "Dubai",
  "Downtown Dubai": "Dubai",
  "Bur Dubai": "Dubai",
  "Al Quoz": "Dubai",
  "Dubai Silicon Oasis": "Dubai",
  "Dubai Science Park": "Dubai",
  "Mirdif": "Dubai",
  "Al Karama": "Dubai",
  "City Walk": "Dubai",
  "Al Baraha": "Dubai",
  "Al Mamzar": "Dubai",
  "Umm Suqeim": "Dubai",
  // Abu Dhabi
  "Al Maryah Island": "Abu Dhabi",
  "Mohammed Bin Zayed City": "Abu Dhabi",
  "Al Mafraq": "Abu Dhabi",
  "Khalifa City": "Abu Dhabi",
  "Shakhbout City": "Abu Dhabi",
  "Al Najda St": "Abu Dhabi",
  "Electra St": "Abu Dhabi",
  "Corniche Road": "Abu Dhabi",
  "Muroor Road": "Abu Dhabi",
  "Musaffah": "Abu Dhabi",
  "Baniyas": "Abu Dhabi",
  "Al Jimi": "Abu Dhabi",
  "Tawam": "Abu Dhabi",
  "Zayed Sports City": "Abu Dhabi",
  // Sharjah
  "Al Nahda": "Sharjah",
  "University City": "Sharjah",
  "Al Qasimia": "Sharjah",
  "Al Majaz": "Sharjah",
  "Al Taawun": "Sharjah",
  // Ajman
  "Al Jurf": "Ajman",
  "Al Rashidiya": "Ajman",
  "Al Nuaimia": "Ajman",
  // Ras Al Khaimah
  "Al Qusaidat": "Ras Al Khaimah",
  "Al Nakheel": "Ras Al Khaimah",
  // Fujairah
  "Al Faseel": "Fujairah",
  // Umm Al Quwain
  "Al Salamah": "Umm Al Quwain",
};

const INITIAL_PLACES = [
  ...Object.keys(PLACE_TO_EMIRATE_MAP),
];

function normalizeClient(client: Client): Client {
  const phones = client.phones?.filter(Boolean) || [];
  const emails = client.emails?.filter(Boolean) || [];
  const phone = client.phone || phones[0] || "";
  const email = client.email || emails[0] || "";

  return {
    ...client,
    name: client.name || "Unnamed Facility",
    orgType: (client.orgType || "Hospital") as OrgType,
    status: (client.status || "Lead") as ClientStatus,
    address: client.address || [client.city, client.state].filter(Boolean).join(", "),
    city: client.city || client.place || client.state || "UAE",
    state: client.state || client.emirate || "UAE",
    phone,
    phones: phones.length > 0 ? phones : phone ? [phone] : [],
    email,
    emails: emails.length > 0 ? emails : email ? [email] : [],
    contacts: (client.contacts || []).map((contact) => ({
      ...contact,
      clientId: contact.clientId || client.id,
      clientName: contact.clientName || client.name,
      phone: contact.phone || contact.whatsapp || "",
      email: contact.email || "",
      department: contact.department || "Purchase",
    })),
    purchases: client.purchases || [],
    requirements: client.requirements || [],
    totalRevenue: Number(client.totalRevenue) || 0,
    source: client.source || "Direct Enquiry",
    assignedTo: client.assignedTo || "emp-1",
    createdAt: client.createdAt || new Date().toISOString().slice(0, 10),
    operationalStatus: client.operationalStatus || "Running",
    notes: client.notes || "",
  };
}

function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("id") || searchParams.get("clientId");
  const paramCompanyId = searchParams.get("companyId");
  const paramName = searchParams.get("name");
  const fromSource = searchParams.get("from");

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [directorySection, setDirectorySection] = useState<"organisations" | "people">("organisations");
  const [peoplePage, setPeoplePage] = useState(1);

  const [clients, setClients] = useState<Client[]>([]);
  const [people, setPeople] = useState<ContactPerson[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ContactPerson | null>(null);
  const [transferringPerson, setTransferringPerson] = useState<ContactPerson | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<ClientTimelineEvent[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadLiveClients = async () => {
      setIsLoadingClients(true);
      setClientLoadError(null);
      try {
        const [liveClients, liveInvoices, liveTimelineEvents] = await Promise.all([
          syncLiveClientsFromApi(),
          apiRequest<Invoice[]>("/api/invoices").catch(() => []),
          apiRequest<ClientTimelineEvent[]>("/api/timeline-events").catch(() => []),
        ]);
        setClients(liveClients);
        setPeople(liveClients.flatMap((client) => client.contacts));
        setInvoices(liveInvoices);
        setTimelineEvents(liveTimelineEvents);
      } catch (error) {
        console.warn("API unavailable, loading cached real healthcare directory:", error);
        setClientLoadError("Could not load the live FastonMed database. Showing cached real records only.");
        const stored = getStoredClients();
        setClients(stored);
        setPeople(stored.flatMap((client) => client.contacts));
      } finally {
        setIsLoadingClients(false);
      }
    };

    void loadLiveClients();
    // Store update events are emitted by the live load itself. Refresh the view
    // from the cache here; starting another network load causes a request loop.
    const handleSync = () => {
      const stored = getStoredClients();
      setClients(stored);
      setPeople(stored.flatMap((client) => client.contacts));
    };
    window.addEventListener("fastonmed_clients_updated", handleSync);
    window.addEventListener("fastonmed_companies_updated", handleSync);
    window.addEventListener("fastonmed_contracts_updated", handleSync);
    return () => {
      window.removeEventListener("fastonmed_clients_updated", handleSync);
      window.removeEventListener("fastonmed_companies_updated", handleSync);
      window.removeEventListener("fastonmed_contracts_updated", handleSync);
    };
  }, []);

  // Automatically select and open organisation if passed via URL (e.g. from Trader Company page)
  useEffect(() => {
    if (!paramId && !paramCompanyId && !paramName) return;

    const targetId = (paramId || (paramCompanyId ? `trader-${paramCompanyId}` : "")).trim();
    const targetName = (paramName || "").trim().toLowerCase();

    // 1. Try finding in current clients
    let matched = clients.find((c) => {
      if (targetId && (c.id === targetId || c.id === paramId || c.id === paramCompanyId || c.id === `trader-${paramCompanyId}` || c.id === `trader-${targetId}`)) return true;
      if (targetName && normalizeOrganisationName(c.name) === targetName) return true;
      return false;
    });

    // 2. If not found in clients, check stored trader companies
    if (!matched) {
      const companies = getStoredCompanies();
      const comp = companies.find(
        (co: ProcurementCompany) =>
          (targetId && (co.id === targetId || `trader-${co.id}` === targetId || co.id === paramCompanyId)) ||
          (targetName && normalizeOrganisationName(co.name) === targetName)
      );
      if (comp) {
        matched = traderCompanyToClient(comp);
        setClients((prev) => {
          const updated = [...prev, matched!];
          saveStoredClients(updated);
          return updated;
        });
      }
    }

    // 3. If not found in clients or trader companies, check stored maintenance contracts
    if (!matched) {
      const contracts = getStoredContracts();
      const contract = contracts.find(
        (c) =>
          (targetId && (c.clientId === targetId || `client-amc-${c.id}` === targetId)) ||
          (targetName && normalizeOrganisationName(c.organisation || c.clientName || "") === targetName)
      );
      if (contract) {
        matched = contractOrganisationToClient(contract);
        setClients((prev) => {
          const updated = [...prev, matched!];
          saveStoredClients(updated);
          return updated;
        });
      }
    }

    if (matched) {
      setSelected(matched);
    }
  }, [paramId, paramCompanyId, paramName, clients]);

  const [orgTypes, setOrgTypes] = useState<string[]>(DEFAULT_ORG_TYPES);
  const [places, setPlaces] = useState<string[]>(INITIAL_PLACES);
  const [search, setSearch] = useState("");
  useEffect(() => { setPeoplePage(1); }, [search]);
  const [filterType, setFilterType] = useState(() => searchParams.get("type") || "All");
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get("status") || "All");
  const [filterOperationalStatus, setFilterOperationalStatus] = useState(() => searchParams.get("operationalStatus") || "All");
  const [filterEmirate, setFilterEmirate] = useState(() => searchParams.get("emirate") || searchParams.get("state") || "All");
  const [filterArea, setFilterArea] = useState(() => searchParams.get("area") || "All");
  const [view, setView] = useState<"grid" | "list">("list");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeActionClientId, setActiveActionClientId] = useState<string | null>(null);

  // Available areas computed from predefined areas, custom places, and existing clients
  const availableAreas = useMemo(() => {
    const areaMap = new Map<string, { label: string; emirate: string }>();

    const registerArea = (rawArea: string, fallbackEmirate?: string) => {
      const trimmed = (rawArea || "").trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (lower === "uae") return;
      if (UAE_EMIRATES.some((e) => e.toLowerCase() === lower)) return;

      const matchedEmirate =
        fallbackEmirate ||
        PLACE_TO_EMIRATE_MAP[trimmed] ||
        Object.entries(PLACE_TO_EMIRATE_MAP).find(([k]) => k.toLowerCase() === lower)?.[1] ||
        "Dubai";

      if (!areaMap.has(lower)) {
        areaMap.set(lower, { label: trimmed, emirate: matchedEmirate });
      }
    };

    // 1. Known dictionary of places & emirates
    Object.entries(PLACE_TO_EMIRATE_MAP).forEach(([area, emirate]) => {
      registerArea(area, emirate);
    });

    // 2. Custom places registered in state
    places.forEach((p) => registerArea(p));

    // 3. Live client addresses / places / cities
    clients.forEach((c) => {
      if (c.city) registerArea(c.city, c.state || c.emirate);
      if (c.place) registerArea(c.place, c.state || c.emirate);
    });

    let list = Array.from(areaMap.values());

    // If an Emirate is selected, scope areas to that Emirate
    if (filterEmirate !== "All") {
      list = list.filter((item) => {
        if (item.emirate.toLowerCase() === filterEmirate.toLowerCase()) return true;
        return clients.some(
          (c) =>
            (c.state?.toLowerCase() === filterEmirate.toLowerCase() ||
             c.emirate?.toLowerCase() === filterEmirate.toLowerCase()) &&
            ((c.city && c.city.toLowerCase() === item.label.toLowerCase()) ||
             (c.place && c.place.toLowerCase() === item.label.toLowerCase()))
        );
      });
    }

    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [places, clients, filterEmirate]);

  const areaOptions = useMemo(() => {
    const defaultLabel = filterEmirate !== "All" ? `All ${filterEmirate} Areas` : "All Areas";
    return [
      { value: "All", label: defaultLabel },
      ...availableAreas.map((item) => ({
        value: item.label,
        label: item.label,
        subtext: filterEmirate === "All" ? item.emirate : undefined,
      })),
    ];
  }, [availableAreas, filterEmirate]);

  // Close actions dropdown on click outside or escape key
  useEffect(() => {
    if (!activeActionClientId) return;
    const handleOutsideClick = () => setActiveActionClientId(null);
    window.addEventListener("click", handleOutsideClick);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveActionClientId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionClientId]);

  const handleAddType = (newType: string) => {
    if (!orgTypes.includes(newType)) {
      setOrgTypes((prev) => [...prev, newType]);
    }
  };

  const handleAddPlace = (newPlace: string) => {
    const trimmed = newPlace.trim();
    if (trimmed && !places.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setPlaces((prev) => [trimmed, ...prev]);
    }
  };

  const directoryFilterKey = JSON.stringify([search, filterType, filterStatus, filterEmirate, filterArea, filterOperationalStatus]);
  const [directoryPaging, setDirectoryPaging] = useState({ page: 1, filterKey: "" });
  const directoryPage = directoryPaging.filterKey === directoryFilterKey ? directoryPaging.page : 1;
  const setDirectoryPage = (page: number) => setDirectoryPaging({ page, filterKey: directoryFilterKey });

  const filtered = clients.filter((c) => {
    const classification = classifyEntity(c.name, c.orgType);
    const isUserRecord = c.entityType === "Individual" || classification.entityType === "Individual";
    if (isUserRecord) return false;

    const q = search.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q));
    const matchType = filterType === "All" || c.orgType === filterType;
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    const matchEmirate = filterEmirate === "All" || c.state === filterEmirate || c.emirate === filterEmirate;
    const matchArea =
      filterArea === "All" ||
      (c.city && c.city.toLowerCase() === filterArea.toLowerCase()) ||
      (c.place && c.place.toLowerCase() === filterArea.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(filterArea.toLowerCase())) ||
      (c.tags && c.tags.some((t) => t.toLowerCase() === filterArea.toLowerCase()));
    const matchOperationalStatus =
      filterOperationalStatus === "All" ||
      (c.operationalStatus || "Running").toLowerCase() === filterOperationalStatus.toLowerCase();
    return matchSearch && matchType && matchStatus && matchEmirate && matchArea && matchOperationalStatus;
  });
  const visiblePage = Math.min(directoryPage, Math.max(1, Math.ceil(filtered.length / 20)));
  const paginated = filtered.slice((visiblePage - 1) * 20, visiblePage * 20);


  const orgEmoji: Record<string, string> = {
    Hospital: "🏥",
    Clinic: "🏢",
    Laboratory: "🔬",
    Pharmacy: "💊",
    "Diagnostic Centre": "🩺",
    "Government Institution": "🏛️",
    "Medical Equipment Trader": "📦",
    "Doctor / Practitioner": "👨‍⚕️",
    "Individual Contact": "👤",
    "Day Surgery Centre": "🏥",
  };

  const handleCreateClient = async (data: Partial<Client> & { repName?: string; repRole?: string; repPhone?: string; repEmail?: string }) => {
    const creator = getCurrentUser();
    const primaryPhone = data.phones && data.phones.length > 0 ? data.phones[0] : data.phone || "";
    const primaryEmail = data.emails && data.emails.length > 0 ? data.emails[0] : data.email || "";
    const clientId = `c-${Date.now()}`;

    const initialContacts: ContactPerson[] =
      data.contacts && data.contacts.length > 0
        ? data.contacts
        : data.repName?.trim()
        ? [
            {
              id: `ct-${Date.now()}`,
              clientId,
              name: data.repName.trim(),
              designation: data.repRole?.trim() || "Procurement / Biomedical Lead",
              department: "Purchase",
              phone: data.repPhone?.trim() || primaryPhone,
              whatsapp: data.repPhone?.trim() || primaryPhone,
              email: data.repEmail?.trim() || primaryEmail,
              lastContacted: new Date().toISOString().slice(0, 10),
              createdAt: new Date().toISOString(),
              createdBy: creator?.name || "User not recorded",
              createdById: creator?.id,
            },
          ]
        : [];

    const newClient: Client = {
      id: clientId,
      name: data.name || "New Healthcare Facility",
      photo: data.photo || data.logo || undefined,
      logo: data.logo || data.photo || undefined,
      orgType: (data.orgType || "Hospital") as OrgType,
      status: (data.status || "Lead") as ClientStatus,
      address: data.address || `${data.city}, ${data.state}`,
      city: data.city || "Dubai Healthcare City (DHCC)",
      state: data.state || "Dubai",
      pincode: "00000",
      phone: primaryPhone,
      phones: data.phones?.filter(Boolean) || (primaryPhone ? [primaryPhone] : []),
      email: primaryEmail,
      emails: data.emails?.filter(Boolean) || (primaryEmail ? [primaryEmail] : []),
      gst: data.gst || "",
      vatNumber: data.gst || "",
      source: data.source || "Direct Enquiry",
      connectedAs: data.connectedAs || [],
      assignedTo: "emp-1",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: creator?.name || "User not recorded",
      createdById: creator?.id,
      totalRevenue: 0,
      contacts: initialContacts,
      purchases: [],
      requirements: [],
      tags: [data.orgType || "Hospital", data.state || "Dubai"],
      googleMapsUrl:
        data.googleMapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${data.name || ""} ${data.city || ""} ${data.state || ""} UAE`
        )}`,
      place: data.city || "Dubai Healthcare City (DHCC)",
      emirate: data.state || "Dubai",
      operationalStatus: data.operationalStatus || "Running",
      notes: data.notes || "",
    };

    let clientToSave = newClient;
    try {
      const createdClient = normalizeClient(
        await apiRequest<Client>("/api/clients", {
          method: "POST",
          body: JSON.stringify(newClient),
        })
      );
      clientToSave = createdClient;
    } catch (error) {
      console.warn("API server save unavailable, saving locally in CRM registry:", error);
    }

    const updatedList = [clientToSave, ...clients];
    setClients(updatedList);
    saveStoredClients(updatedList);
    if (clientToSave.city) {
      handleAddPlace(clientToSave.city);
    }
    toast.success(`Client "${clientToSave.name}" created successfully!`);
    setShowAddModal(false);
  };

  const handleUpdateClient = async (data: Partial<Client> & { repName?: string; repRole?: string; repPhone?: string; repEmail?: string }) => {
    if (!editingClient) return;
    const editor = getCurrentUser();

    const primaryPhone = data.phones && data.phones.length > 0 ? data.phones[0] : data.phone || editingClient.phone;
    const primaryEmail = data.emails && data.emails.length > 0 ? data.emails[0] : data.email || editingClient.email;

    // Update contacts: prioritize data.contacts, or update primary contact
    let updatedContacts = [...editingClient.contacts];
    if (data.contacts && data.contacts.length > 0) {
      const existingContactIds = new Set(editingClient.contacts.map((contact) => contact.id));
      updatedContacts = data.contacts.map((contact) =>
        existingContactIds.has(contact.id)
          ? contact
          : {
              ...contact,
              createdAt: contact.createdAt || new Date().toISOString(),
              createdBy: contact.createdBy || editor?.name || "User not recorded",
              createdById: contact.createdById || editor?.id,
            }
      );
    } else if (data.repName?.trim()) {
      if (updatedContacts.length > 0) {
        updatedContacts[0] = {
          ...updatedContacts[0],
          name: data.repName.trim(),
          designation: data.repRole?.trim() || updatedContacts[0].designation,
          phone: data.repPhone?.trim() || updatedContacts[0].phone,
          whatsapp: data.repPhone?.trim() || updatedContacts[0].whatsapp,
          email: data.repEmail?.trim() || updatedContacts[0].email,
        };
      } else {
        updatedContacts.push({
          id: `ct-${Date.now()}`,
          clientId: editingClient.id,
          name: data.repName.trim(),
          designation: data.repRole?.trim() || "Procurement / Biomedical Lead",
          department: "Purchase",
          phone: data.repPhone?.trim() || primaryPhone,
          whatsapp: data.repPhone?.trim() || primaryPhone,
          email: data.repEmail?.trim() || primaryEmail,
          lastContacted: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          createdBy: editor?.name || "User not recorded",
          createdById: editor?.id,
        });
      }
    }

    const updatedClient: Client = {
      ...editingClient,
      name: data.name || editingClient.name,
      photo: data.photo !== undefined ? data.photo : (editingClient.photo || editingClient.logo),
      logo: data.logo !== undefined ? data.logo : (editingClient.logo || editingClient.photo),
      orgType: (data.orgType || editingClient.orgType) as OrgType,
      status: (data.status || editingClient.status) as ClientStatus,
      operationalStatus: data.operationalStatus || editingClient.operationalStatus || "Running",
      notes: data.notes !== undefined ? data.notes : (editingClient.notes || ""),
      address: data.address || editingClient.address,
      city: data.city || editingClient.city,
      state: data.state || editingClient.state,
      place: data.city || editingClient.city,
      emirate: data.state || editingClient.state,
      phone: primaryPhone,
      phones: data.phones?.filter(Boolean) || editingClient.phones || [primaryPhone],
      email: primaryEmail,
      emails: data.emails?.filter(Boolean) || editingClient.emails || [primaryEmail],
      gst: data.gst !== undefined ? data.gst : editingClient.gst,
      vatNumber: data.gst !== undefined ? data.gst : (editingClient.vatNumber || editingClient.gst),
      source: data.source || editingClient.source,
      connectedAs: data.connectedAs || editingClient.connectedAs || [],
      googleMapsUrl:
        data.googleMapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${data.name || editingClient.name} ${data.city || editingClient.city} ${data.state || editingClient.state} UAE`
        )}`,
      contacts: updatedContacts,
      updatedAt: new Date().toISOString(),
      updatedBy: editor?.name || "User not recorded",
      updatedById: editor?.id,
    };

    let clientToSave = updatedClient;
    try {
      const savedClient = normalizeClient(
        await apiRequest<Client>(`/api/clients/${updatedClient.id}`, {
          method: "PUT",
          body: JSON.stringify(updatedClient),
        })
      );
      clientToSave = savedClient;
    } catch (error) {
      console.warn("API server update unavailable, updating locally in CRM registry:", error);
    }

    const updatedClients = clients.map((c) => (c.id === clientToSave.id ? clientToSave : c));
    setClients(updatedClients);
    saveStoredClients(updatedClients);
    if (selected?.id === clientToSave.id) {
      setSelected(clientToSave);
    }
    if (clientToSave.city) {
      handleAddPlace(clientToSave.city);
    }
    toast.success(`Client "${clientToSave.name}" updated successfully!`);
    setEditingClient(null);
  };

  if (selected) {
    return (
      <>
        <ClientProfile
          client={selected}
          onBack={() => {
            if (fromSource === "companies") {
              router.push("/companies");
            } else {
              setSelected(null);
              setActiveTab("overview");
              if (paramId || paramCompanyId || paramName) {
                router.replace("/clients");
              }
            }
          }}
          backLabel={fromSource === "companies" ? "Back to Trader Companies" : "Back to Clients"}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onEdit={(clientToEdit) => setEditingClient(clientToEdit)}
          onDelete={(clientToDelete) => setDeletingClient(clientToDelete)}
          onEditPerson={(personToEdit) => setEditingPerson(personToEdit)}
          onTransferPerson={(personToTransfer) => setTransferringPerson(personToTransfer)}
          onSaveNotes={async (newNotes) => {
            const updated = { ...selected, notes: newNotes };
            await handleUpdateClient(updated);
          }}
          invoices={invoices}
          timelineEvents={timelineEvents}
        />

        {/* Edit Client Modal when in Profile View */}
        {editingClient && (
          <ClientModal
            mode="edit"
            clientToEdit={editingClient}
            onClose={() => setEditingClient(null)}
            orgTypes={orgTypes}
            onAddType={handleAddType}
            places={places}
            onAddPlace={handleAddPlace}
            onSave={handleUpdateClient}
          />
        )}

        {/* Transfer Person Modal inside Profile View */}
        {transferringPerson && (
          <TransferPersonModal
            person={transferringPerson}
            clients={clients}
            onClose={() => setTransferringPerson(null)}
            onTransfer={(targetClientId, newRole, notes) => {
              transferPersonOrganisation(transferringPerson.id, targetClientId, newRole, notes);
              toast.success(`Updated organization status for ${transferringPerson.name}`);
              setTransferringPerson(null);
              const updatedClient = clients.find((c) => c.id === selected.id);
              if (updatedClient) setSelected(updatedClient);
            }}
          />
        )}

        {/* Edit Person Modal inside Profile View */}
        {editingPerson && (
          <EditPersonModal
            person={editingPerson}
            onClose={() => setEditingPerson(null)}
            onSave={(updated) => {
              updatePerson(updated);
              toast.success(`Contact details updated for ${updated.name}`);
              setEditingPerson(null);
              const updatedClient = clients.find((c) => c.id === selected.id);
              if (updatedClient) setSelected(updatedClient);
            }}
          />
        )}

        {/* Delete Client Confirmation Modal in Profile View */}
        {deletingClient && (
          <DeleteClientModal
            client={deletingClient}
            onClose={() => setDeletingClient(null)}
            onConfirm={(clientToDelete) => {
              deleteStoredClient(clientToDelete.id);
              setClients(getStoredClients());
              setSelected(null);
              toast.success(`"${clientToDelete.name}" deleted successfully!`);
              setDeletingClient(null);
            }}
          />
        )}
      </>
    );
  }

  const isFiltered = Boolean(
    search.trim() ||
    filterType !== "All" ||
    filterEmirate !== "All" ||
    filterArea !== "All" ||
    filterStatus !== "All" ||
    filterOperationalStatus !== "All"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease" }}>
      <div className="directory-section-switch" aria-label="Directory section">
        <button type="button" aria-pressed={directorySection === "organisations"} onClick={() => setDirectorySection("organisations")}><Building2 size={17} />Organisations</button>
        <button type="button" aria-pressed={directorySection === "people"} onClick={() => setDirectorySection("people")}><Users size={17} />People</button>
      </div>
      {directorySection === "people" ? (
        <section className="directory-people">
          <div className="directory-toolbar directory-people-controls">
          <div className="directory-people-search directory-shared-search"><Search size={17} /><input aria-label="Search people" placeholder="Search people, role or organisation…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</div>
          <div className="directory-people-toolbar"><p className="directory-people-count">{people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).length} contacts</p><button type="button" className="btn btn-primary" onClick={() => setShowAddPerson(true)}><Plus size={16}/>Add Person</button></div>
          </div>
          {people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).slice((Math.min(peoplePage, Math.max(1, Math.ceil(people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).length / 20))) - 1) * 20, Math.min(peoplePage, Math.max(1, Math.ceil(people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).length / 20))) * 20).map(person => (
            <article key={person.id} className="directory-person" role="button" tabIndex={0}
              aria-label={`View ${person.name}'s profile`}
              onClick={() => router.push(`/people?person=${encodeURIComponent(person.id)}`)}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); router.push(`/people?person=${encodeURIComponent(person.id)}`); } }}>
              <div className="directory-person-avatar">{person.name?.slice(0, 1)}</div>
              <div><strong>{person.name}</strong><p>{[person.designation, person.clientName].filter(Boolean).join(" · ")}</p><div className="directory-person-links" onClick={event => event.stopPropagation()}>{person.phone && <a href={`tel:${person.phone}`} aria-label={`Call ${person.name}`}><Phone size={16} />Call</a>}{person.email && <a href={`mailto:${person.email}`} aria-label={`Email ${person.name}`}><Mail size={16} />Email</a>}<button type="button" onClick={() => { const organisation = clients.find(c => c.id === person.clientId || c.contacts.some(contact => contact.id === person.id)); if (organisation) { setSelected(organisation); setActiveTab("contacts"); document.querySelector(".crm-main")?.scrollTo({top:0}); } }}>View organisation <ArrowUpRight size={14} /></button></div></div>
            </article>
          ))}
          <DirectoryPagination total={people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).length} page={Math.min(peoplePage, Math.max(1, Math.ceil(people.filter(person => [person.name, person.clientName, person.designation].some(value => value?.toLowerCase().includes(search.toLowerCase()))).length / 20)))} onChange={page => {setPeoplePage(page);document.querySelector(".crm-main")?.scrollTo({top:0,behavior:"smooth"});}} />
          {people.length === 0 && <p>No contacts saved yet.</p>}
        </section>
      ) : <>
      {/* Modern Filter Toolbar */}
      <div
        className={`card clients-toolbar directory-toolbar ${mobileFiltersOpen ? "mobile-filters-open" : ""}`}
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        {/* Left: Search & Filter Chips */}
        <div className="clients-filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: "1 1 auto", minWidth: 0 }}>
          {/* Search Box */}
          <div className="clients-search directory-shared-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "0 10px",
              height: 36,
              flex: "1 1 230px",
              maxWidth: 320,
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <Search size={15} style={{ color: "#94a3b8", flexShrink: 0 }} />
            <input
              placeholder="Search hospital, clinic, city, TRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                fontSize: 13,
                width: "100%",
                background: "transparent",
                color: "#0f172a",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="directory-filter-field"><span>Organisation type</span>
          <CustomLightSelect
            value={filterType}
            options={[{ value: "All", label: "All Types" }, ...orgTypes.map((t) => ({ value: t, label: t }))]}
            onChange={setFilterType}
            icon={<Building2 size={13} style={{ color: filterType !== "All" ? "#004d66" : "#64748b" }} />}
            activeColor={filterType !== "All"}
            style={{ width: "auto", minWidth: 140 }}
            menuStyle={{ minWidth: 190 }}
          />
          </div>

          {/* Emirate Filter */}
          <div className="directory-filter-field"><span>Emirate</span>
          <CustomLightSelect
            value={filterEmirate}
            options={[{ value: "All", label: "All 7 Emirates" }, ...UAE_EMIRATES.map((em) => ({ value: em, label: em }))]}
            onChange={(val) => {
              setFilterEmirate(val);
              if (val !== "All" && filterArea !== "All") {
                const areaEmirate = PLACE_TO_EMIRATE_MAP[filterArea];
                if (areaEmirate && areaEmirate.toLowerCase() !== val.toLowerCase()) {
                  setFilterArea("All");
                }
              }
            }}
            icon={<MapPin size={13} style={{ color: filterEmirate !== "All" ? "#004d66" : "#64748b" }} />}
            activeColor={filterEmirate !== "All"}
            style={{ width: "auto", minWidth: 155 }}
            menuStyle={{ minWidth: 180 }}
          />
          </div>

          {/* Area / District Filter */}
          <div className="directory-filter-field"><span>Area / district</span>
          <CustomLightSelect
            value={filterArea}
            options={areaOptions}
            onChange={setFilterArea}
            icon={<MapPin size={13} style={{ color: filterArea !== "All" ? "#004d66" : "#64748b" }} />}
            activeColor={filterArea !== "All"}
            placeholder="All Areas"
            style={{ width: "auto", minWidth: 150 }}
            menuStyle={{ minWidth: 210, maxHeight: 320 }}
          />
          </div>

          {/* Status Filter */}
          <div className="directory-filter-field"><span>Customer status</span>
          <CustomLightSelect
            value={filterStatus}
            options={[{ value: "All", label: "All Client Statuses" }, ...CLIENT_STATUSES.map((s) => ({ value: s, label: s }))]}
            onChange={setFilterStatus}
            icon={<Activity size={13} style={{ color: filterStatus !== "All" ? "#004d66" : "#64748b" }} />}
            activeColor={filterStatus !== "All"}
            style={{ width: "auto", minWidth: 170 }}
            menuStyle={{ minWidth: 195 }}
          />
          </div>

          {/* Operational Status Filter */}
          <div className="directory-filter-field"><span>Operational status</span>
          <CustomLightSelect
            value={filterOperationalStatus}
            options={OPERATIONAL_STATUS_OPTIONS}
            onChange={setFilterOperationalStatus}
            icon={<Building2 size={13} style={{ color: filterOperationalStatus !== "All" ? "#004d66" : "#64748b" }} />}
            activeColor={filterOperationalStatus !== "All"}
            placeholder="All Operations"
            style={{ width: "auto", minWidth: 175 }}
            menuStyle={{ minWidth: 195 }}
          />
          </div>

          {/* Reset Filters Action */}
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterType("All");
                setFilterEmirate("All");
                setFilterArea("All");
                setFilterStatus("All");
                setFilterOperationalStatus("All");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                height: 36,
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f1f5f9",
                color: "#475569",
                cursor: "pointer",
              }}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        <button className="client-mobile-filter-toggle" type="button" aria-expanded={mobileFiltersOpen} onClick={() => setMobileFiltersOpen(value => !value)}>{mobileFiltersOpen ? "Hide filters" : "Filters"}</button>
        {/* Right: Count Badge, View Switcher & Action */}
        <div className="clients-toolbar-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* Facility Count Badge */}
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: "5px 9px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontWeight: 700, color: "#004d66" }}>{filtered.length}</span>
            <span style={{ color: "#cbd5e1" }}>/</span>
            <span>{clients.length} Facilities</span>
          </div>

          {/* Segmented View Switcher */}
          <div style={{ display: "inline-flex", background: "#f1f5f9", padding: 3, borderRadius: 8, gap: 2 }}>
            <button
              type="button"
              onClick={() => setView("list")}
              title="List View"
              style={{
                border: "none",
                background: view === "list" ? "#ffffff" : "transparent",
                color: view === "list" ? "#004d66" : "#64748b",
                padding: "4px 8px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: view === "list" ? 700 : 500,
                boxShadow: view === "list" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <List size={14} />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              title="Grid View"
              style={{
                border: "none",
                background: view === "grid" ? "#ffffff" : "transparent",
                color: view === "grid" ? "#004d66" : "#64748b",
                padding: "4px 8px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: view === "grid" ? 700 : 500,
                boxShadow: view === "grid" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <LayoutGrid size={14} />
              <span>Grid</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="btn btn-primary"
            style={{
              backgroundColor: "#004d66",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 13px",
              height: 36,
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0, 77, 102, 0.2)",
            }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={15} />
            <span>Add Facility</span>
          </button>
        </div>
      </div>

      {clientLoadError && (
        <div
          className="card"
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {clientLoadError}
        </div>
      )}


      {/* List / Table View */}
      {view === "list" ? (
        <div className="card" style={{ padding: 0, overflow: "visible", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff" }}>
          <div className="table-container clients-facility-container" style={{ border: "none", overflowX: "auto", minHeight: filtered.length <= 4 ? 260 : undefined }}>
            <table className="clients-facility-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Organisation</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Type</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Location</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    <div>Status</div>
                    <div style={{ fontSize: 9.5, fontWeight: 500, color: "#94a3b8", textTransform: "none", letterSpacing: 0, marginTop: 1 }}>
                      Client &amp; Facility
                    </div>
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Contacts</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Revenue</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Connected</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((client, rowIdx) => {
                  const locationText = client.city === client.state ? client.city : `${client.city}, ${client.state}`;
                  return (
                    <tr
                      key={client.id}
                      onClick={() => { setSelected(client); document.querySelector(".crm-main")?.scrollTo({ top: 0, behavior: "auto" }); }}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.12s ease",
                      }}
                      className="hover:bg-slate-50"
                    >
                      {/* Organisation */}
                      <td data-label="Organisation" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <OrganisationAvatar
                            name={client.name}
                            photo={client.photo}
                            logo={client.logo}
                            size={32}
                            isIndividual={client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual"}
                          />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button type="button" className="client-open-button" onClick={e => { e.stopPropagation(); setSelected(client); document.querySelector(".crm-main")?.scrollTo({ top: 0, behavior: "auto" }); }} style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", lineHeight: 1.35 }}>
                                {client.name}
                              </button>
                              {(client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual") && (
                                <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                                  USER
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.2, marginTop: 1 }}>
                              {client.email || client.phone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td data-label="Type" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                          {client.orgType === "Medical Equipment Trader"
                            ? "Equipment Trader"
                            : (client.orgType || "Hospital")}
                        </span>
                      </td>

                      {/* Location (Clean, no redundancy) */}
                      <td data-label="Location" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 12, color: "#334155" }}>
                          {locationText}
                        </span>
                      </td>

                      {/* Status */}
                      <td data-label="Status" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <ClientStatusBadge status={client.status} />
                          <OperationalStatusBadge status={client.operationalStatus} />
                        </div>
                      </td>

                      {/* Contacts */}
                      <td data-label="Contacts" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {client.contacts.slice(0, 3).map((c, i) => (
                            <div
                              key={c.id}
                              title={`${c.name} (${c.designation})`}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: `hsl(${i * 60 + 200}, 65%, 45%)`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: 9.5,
                                fontWeight: 700,
                                border: "1.5px solid white",
                                marginLeft: i > 0 ? -6 : 0,
                                overflow: "hidden",
                              }}
                            >
                              {c.photo || c.avatar ? (
                                <img
                                  src={c.photo || c.avatar}
                                  alt={c.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                getInitials(c.name)
                              )}
                            </div>
                          ))}
                          {client.contacts.length > 3 && (
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "#e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#64748b",
                                fontSize: 8.5,
                                fontWeight: 700,
                                marginLeft: -6,
                                border: "1.5px solid white",
                              }}
                            >
                              +{client.contacts.length - 3}
                            </div>
                          )}
                          {client.contacts.length === 0 && (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Revenue */}
                      <td data-label="Revenue" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        {client.totalRevenue > 0 ? (
                          <span style={{ fontWeight: 600, color: "#059669", fontSize: 12.5 }}>
                            {formatCurrency(client.totalRevenue)}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Connected */}
                      <td data-label="Connected as" style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        {client.connectedAs && client.connectedAs.length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {client.connectedAs.map((item) => (
                              <span
                                key={item}
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: "#004d66",
                                  background: "#ecfeff",
                                  border: "1px solid #a5f3fc",
                                  borderRadius: 5,
                                  padding: "2px 6px",
                                }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>-</span>
                        )}
                      </td>

                      {/* Actions: Action Dropdown */}
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          verticalAlign: "middle",
                          whiteSpace: "nowrap",
                          position: "relative",
                          zIndex: activeActionClientId === client.id ? 40 : 1,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionClientId(
                                activeActionClientId === client.id ? null : client.id
                              );
                            }}
                            title="Actions"
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: activeActionClientId === client.id ? "1px solid #004d66" : "1px solid #cbd5e1",
                              backgroundColor: activeActionClientId === client.id ? "#f0fdfa" : "#ffffff",
                              color: activeActionClientId === client.id ? "#004d66" : "#334155",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                            onMouseEnter={(e) => {
                              if (activeActionClientId !== client.id) {
                                e.currentTarget.style.borderColor = "#94a3b8";
                                e.currentTarget.style.backgroundColor = "#f8fafc";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (activeActionClientId !== client.id) {
                                e.currentTarget.style.borderColor = "#cbd5e1";
                                e.currentTarget.style.backgroundColor = "#ffffff";
                              }
                            }}
                          >
                            <span>Action</span>
                            <ChevronDown
                              size={12}
                              style={{
                                transform: activeActionClientId === client.id ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>

                          {activeActionClientId === client.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                ...(rowIdx >= paginated.length - 2 && paginated.length > 2
                                  ? { bottom: "calc(100% + 4px)" }
                                  : { top: "calc(100% + 4px)" }),
                                zIndex: 100,
                                backgroundColor: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: 8,
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.14), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
                                minWidth: 155,
                                padding: "4px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(client);
                                  setActiveActionClientId(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: "transparent",
                                  color: "#0f172a",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "background-color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdfa")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <Eye size={13.5} color="#004d66" />
                                <span>View Details</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingClient(client);
                                  setActiveActionClientId(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: "transparent",
                                  color: "#0f172a",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "background-color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <Pencil size={13} color="#475569" />
                                <span>Edit Client</span>
                              </button>

                              <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingClient(client);
                                  setActiveActionClientId(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: "transparent",
                                  color: "#dc2626",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "background-color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <Trash2 size={13} color="#dc2626" />
                                <span>Delete Client</span>
                              </button>
                            </div>
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
      ) : (
        <div data-mobile-grid="stack" className="clients-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
          {paginated.map((client) => (
            <div
              key={client.id}
              className="card"
              style={{ padding: 20, cursor: "pointer" }}
              onClick={() => { setSelected(client); document.querySelector(".crm-main")?.scrollTo({ top: 0, behavior: "auto" }); }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <OrganisationAvatar
                  name={client.name}
                  photo={client.photo}
                  logo={client.logo}
                  size={46}
                  isIndividual={client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual"}
                  style={{ borderRadius: 12 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{client.name}</span>
                    {(client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual") && (
                      <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        USER
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{client.city}, {client.state}</span>
                    {client.googleMapsUrl && <span title="Google Maps Available">📍</span>}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <ClientStatusBadge status={client.status} />
                    <OperationalStatusBadge status={client.operationalStatus} />
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      • {client.orgType === "Medical Equipment Trader" ? "Equipment Trader" : client.orgType}
                    </span>
                  </div>
                  {client.connectedAs && client.connectedAs.length > 0 && (
                    <div style={{ marginTop: 7, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {client.connectedAs.map((item) => (
                        <span
                          key={item}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "#004d66",
                            background: "#ecfeff",
                            border: "1px solid #a5f3fc",
                            borderRadius: 5,
                            padding: "2px 6px",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{client.contacts.length} contacts</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "3px 8px", fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClient(client);
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "3px 8px", fontSize: 11, color: "#ef4444", borderColor: "#fecaca" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingClient(client);
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <span style={{ fontWeight: 600, color: "#059669" }}>{formatCurrency(client.totalRevenue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DirectoryPagination total={filtered.length} page={visiblePage} onChange={setDirectoryPage} />

      {/* Add Client Modal */}
      </>}
      {showAddPerson && <AddPersonModal clients={clients} onClose={() => setShowAddPerson(false)} onSave={person => { addStandalonePerson(person); setPeople(getStoredPeople()); setClients(getStoredClients()); setShowAddPerson(false); toast.success("Person added successfully"); }} />}
      {showAddModal && (
        <ClientModal
          mode="create"
          onClose={() => setShowAddModal(false)}
          orgTypes={orgTypes}
          onAddType={handleAddType}
          places={places}
          onAddPlace={handleAddPlace}
          onSave={handleCreateClient}
        />
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <ClientModal
          mode="edit"
          clientToEdit={editingClient}
          onClose={() => setEditingClient(null)}
          orgTypes={orgTypes}
          onAddType={handleAddType}
          places={places}
          onAddPlace={handleAddPlace}
          onSave={handleUpdateClient}
        />
      )}

      {/* Delete Client Confirmation Modal */}
      {deletingClient && (
        <DeleteClientModal
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onConfirm={(clientToDelete) => {
            deleteStoredClient(clientToDelete.id);
            setClients(getStoredClients());
            toast.success(`"${clientToDelete.name}" deleted successfully!`);
            setDeletingClient(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteClientModal({
  client,
  onClose,
  onConfirm,
}: {
  client: Client;
  onClose: () => void;
  onConfirm: (c: Client) => void;
}) {
  const emojiMap: Record<string, string> = {
    Hospital: "🏥",
    Clinic: "🏢",
    Laboratory: "🔬",
    Pharmacy: "💊",
    "Diagnostic Centre": "🩺",
    "Government Institution": "🏛️",
    "Medical Equipment Trader": "📦",
    "Doctor / Practitioner": "👨‍⚕️",
    "Individual Contact": "👤",
    "Day Surgery Centre": "🏥",
  };

  return (
    <div className="organisation-delete-overlay" data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card organisation-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="organisation-delete-title"
        style={{
          maxWidth: 440,
          width: "100%",
          padding: 24,
          borderRadius: 14,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          backgroundColor: "#ffffff",
          border: "1px solid #fee2e2",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: "#fef2f2",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "1px solid #fecaca",
            }}
          >
            <Trash2 size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 id="organisation-delete-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Delete Organisation
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
              This will remove the organisation below from your directory.
            </p>

            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>
                {emojiMap[client.orgType] || "🏢"}
              </span>
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {client.name}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                  {client.orgType} · {client.city}, {client.state}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ fontSize: 12.5 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onConfirm(client)}
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Loading organisations...</div>}>
      <ClientsContent />
    </Suspense>
  );
}

// ─── CLIENT FORM MODAL (CREATE & EDIT MODES) ────────────────────────────────

function ClientModal({
  mode = "create",
  clientToEdit,
  onClose,
  onSave,
  orgTypes,
  onAddType,
  places,
  onAddPlace,
}: {
  mode?: "create" | "edit";
  clientToEdit?: Client | null;
  onClose: () => void;
  onSave: (d: Partial<Client> & { repName?: string; repRole?: string; repPhone?: string; repEmail?: string }) => void | Promise<void>;
  orgTypes: string[];
  onAddType: (newType: string) => void;
  places: string[];
  onAddPlace: (newPlace: string) => void;
}) {
  const isEdit = mode === "edit" && !!clientToEdit;

  const initialOrgPhones = clientToEdit?.phones || (clientToEdit?.phone ? [clientToEdit.phone] : []);
  const initialOrgEmails = clientToEdit?.emails || (clientToEdit?.email ? [clientToEdit.email] : []);

  const [form, setForm] = useState({
    name: clientToEdit?.name || "",
    phone: initialOrgPhones[0] || "",
    email: initialOrgEmails[0] || "",
    orgType: (clientToEdit?.orgType || "Hospital") as OrgType,
    status: (clientToEdit?.status || "Lead") as ClientStatus,
    operationalStatus: (clientToEdit?.operationalStatus || "Running") as "Running" | "Closed" | "Upcoming",
    notes: clientToEdit?.notes || "",
    city: clientToEdit?.city || "", // Place / District
    state: clientToEdit?.state || "Dubai", // Emirate
    address: clientToEdit?.address || "",
    gst: clientToEdit?.vatNumber || clientToEdit?.gst || "", // VAT / TRN Number
    googleMapsUrl: clientToEdit?.googleMapsUrl || "",
    source: (clientToEdit?.source || "Direct Enquiry") as import("@/types").LeadSource,
    connectedAs: clientToEdit?.connectedAs || [],
  });
  const [extraPhone, setExtraPhone] = useState(initialOrgPhones[1] || "");
  const [showExtraPhone, setShowExtraPhone] = useState(Boolean(initialOrgPhones[1]));
  const [extraEmail, setExtraEmail] = useState(initialOrgEmails[1] || "");
  const [showExtraEmail, setShowExtraEmail] = useState(Boolean(initialOrgEmails[1]));
  const [connectionTypes, setConnectionTypes] = useState<string[]>(() => getStoredConnectionTypes());
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState(false);
  const [isAddingConnectionType, setIsAddingConnectionType] = useState(false);
  const [newConnectionType, setNewConnectionType] = useState("");
  const connectionDropdownRef = useRef<HTMLDivElement>(null);

  // Organisation Photo / Logo state & handler
  const [photo, setPhoto] = useState<string>(
    clientToEdit?.photo || clientToEdit?.logo || ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, SVG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhoto(result);
      toast.success("Organisation photo updated");
    };
    reader.readAsDataURL(file);
  };

  // Unified Contact Persons (Person Name, Role, Phone, Email combined together)
  type PersonContact = {
    id: string;
    name: string;
    designation: string;
    phone: string;
    email: string;
  };

  const [contacts, setContacts] = useState<PersonContact[]>(() => {
    if (clientToEdit?.contacts && clientToEdit.contacts.length > 0) {
      return clientToEdit.contacts.map((c) => ({
        id: c.id,
        name: c.name || "",
        designation: c.designation || "",
        phone: c.phone || c.whatsapp || "",
        email: c.email || "",
      }));
    }
    const initialPhones = clientToEdit?.phones || (clientToEdit?.phone ? [clientToEdit.phone] : []);
    const initialEmails = clientToEdit?.emails || (clientToEdit?.email ? [clientToEdit.email] : []);
    return [
      {
        id: "c-1",
        name: "",
        designation: "",
        phone: initialPhones[0] || "",
        email: initialEmails[0] || "",
      },
    ];
  });

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}-${prev.length + 1}`,
        name: "",
        designation: "",
        phone: "",
        email: "",
      },
    ]);
  };

  const handleUpdateContact = (index: number, field: keyof PersonContact, val: string) => {
    setContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length <= 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Type inline toggle
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  // Add Place / Area inline toggle
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");

  // Place suggestions & auto-emirate mapping
  const placeToEmirateMap = PLACE_TO_EMIRATE_MAP;

  const [isPlaceDropdownOpen, setIsPlaceDropdownOpen] = useState(false);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(e.target as Node)) {
        setIsPlaceDropdownOpen(false);
      }
      if (connectionDropdownRef.current && !connectionDropdownRef.current.contains(e.target as Node)) {
        setIsConnectionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePlaceChange = (value: string) => {
    setForm((prev) => {
      const updated = { ...prev, city: value };
      const matched = Object.keys(placeToEmirateMap).find(
        (p) => p.toLowerCase() === value.trim().toLowerCase()
      );
      if (matched) {
        updated.state = placeToEmirateMap[matched];
      }
      return updated;
    });
  };

  const handleSelectPlace = (place: string) => {
    const trimmed = place.trim();
    const mappedEmirate = placeToEmirateMap[trimmed] || form.state;
    setForm((prev) => ({
      ...prev,
      city: trimmed,
      state: mappedEmirate,
    }));
    setIsPlaceDropdownOpen(false);
  };

  const handleCreatePlace = () => {
    const trimmed = newPlaceName.trim();
    if (!trimmed) {
      toast.error("Please enter an area or district name");
      return;
    }
    onAddPlace(trimmed);
    const mappedEmirate = placeToEmirateMap[trimmed] || form.state;
    setForm((prev) => ({
      ...prev,
      city: trimmed,
      state: mappedEmirate,
    }));
    setIsAddingPlace(false);
    setNewPlaceName("");
    toast.success(`"${trimmed}" added to areas!`);
  };

  const handleCreateType = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      toast.error("Please enter a type name");
      return;
    }
    if (!orgTypes.includes(trimmed)) {
      onAddType(trimmed);
    }
    setForm((prev) => ({ ...prev, orgType: trimmed as OrgType }));
    setIsAddingType(false);
    setNewTypeName("");
    toast.success(`"${trimmed}" added as new type!`);
  };

  const handleToggleConnectionType = (type: string) => {
    setForm((prev) => {
      const selected = prev.connectedAs.includes(type);
      return {
        ...prev,
        connectedAs: selected
          ? prev.connectedAs.filter((item) => item !== type)
          : [...prev.connectedAs, type],
      };
    });
  };

  const handleCreateConnectionType = () => {
    const trimmed = newConnectionType.trim();
    if (!trimmed) {
      toast.error("Please enter connection type");
      return;
    }
    const updated = saveStoredConnectionTypes([...connectionTypes, trimmed]);
    setConnectionTypes(updated);
    setForm((prev) => ({
      ...prev,
      connectedAs: prev.connectedAs.includes(trimmed) ? prev.connectedAs : [...prev.connectedAs, trimmed],
    }));
    setIsAddingConnectionType(false);
    setNewConnectionType("");
    toast.success(`"${trimmed}" added`);
  };

  const handleOpenGoogleMapsSearch = () => {
    const query = `${form.name} ${form.city} ${form.state} UAE`.trim();
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, "_blank");
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Please enter the Organisation Name");
      return;
    }
    if (!form.city.trim()) {
      toast.error("Please enter or select a Place / Area");
      return;
    }

    const trimmedCity = form.city.trim();
    const trimmedState = form.state.trim() || placeToEmirateMap[trimmedCity] || "Dubai";
    const fullAddress = form.address.trim() || `${trimmedCity}, ${trimmedState}`;
    const facilityName = form.name.trim();

    if (trimmedCity) {
      onAddPlace(trimmedCity);
    }

    const orgPhone = form.phone.trim();
    const orgEmail = form.email.trim();
    const addPhone = extraPhone.trim();
    const addEmail = extraEmail.trim();

    const validContacts = contacts.filter(
      (c) => c.name.trim() || c.phone.trim() || c.email.trim()
    );
    const orgPhonesList = [orgPhone, addPhone].filter(Boolean);
    const orgEmailsList = [orgEmail, addEmail].filter(Boolean);

    const contactPhones = validContacts.map((c) => c.phone.trim()).filter(Boolean);
    const contactEmails = validContacts.map((c) => c.email.trim()).filter(Boolean);

    const allPhones = Array.from(new Set([...orgPhonesList, ...contactPhones]));
    const allEmails = Array.from(new Set([...orgEmailsList, ...contactEmails]));
    const primary = validContacts[0];

    const formattedContacts: ContactPerson[] = validContacts.map(
      (c, idx) => ({
        id: c.id || `ct-${Date.now()}-${idx}`,
        clientId: clientToEdit?.id || "temp",
        name: c.name.trim() || `Contact Person #${idx + 1}`,
        designation: c.designation.trim() || "Contact Person",
        department: "Purchase" as Department,
        phone: c.phone.trim(),
        whatsapp: c.phone.trim(),
        email: c.email.trim(),
        lastContacted: new Date().toISOString().slice(0, 10),
      })
    );

    onSave({
      ...form,
      photo: photo || undefined,
      logo: photo || undefined,
      name: facilityName,
      city: trimmedCity,
      state: trimmedState,
      place: trimmedCity,
      emirate: trimmedState,
      address: fullAddress,
      operationalStatus: form.operationalStatus,
      notes: form.notes.trim(),
      googleMapsUrl:
        form.googleMapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${facilityName} ${trimmedCity} ${trimmedState} UAE`
        )}`,
      phone: orgPhone || primary?.phone.trim() || allPhones[0] || "",
      phones: allPhones.length > 0 ? allPhones : [orgPhone].filter(Boolean),
      email: orgEmail || primary?.email.trim() || allEmails[0] || "",
      emails: allEmails.length > 0 ? allEmails : [orgEmail].filter(Boolean),
      contacts: formattedContacts,
      repName: primary?.name.trim() || "",
      repRole: primary?.designation.trim() || "",
      repPhone: primary?.phone.trim() || "",
      repEmail: primary?.email.trim() || "",
    });
  };

  return (
    <div className="client-form-overlay" data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 25, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 250,
        padding: "20px 16px",
      }}
      onClick={onClose}
    >
      <div
        className="card client-form-dialog"
        role="dialog" aria-modal="true" aria-labelledby="client-form-title"
        style={{
          width: "100%",
          maxWidth: 960,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 77, 102, 0.08)",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          overflow: "hidden",
          animation: "fadeIn 0.15s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Executive Modal Header */}
        <div className="client-form-heading"
          style={{
            padding: "18px 26px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #004d66 0%, #006680 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0, 77, 102, 0.25)",
                flexShrink: 0,
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <h2 id="client-form-title" style={{ fontSize: 16.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  {isEdit ? "Edit client" : "New client"}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 9999,
                    backgroundColor: isEdit ? "#f0fdfa" : "#eff6ff",
                    color: isEdit ? "#0f766e" : "#1d4ed8",
                    border: isEdit ? "1px solid #99f6e4" : "1px solid #bfdbfe",
                    letterSpacing: "0.02em",
                  }}
                >
                  {isEdit ? "Update Mode" : "UAE Medical Directory"}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                Add organisation details and key contacts
              </p>
            </div>
          </div>

          <button type="button" aria-label="Close client form"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#94a3b8",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            className="hover:bg-slate-100 hover:text-slate-800"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Balanced 2-Column Dashboard Cards */}
        <div className="client-form-body" data-mobile-grid="stack"
          style={{
            padding: "22px 26px 26px 26px",
            overflowY: "auto",
            flex: "1 1 auto",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 20,
            alignItems: "start",
            backgroundColor: "#f8fafc",
          }}
        >
          {/* COLUMN 1: Facility Profile & Location */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Card 1: Facility Identity */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: "16px 18px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <Building2 size={14} color="#006680" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#006680", textTransform: "uppercase" }}>
                  Organisation details
                </span>
              </div>

              {/* Logo + Name Row */}
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {/* Logo Uploader */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 12,
                      backgroundColor: "#f8fafc",
                      border: photo ? "1.5px solid #004d66" : "1.5px dashed #cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                    className="hover:border-teal-600 hover:bg-teal-50/20"
                    title="Click to upload logo / photo"
                  >
                    {photo ? (
                      <img src={photo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "#94a3b8" }}>
                        <Camera size={18} />
                        <span style={{ fontSize: 9, fontWeight: 600 }}>LOGO</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: "none" }}
                    onChange={handlePhotoUpload}
                  />
                  {photo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhoto("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        color: "#ffffff",
                        border: "2px solid #ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Organisation Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                    Organisation / Hospital Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Cleveland Clinic Abu Dhabi"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={{ fontSize: 13, height: 38, borderRadius: 8, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Type & Operational Status */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Type */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                      Facility Type
                    </label>
                    {!isAddingType && (
                      <button
                        type="button"
                        onClick={() => setIsAddingType(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#004d66",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        + Add Type
                      </button>
                    )}
                  </div>

                  {isAddingType ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        type="text"
                        autoFocus
                        className="form-input"
                        placeholder="New type..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateType();
                          } else if (e.key === "Escape") {
                            setIsAddingType(false);
                            setNewTypeName("");
                          }
                        }}
                        style={{ flex: 1, fontSize: 12, height: 36, borderRadius: 6 }}
                      />
                      <button
                        type="button"
                        onClick={handleCreateType}
                        className="btn btn-primary"
                        style={{ height: 36, padding: "0 8px", fontSize: 11, backgroundColor: "#004d66", borderRadius: 6 }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingType(false);
                          setNewTypeName("");
                        }}
                        style={{
                          height: 36,
                          padding: "0 8px",
                          fontSize: 12,
                          background: "none",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <CustomLightSelect
                      value={form.orgType}
                      options={orgTypes.map((o) => ({ value: o, label: o }))}
                      onChange={(val) => setForm({ ...form, orgType: val as OrgType })}
                      onAddNew={() => setIsAddingType(true)}
                      addNewLabel="+ Add New Type..."
                      buttonStyle={{ height: 38, fontSize: 12.5, borderRadius: 8 }}
                    />
                  )}
                </div>

                {/* Operational Status */}
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                    Operational Status
                  </label>
                  <CustomLightSelect
                    value={form.operationalStatus}
                    options={[
                      { value: "Running", label: "Operational (Running)" },
                      { value: "Upcoming", label: "Upcoming (Under Setup)" },
                      { value: "Closed", label: "Closed / Inactive" },
                    ]}
                    onChange={(val) =>
                      setForm({
                        ...form,
                        operationalStatus: val as "Running" | "Closed" | "Upcoming",
                      })
                    }
                    buttonStyle={{ height: 38, fontSize: 12.5, borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Organisation Number & Email */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Number */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                      Organisation Number
                    </label>
                    {!showExtraPhone && (
                      <button
                        type="button"
                        onClick={() => setShowExtraPhone(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#004d66",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +971 4 123 4567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ fontSize: 12.5, height: 38, borderRadius: 8, paddingLeft: 28, width: "100%" }}
                    />
                    <Phone size={13} style={{ position: "absolute", left: 9, color: "#94a3b8", pointerEvents: "none" }} />
                  </div>
                  {showExtraPhone && (
                    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Alternate phone / landline..."
                        value={extraPhone}
                        onChange={(e) => setExtraPhone(e.target.value)}
                        style={{ fontSize: 11.5, height: 32, flex: 1, borderRadius: 6 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowExtraPhone(false);
                          setExtraPhone("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: "0 5px",
                        }}
                        title="Remove alternate number"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                      Organisation Email
                    </label>
                    {!showExtraEmail && (
                      <button
                        type="button"
                        onClick={() => setShowExtraEmail(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#004d66",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. info@facility.ae"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ fontSize: 12.5, height: 38, borderRadius: 8, paddingLeft: 28, width: "100%" }}
                    />
                    <Mail size={13} style={{ position: "absolute", left: 9, color: "#94a3b8", pointerEvents: "none" }} />
                  </div>
                  {showExtraEmail && (
                    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="Alternate / Accounts email..."
                        value={extraEmail}
                        onChange={(e) => setExtraEmail(e.target.value)}
                        style={{ fontSize: 11.5, height: 32, flex: 1, borderRadius: 6 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowExtraEmail(false);
                          setExtraEmail("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: "0 5px",
                        }}
                        title="Remove alternate email"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected To Us By */}
              <div ref={connectionDropdownRef} style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                    Connected To Us By
                  </label>
                  {!isAddingConnectionType && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsConnectionDropdownOpen(true);
                        setIsAddingConnectionType(true);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#004d66",
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      + Add Connection
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="form-input"
                  onClick={() => setIsConnectionDropdownOpen((prev) => !prev)}
                  style={{
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    textAlign: "left",
                    fontSize: 12.5,
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.connectedAs.length > 0 ? form.connectedAs.join(", ") : "Select connection channels..."}
                  </span>
                  <ChevronDown size={15} color="#64748b" />
                </button>

                {isConnectionDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
                      zIndex: 9999,
                      padding: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {connectionTypes.map((type) => {
                        const isSelected = form.connectedAs.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleToggleConnectionType(type)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: isSelected ? 700 : 500,
                              backgroundColor: isSelected ? "#004d66" : "#f1f5f9",
                              color: isSelected ? "#ffffff" : "#334155",
                              border: isSelected ? "1px solid #004d66" : "1px solid #e2e8f0",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {isSelected && <Check size={11} />}
                            <span>{type}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isAddingConnectionType ? (
                      <div style={{ display: "flex", gap: 4, paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
                        <input
                          type="text"
                          autoFocus
                          className="form-input"
                          placeholder="New connection channel..."
                          value={newConnectionType}
                          onChange={(e) => setNewConnectionType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateConnectionType();
                            } else if (e.key === "Escape") {
                              setIsAddingConnectionType(false);
                              setNewConnectionType("");
                            }
                          }}
                          style={{ flex: 1, fontSize: 11.5, height: 32 }}
                        />
                        <button
                          type="button"
                          onClick={handleCreateConnectionType}
                          className="btn btn-primary"
                          style={{ height: 32, padding: "0 8px", fontSize: 11, backgroundColor: "#004d66" }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingConnectionType(true)}
                        style={{
                          width: "100%",
                          border: "1px dashed #99f6e4",
                          borderRadius: 6,
                          background: "#f0fdfa",
                          color: "#004d66",
                          padding: "6px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        + Add Custom Channel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Location & registration */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: "16px 18px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <MapPin size={14} color="#006680" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#006680", textTransform: "uppercase" }}>
                  Location & registration
                </span>
              </div>

              {/* Emirate & Area */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                    Emirate *
                  </label>
                  <CustomLightSelect
                    value={form.state}
                    options={UAE_EMIRATES.map((em) => ({ value: em, label: em }))}
                    onChange={(val) => setForm({ ...form, state: val })}
                    buttonStyle={{ height: 38, fontSize: 12.5, borderRadius: 8 }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                      Area / District *
                    </label>
                    {!isAddingPlace && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingPlace(true);
                          setIsPlaceDropdownOpen(false);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#004d66",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        + Add Place
                      </button>
                    )}
                  </div>

                  {isAddingPlace ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        type="text"
                        autoFocus
                        className="form-input"
                        placeholder="New area / district..."
                        value={newPlaceName}
                        onChange={(e) => setNewPlaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreatePlace();
                          } else if (e.key === "Escape") {
                            setIsAddingPlace(false);
                            setNewPlaceName("");
                          }
                        }}
                        style={{ flex: 1, fontSize: 12, height: 38, borderRadius: 8 }}
                      />
                      <button
                        type="button"
                        onClick={handleCreatePlace}
                        className="btn btn-primary"
                        style={{ height: 38, padding: "0 10px", fontSize: 11, backgroundColor: "#004d66", borderRadius: 8 }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingPlace(false);
                          setNewPlaceName("");
                        }}
                        style={{
                          height: 38,
                          padding: "0 8px",
                          fontSize: 12,
                          background: "none",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <CustomLightSelect
                      sheetTitle="Area / District"
                      placeholder="Select area or district"
                      value={form.city}
                      options={places.map((place) => ({ value: place, label: place, subtext: placeToEmirateMap[place] }))}
                      onChange={handleSelectPlace}
                      clearable={false}
                      searchable
                      onAddNew={(query) => {
                        setNewPlaceName(query || "");
                        setIsAddingPlace(true);
                        setIsPlaceDropdownOpen(false);
                      }}
                      addNewLabel="Add new place"
                    />
                  )}
                </div>
              </div>

              {/* Building / Street Address */}
              <div>
                <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  Address / Building / Street
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Building 49, Al Maryah Island, Abu Dhabi"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ fontSize: 12.5, height: 38, borderRadius: 8 }}
                />
              </div>

              {/* VAT TRN */}
              <div>
                <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  VAT Number (UAE TRN) <span style={{ color: "#94a3b8", fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="15-digit UAE TRN (e.g. 100XXXXXXXXX003)"
                  value={form.gst}
                  onChange={(e) => setForm({ ...form, gst: e.target.value })}
                  style={{ fontSize: 12.5, height: 38, borderRadius: 8 }}
                />
              </div>
            </div>
          </div>

          {/* COLUMN 2: Key Stakeholders & Internal Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Card 3: Key Stakeholders / Contact Persons */}
            <div className="client-stakeholder-section"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: "16px 18px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Header with Add Contact button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 8,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Users size={14} color="#006680" />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#006680", textTransform: "uppercase" }}>
                    Contact people
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddContact}
                  style={{
                    backgroundColor: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    color: "#004d66",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    padding: "3px 9px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  className="hover:bg-teal-100"
                >
                  <Plus size={11} />
                  <span>Add Person</span>
                </button>
              </div>

              <div className="client-stakeholder-fields" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto", paddingRight: 2 }}>
                {contacts.map((contact, idx) => (
                  <div
                    className="client-stakeholder-card" key={contact.id}
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: 10,
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: idx === 0 ? "#0f766e" : "#64748b",
                          backgroundColor: idx === 0 ? "#ccfbf1" : "#e2e8f0",
                          padding: "2px 7px",
                          borderRadius: 4,
                        }}
                      >
                        {idx === 0 ? "Primary Contact" : `Contact #${idx + 1}`}
                      </span>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontSize: 11,
                            padding: 0,
                          }}
                          className="hover:text-red-600"
                          title="Remove contact"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Full Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Dr. Tariq Al Nuaimi"
                          value={contact.name}
                          onChange={(e) => handleUpdateContact(idx, "name", e.target.value)}
                          style={{ fontSize: 12, height: 34, backgroundColor: "#ffffff", borderRadius: 6 }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Designation / Role</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Biomedical Director"
                          value={contact.designation}
                          onChange={(e) => handleUpdateContact(idx, "designation", e.target.value)}
                          style={{ fontSize: 12, height: 34, backgroundColor: "#ffffff", borderRadius: 6 }}
                        />
                      </div>
                    </div>

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Phone / WhatsApp</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="+971 50 123 4567"
                          value={contact.phone}
                          onChange={(e) => handleUpdateContact(idx, "phone", e.target.value)}
                          style={{ fontSize: 12, height: 34, backgroundColor: "#ffffff", borderRadius: 6 }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Official Email</label>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="tariq@hospital.ae"
                          value={contact.email}
                          onChange={(e) => handleUpdateContact(idx, "email", e.target.value)}
                          style={{ fontSize: 12, height: 34, backgroundColor: "#ffffff", borderRadius: 6 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Internal Notes & Tender Remarks */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: "16px 18px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <FileText size={14} color="#006680" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#006680", textTransform: "uppercase" }}>
                  Notes
                </span>
              </div>

              <textarea
                className="form-input"
                placeholder="Record operational insights, key procurement cycles, biomedical contacts, tender preferences..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{
                  fontSize: 12.5,
                  padding: "10px 12px",
                  borderRadius: 8,
                  minHeight: 88,
                  resize: "vertical",
                  lineHeight: 1.45,
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="client-form-footer"
          style={{
            padding: "14px 26px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fafbfc",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={13} />
            <span>FastOnMed Healthcare Client Directory • UAE Medical Network</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                backgroundColor: "#004d66",
                fontSize: 13,
                padding: "8px 22px",
                fontWeight: 600,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                boxShadow: "0 2px 8px rgba(0, 77, 102, 0.25)",
              }}
              onClick={handleSubmit}
            >
              <Building2 size={15} />
              <span>{isEdit ? "Save Changes" : "Save Client"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT PROFILE OVERVIEW ────────────────────────────────────────────────

function ClientProfile({
  client,
  onBack,
  backLabel = "Back to Clients",
  activeTab,
  setActiveTab,
  onEdit,
  onDelete,
  onEditPerson,
  onTransferPerson,
  onSaveNotes,
  invoices,
  timelineEvents,
}: {
  client: Client;
  onBack: () => void;
  backLabel?: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  onEdit: (client: Client) => void;
  onDelete?: (client: Client) => void;
  onEditPerson: (person: ContactPerson) => void;
  onTransferPerson: (person: ContactPerson) => void;
  onSaveNotes?: (notes: string) => void | Promise<void>;
  invoices: Invoice[];
  timelineEvents: ClientTimelineEvent[];
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [facilityNotes, setFacilityNotes] = useState(client.notes || "");
  const [clientTaskCount, setClientTaskCount] = useState<number>(0);
  const [expiryVersion, setExpiryVersion] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setExpiryVersion((v) => v + 1);
    window.addEventListener("fastonmed_expiry_updated", handleUpdate);
    return () => window.removeEventListener("fastonmed_expiry_updated", handleUpdate);
  }, []);

  useEffect(() => {
    const refreshTimeline = () => setActivityVersion((version) => version + 1);
    const events = [
      "fastonmed_tasks_updated",
      "fastonmed_leads_updated",
      "fastonmed_services_updated",
      "fastonmed_quotations_updated",
      "fastonmed_quotes_updated",
      "fastonmed_contracts_updated",
      "fastonmed_clients_updated",
      "fastonmed_people_updated",
      "fastonmed_expiry_updated",
      "fastonmed_shared_data_synced",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, refreshTimeline));
    return () => events.forEach((eventName) => window.removeEventListener(eventName, refreshTimeline));
  }, []);

  const expiryRecords = useMemo(() => buildCompanyExpiryRecords(client, invoices), [client, invoices, expiryVersion]);
  const timelineClient = useMemo(
    () => getStoredClients().find((storedClient) => storedClient.id === client.id) || client,
    [client, activityVersion]
  );
  const isTrader = useMemo(() => isTraderCompany(client), [client]);
  const [traderProducts, setTraderProducts] = useState<Product[]>([]);

  // Horizontal tabs scrolling state and controls
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabsScroll = () => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const handleTabsScroll = (direction: "left" | "right") => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(checkTabsScroll, 320);
  };

  useEffect(() => {
    checkTabsScroll();
    const handleResize = () => checkTabsScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkTabsScroll, 120);
    return () => clearTimeout(timer);
  }, [activeTab, isTrader, clientTaskCount]);

  const clientPurchasesList = useMemo(() => {
    const rawPurchases = client.purchases || [];
    const existingInvNos = new Set(
      rawPurchases.map((p) => (p.invoiceNumber || "").trim().toLowerCase()).filter(Boolean)
    );
    const existingIds = new Set(rawPurchases.map((p) => String(p.id)));

    const cleanName = (val?: string) => (val || "").toLowerCase().replace(/\s+/g, " ").trim();
    const cName = cleanName(client.name);

    // Also include any invoices for this client not yet in client.purchases
    const clientInvoices = invoices.filter(
      (inv) =>
        inv.clientId === client.id ||
        (inv.clientName && cName && cleanName(inv.clientName) === cName)
    );

    const fromInvoices = clientInvoices
      .filter(
        (inv) =>
          !existingIds.has(String(inv.id)) &&
          (!inv.invoiceNumber || !existingInvNos.has(inv.invoiceNumber.trim().toLowerCase()))
      )
      .map((inv) => ({
        id: inv.id,
        clientId: client.id,
        productName: inv.items?.map((i) => i.product).filter(Boolean).join(", ") || "Biomedical Equipment / Consumables",
        product: inv.items?.map((i) => i.product).filter(Boolean).join(", ") || "Biomedical Equipment / Consumables",
        model: "Standard",
        brand: "FastonMed",
        quantity: inv.items?.reduce((sum, i) => sum + (i.qty || 1), 0) || 1,
        purchaseDate: inv.createdAt,
        date: inv.createdAt,
        invoiceNumber: inv.invoiceNumber,
        warrantyPeriod: "1 Year",
        installationDate: inv.createdAt,
        assignedEngineer: "Biomedical Team",
        amount: inv.amount,
      }));

    const combined = [...rawPurchases, ...fromInvoices];

    // Map each purchase with date from matched invoice if missing, and safe fallbacks for product/qty/model/brand
    const resolved = combined.map((p) => {
      const matchedInv = invoices.find(
        (inv) =>
          (p.invoiceNumber && inv.invoiceNumber && inv.invoiceNumber.trim().toLowerCase() === p.invoiceNumber.trim().toLowerCase()) ||
          (p.id && String(inv.id) === String(p.id))
      );

      // Date when invoice was created
      const invoiceCreatedDate =
        matchedInv?.createdAt ||
        (matchedInv as any)?.date ||
        p.purchaseDate ||
        (p as any)?.date ||
        (p as any)?.createdAt ||
        "";

      const productName =
        p.productName ||
        (p as any)?.product ||
        matchedInv?.items?.map((i) => i.product).filter(Boolean).join(", ") ||
        "Biomedical Equipment / Consumables";

      const modelBrand =
        [p.brand, p.model].filter(Boolean).join(" ").trim() ||
        (p as any)?.brand ||
        (p as any)?.model ||
        "—";

      const qty =
        p.quantity ||
        (p as any)?.qty ||
        (matchedInv?.items && matchedInv.items.length > 0 ? matchedInv.items.reduce((s, it) => s + (it.qty || 1), 0) : 1);

      const invoiceNumber = p.invoiceNumber || matchedInv?.invoiceNumber || "—";
      const amount = Number(p.amount ?? matchedInv?.amount ?? 0);

      return {
        ...p,
        invoiceCreatedDate,
        productName,
        modelBrand,
        qty,
        invoiceNumber,
        amount,
      };
    });

    // Sort by date descending (newest invoice created first)
    resolved.sort((a, b) => {
      const timeA = a.invoiceCreatedDate ? new Date(a.invoiceCreatedDate).getTime() : 0;
      const timeB = b.invoiceCreatedDate ? new Date(b.invoiceCreatedDate).getTime() : 0;
      return timeB - timeA;
    });

    return resolved;
  }, [client, invoices]);

  useEffect(() => {
    if (!isTrader) return;
    const updateProds = () => {
      setTraderProducts(getCompanyProducts(client));
    };
    updateProds();
    window.addEventListener("fastonmed_products_updated", updateProds);
    window.addEventListener("fastonmed_companies_updated", updateProds);
    return () => {
      window.removeEventListener("fastonmed_products_updated", updateProds);
      window.removeEventListener("fastonmed_companies_updated", updateProds);
    };
  }, [client, isTrader]);

  useEffect(() => {
    if (isTrader && activeTab === "requirements") {
      setActiveTab("products");
    }
  }, [isTrader, activeTab, setActiveTab]);

  useEffect(() => {
    const calcCount = () => {
      const allTasks = getStoredTasks();
      const count = allTasks.filter((t) => {
        const matchId = t.clientId && t.clientId === client.id;
        const tName = (t.clientName || "").trim().toLowerCase();
        const cName = (client.name || "").trim().toLowerCase();
        const matchName = tName && cName && (tName === cName || tName.includes(cName) || cName.includes(tName));
        return matchId || matchName;
      }).length;
      setClientTaskCount(count);
    };

    calcCount();
    window.addEventListener("fastonmed_tasks_updated", calcCount);
    return () => {
      window.removeEventListener("fastonmed_tasks_updated", calcCount);
    };
  }, [client.id, client.name]);

  useEffect(() => {
    setFacilityNotes(client.notes || "");
  }, [client.notes]);

  const handleSaveFacilityNotes = () => {
    if (onSaveNotes) {
      onSaveNotes(facilityNotes.trim());
    }
    setIsEditingNotes(false);
    toast.success("Facility notes updated!");
  };

  const normalizeName = (value?: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const matchesOrganisation = (recordClientId?: string, recordClientName?: string) => {
    if (recordClientId && (recordClientId === client.id || `trader-${recordClientId}` === client.id || recordClientId === `trader-${client.id}`)) {
      return true;
    }
    const recordName = normalizeName(recordClientName);
    const clientName = normalizeName(client.name);
    if (!recordName || !clientName) return false;
    return recordName === clientName ||
      (recordName.length >= 5 && clientName.length >= 5 && (recordName.includes(clientName) || clientName.includes(recordName)));
  };
  const dateAndTime = (value?: string) => {
    if (!value) return { date: "", time: undefined as string | undefined };
    const [date, rawTime] = value.split("T");
    return { date, time: rawTime ? rawTime.slice(0, 5) : undefined };
  };

  const localInvoiceEvents: OrganisationTimelineEvent[] = invoices
    .filter((invoice) => matchesOrganisation(invoice.clientId, invoice.clientName))
    .map((invoice) => ({
      id: `invoice-${invoice.id}`,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      source: "Zoho Books",
      type: "invoice",
      title: `Invoice ${invoice.status}`,
      description: `${invoice.invoiceNumber} for ${formatCurrency(invoice.amount)}`,
      date: invoice.createdAt,
      transactionId: invoice.id,
      transactionNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
      category: "invoice",
    }));
  const zohoTimelineEvents = timelineEvents.filter(
    (event) => matchesOrganisation(event.clientId, event.clientName)
  ) as OrganisationTimelineEvent[];

  const taskEvents: OrganisationTimelineEvent[] = getStoredTasks()
    .filter((task) => matchesOrganisation(task.clientId, task.clientName))
    .flatMap((task) => {
      const created = dateAndTime(task.createdAt);
      const events: OrganisationTimelineEvent[] = [{
        id: `task-created-${task.id}`,
        clientId: client.id,
        clientName: client.name,
        source: "FastonMed CRM",
        type: "system",
        title: `Task created: ${task.title}`,
        description: `${task.type} • ${task.status} • Assigned to ${task.assignedTo || "Unassigned"}${task.dueDate ? ` • Due ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}` : ""}`,
        date: created.date || task.dueDate,
        time: created.time,
        status: task.status,
        actor: task.createdBy || "Creator not recorded",
        category: "task",
      }];
      if (task.completedDate || task.completedAt) {
        const completed = dateAndTime(task.completedAt || task.completedDate);
        events.push({
          id: `task-completed-${task.id}`,
          clientId: client.id,
          clientName: client.name,
          source: "FastonMed CRM",
          type: "system",
          title: `Task ${task.status.toLowerCase()}: ${task.title}`,
          description: `${task.type} • Assigned to ${task.assignedTo || "Unassigned"}`,
          date: completed.date || task.completedDate || task.dueDate,
          time: completed.time,
          status: task.status,
          actor: task.assignedTo || task.createdBy || "Team member not recorded",
          category: "task",
        });
      }
      return events;
    });

  const leadEvents: OrganisationTimelineEvent[] = getStoredLeads()
    .filter((lead) => matchesOrganisation(lead.clientId, lead.clientName))
    .flatMap((lead) => {
      const created = dateAndTime(lead.createdAt);
      const events: OrganisationTimelineEvent[] = [{
        id: `lead-created-${lead.id}`,
        clientId: client.id,
        clientName: client.name,
        source: "FastonMed CRM",
        type: "system",
        title: `Lead created: ${lead.product}`,
        description: `${lead.stage} • ${lead.priority} priority • Assigned to ${lead.assignedTo}${lead.estimatedValue ? ` • ${formatCurrency(lead.estimatedValue)}` : ""}`,
        date: created.date,
        time: created.time,
        status: lead.stage,
        amount: lead.estimatedValue,
        actor: lead.createdBy || "Creator not recorded",
        category: "lead",
      }];
      (lead.comments || []).forEach((comment) => {
        const commentDate = dateAndTime(comment.createdAt);
        events.push({
          id: `lead-comment-${lead.id}-${comment.id}`,
          clientId: client.id,
          clientName: client.name,
          source: "FastonMed CRM",
          type: "contact",
          title: `Lead update: ${lead.product}`,
          description: comment.text,
          date: commentDate.date,
          time: commentDate.time,
          actor: comment.author,
          category: "lead",
        });
      });
      return events;
    });

  const serviceEvents: OrganisationTimelineEvent[] = getStoredServiceTickets()
    .filter((ticket) => matchesOrganisation(ticket.clientId, ticket.clientName))
    .flatMap((ticket) => {
      const created = dateAndTime(ticket.createdAt);
      const events: OrganisationTimelineEvent[] = [{
        id: `service-created-${ticket.id}`,
        clientId: client.id,
        clientName: client.name,
        source: "FastonMed CRM",
        type: "system",
        title: `Service request: ${ticket.equipment}`,
        description: `${ticket.ticketNumber} • ${ticket.status} • ${ticket.complaint}`,
        date: created.date,
        time: created.time,
        status: ticket.status,
        actor: ticket.assignedEngineerName ? `Assigned to ${ticket.assignedEngineerName}` : undefined,
        category: "service",
      }];
      if (ticket.resolvedAt) {
        const resolved = dateAndTime(ticket.resolvedAt);
        events.push({
          id: `service-resolved-${ticket.id}`,
          clientId: client.id,
          clientName: client.name,
          source: "FastonMed CRM",
          type: "system",
          title: `Service ${ticket.status.toLowerCase()}: ${ticket.equipment}`,
          description: ticket.engineerNotes || `${ticket.ticketNumber} completed`,
          date: resolved.date,
          time: resolved.time,
          status: ticket.status,
          actor: ticket.assignedEngineerName,
          category: "service",
        });
      }
      return events;
    });

  const quotationEvents: OrganisationTimelineEvent[] = getStoredQuotations()
    .filter((quote) => matchesOrganisation(quote.clientId, quote.clientName))
    .map((quote) => ({
      id: `quotation-${quote.id}`,
      clientId: client.id,
      clientName: client.name,
      source: "FastonMed CRM",
      type: "quote",
      title: `Quotation ${quote.status}`,
      description: `${quote.quotationNumber} • ${quote.items.length} item${quote.items.length === 1 ? "" : "s"} • ${formatCurrency(quote.total)}`,
      date: quote.createdAt || quote.date,
      transactionId: quote.id,
      transactionNumber: quote.quotationNumber,
      status: quote.status,
      amount: quote.total,
      actor: quote.preparedBy || "Preparer not recorded",
      category: "quotation",
    }));

  const clientContracts = useMemo(() => {
    return getStoredContracts().filter((contract) =>
      matchesOrganisation(contract.clientId, contract.clientName || contract.organisation)
    );
  }, [client, activityVersion]);

  const contractEvents: OrganisationTimelineEvent[] = clientContracts
    .map((contract) => ({
      id: `contract-${contract.id}`,
      clientId: client.id,
      clientName: client.name,
      source: "FastonMed CRM",
      type: "system",
      title: `Maintenance contract ${contract.status.toLowerCase()}`,
      description: `${contract.contractNumber} • ${contract.typeOfService || "AMC / CMC"} • ${formatCurrency(contract.amount || contract.value || 0)} • Ends ${contract.endDate}`,
      date: contract.startDate,
      status: contract.status,
      actor: contract.createdBy || "User not recorded",
      category: "contract",
    }));

  const contactEvents: OrganisationTimelineEvent[] = (timelineClient.contacts || []).map((contact) => ({
    id: `contact-${client.id}-${contact.id}`,
    clientId: client.id,
    clientName: client.name,
    source: "FastonMed CRM",
    type: "contact",
    title: `Contact linked: ${contact.name}`,
    description: `${contact.designation || "Contact"} • ${contact.department || "Department not specified"}${contact.phone ? ` • ${contact.phone}` : ""}`,
    date: contact.lastContacted || client.createdAt,
    actor: contact.createdBy || timelineClient.createdBy || "User not recorded",
    category: "contact",
  }));

  const purchaseEvents: OrganisationTimelineEvent[] = (client.purchases || []).map((purchase) => ({
    id: `purchase-${client.id}-${purchase.id}`,
    clientId: client.id,
    clientName: client.name,
    source: "FastonMed CRM",
    type: "invoice",
    title: `Purchase: ${purchase.productName}`,
    description: `${purchase.invoiceNumber || "No invoice number"} • Qty ${purchase.quantity} • ${formatCurrency(purchase.amount || 0)}`,
    date: purchase.purchaseDate || purchase.installationDate || client.createdAt,
    amount: purchase.amount,
    actor: purchase.createdBy || timelineClient.createdBy || "User not recorded",
    category: "purchase",
  }));

  const requirementEvents: OrganisationTimelineEvent[] = (client.requirements || []).map((requirement) => ({
    id: `requirement-${client.id}-${requirement.id}`,
    clientId: client.id,
    clientName: client.name,
    source: "FastonMed CRM",
    type: "system",
    title: `Requirement: ${requirement.product}`,
    description: `${requirement.status} • ${requirement.priority} priority • Qty ${requirement.quantity}${requirement.budget ? ` • Budget ${formatCurrency(requirement.budget)}` : ""}`,
    date: requirement.requirementDate || client.createdAt,
    status: requirement.status,
    actor: requirement.createdBy || timelineClient.createdBy || "User not recorded",
    category: "requirement",
  }));

  const expiryEvents: OrganisationTimelineEvent[] = expiryRecords.map((record) => ({
    id: `expiry-${record.id}`,
    clientId: client.id,
    clientName: client.name,
    source: "FastonMed CRM",
    type: "system",
    title: `Product expiry tracked: ${record.productName}`,
    description: `${record.source} • Installed ${record.installationDate} • Expires ${record.expiryDate}`,
    date: record.installationDate || client.createdAt,
    amount: record.amount,
    actor: record.createdBy || "User not recorded",
    category: "expiry",
  }));

  const fallbackEvents: OrganisationTimelineEvent[] = [
    {
      id: `client-created-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      source: "FastonMed CRM",
      type: "system",
      title: "Client Created in UAE Registry",
      date: client.createdAt,
      description: `Added via ${client.source}`,
      actor: timelineClient.createdBy || "User not recorded",
      category: "organisation",
    },
    {
      id: `initial-enquiry-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      source: "FastonMed CRM",
      type: "system",
      title: "Initial Enquiry Logged",
      date: client.createdAt,
      description: `Location set to ${client.city}, ${client.state}`,
      actor: timelineClient.createdBy || "User not recorded",
      category: "organisation",
    },
  ];
  const timeline: OrganisationTimelineEvent[] = [
    ...zohoTimelineEvents,
    ...localInvoiceEvents,
    ...taskEvents,
    ...leadEvents,
    ...serviceEvents,
    ...quotationEvents,
    ...contractEvents,
    ...contactEvents,
    ...purchaseEvents,
    ...requirementEvents,
    ...expiryEvents,
    ...fallbackEvents,
  ]
    .filter((event) => Boolean(event.date))
    .filter((event, index, events) => events.findIndex((item) => item.id === event.id) === index)
    .sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
      {/* Top Action Bar */}
      <div className="organisation-profile-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#004d66",
            fontWeight: 600,
            fontSize: 13.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#42b69c")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#004d66")}
        >
          <ArrowLeft size={14} />
          <span>{backLabel}</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onDelete && (
            <button
              onClick={() => onDelete(client)}
              aria-label="Delete organisation"
              title="Delete organisation"
              className="btn btn-secondary"
              style={{
                borderColor: "#fee2e2",
                color: "#ef4444",
                backgroundColor: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 14px",
                borderRadius: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          )}
          <button
            onClick={() => onEdit(client)}
            aria-label="Edit client details"
            title="Edit client details"
            className="btn btn-primary"
            style={{
              backgroundColor: "#004d66",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 16px",
              borderRadius: 8,
            }}
          >
            <Pencil size={13} />
            <span>Edit Client Details</span>
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div className="card client-profile-header" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <OrganisationAvatar
            name={client.name}
            photo={client.photo}
            logo={client.logo}
            size={52}
            isIndividual={client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual"}
            style={{ borderRadius: 12 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                {client.name}
              </h1>
              <ClientStatusBadge status={client.status} />
              <OperationalStatusBadge status={client.operationalStatus} />
            </div>

            {/* Location & Real Google Maps Pin */}
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{client.orgType}</span>
              <span>•</span>
              <span>
                {Array.from(new Set([client.address, client.city, client.state].flatMap(value => (value || "").split(",")).map(value => value.trim()).filter(Boolean))).join(", ")}
              </span>
              {client.googleMapsUrl && (
                <a
                  href={client.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#0284c7",
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#f0f9ff",
                    padding: "2px 8px",
                    borderRadius: 6,
                    border: "1px solid #bae6fd",
                  }}
                >
                  <MapPin size={12} />
                  <span>View on Maps</span>
                  <ArrowUpRight size={12} />
                </a>
              )}
            </div>

            {/* Contacts & VAT Badges */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              {(client.phones && client.phones.length > 0 ? client.phones : [client.phone]).filter(Boolean).map((ph, idx) => (
                <a
                  key={idx}
                  href={`tel:${ph}`}
                  style={{
                    fontSize: 12,
                    textDecoration: "none",
                    color: "#334155",
                    background: "#f8fafc",
                    padding: "3px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Phone size={11} style={{ color: "#64748b" }} />
                  <span>{ph}</span>
                </a>
              ))}

              {(client.emails && client.emails.length > 0 ? client.emails : [client.email]).filter(Boolean).map((em, idx) => (
                <a
                  key={idx}
                  href={`mailto:${em}`}
                  style={{
                    fontSize: 12,
                    textDecoration: "none",
                    color: "#334155",
                    background: "#f8fafc",
                    padding: "3px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Mail size={11} style={{ color: "#64748b" }} />
                  <span>{em}</span>
                </a>
              ))}

              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: "#004d66",
                    background: "#f8fafc",
                    padding: "3px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Globe size={11} style={{ color: "#64748b" }} />
                  <span>Website</span>
                  <ArrowUpRight size={11} />
                </a>
              )}

              {(client.vatNumber || client.gst) && (
                <span
                  style={{
                    fontSize: 12,
                    background: "#f0fdf9",
                    color: "#004d66",
                    padding: "3px 9px",
                    borderRadius: 6,
                    border: "1px solid #bbf7d0",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Receipt size={11} style={{ color: "#059669" }} />
                  <span>TRN: {client.vatNumber || client.gst}</span>
                </span>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* Tabs Navigation with Both Side Arrows */}
      <div className="card client-profile-sections" style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            padding: "0 6px",
            position: "relative",
          }}
        >
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => handleTabsScroll("left")}
            disabled={!canScrollLeft}
            title={canScrollLeft ? "Scroll tabs left" : undefined}
            aria-label="Scroll tabs left"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: canScrollLeft ? "#ffffff" : "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canScrollLeft ? "pointer" : "default",
              color: canScrollLeft ? "#004d66" : "#cbd5e1",
              boxShadow: canScrollLeft ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              opacity: canScrollLeft ? 1 : 0.35,
              transition: "all 0.15s ease",
              margin: "0 4px",
            }}
            onMouseEnter={(e) => {
              if (canScrollLeft) {
                e.currentTarget.style.backgroundColor = "#f0fdfa";
                e.currentTarget.style.borderColor = "#99f6e4";
                e.currentTarget.style.transform = "scale(1.08)";
              }
            }}
            onMouseLeave={(e) => {
              if (canScrollLeft) {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>

          {/* Scrollable Tabs List */}
          <div
            ref={tabsContainerRef}
            onScroll={checkTabsScroll}
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              padding: "0 4px",
              gap: 4,
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              scrollBehavior: "smooth",
            }}
          >
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "calendar", label: "Work Calendar", count: clientTaskCount, icon: CalendarDays },
              { id: "contacts", label: "Contacts", count: client.contacts.length, icon: Users },
              ...(isTrader ? [{ id: "products", label: "Products", count: traderProducts.length, icon: Package }] : []),
              { id: "purchases", label: "Purchases", count: clientPurchasesList.length, icon: ShoppingBag },
              { id: "expiry", label: "Product Expiry", count: expiryRecords.length, icon: AlertTriangle },
              { id: "contracts", label: "Maintenance Contracts", count: clientContracts.length, icon: ShieldCheck },
              ...(!isTrader ? [{ id: "requirements", label: "Requirements", count: client.requirements.length, icon: FileText }] : []),
              { id: "timeline", label: "Timeline", icon: History },
            ].map((tabItem) => {
              const isActive = activeTab === tabItem.id;
              const TabIcon = tabItem.icon;
              return (
                <button
                  key={tabItem.id}
                  aria-pressed={isActive}
                  type="button"
                  onClick={(e) => {
                    setActiveTab(tabItem.id);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                  }}
                  style={{
                    position: "relative",
                    background: isActive ? "#f0fdfa" : "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    padding: "11px 14px",
                    margin: "6px 0",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#004d66" : "#64748b",
                    fontFamily: "Inter, sans-serif",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                      e.currentTarget.style.color = "#0f172a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#64748b";
                    }
                  }}
                >
                  <TabIcon
                    size={15}
                    style={{
                      color: isActive ? "#004d66" : "#94a3b8",
                      transition: "color 0.15s ease",
                    }}
                  />
                  <span>{tabItem.label}</span>
                  {typeof tabItem.count === "number" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "1.5px 7px",
                        borderRadius: 10,
                        backgroundColor: isActive ? "#ccfbf1" : "#f1f5f9",
                        color: isActive ? "#0f766e" : "#64748b",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tabItem.count}
                    </span>
                  )}
                  {/* Modern active indicator underline */}
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -6,
                        left: 10,
                        right: 10,
                        height: 2.5,
                        backgroundColor: "#004d66",
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => handleTabsScroll("right")}
            disabled={!canScrollRight}
            title={canScrollRight ? "Scroll tabs right" : undefined}
            aria-label="Scroll tabs right"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: canScrollRight ? "#ffffff" : "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canScrollRight ? "pointer" : "default",
              color: canScrollRight ? "#004d66" : "#cbd5e1",
              boxShadow: canScrollRight ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              opacity: canScrollRight ? 1 : 0.35,
              transition: "all 0.15s ease",
              margin: "0 4px",
            }}
            onMouseEnter={(e) => {
              if (canScrollRight) {
                e.currentTarget.style.backgroundColor = "#f0fdfa";
                e.currentTarget.style.borderColor = "#99f6e4";
                e.currentTarget.style.transform = "scale(1.08)";
              }
            }}
            onMouseLeave={(e) => {
              if (canScrollRight) {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="organisation-more-info">
                <h3>More information</h3>
                <dl>
                  {[
                    ["Organisation type", client.orgType],
                    ["Location", Array.from(new Set([client.address, client.city, client.state].flatMap(value => (value || "").split(",")).map(value => value.trim()).filter(Boolean))).join(", ")],
                    ["Customer status", client.status],
                    ["Operational status", client.operationalStatus],
                    ["Phone", (client.phones?.length ? client.phones : [client.phone]).filter(Boolean).join(", ")],
                    ["Email", (client.emails?.length ? client.emails : [client.email]).filter(Boolean).join(", ")],
                    ["Website", client.website],
                    ["VAT / TRN", client.vatNumber || client.gst],
                    ["Connected through", client.connectedAs?.join(", ")],
                    ["Source", client.source],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{label === "Website" ? <a href={client.website} target="_blank" rel="noopener noreferrer">{value}<ArrowUpRight size={14} /></a> : label === "Phone" ? <a href={`tel:${client.phones?.[0] || client.phone}`}>{value}</a> : label === "Email" ? <a href={`mailto:${client.emails?.[0] || client.email}`}>{value}</a> : value}</dd></div>
                  ))}
                </dl>
              </section>
              {/* Primary representative contact card */}
              {client.contacts.length > 0 && (
                <section className="representative-contact-card">
                  <div className="representative-card-heading">
                    <h4><User size={15} />Primary representative</h4>
                    <button type="button" onClick={() => onEdit(client)} aria-label="Edit representative" title="Edit representative"><Pencil size={17} /></button>
                  </div>
                  <strong>{client.contacts[0].name}</strong>
                  <p>{[client.contacts[0].designation, client.contacts[0].department].filter(Boolean).join(" · ")}</p>
                  {([
                    { label: "Phone", value: client.contacts[0].phone, href: `tel:${client.contacts[0].phone}`, icon: <Phone size={15} />, action: "Call" },
                    { label: "Email", value: client.contacts[0].email, href: `mailto:${client.contacts[0].email}`, icon: <Mail size={15} />, action: "Email" },
                  ]).map((contact) => (
                    <div className="representative-contact-row" key={contact.label}>
                      <div><small>{contact.label}</small><span>{contact.value || `${contact.label} not added`}</span></div>
                      {contact.value && <div className="representative-contact-actions">
                        <a href={contact.href} aria-label={`${contact.action} ${client.contacts[0].name}`}>{contact.icon}<span>{contact.action}</span></a>
                        <button type="button" aria-label={`Copy representative ${contact.label.toLowerCase()}`} onClick={async () => {
                          try { await navigator.clipboard.writeText(contact.value!); toast.success(`${contact.label} copied`); }
                          catch { toast.error(`Could not copy ${contact.label.toLowerCase()}`); }
                        }}><Copy size={14} /><span>Copy</span></button>
                      </div>}
                    </div>
                  ))}
                </section>
              )}

              {/* Facility Notes & Remarks Card (Directly Editable Here) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  padding: "16px 18px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} style={{ color: "#004d66" }} />
                    <h4 style={{ margin: 0, fontSize: 12, textTransform: "uppercase", color: "#004d66", fontWeight: 700, letterSpacing: "0.04em" }}>
                      Facility Notes &amp; Remarks
                    </h4>
                  </div>

                  {!isEditingNotes ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#004d66",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 9px",
                        borderRadius: 6,
                      }}
                    >
                      <Pencil size={11} />
                      <span>Edit Note</span>
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFacilityNotes(client.notes || "");
                          setIsEditingNotes(false);
                        }}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#64748b",
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: "3px 9px",
                          borderRadius: 6,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveFacilityNotes}
                        style={{
                          background: "#004d66",
                          border: "none",
                          color: "#ffffff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "3px 11px",
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Check size={12} />
                        <span>Save Note</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditingNotes ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      autoFocus
                      aria-label="Facility notes"
                      className="form-input"
                      value={facilityNotes}
                      onChange={(e) => setFacilityNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSaveFacilityNotes();
                        } else if (e.key === "Escape") {
                          setFacilityNotes(client.notes || "");
                          setIsEditingNotes(false);
                        }
                      }}
                      placeholder="Type facility notes, procurement updates, tender remarks (Ctrl+Enter to save)..."
                      rows={4}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        padding: "10px 14px",
                        backgroundColor: "#ffffff",
                        border: "1.5px solid #004d66",
                        borderRadius: 8,
                        resize: "vertical",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        Press <strong>⌘ + Enter</strong> or <strong>Ctrl + Enter</strong> to save immediately
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFacilityNotes(client.notes || "");
                            setIsEditingNotes(false);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: 11.5 }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveFacilityNotes}
                          style={{
                            background: "#004d66",
                            border: "none",
                            color: "#ffffff",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "4px 14px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Check size={12} />
                          <span>Save Note</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 13,
                      color: client.notes ? "#334155" : "#94a3b8",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      padding: "4px 0",
                    }}
                  >
                    {client.notes || "No notes added yet. Use Edit Note to add remarks."}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === "calendar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ClientDetailCalendar client={client} />
            </div>
          )}

          {activeTab === "contacts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  Showing <strong style={{ color: "#0f172a" }}>{client.contacts.length}</strong> {client.contacts.length === 1 ? "representative contact" : "representative contacts"} for {client.name}
                </span>
                <button
                  onClick={() => onEdit(client)}
                  className="btn btn-secondary"
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#004d66",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <Pencil size={12} />
                  <span>Manage Contacts</span>
                </button>
              </div>

              {/* Contact Cards Grid */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                {client.contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "16px 18px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.03)";
                    }}
                  >
                    {/* Top Row: Avatar, Name & Action Buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)",
                            border: "1px solid #ccfbf1",
                            color: "#004d66",
                            fontWeight: 700,
                            fontSize: 13.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {c.photo || c.avatar ? (
                            <img
                              src={c.photo || c.avatar}
                              alt={c.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            getInitials(c.name)
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              lineHeight: 1.3,
                            }}
                            title={c.name}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={c.designation ? `${c.designation}${c.department && c.department !== c.designation ? ` · ${c.department}` : ""}` : undefined}
                          >
                            {c.designation || "Representative"}
                            {c.department && c.department !== c.designation ? ` · ${c.department}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Top-Right Quick Action Icons */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => onEditPerson(c)}
                          title="Edit Contact Details"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
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
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransferPerson(c)}
                          title="Transfer or Mark as Left"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            border: "1px solid #bae6fd",
                            backgroundColor: "#f0f9ff",
                            color: "#004d66",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#e0f2fe";
                            e.currentTarget.style.borderColor = "#7dd3fc";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0f9ff";
                            e.currentTarget.style.borderColor = "#bae6fd";
                          }}
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "14px 0 12px 0" }} />

                    {/* Contact Channels (Phone & Email) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#334155",
                            textDecoration: "none",
                            fontSize: 12.5,
                            transition: "color 0.15s ease",
                            width: "fit-content",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#004d66")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Phone size={11} style={{ color: "#0284c7" }} />
                          </span>
                          <span style={{ fontWeight: 500 }}>{c.phone}</span>
                        </a>
                      ) : null}

                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#334155",
                            textDecoration: "none",
                            fontSize: 12.5,
                            transition: "color 0.15s ease",
                            width: "fit-content",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#004d66")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Mail size={11} style={{ color: "#0284c7" }} />
                          </span>
                          <span style={{ fontWeight: 500, wordBreak: "break-all" }}>{c.email}</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}

                {client.contacts.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "48px 24px",
                      color: "#94a3b8",
                      gridColumn: "1 / -1",
                      backgroundColor: "#ffffff",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#f1f5f9",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <Users size={22} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                      No representative contacts added yet
                    </div>
                    <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 auto 14px", maxWidth: 360 }}>
                      Add key contacts or representatives for {client.name} to streamline communication and purchasing.
                    </p>
                    <button
                      onClick={() => onEdit(client)}
                      style={{
                        backgroundColor: "#004d66",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Plus size={14} />
                      <span>Add Contact</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "purchases" && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Product</th>
                    <th>Model / Brand</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {clientPurchasesList.map((p, idx) => (
                    <tr key={p.id || `purchase-${idx}`}>
                      <td style={{ fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                        {formatDate(p.invoiceCreatedDate)}
                      </td>
                      <td style={{ fontWeight: 600, color: "#004d66", whiteSpace: "nowrap" }}>
                        {p.invoiceNumber}
                      </td>
                      <td style={{ fontWeight: 600, color: "#0f172a" }}>
                        {p.productName}
                      </td>
                      <td style={{ color: "#475569" }}>
                        {p.modelBrand}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>
                        {p.qty}
                      </td>
                      <td style={{ fontWeight: 700, color: "#059669", textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                  {clientPurchasesList.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
                        No equipment purchases recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "expiry" && (
            <ClientProductExpiryTab client={client} invoices={invoices} />
          )}

          {activeTab === "contracts" && (
            <ClientMaintenanceContractsTab client={client} />
          )}

          {activeTab === "products" && isTrader && (
            <TraderCompanyProductsTab client={client} />
          )}

          {!isTrader && activeTab === "requirements" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {client.requirements.map((r) => (
                <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.product}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Qty: {r.quantity} {r.budget ? `· Budget: ${formatCurrency(r.budget)}` : ""} · Needed by: {r.requirementDate}
                    </div>
                  </div>
                  <span className={`badge badge-${r.priority.toLowerCase()}`}>{r.priority} Priority</span>
                </div>
              ))}
              {client.requirements.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                  No open RFP requirements.
                </div>
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {timeline.map((ev) => (
                <div key={`${ev.id}-${activityVersion}`} style={{ display: "flex", gap: 14 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background:
                        ev.category === "task" ? "#7c3aed" :
                        ev.category === "lead" ? "#ea580c" :
                        ev.category === "service" ? "#0891b2" :
                        ev.category === "quotation" || ev.category === "invoice" ? "#2563eb" :
                        ev.category === "contract" ? "#0f766e" :
                        ev.category === "expiry" ? "#dc2626" : "#42b69c",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                      {ev.category && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {ev.category}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{ev.description}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {ev.date}{ev.time ? ` ${ev.time}` : ""} • {ev.source}
                      {ev.actor ? ` • ${
                        ev.category === "task" && ev.title.startsWith("Task created")
                          ? "Created by "
                          : ["contact", "purchase", "requirement", "expiry", "organisation"].includes(ev.category || "")
                          ? "Added by "
                          : "By "
                      }${ev.actor}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>
                  No activity has been recorded for this organisation yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PEOPLE MODALS (ADD, EDIT, TRANSFER) ────────────────────────────────────

function AddPersonModal({
  clients,
  onClose,
  onSave,
}: {
  clients: Client[];
  onClose: () => void;
  onSave: (p: Omit<ContactPerson, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState<Department>("Biomedical Engineering");
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptList, setDeptList] = useState<string[]>(() => getStoredDepartments());

  const handleCreateDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      toast.error("Please enter a department name");
      return;
    }
    if (!deptList.includes(trimmed)) {
      const updated = [...deptList, trimmed];
      setDeptList(updated);
      saveStoredDepartments(updated);
    }
    setDepartment(trimmed as Department);
    setIsAddingDept(false);
    setNewDeptName("");
    toast.success(`Department "${trimmed}" selected!`);
  };
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto(reader.result);
        toast.success("Profile photo uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the contact person's name");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    const selectedClient = clients.find((c) => c.id === clientId);
    onSave({
      name: name.trim(),
      designation: designation.trim(),
      department,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim() || "",
      linkedin: linkedin.trim() || undefined,
      clientId: clientId || undefined,
      clientName: selectedClient ? selectedClient.name : undefined,
      notes: notes.trim(),
      status: clientId ? "Active at Organisation" : "Independent / Consultant",
      previousOrganisations: [],
      photo: photo || undefined,
      avatar: photo || undefined,
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
        zIndex: 200,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 740, maxHeight: "90vh", overflow: "auto", padding: 0, borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#002735" }}>Add Healthcare Professional</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Photo Upload Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              border: "1px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
                flexShrink: 0,
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <User size={22} style={{ color: "#94a3b8" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                Profile Photo
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                Upload JPG, PNG or WebP image (max 5MB)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                >
                  <Camera size={12} />
                  <span>{photo ? "Change Photo" : "Add Photo"}</span>
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto("")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 500,
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Trash2 size={11} />
                    <span>Remove</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Full Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Dr. Tariq Al Mansoori"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ fontSize: 13 }}
            />
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Designation / Title (optional)</label>
              <input
                className="form-input"
                placeholder="e.g. Chief Biomedical Engineer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 12, margin: 0 }}>Department</label>
                {!isAddingDept && (
                  <button
                    type="button"
                    onClick={() => setIsAddingDept(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#004d66",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {isAddingDept ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="text"
                    autoFocus
                    className="form-input"
                    placeholder="New department..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateDept();
                      } else if (e.key === "Escape") {
                        setIsAddingDept(false);
                        setNewDeptName("");
                      }
                    }}
                    style={{ flex: 1, fontSize: 12, height: 36 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateDept}
                    className="btn btn-primary"
                    style={{ height: 36, padding: "0 8px", fontSize: 11, backgroundColor: "#004d66" }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDept(false);
                      setNewDeptName("");
                    }}
                    className="btn btn-secondary"
                    style={{ height: 36, padding: "0 8px", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <CustomLightSelect
                  value={department}
                  options={deptList.map((d) => ({ value: d, label: d }))}
                  onChange={(val) => setDepartment(val as Department)}
                  onAddNew={() => setIsAddingDept(true)}
                  addNewLabel="+ Add New Department..."
                />
              )}
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Direct Mobile / Phone *</label>
              <input
                className="form-input"
                placeholder="+971 50 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>WhatsApp (optional)</label>
              <input
                className="form-input"
                placeholder="+971 50 000 0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Direct Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="doctor@hospital.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>LinkedIn Profile URL</label>
              <input
                className="form-input"
                placeholder="linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
              Healthcare Facility ({clients.length} Facilities Available)
            </label>
            <FacilityPicker
              clients={clients}
              value={clientId}
              onChange={setClientId}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Background / Notes</label>
            <textarea
              className="form-input"
              placeholder="e.g. Decision maker for ICU ventilators & patient monitors. Preferred contact via WhatsApp."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ fontSize: 13, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#004d66" }}>Add Contact Person</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPersonModal({
  person,
  onClose,
  onSave,
}: {
  person: ContactPerson;
  onClose: () => void;
  onSave: (updated: ContactPerson) => void;
}) {
  const [name, setName] = useState(person.name);
  const [designation, setDesignation] = useState(person.designation);
  const [department, setDepartment] = useState<Department>(person.department);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptList, setDeptList] = useState<string[]>(() => getStoredDepartments());

  const handleCreateDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      toast.error("Please enter a department name");
      return;
    }
    if (!deptList.includes(trimmed)) {
      const updated = [...deptList, trimmed];
      setDeptList(updated);
      saveStoredDepartments(updated);
    }
    setDepartment(trimmed as Department);
    setIsAddingDept(false);
    setNewDeptName("");
    toast.success(`Department "${trimmed}" selected!`);
  };
  const [phone, setPhone] = useState(person.phone);
  const [whatsapp, setWhatsapp] = useState(person.whatsapp || person.phone);
  const [email, setEmail] = useState(person.email);
  const [linkedin, setLinkedin] = useState(person.linkedin || "");
  const [status, setStatus] = useState<ContactStatus>(person.status || "Active at Organisation");
  const [notes, setNotes] = useState(person.notes || "");
  const [photo, setPhoto] = useState(person.photo || person.avatar || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto(reader.result);
        toast.success("Profile photo updated");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    onSave({
      ...person,
      name: name.trim(),
      designation: designation.trim(),
      department,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim(),
      linkedin: linkedin.trim() || undefined,
      status,
      notes: notes.trim(),
      photo: photo || undefined,
      avatar: photo || undefined,
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
        zIndex: 200,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 740, maxHeight: "90vh", overflow: "auto", padding: 0, borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#002735" }}>Edit Contact: {person.name}</h3>
              {person.clientName && (
                <span style={{ fontSize: 12, color: "#64748b" }}>Organisation: {person.clientName}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Photo Upload Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              border: "1px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
                flexShrink: 0,
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <User size={22} style={{ color: "#94a3b8" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                Profile Photo
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                Upload JPG, PNG or WebP image (max 5MB)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                >
                  <Camera size={12} />
                  <span>{photo ? "Change Photo" : "Add Photo"}</span>
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto("")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 500,
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Trash2 size={11} />
                    <span>Remove</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Full Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ fontSize: 13 }}
            />
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Designation / Title</label>
              <input
                className="form-input"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 12, margin: 0 }}>Department</label>
                {!isAddingDept && (
                  <button
                    type="button"
                    onClick={() => setIsAddingDept(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#004d66",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {isAddingDept ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="text"
                    autoFocus
                    className="form-input"
                    placeholder="New department..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateDept();
                      } else if (e.key === "Escape") {
                        setIsAddingDept(false);
                        setNewDeptName("");
                      }
                    }}
                    style={{ flex: 1, fontSize: 12, height: 36 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateDept}
                    className="btn btn-primary"
                    style={{ height: 36, padding: "0 8px", fontSize: 11, backgroundColor: "#004d66" }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDept(false);
                      setNewDeptName("");
                    }}
                    className="btn btn-secondary"
                    style={{ height: 36, padding: "0 8px", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <CustomLightSelect
                  value={department}
                  options={deptList.map((d) => ({ value: d, label: d }))}
                  onChange={(val) => setDepartment(val as Department)}
                  onAddNew={() => setIsAddingDept(true)}
                  addNewLabel="+ Add New Department..."
                />
              )}
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Phone</label>
              <input
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>WhatsApp</label>
              <input
                className="form-input"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>LinkedIn Profile URL</label>
              <input
                className="form-input"
                placeholder="https://linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Mobility / Facility Status</label>
            <CustomLightSelect
              value={status}
              options={[
                { value: "Active at Organisation", label: "Active at Organisation" },
                { value: "Changed Organisation", label: "Changed Organisation (Moved Facility)" },
                { value: "Independent / Consultant", label: "Independent / Free Agent" },
              ]}
              onChange={(val) => setStatus(val as ContactStatus)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Notes & Conversation History</label>
            <textarea
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ fontSize: 13, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#004d66" }}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferPersonModal({
  person,
  clients,
  onClose,
  onTransfer,
}: {
  person: ContactPerson;
  clients: Client[];
  onClose: () => void;
  onTransfer: (newClientId: string | null, newRole?: string, notes?: string) => void;
}) {
  const [transferType, setTransferType] = useState<"new_org" | "independent">("new_org");
  const [targetClientId, setTargetClientId] = useState<string>(clients[0]?.id || "");
  const [newRole, setNewRole] = useState(person.designation);
  const [notes, setNotes] = useState("");

  const availableClients = clients
    .filter((c) => c.id !== person.clientId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleConfirm = () => {
    if (transferType === "new_org") {
      if (!targetClientId) {
        toast.error("Please select the new healthcare facility");
        return;
      }
      onTransfer(targetClientId, newRole, notes);
    } else {
      onTransfer(null, undefined, notes);
    }
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
        zIndex: 200,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", padding: 0, borderRadius: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔄</span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#002735" }}>
                Transfer / Change Organisation
              </h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>Contact: {person.name}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Explanation Alert */}
          <div
            style={{
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 12.5,
              color: "#0369a1",
              lineHeight: 1.5,
            }}
          >
            💡 If <strong>{person.name}</strong> has left <strong>{person.clientName || "their facility"}</strong>, their mobile number and email will be permanently preserved in FastonMed so you can contact them again. Prior facility will be archived in their career history.
          </div>

          {/* Transfer Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                border: transferType === "new_org" ? "2px solid #004d66" : "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: "pointer",
                backgroundColor: transferType === "new_org" ? "#f8fafc" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="transferType"
                checked={transferType === "new_org"}
                onChange={() => setTransferType("new_org")}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                  Moved to a New Healthcare Facility
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Assign {person.name} to another hospital or clinic in UAE
                </div>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                border: transferType === "independent" ? "2px solid #004d66" : "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: "pointer",
                backgroundColor: transferType === "independent" ? "#f8fafc" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="transferType"
                checked={transferType === "independent"}
                onChange={() => setTransferType("independent")}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                  Left Facility / Independent Consultant
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Keep contact in your directory as an independent advisor or between jobs
                </div>
              </div>
            </label>
          </div>

          {/* Target Facility selector if new_org */}
          {transferType === "new_org" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, backgroundColor: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
                  New Healthcare Facility ({availableClients.length} Facilities Available) *
                </label>
                <FacilityPicker
                  clients={availableClients}
                  value={targetClientId}
                  onChange={setTargetClientId}
                  allowIndependent={false}
                  placeholder="Select new facility..."
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  New Designation / Role (optional)
                </label>
                <input
                  className="form-input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Biomedical Director"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Transition Notes (optional)
            </label>
            <input
              className="form-input"
              placeholder="e.g. Moved in Jan 2025, handles upcoming cardiology tender"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: "#004d66" }}
              onClick={handleConfirm}
            >
              Confirm Transfer & Update History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
