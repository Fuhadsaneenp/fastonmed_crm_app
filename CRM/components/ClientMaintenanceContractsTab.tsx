"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import CustomLightSelect from "@/components/CustomLightSelect";
import OrganisationAvatar from "@/components/OrganisationAvatar";
import { getStoredContracts, syncLiveContractsFromApi, addStoredContract } from "@/lib/contract-store";
import { getStoredClients, saveStoredClients } from "@/lib/client-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, AMCContract } from "@/types";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  Search,
  Download,
  Eye,
  ExternalLink,
  Plus,
  Phone,
  Mail,
  X,
  Building2,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Wrench,
  Layers,
  FileText,
  Check,
  Pencil,
  ChevronDown,
  Save,
} from "lucide-react";

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

// Days to expiry helper
function getDaysToExpiry(expiryDateStr?: string): number | null {
  if (!expiryDateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(days: number | null) {
  if (days === null) {
    return {
      label: "Check Date",
      color: "#64748b",
      bg: "#f1f5f9",
      border: "#cbd5e1",
    };
  }
  if (days < 0) {
    return {
      label: "Expired",
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
    label: "Active",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  };
}

const SERVICE_TYPE_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  "Comprehensive AMC": {
    label: "Comprehensive AMC",
    bg: "#eef2ff",
    text: "#4338ca",
    border: "#c7d2fe",
  },
  "Preventive Maintenance": {
    label: "Preventive Maintenance",
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
  },
  "Calibration & Safety Check": {
    label: "Calibration & Safety",
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
  },
  "Non-Comprehensive AMC": {
    label: "Non-Comprehensive",
    bg: "#f1f5f9",
    text: "#334155",
    border: "#cbd5e1",
  },
  "Breakdown Support": {
    label: "Breakdown Support",
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
  },
};

const colDivider = {
  borderRight: "1px solid #f1f5f9",
};

export default function ClientMaintenanceContractsTab({ client }: { client: Client }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedContract, setSelectedContract] = useState<AMCContract | null>(null);
  const [contractVersion, setContractVersion] = useState(0);

  // New Maintenance Contract Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState("Biomedical Equipment Annual Maintenance Agreement");
  const [formTypeOfService, setFormTypeOfService] = useState("Comprehensive AMC");
  const [formOrganisation, setFormOrganisation] = useState(client.name);
  const [formClientId, setFormClientId] = useState(client.id);
  const [formOrgType, setFormOrgType] = useState(client.orgType || "Hospital");
  const [formStartDate, setFormStartDate] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formValue, setFormValue] = useState("75000");
  const [formExistingContractor, setFormExistingContractor] = useState("FastonMed");
  const [formContractNumber, setFormContractNumber] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Organisation Picker inside Modal
  const [allClients, setAllClients] = useState<Client[]>(() => {
    try {
      return getStoredClients();
    } catch {
      return [client];
    }
  });
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [orgSearchText, setOrgSearchText] = useState("");
  const [showAddOrgPanel, setShowAddOrgPanel] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState("Hospital");
  const [newOrgCity, setNewOrgCity] = useState("Dubai");
  const [newOrgContactPerson, setNewOrgContactPerson] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");

  const orgDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const list = getStoredClients();
      if (list && list.length > 0) setAllClients(list);
    } catch {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openNewContractModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const expiry = nextYear.toISOString().slice(0, 10);

    const primaryContact = client.contacts?.[0];
    setFormTitle("Biomedical Equipment Annual Maintenance Agreement");
    setFormTypeOfService("Comprehensive AMC");
    setFormOrganisation(client.name);
    setFormClientId(client.id);
    setFormOrgType(client.orgType || "Hospital");
    setFormStartDate(today);
    setFormExpiryDate(expiry);
    setFormValue("75000");
    setFormExistingContractor("FastonMed");
    setFormContractNumber(`AMC-${new Date().getFullYear()}-${String(Math.floor(10 + Math.random() * 90)).padStart(4, "0")}`);
    setFormContactPerson(primaryContact?.name || client.name);
    setFormContactPhone(primaryContact?.phone || primaryContact?.whatsapp || client.phone || "");
    setFormContactEmail(primaryContact?.email || client.email || "");
    setFormNotes("Quarterly preventive maintenance with full electrical safety analysis and certification.");
    setShowAddOrgPanel(false);
    setOrgDropdownOpen(false);
    setShowAddModal(true);
  };

  const handleSelectCrmOrganisation = (clientId: string) => {
    if (clientId === "CUSTOM") {
      setFormClientId("CUSTOM");
      setFormOrganisation("");
      setFormOrgType("Hospital");
      setOrgDropdownOpen(false);
      return;
    }
    const matched = allClients.find((c) => c.id === clientId);
    if (matched) {
      setFormClientId(matched.id);
      setFormOrganisation(matched.name);
      setFormOrgType(matched.orgType || "Hospital");
      const prime = matched.contacts?.[0];
      if (prime?.name) setFormContactPerson(prime.name);
      if (prime?.phone || prime?.whatsapp || matched.phone) {
        setFormContactPhone(prime?.phone || prime?.whatsapp || matched.phone || "");
      }
      if (prime?.email || matched.email) {
        setFormContactEmail(prime?.email || matched.email || "");
      }
      setOrgDropdownOpen(false);
    }
  };

  const handleSaveNewOrg = () => {
    if (!newOrgName.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    let creator: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}
    const newClientObj: Client = {
      id: `client-${Date.now()}`,
      name: newOrgName.trim(),
      orgType: newOrgType as any,
      city: newOrgCity,
      state: "Dubai",
      address: `${newOrgCity || "Dubai"}, UAE`,
      status: "Existing Customer",
      phone: newOrgPhone.trim(),
      email: "",
      source: "Direct Enquiry",
      assignedTo: creator.id || "emp-1",
      totalRevenue: 0,
      purchases: [],
      requirements: [],
      contacts: newOrgContactPerson.trim()
        ? [
            {
              id: `contact-${Date.now()}`,
              name: newOrgContactPerson.trim(),
              designation: "Key Contact",
              department: "Biomedical Engineering",
              phone: newOrgPhone.trim(),
              email: "",
              createdAt: new Date().toISOString(),
              createdBy: creator.name || "User not recorded",
              createdById: creator.id,
            },
          ]
        : [],
      createdAt: new Date().toISOString(),
      createdBy: creator.name || "User not recorded",
      createdById: creator.id,
    };

    const updated = [newClientObj, ...allClients];
    setAllClients(updated);
    saveStoredClients(updated);
    window.dispatchEvent(new Event("fastonmed_clients_updated"));

    setFormClientId(newClientObj.id);
    setFormOrganisation(newClientObj.name);
    setFormOrgType(newClientObj.orgType || "Hospital");
    if (newOrgContactPerson.trim()) setFormContactPerson(newOrgContactPerson.trim());
    if (newOrgPhone.trim()) setFormContactPhone(newOrgPhone.trim());
    setShowAddOrgPanel(false);
    setOrgDropdownOpen(false);
    toast.success(`Added ${newClientObj.name} to CRM directory`);
  };

  const filteredClientsInModal = useMemo(() => {
    const q = orgSearchText.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.orgType || "").toLowerCase().includes(q)
    );
  }, [allClients, orgSearchText]);

  const handleSaveNewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a contract title");
      return;
    }
    if (!formOrganisation.trim()) {
      toast.error("Please select or enter an organisation");
      return;
    }

    const val = Number(formValue) || 0;
    const days = getDaysToExpiry(formExpiryDate);
    const computedStatus = days === null ? "Active" : days < 0 ? "Expired" : days <= 30 ? "Expiring Soon" : "Active";
    let creator: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}

    const contractData: AMCContract = {
      id: `amc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: formTitle.trim(),
      contractNumber: formContractNumber.trim() || `AMC-${Date.now()}`,
      typeOfService: formTypeOfService,
      clientId: formClientId || client.id,
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
      createdBy: creator.name || "User not recorded",
      createdById: creator.id,
    };

    setIsSaving(true);
    try {
      await addStoredContract(contractData);
      window.dispatchEvent(new Event("fastonmed_contracts_updated"));
      toast.success(`Created contract: ${contractData.title}`);
      setShowAddModal(false);
      setContractVersion((v) => v + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the contract");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleUpdate = () => setContractVersion((v) => v + 1);
    window.addEventListener("fastonmed_contracts_updated", handleUpdate);

    // Sync from API in background
    syncLiveContractsFromApi().then(() => setContractVersion((v) => v + 1));

    return () => {
      window.removeEventListener("fastonmed_contracts_updated", handleUpdate);
    };
  }, []);

  const clientContracts = useMemo(() => {
    const all = getStoredContracts();
    const cId = client.id;
    const cName = (client.name || "").trim().toLowerCase();

    return all.filter((c) => {
      // ID matching
      if (
        c.clientId &&
        (c.clientId === cId ||
          c.clientId === `trader-${cId}` ||
          cId === `trader-${c.clientId}`)
      ) {
        return true;
      }
      // Name matching
      const orgLower = (c.organisation || c.clientName || "").trim().toLowerCase();
      if (
        orgLower &&
        cName &&
        (orgLower === cName || orgLower.includes(cName) || cName.includes(orgLower))
      ) {
        return true;
      }
      return false;
    });
  }, [client, contractVersion]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientContracts.filter((c) => {
      const days = getDaysToExpiry(c.endDate || c.expiryDate);

      // Status filter
      if (statusFilter === "Active") {
        if (days !== null && days < 0) return false;
      } else if (statusFilter === "Expiring Soon") {
        if (days === null || days < 0 || days > 30) return false;
      } else if (statusFilter === "Expired") {
        if (days === null || days >= 0) return false;
      } else if (statusFilter === "Pending Renewal") {
        if (c.status !== "Pending Renewal") return false;
      }

      // Search query
      if (!q) return true;
      const equipMatch = (c.equipments || []).some(
        (eq) =>
          (eq.name || "").toLowerCase().includes(q) ||
          (eq.model || "").toLowerCase().includes(q) ||
          (eq.serialNumber || "").toLowerCase().includes(q)
      );
      return (
        (c.title || "").toLowerCase().includes(q) ||
        (c.contractNumber || "").toLowerCase().includes(q) ||
        (c.typeOfService || "").toLowerCase().includes(q) ||
        (c.existingContractor || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q) ||
        (c.contactPhone || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q) ||
        equipMatch
      );
    });
  }, [clientContracts, search, statusFilter]);

  const exportCsv = () => {
    const headers = [
      "Contract Title",
      "Contract Number",
      "Service Type",
      "Organisation",
      "Equipments",
      "Contact Person",
      "Contact Phone",
      "Start Date",
      "End Date",
      "Contractor",
      "Status",
      "Amount (AED)",
      "Payment Status",
    ];

    const rows = filteredContracts.map((c) => {
      const eqList = (c.equipments || [])
        .map((eq) => `${eq.name} (${eq.model} - ${eq.serialNumber})`)
        .join("; ");
      return [
        `"${(c.title || "").replace(/"/g, '""')}"`,
        `"${(c.contractNumber || "").replace(/"/g, '""')}"`,
        `"${(c.typeOfService || "AMC").replace(/"/g, '""')}"`,
        `"${(c.clientName || c.organisation || client.name).replace(/"/g, '""')}"`,
        `"${eqList.replace(/"/g, '""')}"`,
        `"${(c.contactPerson || "").replace(/"/g, '""')}"`,
        `"${(c.contactPhone || "").replace(/"/g, '""')}"`,
        `"${c.startDate || ""}"`,
        `"${c.endDate || c.expiryDate || ""}"`,
        `"${(c.existingContractor || "FastonMed").replace(/"/g, '""')}"`,
        `"${c.status || ""}"`,
        c.amount || c.value || 0,
        `"${c.paymentStatus || ""}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${client.name.replace(/\s+/g, "_")}_Maintenance_Contracts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Search & Filter Bar */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
            flexWrap: "wrap",
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 480 }}>
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
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contract, equipment, serial, service type..."
              style={{ paddingLeft: 36, height: 36, fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CustomLightSelect
              value={statusFilter}
              options={[
                { value: "All", label: "All Statuses" },
                { value: "Active", label: "Active" },
                { value: "Expiring Soon", label: "Expiring Soon (< 30d)" },
                { value: "Expired", label: "Expired" },
                { value: "Pending Renewal", label: "Pending Renewal" },
              ]}
              onChange={(val) => setStatusFilter(val)}
              activeColor={statusFilter !== "All"}
              style={{ width: 175 }}
              buttonStyle={{ height: 36, fontSize: 13 }}
              menuStyle={{ minWidth: 180 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportCsv}
              disabled={filteredContracts.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 36,
                fontSize: 13,
                padding: "0 14px",
              }}
            >
              <Download size={14} />
              Export Sheet
            </button>
            <button
              type="button"
              onClick={openNewContractModal}
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                fontSize: 13,
                padding: "0 14px",
                backgroundColor: "#004d66",
                color: "#ffffff",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                boxShadow: "0 1px 3px rgba(0,77,102,0.2)",
              }}
            >
              <Plus size={14} />
              New Contract
            </button>
          </div>
        </div>

        {/* Maintenance Contracts Table */}
        <div className="table-container" style={{ border: "none", overflowX: "auto" }}>
          <table data-mobile-cards="true" style={{ width: "100%", borderCollapse: "collapse", minWidth: 1240 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Organisation
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Contract & Service Type
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Covered Equipment
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Contact Person
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Contact Number
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Expiry Date
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Start Date
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Contractor / Team
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    ...colDivider,
                  }}
                >
                  Value
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "right",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => {
                const expiryDateStr = contract.endDate || contract.expiryDate;
                const days = getDaysToExpiry(expiryDateStr);
                const badge = getExpiryBadge(days);
                const serviceStyle =
                  SERVICE_TYPE_STYLES[contract.typeOfService || ""] || {
                    label: contract.typeOfService || "AMC",
                    bg: "#f0fdfa",
                    text: "#0f766e",
                    border: "#ccfbf1",
                  };

                const orgName = contract.clientName || contract.organisation || client.name;
                const primaryContact = client.contacts?.[0];
                const contactPerson = contract.contactPerson || primaryContact?.name || "—";
                const contactPhone = contract.contactPhone || primaryContact?.phone || primaryContact?.whatsapp || client.phone || "—";
                const amount = contract.amount || contract.value || 0;

                return (
                  <tr
                    key={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                  >
                    {/* 1. Organisation */}
                    <td data-label="Organisation" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <OrganisationAvatar
                          name={orgName}
                          size={32}
                          style={{ borderRadius: 8 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "#002735", fontSize: 13, lineHeight: 1.3 }}>
                            {orgName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                days !== null && days < 0
                                  ? "#dc2626"
                                  : days === null
                                  ? "#b45309"
                                  : "#64748b",
                              marginTop: 2,
                            }}
                          >
                            {days === null
                              ? "Date verification needed"
                              : days < 0
                              ? `${Math.abs(days)} days expired`
                              : `${days} days remaining`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Contract Title & Service Type */}
                    <td data-label="Contract & Service Type" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ maxWidth: 240 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, lineHeight: 1.3 }}>
                          {contract.title || `Contract #${contract.contractNumber}`}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          {contract.contractNumber && contract.contractNumber !== "0" && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: "#64748b",
                                background: "#f1f5f9",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              #{contract.contractNumber}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: serviceStyle.text,
                              background: serviceStyle.bg,
                              border: `1px solid ${serviceStyle.border}`,
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {serviceStyle.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Covered Equipment */}
                    <td data-label="Covered Equipment" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ maxWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
                        {(contract.equipments && contract.equipments.length > 0) ? (
                          contract.equipments.slice(0, 2).map((eq, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 11.5,
                                color: "#334155",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                padding: "3px 7px",
                                borderRadius: 6,
                                lineHeight: 1.3,
                              }}
                            >
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>{eq.name}</span>
                              {(eq.model || eq.serialNumber) && (
                                <span style={{ color: "#64748b", fontSize: 10.5, marginLeft: 4 }}>
                                  ({eq.model || eq.serialNumber})
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>General Equipment</span>
                        )}
                        {(contract.equipments?.length || 0) > 2 && (
                          <span style={{ fontSize: 10.5, color: "#004d66", fontWeight: 600 }}>
                            +{(contract.equipments?.length || 0) - 2} more units
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Contact Person */}
                    <td data-label="Contact Person" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>
                        {contactPerson}
                      </span>
                    </td>

                    {/* 5. Contact Number */}
                    <td data-label="Contact Number" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      {contactPhone && contactPhone !== "—" ? (
                        <a
                          href={`tel:${contactPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: "#004d66",
                            fontWeight: 600,
                            fontSize: 12,
                            textDecoration: "none",
                          }}
                        >
                          {contactPhone}
                        </a>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* 6. Expiry Date Badge */}
                    <td data-label="Expiry Date" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          fontSize: 11.5,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: badge.color,
                            display: "inline-block",
                          }}
                        />
                        {expiryDateStr ? `${formatDate(expiryDateStr)} - ${badge.label}` : "No End Date"}
                      </span>
                    </td>

                    {/* 7. Start Date */}
                    <td data-label="Start Date" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>
                        {formatDate(contract.startDate)}
                      </span>
                    </td>

                    {/* 8. Contractor / Team */}
                    <td data-label="Contractor / Team" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {(!contract.existingContractor ||
                          contract.existingContractor === "FastonMed" ||
                          contract.existingContractor.toLowerCase().includes("faston")) ? (
                          <>
                            <ShieldCheck size={14} color="#059669" />
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12.5 }}>
                                FastonMed
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>Direct Provider</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <Wrench size={14} color="#7c3aed" />
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12.5 }}>
                                {contract.existingContractor}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748b" }}>Third-Party Service</div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* 9. Value */}
                    <td data-label="Value" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div>
                        {amount > 0 ? (
                          <div style={{ fontWeight: 700, color: "#059669", fontSize: 12.5 }}>
                            {formatCurrency(amount)}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                        {contract.paymentStatus && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color:
                                contract.paymentStatus === "Paid"
                                  ? "#059669"
                                  : contract.paymentStatus === "Overdue"
                                  ? "#dc2626"
                                  : "#d97706",
                            }}
                          >
                            {contract.paymentStatus}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 10. Action */}
                    <td data-label="Action" style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContract(contract);
                          }}
                          title="View Contract Details"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0fdfa";
                            e.currentTarget.style.borderColor = "#004d66";
                            e.currentTarget.style.color = "#004d66";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.color = "#64748b";
                          }}
                        >
                          <Eye size={13.5} />
                        </button>
                        <Link
                          href={`/maintenance-contracts?search=${encodeURIComponent(contract.contractNumber || contract.title || "")}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open in Maintenance Contracts"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0fdfa";
                            e.currentTarget.style.borderColor = "#004d66";
                            e.currentTarget.style.color = "#004d66";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.color = "#64748b";
                          }}
                        >
                          <ExternalLink size={13.5} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredContracts.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "#eaf8f4",
                          color: "#004d66",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShieldCheck size={26} />
                      </div>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
                        No maintenance contracts found for {client.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 420 }}>
                        Annual maintenance agreements (AMC), preventive maintenance contracts, and equipment service plans will be listed in this section.
                      </div>
                      <button
                        type="button"
                        onClick={openNewContractModal}
                        className="btn btn-primary"
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          padding: "8px 16px",
                          backgroundColor: "#004d66",
                          color: "#ffffff",
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: "none",
                          boxShadow: "0 1px 3px rgba(0,77,102,0.2)",
                        }}
                      >
                        <Plus size={14} />
                        Create Maintenance Contract
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Details Modal */}
      {selectedContract && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
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
              padding: 0,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              backgroundColor: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ffffff",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#eaf8f4",
                    color: "#004d66",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                    {selectedContract.title || `Contract #${selectedContract.contractNumber}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {selectedContract.clientName || client.name} • {selectedContract.typeOfService || "Maintenance Agreement"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContract(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Quick Metrics */}
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                    Status
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {(() => {
                      const days = getDaysToExpiry(selectedContract.endDate || selectedContract.expiryDate);
                      const badge = getExpiryBadge(days);
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color }} />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                    Annual Value
                  </div>
                  <div style={{ fontWeight: 700, color: "#059669", fontSize: 14, marginTop: 4 }}>
                    {formatCurrency(selectedContract.amount || selectedContract.value || 0)}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                    Duration
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
                    {formatDate(selectedContract.startDate)} – {formatDate(selectedContract.endDate || selectedContract.expiryDate)}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                    Provider
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
                    {selectedContract.existingContractor || "FastonMed"}
                  </div>
                </div>
              </div>

              {/* Covered Equipment List */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Package size={14} color="#004d66" />
                  Covered Equipment ({(selectedContract.equipments || []).length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(selectedContract.equipments || []).length > 0 ? (
                    selectedContract.equipments.map((eq, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                            {eq.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                            Model: {eq.model || "Standard"}
                          </div>
                        </div>
                        {eq.serialNumber && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#0f766e",
                              background: "#f0fdfa",
                              border: "1px solid #ccfbf1",
                              padding: "2px 8px",
                              borderRadius: 6,
                            }}
                          >
                            SN: {eq.serialNumber}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>
                      No specific equipment records attached.
                    </div>
                  )}
                </div>
              </div>

              {/* Service Schedule Visits */}
              {(selectedContract.serviceSchedule || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} color="#004d66" />
                    Scheduled Maintenance Visits
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedContract.serviceSchedule.map((dateStr, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                          color: "#334155",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Clock size={12} color="#64748b" />
                        Visit {idx + 1}: {formatDate(dateStr)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={14} color="#004d66" />
                  Contract Contact
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
                    {selectedContract.contactPerson || client.contacts?.[0]?.name || client.name}
                  </div>
                  {(selectedContract.contactPhone || client.phone) && (
                    <a
                      href={`tel:${selectedContract.contactPhone || client.phone}`}
                      style={{
                        fontSize: 12,
                        color: "#004d66",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Phone size={12} />
                      {selectedContract.contactPhone || client.phone}
                    </a>
                  )}
                  {(selectedContract.contactEmail || client.email) && (
                    <a
                      href={`mailto:${selectedContract.contactEmail || client.email}`}
                      style={{
                        fontSize: 12,
                        color: "#004d66",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Mail size={12} />
                      {selectedContract.contactEmail || client.email}
                    </a>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedContract.notes && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} color="#004d66" />
                    Agreement Notes
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 12.5,
                      color: "#475569",
                      lineHeight: 1.5,
                    }}
                  >
                    {selectedContract.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                position: "sticky",
                bottom: 0,
              }}
            >
              <Link
                href={`/maintenance-contracts?search=${encodeURIComponent(selectedContract.contractNumber || selectedContract.title || "")}`}
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={14} />
                Open in Maintenance Hub
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedContract(null)}
                style={{ fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= NEW MAINTENANCE CONTRACT MODAL ================= */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
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
                  New Maintenance Contract
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Connect with our CRM Organisations, set service specifications and contractor details
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewContract}>
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
                        const matched = allClients.find((c) => c.id === formClientId || c.name.toLowerCase() === formOrganisation.toLowerCase());
                        if (matched) {
                          return (
                            <>
                              <span style={{ fontSize: 13 }}>{orgEmoji[matched.orgType || ""] || "🏢"}</span>
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>{matched.name}</span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>({matched.orgType || "Hospital"}{matched.city ? ` • ${matched.city}` : ""})</span>
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
                        return <span>-- Choose from CRM Organisations ({allClients.length} facilities) --</span>;
                      })()}
                    </div>
                    <ChevronDown size={15} color="#64748b" style={{ transform: orgDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                  </button>

                  {/* Popover Dropdown */}
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
                            const isSelected = formClientId === c.id || (!formClientId && formOrganisation === c.name);
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
                  <div style={{ marginTop: 10 }}>
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
                    placeholder="75000"
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
                    placeholder="e.g. AMC-2026-0025"
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
                  onClick={() => setShowAddModal(false)}
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
                  {isSaving ? "Saving to live website…" : "Save Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
