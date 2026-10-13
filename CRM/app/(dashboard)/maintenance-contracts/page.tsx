"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  getStoredContracts,
  addStoredContract,
  updateStoredContract,
  deleteStoredContract,
  syncLiveContractsFromApi,
} from "@/lib/contract-store";
import {
  getStoredClients,
  saveStoredClients,
  contractOrganisationToClient,
  normalizeOrganisationName,
} from "@/lib/client-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AMCContract, AMCStatus, Client } from "@/types";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  Search,
  Plus,
  Building2,
  Package,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  X,
  Download,
  ChevronDown,
  User,
  Phone,
  Mail,
  DollarSign,
  FileText,
  Layers,
  LayoutGrid,
  List as ListIcon,
  ExternalLink,
  Check,
  RefreshCw,
} from "lucide-react";

// Days to expiry calculator
function getDaysToExpiry(expiryDateStr?: string): number {
  if (!expiryDateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(days: number) {
  if (days < 0) {
    return {
      label: `Expired (${Math.abs(days)}d)`,
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }
  if (days <= 30) {
    return {
      label: `Due in ${days}d`,
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  }
  return {
    label: `Active (${days}d)`,
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  };
}

const SERVICE_TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  "Comprehensive AMC": {
    label: "Comprehensive AMC",
    bg: "#eef2ff",
    text: "#4338ca",
    border: "#c7d2fe",
    dot: "#4f46e5",
  },
  "Preventive Maintenance": {
    label: "Preventive Maintenance",
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
    dot: "#059669",
  },
  "Calibration & Safety Check": {
    label: "Calibration & Safety Check",
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
    dot: "#d97706",
  },
  "Non-Comprehensive AMC": {
    label: "Non-Comprehensive AMC",
    bg: "#f1f5f9",
    text: "#334155",
    border: "#cbd5e1",
    dot: "#64748b",
  },
  "Breakdown Support": {
    label: "Breakdown Support",
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    dot: "#ef4444",
  },
};

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

function getOrgAvatarBg(orgType?: string) {
  switch (orgType) {
    case "Individual Contact":
    case "Doctor / Practitioner":
      return "#fef3c7";
    case "Diagnostic Centre":
      return "#e0f2fe";
    case "Medical Equipment Trader":
      return "#fef3c7";
    case "Pharmacy":
      return "#fce7f3";
    case "Laboratory":
      return "#ecfdf5";
    default:
      return "#e0f2fe";
  }
}

export default function MaintenanceContractsPage() {
  const [contracts, setContracts] = useState<AMCContract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Search & Filter controls matching screenshot
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("default");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Modals & Dropdown states
  const [selectedContract, setSelectedContract] = useState<AMCContract | null>(null);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);

  // Custom Searchable Dropdown States for Organisation
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [orgSearchText, setOrgSearchText] = useState("");
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  // Add new organisation panel state
  const [showAddOrgPanel, setShowAddOrgPanel] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState("Hospital");
  const [newOrgCity, setNewOrgCity] = useState("Dubai");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgContactPerson, setNewOrgContactPerson] = useState("");

  // Form Fields for Add/Edit
  const [formId, setFormId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formContractNumber, setFormContractNumber] = useState("");
  const [formTypeOfService, setFormTypeOfService] = useState("Comprehensive AMC");
  const [formClientId, setFormClientId] = useState("");
  const [formOrganisation, setFormOrganisation] = useState("");
  const [formOrgType, setFormOrgType] = useState("Hospital");
  const [formStartDate, setFormStartDate] = useState("2026-01-01");
  const [formExpiryDate, setFormExpiryDate] = useState("2026-12-31");
  const [formValue, setFormValue] = useState<number | string>(65000);
  const [formExistingContractor, setFormExistingContractor] = useState("FastonMed");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formStatus, setFormStatus] = useState<AMCStatus>("Active");
  const [formNotes, setFormNotes] = useState("");

  const refreshContracts = async (showConfirmation = false) => {
    setIsSyncing(true);
    const fresh = await syncLiveContractsFromApi();
    setContracts(fresh);
    setLastSyncedAt(new Date());
    setIsSyncing(false);
    if (showConfirmation) {
      toast.success(fresh.length > 0 ? `${fresh.length} live contracts loaded` : "The live website has no maintenance contracts yet");
    }
  };

  // Load cached data immediately, then refresh from the shared source.
  useEffect(() => {
    setContracts(getStoredContracts());
    setClients(getStoredClients());
    void refreshContracts();

    const handleContractsUpdated = () => {
      setContracts(getStoredContracts());
    };
    const handleClientsUpdated = () => {
      setClients(getStoredClients());
    };
    const handleWindowFocus = () => void refreshContracts();

    window.addEventListener("fastonmed_contracts_updated", handleContractsUpdated);
    window.addEventListener("fastonmed_clients_updated", handleClientsUpdated);
    window.addEventListener("focus", handleWindowFocus);

    // Keep shared data fresh without continuously blocking the local development server.
    const pollTimer = setInterval(() => {
      void refreshContracts();
    }, 60000);

    return () => {
      window.removeEventListener("fastonmed_contracts_updated", handleContractsUpdated);
      window.removeEventListener("fastonmed_clients_updated", handleClientsUpdated);
      window.removeEventListener("focus", handleWindowFocus);
      clearInterval(pollTimer);
    };
  }, []);

  const filteredClientsInModal = useMemo(() => {
    if (!orgSearchText.trim()) return clients;
    const q = orgSearchText.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.orgType || "").toLowerCase().includes(q)
    );
  }, [clients, orgSearchText]);

  const handleSaveNewOrg = () => {
    const name = newOrgName.trim();
    if (!name) {
      toast.error("Please enter organisation name");
      return;
    }

    let creator: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}

    const newClient: Client = {
      id: `client-${Date.now()}`,
      name,
      orgType: newOrgType as any,
      city: newOrgCity.trim() || "Dubai",
      state: "Dubai",
      address: `${newOrgCity.trim() || "Dubai"}, UAE`,
      phone: newOrgPhone.trim(),
      email: newOrgEmail.trim(),
      status: "Existing Customer",
      source: "Referral",
      assignedTo: "emp-1",
      createdAt: new Date().toISOString(),
      createdBy: creator.name || "User not recorded",
      createdById: creator.id,
      contacts: newOrgContactPerson.trim()
        ? [
            {
              id: `person-${Date.now()}`,
              name: newOrgContactPerson.trim(),
              designation: "Key Contact",
              department: "Biomedical Engineering",
              phone: newOrgPhone.trim(),
              email: newOrgEmail.trim(),
              createdAt: new Date().toISOString(),
              createdBy: creator.name || "User not recorded",
              createdById: creator.id,
            },
          ]
        : [],
      purchases: [],
      requirements: [],
      totalRevenue: 0,
    };

    const updated = [newClient, ...clients];
    setClients(updated);
    saveStoredClients(updated);
    window.dispatchEvent(new Event("fastonmed_clients_updated"));

    handleSelectCrmOrganisation(newClient.id);
    setShowAddOrgPanel(false);
    setOrgDropdownOpen(false);
    setOrgSearchText("");
    toast.success(`Organisation "${newClient.name}" added and selected!`);
  };

  // Dismiss dropdown on outside click or escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-contract-actions]")) {
        setActiveActionDropdownId(null);
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveActionDropdownId(null);
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Fast client lookup map by ID and Name
  const clientMap = useMemo(() => {
    const byId = new Map<string, Client>();
    const byName = new Map<string, Client>();
    clients.forEach((cl) => {
      if (cl.id) byId.set(cl.id, cl);
      if (cl.name) byName.set(cl.name.toLowerCase(), cl);
    });
    return { byId, byName };
  }, [clients]);

  // Helper to find connected CRM organisation for a contract
  const getConnectedClient = (c: AMCContract): Client | undefined => {
    if (c.clientId && clientMap.byId.has(c.clientId)) {
      return clientMap.byId.get(c.clientId);
    }
    const nameKey = (c.organisation || c.clientName || "").toLowerCase();
    return clientMap.byName.get(nameKey);
  };

  // Available unique service types for filter
  const availableServiceTypes = useMemo(() => {
    const types = new Set<string>();
    contracts.forEach((c) => {
      if (c.typeOfService) types.add(c.typeOfService);
    });
    return Array.from(types);
  }, [contracts]);

  // Filtered and Sorted Contracts
  const filteredAndSortedContracts = useMemo(() => {
    let result = contracts.filter((c) => {
      const type = c.typeOfService || "Comprehensive AMC";
      if (serviceTypeFilter !== "All" && type !== serviceTypeFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;

      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const matchTitle = (c.title || "").toLowerCase().includes(q);
      const matchNumber = (c.contractNumber || "").toLowerCase().includes(q);
      const matchOrg = (c.organisation || c.clientName || "").toLowerCase().includes(q);
      const matchContractor = (c.existingContractor || "").toLowerCase().includes(q);
      const matchContact = (c.contactPerson || "").toLowerCase().includes(q);
      const matchType = (c.typeOfService || "").toLowerCase().includes(q);
      return matchTitle || matchNumber || matchOrg || matchContractor || matchContact || matchType;
    });

    // Sorting
    if (sortBy === "value-desc") {
      result.sort((a, b) => (b.value || b.amount || 0) - (a.value || a.amount || 0));
    } else if (sortBy === "value-asc") {
      result.sort((a, b) => (a.value || a.amount || 0) - (b.value || b.amount || 0));
    } else if (sortBy === "expiry-soon") {
      result.sort((a, b) => {
        const dA = new Date(a.expiryDate || a.endDate).getTime();
        const dB = new Date(b.expiryDate || b.endDate).getTime();
        return dA - dB;
      });
    } else if (sortBy === "expiry-late") {
      result.sort((a, b) => {
        const dA = new Date(a.expiryDate || a.endDate).getTime();
        const dB = new Date(b.expiryDate || b.endDate).getTime();
        return dB - dA;
      });
    } else if (sortBy === "title-az") {
      result.sort((a, b) => (a.title || a.contractNumber).localeCompare(b.title || b.contractNumber));
    } else if (sortBy === "title-za") {
      result.sort((a, b) => (b.title || b.contractNumber).localeCompare(a.title || a.contractNumber));
    } else if (sortBy === "org-az") {
      result.sort((a, b) => (a.organisation || a.clientName || "").localeCompare(b.organisation || b.clientName || ""));
    } else if (sortBy === "org-za") {
      result.sort((a, b) => (b.organisation || b.clientName || "").localeCompare(a.organisation || a.clientName || ""));
    } else if (sortBy === "type-az") {
      result.sort((a, b) => (a.typeOfService || "").localeCompare(b.typeOfService || ""));
    } else if (sortBy === "contractor-az") {
      result.sort((a, b) => (a.existingContractor || "FastonMed").localeCompare(b.existingContractor || "FastonMed"));
    }

    return result;
  }, [contracts, serviceTypeFilter, statusFilter, sortBy, search]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedContracts.length / pageSize) || 1;
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedContracts.slice(start, start + pageSize);
  }, [filteredAndSortedContracts, currentPage, pageSize]);

  // Overall Stats
  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => {
      const days = getDaysToExpiry(c.expiryDate || c.endDate);
      return days >= 0;
    }).length;
    const totalVal = contracts.reduce((acc, c) => acc + (c.value || c.amount || 0), 0);
    const contractorCount = new Set(contracts.map((c) => c.existingContractor || "FastonMed")).size;
    return { total, active, totalVal, contractorCount };
  }, [contracts]);

  const handleSortColumn = (col: string) => {
    setCurrentPage(1);
    if (col === "title") {
      setSortBy((prev) => (prev === "title-az" ? "title-za" : "title-az"));
    } else if (col === "type") {
      setSortBy((prev) => (prev === "type-az" ? "default" : "type-az"));
    } else if (col === "org") {
      setSortBy((prev) => (prev === "org-az" ? "org-za" : "org-az"));
    } else if (col === "expiry") {
      setSortBy((prev) => (prev === "expiry-soon" ? "expiry-late" : "expiry-soon"));
    } else if (col === "value") {
      setSortBy((prev) => (prev === "value-desc" ? "value-asc" : "value-desc"));
    } else if (col === "contractor") {
      setSortBy((prev) => (prev === "contractor-az" ? "default" : "contractor-az"));
    }
  };

  const getSortIcon = (col: string) => {
    if (col === "title") {
      if (sortBy === "title-az") return " ↑";
      if (sortBy === "title-za") return " ↓";
    } else if (col === "type") {
      if (sortBy === "type-az") return " ↑";
    } else if (col === "org") {
      if (sortBy === "org-az") return " ↑";
      if (sortBy === "org-za") return " ↓";
    } else if (col === "expiry") {
      if (sortBy === "expiry-soon") return " ↑";
      if (sortBy === "expiry-late") return " ↓";
    } else if (col === "value") {
      if (sortBy === "value-desc") return " ↓";
      if (sortBy === "value-asc") return " ↑";
    } else if (col === "contractor") {
      if (sortBy === "contractor-az") return " ↑";
    }
    return " ↕";
  };

  // Handle CRM Organisation Selection in Modal
  const handleSelectCrmOrganisation = (clientId: string) => {
    setOrgDropdownOpen(false);
    setOrgSearchText("");
    if (clientId === "CUSTOM") {
      setFormClientId("CUSTOM");
      setFormOrganisation("");
      return;
    }
    setFormClientId(clientId);
    const found = clients.find((cl) => cl.id === clientId);
    if (found) {
      setFormOrganisation(found.name);
      setFormOrgType(found.orgType || "Hospital");
      const contact = found.contacts?.[0];
      setFormContactPerson(contact?.name || found.name);
      setFormContactPhone(contact?.phone || found.phone || "");
      setFormContactEmail(contact?.email || found.email || "");
      toast.success(`Selected: ${found.name}`);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setOrgDropdownOpen(false);
    setOrgSearchText("");
    setShowAddOrgPanel(false);
    const newId = `amc-${Date.now()}`;
    const nextNum = `AMC-2026-${String(contracts.length + 1).padStart(4, "0")}`;
    setFormId(newId);
    setFormContractNumber(nextNum);
    setFormTitle("Biomedical Equipment Annual Maintenance Agreement");
    setFormTypeOfService("Comprehensive AMC");
    const firstClient = clients[0];
    if (firstClient) {
      setFormClientId(firstClient.id);
      setFormOrganisation(firstClient.name);
      setFormOrgType(firstClient.orgType || "Hospital");
      const contact = firstClient.contacts?.[0];
      setFormContactPerson(contact?.name || firstClient.name);
      setFormContactPhone(contact?.phone || firstClient.phone || "+971 50 123 4567");
      setFormContactEmail(contact?.email || firstClient.email || "");
    } else {
      setFormClientId("c-1");
      setFormOrganisation("Cleveland Clinic Abu Dhabi");
      setFormOrgType("Hospital");
      setFormContactPerson("Dr. Tariq Al-Nuaimi");
      setFormContactPhone("+971 50 123 4567");
      setFormContactEmail("");
    }
    setFormStartDate("2026-01-01");
    setFormExpiryDate("2026-12-31");
    setFormValue(75000);
    setFormExistingContractor("FastonMed");
    setFormStatus("Active");
    setFormNotes("Quarterly preventive maintenance with full electrical safety analysis and certification.");
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: AMCContract) => {
    setIsEditMode(true);
    setOrgDropdownOpen(false);
    setOrgSearchText("");
    setShowAddOrgPanel(false);
    setFormId(c.id);
    setFormContractNumber(c.contractNumber || "");
    setFormTitle(c.title || `Maintenance Contract ${c.contractNumber}`);
    setFormTypeOfService(c.typeOfService || "Comprehensive AMC");
    setFormClientId(c.clientId || "");
    setFormOrganisation(c.organisation || c.clientName || "");
    setFormOrgType(c.orgType || "Hospital");
    setFormStartDate(c.startDate || "2026-01-01");
    setFormExpiryDate(c.expiryDate || c.endDate || "2026-12-31");
    setFormValue(c.value || c.amount || 0);
    setFormExistingContractor(c.existingContractor || "FastonMed");
    setFormContactPerson(c.contactPerson || "");
    setFormContactPhone(c.contactPhone || "");
    setFormContactEmail(c.contactEmail || "");
    setFormStatus(c.status || "Active");
    setFormNotes(c.notes || "");
    setShowAddEditModal(true);
  };

  // Save Contract
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a contract title");
      return;
    }
    if (!formOrganisation.trim()) {
      toast.error("Please select or enter an organization");
      return;
    }

    const val = Number(formValue) || 0;
    const days = getDaysToExpiry(formExpiryDate);
    const computedStatus: AMCStatus = days < 0 ? "Expired" : days <= 30 ? "Expiring Soon" : formStatus;
    let creator: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}
    const existingContract = contracts.find((contract) => contract.id === formId);

    // Ensure organisation exists in CRM directory
    const allClients = getStoredClients();
    const matchedClient = allClients.find(
      (c) =>
        (formClientId && formClientId !== "CUSTOM" && formClientId !== "c-custom" && c.id === formClientId) ||
        normalizeOrganisationName(c.name) === normalizeOrganisationName(formOrganisation)
    );

    let effectiveClientId = matchedClient?.id;
    if (!matchedClient && formOrganisation.trim()) {
      const newClient = contractOrganisationToClient({
        id: formId,
        title: formTitle.trim(),
        contractNumber: formContractNumber.trim() || `AMC-${Date.now()}`,
        typeOfService: formTypeOfService,
        clientId: `client-${Date.now()}`,
        clientName: formOrganisation.trim(),
        organisation: formOrganisation.trim(),
        orgType: formOrgType,
        startDate: formStartDate,
        endDate: formExpiryDate,
        expiryDate: formExpiryDate,
        amount: val,
        value: val,
        existingContractor: formExistingContractor.trim() || "FastonMed",
        contactPerson: formContactPerson.trim(),
        contactPhone: formContactPhone.trim(),
        contactEmail: formContactEmail.trim(),
        paymentStatus: "Paid",
        status: computedStatus,
        serviceSchedule: ["2026-03-01", "2026-06-01", "2026-09-01", "2026-12-01"],
        assignedEngineerId: "emp-hashim",
        equipments: [{ name: formTitle.trim(), model: "Standard", serialNumber: "SN-AMC-001" }],
        notes: formNotes.trim(),
      });
      const updatedClients = [newClient, ...allClients];
      saveStoredClients(updatedClients);
      effectiveClientId = newClient.id;
    }

    const contractData: AMCContract = {
      id: formId,
      title: formTitle.trim(),
      contractNumber: formContractNumber.trim() || `AMC-${Date.now()}`,
      typeOfService: formTypeOfService,
      clientId: effectiveClientId || formClientId || "c-custom",
      clientName: formOrganisation.trim(),
      organisation: formOrganisation.trim(),
      orgType: formOrgType,
      startDate: formStartDate,
      endDate: formExpiryDate,
      expiryDate: formExpiryDate,
      amount: val,
      value: val,
      existingContractor: formExistingContractor.trim() || "FastonMed",
      contactPerson: formContactPerson.trim(),
      contactPhone: formContactPhone.trim(),
      contactEmail: formContactEmail.trim(),
      paymentStatus: "Paid",
      status: computedStatus,
      serviceSchedule: ["2026-03-01", "2026-06-01", "2026-09-01", "2026-12-01"],
      assignedEngineerId: "emp-hashim",
      equipments: [{ name: formTitle.trim(), model: "Standard", serialNumber: "SN-AMC-001" }],
      notes: formNotes.trim(),
      createdBy: existingContract?.createdBy || creator.name || "User not recorded",
      createdById: existingContract?.createdById || creator.id,
    };

    setIsSaving(true);
    try {
      const savedContracts = isEditMode
        ? await updateStoredContract(contractData)
        : await addStoredContract(contractData);
      setContracts(savedContracts);
      setClients(getStoredClients());
      window.dispatchEvent(new Event("fastonmed_clients_updated"));
      toast.success(`${isEditMode ? "Updated" : "Created"} contract: ${contractData.title}`);
      setShowAddEditModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the contract to the live website");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Contract
  const handleDeleteContract = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        const savedContracts = await deleteStoredContract(id);
        setContracts(savedContracts);
        if (selectedContract?.id === id) setSelectedContract(null);
        toast.success(`Deleted contract: ${name}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete the contract from the live website");
      }
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (contracts.length === 0) {
      toast.error("No contracts to export");
      return;
    }
    const headers = [
      "Title",
      "Type of Service",
      "Organisation",
      "Expiry Date",
      "Value (AED)",
      "Existing Contractor",
      "Contact Person",
      "Contact Phone",
      "Status",
    ];
    const rows = filteredAndSortedContracts.map((c) => [
      `"${c.title || c.contractNumber}"`,
      `"${c.typeOfService || "Comprehensive AMC"}"`,
      `"${c.organisation || c.clientName}"`,
      c.expiryDate || c.endDate,
      c.value || c.amount || 0,
      `"${c.existingContractor || "FastonMed"}"`,
      `"${c.contactPerson || "—"}"`,
      `"${c.contactPhone || "—"}"`,
      c.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `maintenance_contracts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Contracts sheet exported to CSV");
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1440, margin: "0 auto" }}>
      {/* ================= TOP CONTROLS BAR (MATCHING SCREENSHOT) ================= */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: 16,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {isSyncing && contracts.length === 0 && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              marginBottom: 14,
              borderRadius: 8,
              background: "#f0f9ff",
              color: "#075985",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className="spin" />
            Loading maintenance contracts from the live website…
          </div>
        )}
        {/* Row 1: Entries + Search Box */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {/* Showing [ 10 ⌵ ] entries */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
            <span>Showing</span>
            <select
              className="form-input"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                width: 75,
                height: 36,
                fontSize: 13,
                fontWeight: 600,
                textAlign: "center",
                padding: "0 6px",
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>

          {/* Search by title, contractor, organisation... */}
          <div style={{ position: "relative", width: 380, maxWidth: "100%" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, contractor, organisation..."
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Category/Type filter, Status filter, Sort filter, Grid/List toggle, Add button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Type of Service Filter */}
            <select
              className="form-input"
              value={serviceTypeFilter}
              onChange={(e) => {
                setServiceTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 200, height: 36, fontSize: 12.5 }}
            >
              <option value="All">All Types of Service ({contracts.length})</option>
              {availableServiceTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 140, height: 36, fontSize: 12.5 }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
            </select>

            {/* Sort by */}
            <select
              className="form-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: 155, height: 36, fontSize: 12.5 }}
            >
              <option value="default">Sort by (Default)</option>
              <option value="value-desc">Value: High to Low</option>
              <option value="value-asc">Value: Low to High</option>
              <option value="expiry-soon">Expiry: Soonest</option>
              <option value="title-az">Title: A to Z</option>
            </select>

            {/* View Toggle: Grid / List */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#f1f5f9",
                padding: 2,
                borderRadius: 7,
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: viewMode === "grid" ? "#004d66" : "transparent",
                  color: viewMode === "grid" ? "#ffffff" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                <LayoutGrid size={13} />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: viewMode === "list" ? "#004d66" : "transparent",
                  color: viewMode === "list" ? "#ffffff" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                <ListIcon size={13} />
                <span>List</span>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refreshContracts(true)}
              disabled={isSyncing}
              title={lastSyncedAt ? `Last refreshed ${lastSyncedAt.toLocaleTimeString()}` : "Refresh contracts"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, fontSize: 12.5, padding: "0 12px" }}
            >
              <RefreshCw size={13} className={isSyncing ? "spin" : undefined} />
              <span>{isSyncing ? "Refreshing…" : "Refresh"}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCsv}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                fontSize: 12.5,
                padding: "0 12px",
              }}
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {/* + Add Contract button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                fontSize: 12.5,
                padding: "0 16px",
                fontWeight: 600,
                backgroundColor: "#004d66",
                color: "#ffffff",
                boxShadow: "0 1px 2px rgba(0,77,102,0.2)",
              }}
            >
              <Plus size={14} />
              <span>Add Contract</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= SUB-BAR: COUNT + STATS INDICATORS ================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "2px 4px 12px 4px",
          fontSize: 12.5,
          color: "#64748b",
        }}
      >
        <div>
          Showing <strong style={{ color: "#0f172a" }}>{paginatedContracts.length}</strong> of{" "}
          <strong style={{ color: "#0f172a" }}>{filteredAndSortedContracts.length}</strong> contracts
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setStatusFilter((prev) => (prev === "Active" ? "All" : "Active"));
              setCurrentPage(1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 20,
              border: statusFilter === "Active" ? "1px solid #10b981" : "1px solid #e2e8f0",
              background: statusFilter === "Active" ? "#ecfdf5" : "#ffffff",
              cursor: "pointer",
              fontSize: 12,
              color: "#0f172a",
              transition: "all 0.15s ease",
            }}
            title="Click to filter by Active contracts"
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ fontWeight: 700 }}>{stats.active}</span> Active Contracts
          </button>

          <button
            type="button"
            onClick={() => {
              setSortBy((prev) => (prev === "value-desc" ? "value-asc" : "value-desc"));
              setCurrentPage(1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 20,
              border: sortBy.startsWith("value") ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: sortBy.startsWith("value") ? "#f0f9ff" : "#ffffff",
              cursor: "pointer",
              fontSize: 12,
              color: "#0f172a",
              transition: "all 0.15s ease",
            }}
            title="Click to sort by Value"
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0284c7", display: "inline-block" }} />
            <span style={{ fontWeight: 700 }}>{formatCurrency(stats.totalVal)}</span> Total Value
          </button>

          <button
            type="button"
            onClick={() => {
              setServiceTypeFilter("All");
              setStatusFilter("All");
              setSearch("");
              setCurrentPage(1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: 12,
              color: "#0f172a",
              transition: "all 0.15s ease",
            }}
            title="Click to view all partner contractors"
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />
            <span style={{ fontWeight: 700 }}>{stats.contractorCount}</span> Partner Contractors
          </button>
        </div>
      </div>

      {/* ================= SHEET TABLE VIEW ================= */}
      {viewMode === "list" ? (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Table Container with proper horizontal overflow so columns NEVER squish or break text */}
          <div className="table-container" style={{ border: "none", overflowX: "auto" }}>
            <table data-mobile-cards="true" style={{ width: "100%", minWidth: 1260, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {/* 1. Title */}
                  <th
                    onClick={() => handleSortColumn("title")}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("title") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 250,
                      minWidth: 250,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Title"
                  >
                    <span>Title</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("title")}</span>
                  </th>

                  {/* 2. Type of Service */}
                  <th
                    onClick={() => handleSortColumn("type")}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("type") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 180,
                      minWidth: 180,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Type of Service"
                  >
                    <span>Type of Service</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("type")}</span>
                  </th>

                  {/* 3. Organisation */}
                  <th
                    onClick={() => handleSortColumn("org")}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("org") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 210,
                      minWidth: 210,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Organisation"
                  >
                    <span>Organisation</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("org")}</span>
                  </th>

                  {/* 4. Expiry Timeline */}
                  <th
                    onClick={() => handleSortColumn("expiry")}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("expiry") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 155,
                      minWidth: 155,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Expiry Timeline"
                  >
                    <span>Expiry Timeline</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("expiry")}</span>
                  </th>

                  {/* 5. Value */}
                  <th
                    onClick={() => handleSortColumn("value")}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("value") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 135,
                      minWidth: 135,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Value"
                  >
                    <span>Value</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("value")}</span>
                  </th>

                  {/* 6. Existing Contractor */}
                  <th
                    onClick={() => handleSortColumn("contractor")}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortBy.startsWith("contractor") ? "#004d66" : "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 165,
                      minWidth: 165,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    title="Click to sort by Existing Contractor"
                  >
                    <span>Existing Contractor</span>
                    <span style={{ fontSize: 10, marginLeft: 4 }}>{getSortIcon("contractor")}</span>
                  </th>

                  {/* 7. Contact */}
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 175,
                      minWidth: 175,
                    }}
                  >
                    Contact
                  </th>

                  {/* 8. Sticky Action Column */}
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid #e2e8f0",
                      width: 140,
                      minWidth: 140,
                      position: "sticky",
                      right: 0,
                      backgroundColor: "#f8fafc",
                      zIndex: 3,
                      boxShadow: "-3px 0 6px rgba(0,0,0,0.03)",
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedContracts.map((c, rowIdx) => {
                  const serviceType = c.typeOfService || "Comprehensive AMC";
                  const typeConf = SERVICE_TYPE_CONFIG[serviceType] || SERVICE_TYPE_CONFIG["Comprehensive AMC"];
                  const expDate = c.expiryDate || c.endDate;
                  const days = getDaysToExpiry(expDate);
                  const badge = getExpiryBadge(days);
                  const contractor = c.existingContractor || "FastonMed";
                  const contractVal = c.value || c.amount || 0;

                  // CRM connected organisation lookup
                  const matchedClient = getConnectedClient(c);
                  const orgName = matchedClient?.name || c.organisation || c.clientName || "Healthcare Facility";
                  const orgSubtitle = matchedClient?.orgType || c.orgType || "Hospital";
                  const contactName = c.contactPerson || matchedClient?.contacts?.[0]?.name || "—";
                  const contactPhone = c.contactPhone || matchedClient?.phone || matchedClient?.contacts?.[0]?.phone;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContract(c)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: "#ffffff",
                        transition: "background 0.12s ease",
                      }}
                      className="hover:bg-slate-50"
                    >
                      {/* 1. Title (No awkward line breaks on badges) */}
                      <td data-label="Title" style={{ padding: "12px 16px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", lineHeight: 1.35 }}>
                            {c.title || `Maintenance Agreement ${c.contractNumber}`}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#475569",
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                display: "inline-block",
                              }}
                            >
                              {c.contractNumber}
                            </span>
                            {(c.equipments || []).length > 0 && (
                              <span style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap" }}>
                                • {(c.equipments || []).length} equipment unit{c.equipments!.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Type of Service (Single line badge) */}
                      <td data-label="Type of Service" style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: typeConf.bg,
                            color: typeConf.text,
                            border: `1px solid ${typeConf.border}`,
                            fontSize: 11.5,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: typeConf.dot }} />
                          {typeConf.label}
                        </span>
                      </td>

                      {/* 3. Organisation (Always Clickable Link to CRM) */}
                      <td data-label="Organisation" style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ minWidth: 0 }}>
                          <Link
                            href={
                              matchedClient
                                ? `/clients?id=${matchedClient.id}&name=${encodeURIComponent(matchedClient.name)}`
                                : `/clients?search=${encodeURIComponent(orgName)}`
                            }
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: "#0f172a",
                              lineHeight: 1.3,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#004d66")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                            title="Click to view full Organisation in CRM"
                          >
                            <span>{orgName}</span>
                            <ExternalLink size={11} color="#94a3b8" />
                          </Link>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>
                              {matchedClient?.orgType || orgSubtitle}
                              {matchedClient?.city ? ` • ${matchedClient.city}` : ""}
                            </span>
                            <Link
                              href={matchedClient ? `/clients?id=${matchedClient.id}` : `/clients?search=${encodeURIComponent(orgName)}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ textDecoration: "none" }}
                            >
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  background: "#e0f2fe",
                                  color: "#0369a1",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                }}
                                title="Open CRM client record"
                              >
                                CRM
                              </span>
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* 4. Expiry Timeline (Clean single-line pill) */}
                      <td data-label="Expiry Timeline" style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {formatDate(expDate)}
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "2px 7px",
                              borderRadius: 5,
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color }} />
                            {badge.label}
                          </span>
                        </div>
                      </td>

                      {/* 5. Value */}
                      <td data-label="Value" style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {formatCurrency(contractVal)}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#059669", fontWeight: 600, marginTop: 1, whiteSpace: "nowrap" }}>
                          Annual Agreement
                        </div>
                      </td>

                      {/* 6. Existing Contractor (Clickable to Filter) */}
                      <td data-label="Existing Contractor"
                        style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearch(contractor === "FastonMed" ? "FastonMed" : contractor);
                        }}
                        title={`Click to filter by ${contractor}`}
                      >
                        {contractor === "FastonMed" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "#059669",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: 5,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                            }}
                          >
                            <ShieldCheck size={12} color="#059669" />
                            FastonMed
                          </span>
                        ) : (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", cursor: "pointer" }}>
                            <Building2 size={12} color="#64748b" />
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
                              {contractor}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. Contact (Clean, no text breaking) */}
                      <td data-label="Contact" style={{ padding: "12px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        {contactName && contactName !== "—" ? (
                          <div style={{ whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", lineHeight: 1.25, whiteSpace: "nowrap" }}>
                              {contactName}
                            </div>
                            {contactPhone && (
                              <a
                                href={`tel:${contactPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  fontSize: 11,
                                  color: "#0284c7",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  textDecoration: "none",
                                  marginTop: 3,
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Phone size={10} />
                                <span>{contactPhone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* 8. Sticky Action Column with Unified Dropdown */}
                      <td data-label="Action"
                        data-contract-actions
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          verticalAlign: "middle",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid #f1f5f9",
                          position: "sticky",
                          right: 0,
                          backgroundColor: "#ffffff",
                          zIndex: activeActionDropdownId === c.id ? 30 : 2,
                          boxShadow: "-3px 0 6px rgba(0,0,0,0.03)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Dropdown Menu Toggle */}
                        <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionDropdownId(activeActionDropdownId === c.id ? null : c.id);
                            }}
                            title="Actions"
                            style={{
                              padding: "5px 11px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: activeActionDropdownId === c.id ? "1px solid #004d66" : "1px solid #cbd5e1",
                              backgroundColor: activeActionDropdownId === c.id ? "#f0fdfa" : "#ffffff",
                              color: activeActionDropdownId === c.id ? "#004d66" : "#334155",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                            onMouseEnter={(e) => {
                              if (activeActionDropdownId !== c.id) {
                                e.currentTarget.style.borderColor = "#94a3b8";
                                e.currentTarget.style.backgroundColor = "#f8fafc";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (activeActionDropdownId !== c.id) {
                                e.currentTarget.style.borderColor = "#cbd5e1";
                                e.currentTarget.style.backgroundColor = "#ffffff";
                              }
                            }}
                          >
                            <span>Action</span>
                            <ChevronDown
                              size={12}
                              style={{
                                transform: activeActionDropdownId === c.id ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>

                            {activeActionDropdownId === c.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  ...(rowIdx >= paginatedContracts.length - 2 && paginatedContracts.length > 3
                                    ? { bottom: "calc(100% + 4px)" }
                                    : { top: "calc(100% + 4px)" }),
                                  zIndex: 100,
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 8,
                                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
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
                                    setSelectedContract(c);
                                    setActiveActionDropdownId(null);
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
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f9ff")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Eye size={14} color="#0284c7" />
                                  <span>View Details</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(c);
                                    setActiveActionDropdownId(null);
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
                                  <span>Edit Contract</span>
                                </button>

                                <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteContract(c.id, c.title || c.contractNumber);
                                    setActiveActionDropdownId(null);
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
                                    color: "#ef4444",
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "background-color 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Trash2 size={13} color="#ef4444" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedContracts.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <ShieldCheck size={36} color="#cbd5e1" />
                        <div style={{ fontWeight: 600, color: "#334155", fontSize: 14 }}>No live maintenance contracts found</div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>The live website currently has no contracts. Add one here to save it to the live system.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= GRID VIEW ================= */
        <div data-mobile-grid="stack"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {paginatedContracts.map((c) => {
            const serviceType = c.typeOfService || "Comprehensive AMC";
            const typeConf = SERVICE_TYPE_CONFIG[serviceType] || SERVICE_TYPE_CONFIG["Comprehensive AMC"];
            const expDate = c.expiryDate || c.endDate;
            const days = getDaysToExpiry(expDate);
            const badge = getExpiryBadge(days);
            const contractor = c.existingContractor || "FastonMed";
            const matchedClient = getConnectedClient(c);
            const orgName = matchedClient?.name || c.organisation || c.clientName;

            return (
              <div
                key={c.id}
                className="card"
                onClick={() => setSelectedContract(c)}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: typeConf.bg,
                        color: typeConf.text,
                        border: `1px solid ${typeConf.border}`,
                      }}
                    >
                      {serviceType}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <h3 style={{ margin: "4px 0 2px", fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                    {c.title || c.contractNumber}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                    {orgName}
                  </div>

                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11.5, marginBottom: 12 }}>
                    <div>
                      <span style={{ color: "#64748b" }}>Expiry:</span>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(expDate)}</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>Value:</span>
                      <div style={{ fontWeight: 700, color: "#059669" }}>{formatCurrency(c.value || c.amount || 0)}</div>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ color: "#64748b" }}>Contractor: </span>
                      <span style={{ fontWeight: 600, color: "#334155" }}>{contractor}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    Contact: <strong style={{ color: "#0f172a" }}>{c.contactPerson || "—"}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(c);
                    }}
                    style={{ fontSize: 11.5, padding: "3px 8px" }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= PAGINATION FOOTER ================= */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            padding: "0 4px",
            fontSize: 12.5,
            color: "#64748b",
          }}
        >
          <div>
            Page <strong style={{ color: "#0f172a" }}>{currentPage}</strong> of{" "}
            <strong style={{ color: "#0f172a" }}>{totalPages}</strong>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ fontSize: 12, padding: "4px 12px", opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ fontSize: 12, padding: "4px 12px", opacity: currentPage >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ================= VIEW DETAIL MODAL ================= */}
      {selectedContract && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setSelectedContract(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "#e0f2fe",
                    color: "#0369a1",
                  }}
                >
                  {selectedContract.typeOfService || "Comprehensive AMC"}
                </span>
                <h3 style={{ margin: "6px 0 2px", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  {selectedContract.title || selectedContract.contractNumber}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedContract.organisation || selectedContract.clientName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContract(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Contract Info Grid */}
            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Contract Value</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                  {formatCurrency(selectedContract.value || selectedContract.amount || 0)}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Expiry Timeline</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                  {formatDate(selectedContract.expiryDate || selectedContract.endDate)}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Existing Contractor</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                  {selectedContract.existingContractor || "FastonMed"}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Key Contact</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                  {selectedContract.contactPerson || "—"}
                </div>
                {selectedContract.contactPhone && (
                  <div style={{ fontSize: 11.5, color: "#0284c7", marginTop: 2 }}>
                    {selectedContract.contactPhone}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {selectedContract.notes && (
              <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#475569", marginBottom: 18 }}>
                <div style={{ fontWeight: 600, color: "#334155", marginBottom: 2 }}>Contract Terms & Notes:</div>
                {selectedContract.notes}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedContract(null)}
                style={{ fontSize: 12.5 }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const toEdit = selectedContract;
                  setSelectedContract(null);
                  handleOpenEdit(toEdit);
                }}
                style={{ fontSize: 12.5, backgroundColor: "#004d66" }}
              >
                Edit Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT MODAL WITH CRM ORGANISATION INTEGRATION ================= */}
      {showAddEditModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setShowAddEditModal(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  {isEditMode ? "Edit Maintenance Contract" : "New Maintenance Contract"}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Connect with our CRM Organisations, set service specifications and contractor details
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContract}>
              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Comprehensive ICU Ventilator & Monitor AMC"
                  required
                  style={{ height: 36, fontSize: 12.5 }}
                />
              </div>

              {/* Type of Service */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Type of Service *</label>
                <select
                  className="form-input"
                  value={formTypeOfService}
                  onChange={(e) => setFormTypeOfService(e.target.value)}
                  style={{ height: 36, fontSize: 12.5 }}
                >
                  <option value="Comprehensive AMC">Comprehensive AMC</option>
                  <option value="Preventive Maintenance">Preventive Maintenance</option>
                  <option value="Calibration & Safety Check">Calibration & Safety Check</option>
                  <option value="Non-Comprehensive AMC">Non-Comprehensive AMC</option>
                  <option value="Breakdown Support">Breakdown Support</option>
                </select>
              </div>

              {/* Organisation Picker */}
              <div style={{ marginBottom: 16, padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: "#004d66", margin: 0 }}>
                    Organisation *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddOrgPanel(!showAddOrgPanel)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#004d66",
                      backgroundColor: "#e0f2fe",
                      border: "1px solid #bae6fd",
                      padding: "3px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Plus size={13} />
                    <span>{showAddOrgPanel ? "Close Add Form" : "+ Add Organisation"}</span>
                  </button>
                </div>

                {/* Inline Add Organisation Panel */}
                {showAddOrgPanel && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "12px 14px",
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #bae6fd",
                      boxShadow: "0 2px 8px rgba(0,77,102,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#004d66", display: "flex", alignItems: "center", gap: 5 }}>
                        <Building2 size={14} color="#004d66" />
                        <span>Add New Organisation to Directory</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddOrgPanel(false)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Organisation Name *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          placeholder="e.g. Al Zahra Medical Center"
                          style={{ height: 32, fontSize: 12 }}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Facility Type
                        </label>
                        <select
                          className="form-input"
                          value={newOrgType}
                          onChange={(e) => setNewOrgType(e.target.value)}
                          style={{ height: 32, fontSize: 12 }}
                        >
                          <option value="Hospital">Hospital</option>
                          <option value="Clinic">Clinic</option>
                          <option value="Diagnostic Centre">Diagnostic Centre</option>
                          <option value="Day Surgery Centre">Day Surgery Centre</option>
                          <option value="Medical Equipment Trader">Medical Equipment Trader</option>
                          <option value="Pharmacy">Pharmacy</option>
                          <option value="Laboratory">Laboratory</option>
                          <option value="Doctor / Practitioner">Doctor / Practitioner</option>
                          <option value="Individual Contact">Individual Contact</option>
                        </select>
                      </div>
                    </div>

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          City
                        </label>
                        <select
                          className="form-input"
                          value={newOrgCity}
                          onChange={(e) => setNewOrgCity(e.target.value)}
                          style={{ height: 32, fontSize: 12 }}
                        >
                          <option value="Dubai">Dubai</option>
                          <option value="Abu Dhabi">Abu Dhabi</option>
                          <option value="Sharjah">Sharjah</option>
                          <option value="Ajman">Ajman</option>
                          <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                          <option value="Fujairah">Fujairah</option>
                          <option value="Umm Al Quwain">Umm Al Quwain</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Contact Person
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={newOrgContactPerson}
                          onChange={(e) => setNewOrgContactPerson(e.target.value)}
                          placeholder="e.g. Dr. Sarah"
                          style={{ height: 32, fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                          Phone
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={newOrgPhone}
                          onChange={(e) => setNewOrgPhone(e.target.value)}
                          placeholder="+971 50 123 4567"
                          style={{ height: 32, fontSize: 12 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowAddOrgPanel(false)}
                        className="btn btn-secondary"
                        style={{ height: 30, fontSize: 11.5, padding: "0 10px" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewOrg}
                        className="btn btn-primary"
                        style={{ height: 30, fontSize: 11.5, padding: "0 12px", backgroundColor: "#004d66" }}
                      >
                        Save & Select Organisation
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Searchable Dropdown */}
                <div style={{ position: "relative" }} ref={orgDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 12px",
                      backgroundColor: "#ffffff",
                      border: orgDropdownOpen ? "1px solid #004d66" : "1px solid #cbd5e1",
                      boxShadow: orgDropdownOpen ? "0 0 0 3px rgba(0,77,102,0.12)" : "none",
                      borderRadius: 8,
                      fontSize: 13,
                      color: formClientId || formOrganisation ? "#0f172a" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(() => {
                        if (formClientId === "CUSTOM") {
                          return (
                            <>
                              <span style={{ fontSize: 13 }}>✏️</span>
                              <span style={{ fontWeight: 600, color: "#004d66" }}>Custom Organisation: {formOrganisation || "Unspecified"}</span>
                            </>
                          );
                        }
                        const matched = clients.find((c) => c.id === formClientId);
                        if (matched) {
                          return (
                            <>
                              <span style={{ fontSize: 13 }}>{orgEmoji[matched.orgType || ""] || "🏢"}</span>
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>{matched.name}</span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>({matched.orgType || "Hospital"} • {matched.city || "UAE"})</span>
                            </>
                          );
                        }
                        if (formOrganisation) {
                          return (
                            <>
                              <span style={{ fontSize: 13 }}>🏢</span>
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>{formOrganisation}</span>
                            </>
                          );
                        }
                        return <span>-- Choose from CRM Organisations ({clients.length} facilities) --</span>;
                      })()}
                    </div>
                    <ChevronDown size={15} color="#64748b" style={{ transform: orgDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                  </button>

                  {/* Popover Dropdown matching website style */}
                  {orgDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        backgroundColor: "#ffffff",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 12px 28px -4px rgba(0,0,0,0.15), 0 6px 12px -2px rgba(0,0,0,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Search Bar */}
                      <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                        <Search size={14} color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Type to search organisation, facility or city..."
                          value={orgSearchText}
                          onChange={(e) => setOrgSearchText(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: 12.5,
                            width: "100%",
                            color: "#0f172a",
                          }}
                        />
                        {orgSearchText && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrgSearchText("");
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Add options at top of dropdown */}
                      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f0f9ff" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddOrgPanel(true);
                            setOrgDropdownOpen(false);
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            border: "none",
                            borderRight: "1px solid #e0f2fe",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "#004d66",
                          }}
                        >
                          <Plus size={13} />
                          <span>+ Add New Organisation</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectCrmOrganisation("CUSTOM")}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: formClientId === "CUSTOM" ? "#e0f2fe" : "transparent",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "#0284c7",
                          }}
                        >
                          <Pencil size={12} />
                          <span>Custom Name</span>
                        </button>
                      </div>

                      {/* Clients List */}
                      <div style={{ maxHeight: 240, overflowY: "auto" }}>
                        {filteredClientsInModal.length === 0 ? (
                          <div style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
                            No matching organisations found.
                          </div>
                        ) : (
                          filteredClientsInModal.map((c) => {
                            const isSelected = formClientId === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCrmOrganisation(c.id)}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  border: "none",
                                  borderBottom: "1px solid #f8fafc",
                                  backgroundColor: isSelected ? "#f0fdfa" : "#ffffff",
                                  color: isSelected ? "#004d66" : "#1e293b",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  transition: "background 0.1s ease",
                                }}
                                className="hover:bg-slate-50"
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: "50%",
                                      backgroundColor: getOrgAvatarBg(c.orgType),
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 11,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {orgEmoji[c.orgType || ""] || "🏢"}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: 12.5, color: isSelected ? "#004d66" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {c.name}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>
                                      {c.orgType || "Hospital"} {c.city ? `• ${c.city}` : ""}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check size={14} color="#059669" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Name Override Input when CUSTOM is selected */}
                {formClientId === "CUSTOM" && (
                  <div style={{ marginTop: 10, animation: "fadeIn 0.15s ease" }}>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#004d66", marginBottom: 3 }}>
                      Custom Organisation Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formOrganisation}
                      onChange={(e) => setFormOrganisation(e.target.value)}
                      placeholder="Enter custom organisation name"
                      required
                      style={{ height: 34, fontSize: 12.5, backgroundColor: "#ffffff" }}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Expiry Timeline & Value */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Expiry Timeline (Date) *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    required
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Value (AED) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="65000"
                    required
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Existing Contractor & Contract # */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Existing Contractor *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formExistingContractor}
                    onChange={(e) => setFormExistingContractor(e.target.value)}
                    placeholder="e.g. FastonMed / OEM"
                    required
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Contract Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formContractNumber}
                    onChange={(e) => setFormContractNumber(e.target.value)}
                    placeholder="e.g. AMC-2026-0012"
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="e.g. Dr. Tariq Al-Nuaimi"
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    placeholder="e.g. +971 50 123 4567"
                    style={{ height: 36, fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Terms, covered models, visit frequency..."
                  style={{ fontSize: 12.5 }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddEditModal(false)}
                  style={{ fontSize: 12.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ fontSize: 12.5, backgroundColor: "#004d66" }}
                >
                  {isSaving ? "Saving to live website…" : isEditMode ? "Update Contract" : "Save Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
