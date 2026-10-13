"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import CustomLightSelect from "@/components/CustomLightSelect";
import OrganisationAvatar from "@/components/OrganisationAvatar";
import { getStoredServiceTickets } from "@/lib/service-store";
import { getStoredProducts } from "@/lib/trader-store";
import { getStoredClients, saveStoredClients } from "@/lib/client-store";
import { formatCurrency } from "@/lib/utils";
import type { Client, Invoice, ServiceTicket, ContactPerson, Product } from "@/types";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  ExternalLink,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Wrench,
  X,
  Building2,
} from "lucide-react";

export type ExpiryRecord = {
  id: string;
  organisation: string;
  productName: string;
  contactPerson: string;
  contactNumber: string;
  expiryDate: string;
  installationDate: string;
  installedBy: "FastonMed" | "Other Team";
  otherTeamName: string;
  source: "Sales" | "AMC" | "Service";
  amount?: number;
  clientId?: string;
  orgType?: string;
  location?: string;
  email?: string;
  createdBy?: string;
  createdById?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedById?: string;
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

function addOneYear(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setFullYear(parsed.getFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setMonth(parsed.getMonth() + months);
  return parsed.toISOString().slice(0, 10);
}

function normalizeDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function formatDate(date: string) {
  if (!date || date === "-") return "-";
  if (date === "Need to Check Date" || date === "Need to Check") return "Need to Check Date";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysToExpiry(expiryDate: string): number | null {
  if (!expiryDate || expiryDate === "Need to Check Date" || expiryDate === "Need to Check") {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return null;
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function getExpiryBadge(days: number | null) {
  if (days === null || Number.isNaN(days)) {
    return { label: "Need to Check", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
  }
  if (days < 0) return { label: "Expired", bg: "#fee2e2", color: "#dc2626", border: "#fecaca" };
  if (days <= 30) return { label: "Due Soon", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" };
  if (days <= 90) return { label: "Upcoming", bg: "#fef9c3", color: "#a16207", border: "#fde68a" };
  return { label: "Active", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
}

export function buildCompanyExpiryRecords(client: Client, invoices: Invoice[] = []): ExpiryRecord[] {
  const clientNameLower = (client.name || "").trim().toLowerCase();
  const clientId = client.id;
  const isTrader =
    client.orgType === "Medical Equipment Trader" ||
    (client.connectedAs && client.connectedAs.some((c) => c.toLowerCase() === "trader"));

  const brandKeyword = clientNameLower
    .replace(/(medical|international|healthcare|systems|endoscopy|radiology|llc|tr|trading|equipment)/g, "")
    .trim();

  const isMatchingEntity = (orgName?: string, cId?: string, prodName?: string) => {
    // 1. Direct ID match
    if (cId && (cId === clientId || cId === `trader-${clientId}` || clientId === `trader-${cId}`)) {
      return true;
    }
    // 2. Name match
    const orgLower = (orgName || "").trim().toLowerCase();
    if (orgLower && clientNameLower && (orgLower === clientNameLower || orgLower.includes(clientNameLower) || clientNameLower.includes(orgLower))) {
      return true;
    }
    // 3. If trader company, match by supplied products/brand
    if (isTrader && prodName && brandKeyword.length >= 3) {
      if (prodName.toLowerCase().includes(brandKeyword)) return true;
    }
    return false;
  };

  const primaryContact = client.contacts?.[0];
  const defaultContactPerson = primaryContact?.name || client.name || "—";
  const defaultContactNumber = primaryContact?.phone || primaryContact?.whatsapp || client.phone || "—";
  const defaultEmail = primaryContact?.email || client.email || "";
  const location = client.address || [client.city, client.state].filter(Boolean).join(", ") || client.city || "UAE";

  // A. From Invoices (Product Purchases & Deliveries)
  const fromInvoices: ExpiryRecord[] = (invoices || [])
    .filter((invoice) => isMatchingEntity(invoice.clientName, invoice.clientId))
    .flatMap((invoice) =>
      (invoice.items || []).map((item, index) => {
        const installDate = invoice.createdAt || new Date().toISOString().slice(0, 10);
        return {
          id: `inv-${invoice.id}-${index}`,
          organisation: invoice.clientName || client.name,
          productName: item.product || "Medical Device",
          contactPerson: defaultContactPerson,
          contactNumber: defaultContactNumber,
          expiryDate: addOneYear(installDate),
          installationDate: installDate,
          installedBy: "FastonMed" as const,
          otherTeamName: "",
          source: "Sales" as const,
          amount: item.amount,
          clientId: client.id,
          orgType: client.orgType || "Hospital",
          location,
          email: defaultEmail,
        };
      })
    );

  // C. From Service Tickets
  const fromTickets: ExpiryRecord[] = getStoredServiceTickets()
    .filter((ticket) => isMatchingEntity(ticket.clientName, ticket.clientId, ticket.equipment))
    .map((ticket) => {
      const installDate = ticket.visitDate || ticket.createdAt || new Date().toISOString().slice(0, 10);
      return {
        id: `service-${ticket.id}`,
        organisation: ticket.clientName || client.name,
        productName: `${ticket.equipment || "Equipment"} - ${ticket.model || "Service"}`,
        contactPerson: defaultContactPerson,
        contactNumber: defaultContactNumber,
        expiryDate: addOneYear(installDate),
        installationDate: installDate,
        installedBy: "FastonMed" as const,
        otherTeamName: "",
        source: "Service" as const,
        clientId: client.id,
        orgType: client.orgType || "Hospital",
        location,
        email: defaultEmail,
      };
    });

  // D. From User Tracked Custom Expiry Records
  const customRecords: ExpiryRecord[] = (() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("fastonmed_custom_expiry_records");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: ExpiryRecord) => isMatchingEntity(r.organisation, r.clientId, r.productName));
        }
      }
    } catch {
      // ignore
    }
    return [];
  })();

  const deletedIds: string[] = (() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("fastonmed_deleted_expiry_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  })();

  const editedRecords: Record<string, Partial<ExpiryRecord>> = (() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("fastonmed_edited_expiry_records");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  })();

  const allRows = [...fromInvoices, ...fromTickets, ...customRecords]
    .filter((row) => !deletedIds.includes(row.id))
    .filter((row) => row.source !== "AMC")
    .map((row) => (editedRecords[row.id] ? { ...row, ...editedRecords[row.id] } : row));

  // Deduplicate by product name + expiry date
  const unique = allRows.filter((row, index, rows) => {
    const key = `${(row.productName || "").toLowerCase()}::${row.expiryDate || ""}`;
    return rows.findIndex((item) => `${(item.productName || "").toLowerCase()}::${item.expiryDate || ""}` === key) === index;
  });

  return unique.sort((a, b) => normalizeDate(a.expiryDate) - normalizeDate(b.expiryDate));
}

const colDivider = {
  borderRight: "1px solid #f1f5f9",
};

export default function ClientProductExpiryTab({
  client,
  invoices = [],
}: {
  client: Client;
  invoices?: Invoice[];
}) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<ExpiryRecord | null>(null);
  const [expiryVersion, setExpiryVersion] = useState(0);

  // Add Tracked Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      return getStoredProducts();
    } catch {
      return [];
    }
  });
  const [allClients, setAllClients] = useState<Client[]>(() => {
    try {
      return getStoredClients();
    } catch {
      return [client];
    }
  });
  const [clientContacts, setClientContacts] = useState<ContactPerson[]>(() => client.contacts || []);

  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const [facilitySearchText, setFacilitySearchText] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchText, setProductSearchText] = useState("");
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [contactSearchText, setContactSearchText] = useState("");
  const [isCustomContactMode, setIsCustomContactMode] = useState(false);
  const [showAddContactPanel, setShowAddContactPanel] = useState(false);

  // Form Fields
  const [formOrganisation, setFormOrganisation] = useState(client.name);
  const [formOrgType, setFormOrgType] = useState(client.orgType || "Hospital");
  const [formClientId, setFormClientId] = useState(client.id);
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactNumber, setFormContactNumber] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formProductName, setFormProductName] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formInstallationDate, setFormInstallationDate] = useState("");
  const [installationUnknown, setInstallationUnknown] = useState(false);
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [expiryUnknown, setExpiryUnknown] = useState(false);
  const [formInstalledBy, setFormInstalledBy] = useState<"FastonMed" | "Other Team">("FastonMed");
  const [formOtherTeamName, setFormOtherTeamName] = useState("");

  // Inline Contact Fields
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  const facilityDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClientContacts(client.contacts || []);
  }, [client]);

  useEffect(() => {
    try {
      const list = getStoredClients();
      if (list && list.length > 0) setAllClients(list);
    } catch {}

    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProducts(data);
        else if (data?.products && Array.isArray(data.products)) setProducts(data.products);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (facilityDropdownRef.current && !facilityDropdownRef.current.contains(e.target as Node)) {
        setFacilityDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const primaryContact = clientContacts?.[0] || client.contacts?.[0];
    setFormOrganisation(client.name);
    setFormOrgType(client.orgType || "Hospital");
    setFormClientId(client.id);
    setFormContactPerson(primaryContact?.name || "");
    setFormContactNumber(primaryContact?.phone || primaryContact?.whatsapp || client.phone || "");
    setFormEmail(primaryContact?.email || client.email || "");
    setFormProductName("");
    setFormProductId("");
    setFormAmount("");
    setFormInstallationDate(today);
    setInstallationUnknown(false);
    setFormExpiryDate(addOneYear(today));
    setExpiryUnknown(false);
    setFormInstalledBy("FastonMed");
    setFormOtherTeamName("");
    setIsCustomContactMode(false);
    setShowAddContactPanel(false);
    setFacilityDropdownOpen(false);
    setProductDropdownOpen(false);
    setContactDropdownOpen(false);
    setShowAddModal(true);
  };

  const handleProductChange = (productId: string) => {
    setFormProductId(productId);
    if (productId === "CUSTOM") {
      setFormProductName("");
      return;
    }
    const matched = products.find((p) => p.id === productId);
    if (matched) {
      setFormProductName(matched.name);
      if (matched.sellingPrice && (!formAmount || formAmount === "0")) {
        setFormAmount(matched.sellingPrice.toString());
      }
    }
  };

  const handleSaveNewContact = () => {
    if (!newContactName.trim()) {
      toast.error("Contact person name is required");
      return;
    }
    let creator: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}
    const newContact: ContactPerson = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      designation: newContactRole.trim() || "Contact Person",
      department: "Purchase",
      phone: newContactPhone.trim(),
      email: newContactEmail.trim(),
      createdAt: new Date().toISOString(),
      createdBy: creator.name || "User not recorded",
      createdById: creator.id,
    };

    const updatedContacts = [...clientContacts, newContact];
    setClientContacts(updatedContacts);

    try {
      const all = getStoredClients();
      const idx = all.findIndex((c) => c.id === formClientId || c.name.toLowerCase() === formOrganisation.toLowerCase());
      if (idx !== -1) {
        all[idx] = {
          ...all[idx],
          contacts: updatedContacts,
        };
        saveStoredClients(all);
      }
    } catch {}

    setFormContactPerson(newContact.name);
    if (newContact.phone) setFormContactNumber(newContact.phone);
    if (newContact.email) setFormEmail(newContact.email);
    setShowAddContactPanel(false);
    setContactDropdownOpen(false);
    setIsCustomContactMode(false);
    toast.success(`Added ${newContact.name} to ${formOrganisation}`);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName.trim()) {
      toast.error("Please select or enter a product name");
      return;
    }

    const finalInstallDate = installationUnknown ? "Need to Check Date" : formInstallationDate;
    const finalExpiryDate = expiryUnknown ? "Need to Check Date" : formExpiryDate;

    const newRecord: ExpiryRecord = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      organisation: formOrganisation.trim() || client.name,
      productName: formProductName.trim(),
      contactPerson: formContactPerson.trim() || "—",
      contactNumber: formContactNumber.trim() || "—",
      expiryDate: finalExpiryDate,
      installationDate: finalInstallDate,
      installedBy: formInstalledBy,
      otherTeamName: formInstalledBy === "Other Team" ? formOtherTeamName.trim() : "",
      source: "Sales",
      amount: formAmount ? parseFloat(formAmount) : undefined,
      clientId: formClientId || client.id,
      orgType: formOrgType || client.orgType || "Hospital",
      location: client.address || client.city || "UAE",
      email: formEmail.trim() || client.email || "",
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem("fastonmed_custom_expiry_records");
      const current: ExpiryRecord[] = raw ? JSON.parse(raw) : [];
      const updated = [newRecord, ...current];
      localStorage.setItem("fastonmed_custom_expiry_records", JSON.stringify(updated));

      fetch("/api/product-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", localCustomRecords: updated }),
      }).catch(() => {});

      window.dispatchEvent(new Event("fastonmed_expiry_updated"));
      toast.success("Tracked product added successfully!");
      setShowAddModal(false);
      setExpiryVersion((v) => v + 1);
    } catch (err) {
      console.error("Error saving tracked product:", err);
      toast.error("Failed to save tracked product");
    }
  };

  const filteredClientsInModal = useMemo(() => {
    const q = facilitySearchText.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.orgType || "").toLowerCase().includes(q)
    );
  }, [allClients, facilitySearchText]);

  const filteredProductsInModal = useMemo(() => {
    const q = productSearchText.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.model || "").toLowerCase().includes(q)
    );
  }, [products, productSearchText]);

  const filteredContactsInDropdown = useMemo(() => {
    const q = contactSearchText.trim().toLowerCase();
    if (!q) return clientContacts;
    return clientContacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.designation || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [clientContacts, contactSearchText]);

  useEffect(() => {
    const handleUpdate = () => setExpiryVersion((v) => v + 1);
    window.addEventListener("fastonmed_expiry_updated", handleUpdate);
    window.addEventListener("fastonmed_contracts_updated", handleUpdate);

    // Sync from database
    fetch("/api/product-expiry")
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.customRecords)) {
          try {
            localStorage.setItem("fastonmed_custom_expiry_records", JSON.stringify(json.customRecords));
            if (json.editedRecords) {
              localStorage.setItem("fastonmed_edited_expiry_records", JSON.stringify(json.editedRecords));
            }
            if (json.deletedIds) {
              localStorage.setItem("fastonmed_deleted_expiry_ids", JSON.stringify(json.deletedIds));
            }
          } catch {}
          setExpiryVersion((v) => v + 1);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("fastonmed_expiry_updated", handleUpdate);
      window.removeEventListener("fastonmed_contracts_updated", handleUpdate);
    };
  }, []);

  const records = useMemo(() => buildCompanyExpiryRecords(client, invoices), [client, invoices, expiryVersion]);

  const filteredRecords = records.filter((record) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      record.productName.toLowerCase().includes(q) ||
      record.organisation.toLowerCase().includes(q) ||
      record.contactPerson.toLowerCase().includes(q) ||
      record.contactNumber.toLowerCase().includes(q) ||
      record.installedBy.toLowerCase().includes(q) ||
      record.source.toLowerCase().includes(q);

    const matchesSource = sourceFilter === "All" || record.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const exportCsv = () => {
    const headers = [
      "Organisation",
      "Product Name",
      "Contact Person",
      "Contact Number",
      "Expiry Date",
      "Installation Date",
      "Installation Team",
      "Source",
      "Amount",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.organisation.replace(/"/g, '""')}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${r.contactPerson.replace(/"/g, '""')}"`,
      `"${r.contactNumber.replace(/"/g, '""')}"`,
      r.expiryDate,
      r.installationDate,
      r.installedBy,
      r.source,
      r.amount || 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${client.name.replace(/[^a-zA-Z0-9]/g, "_")}_product_expiry.csv`);
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
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organisation, product, contact, team..."
              style={{ paddingLeft: 36, height: 36, fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CustomLightSelect
              value={sourceFilter}
              options={[
                { value: "All", label: "All Sources" },
                { value: "Sales", label: "Sales" },
                { value: "Service", label: "Service" },
              ]}
              onChange={(val) => setSourceFilter(val)}
              activeColor={sourceFilter !== "All"}
              style={{ width: 140 }}
              buttonStyle={{ height: 36, fontSize: 13 }}
              menuStyle={{ minWidth: 150 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportCsv}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, fontSize: 13, padding: "0 14px" }}
            >
              <Download size={14} />
              Export Sheet
            </button>
            <button
              type="button"
              onClick={openAddModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 36,
                fontSize: 13,
                padding: "0 16px",
                backgroundColor: "#004d66",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,77,102,0.2)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00384a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#004d66")}
            >
              <Plus size={15} />
              Add Tracked Product
            </button>
          </div>
        </div>

        {/* Expiry Table Matching Exact Design */}
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
                  Product Name
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
                  Installation Date
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
                  Installation Team
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
                  Source
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
              {filteredRecords.map((record) => {
                const days = getDaysToExpiry(record.expiryDate);
                const badge = getExpiryBadge(days);

                return (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
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
                          name={record.organisation}
                          size={32}
                          style={{ borderRadius: 8 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "#002735", fontSize: 13, lineHeight: 1.3 }}>
                            {record.organisation}
                          </div>
                          <div style={{ fontSize: 11, color: days !== null && days < 0 ? "#dc2626" : days === null ? "#b45309" : "#64748b", marginTop: 2 }}>
                            {days === null ? "Date verification needed" : days < 0 ? `${Math.abs(days)} days expired` : `${days} days remaining`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Product Name */}
                    <td data-label="Product Name" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, maxWidth: 220 }}>
                        {record.productName}
                      </div>
                    </td>

                    {/* 3. Contact Person */}
                    <td data-label="Contact Person" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>
                        {record.contactPerson && record.contactPerson !== "—" ? record.contactPerson : "—"}
                      </span>
                    </td>

                    {/* 4. Contact Number */}
                    <td data-label="Contact Number" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      {record.contactNumber && record.contactNumber !== "—" ? (
                        <a
                          href={`tel:${record.contactNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#004d66", fontWeight: 600, fontSize: 12, textDecoration: "none" }}
                        >
                          {record.contactNumber}
                        </a>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* 5. Expiry Date Badge */}
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
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.color, display: "inline-block" }} />
                        {days === null ? "Need to Check Date" : `${formatDate(record.expiryDate)} - ${badge.label}`}
                      </span>
                    </td>

                    {/* 6. Installation Date */}
                    <td data-label="Installation Date" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>
                        {formatDate(record.installationDate)}
                      </span>
                    </td>

                    {/* 7. Installation Team */}
                    <td data-label="Installation Team" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {record.installedBy === "FastonMed" ? (
                          <ShieldCheck size={14} color="#059669" />
                        ) : (
                          <Wrench size={14} color="#7c3aed" />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12.5 }}>
                            {record.installedBy}
                          </div>
                          {record.otherTeamName && (
                            <div style={{ fontSize: 10.5, color: "#64748b" }}>{record.otherTeamName}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 8. Source */}
                    <td data-label="Source" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                        {record.source === "Sales" ? "Direct Enquiry" : record.source}
                      </span>
                    </td>

                    {/* 9. Value */}
                    <td data-label="Value" style={{ padding: "12px 14px", verticalAlign: "middle", ...colDivider }}>
                      {record.amount && record.amount > 0 ? (
                        <span style={{ fontWeight: 700, color: "#059669", fontSize: 12.5 }}>
                          {formatCurrency(record.amount)}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* 10. Actions */}
                    <td data-label="Action" style={{ padding: "12px 14px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        title={`View details for ${record.productName}`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          color: "#004d66",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0fdfa";
                          e.currentTarget.style.borderColor = "#004d66";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }}
                      >
                        <Eye size={13.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <CalendarDays size={34} color="#cbd5e1" />
                      <div style={{ fontWeight: 600, color: "#334155", fontSize: 14 }}>
                        No product expiry records found for {client.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", maxWidth: 440 }}>
                        Product warranties, equipment purchases, and service installations linked to this organisation will appear here.
                      </div>
                      <button
                        type="button"
                        onClick={openAddModal}
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          height: 34,
                          fontSize: 12.5,
                          padding: "0 14px",
                          backgroundColor: "#004d66",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 3px rgba(0,77,102,0.2)",
                        }}
                      >
                        <Plus size={14} />
                        Add Tracked Product
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRecord && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 0,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 30px rgba(0,0,0,0.12)",
              backgroundColor: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: "#eaf8f4",
                    color: "#004d66",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={15} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                    {selectedRecord.organisation}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    Product Expiry Details
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Product Info */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Product / Equipment
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", marginTop: 2, lineHeight: 1.35 }}>
                    {selectedRecord.productName}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "1px 6px", borderRadius: 4, fontWeight: 500 }}>
                      Source: {selectedRecord.source === "Sales" ? "Direct Enquiry" : selectedRecord.source}
                    </span>
                  </div>
                </div>

                {selectedRecord.amount ? (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Value</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
                      {formatCurrency(selectedRecord.amount)}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Grid with subtle dividers */}
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ padding: "9px 12px", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Installation Date</span>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {formatDate(selectedRecord.installationDate)}
                  </div>
                </div>

                <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Expiry Date</span>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {formatDate(selectedRecord.expiryDate)}
                  </div>
                </div>

                <div style={{ padding: "9px 12px", borderRight: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Installed By</span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {selectedRecord.installedBy}
                  </div>
                </div>

                <div style={{ padding: "9px 12px" }}>
                  <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Source</span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {selectedRecord.source === "Sales" ? "Direct Enquiry" : selectedRecord.source}
                  </div>
                </div>
              </div>

              {/* Contact Row */}
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                    {selectedRecord.contactPerson || "Facility Contact"}
                  </div>
                  {selectedRecord.contactNumber && (
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {selectedRecord.contactNumber}
                    </div>
                  )}
                </div>

                {selectedRecord.contactNumber && (
                  <a
                    href={`tel:${selectedRecord.contactNumber}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 5,
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#004d66",
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <Phone size={11} />
                    <span>Call</span>
                  </a>
                )}
              </div>
            </div>

            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedRecord(null)}
                style={{
                  height: 30,
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  backgroundColor: "#004d66",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD TRACKED PRODUCT MODAL ================= */}
      {showAddModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              padding: 0,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#ecfdf5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    Add Tracked Product
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Manage product warranty, AMC and installation expiry tracking
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSubmitForm}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  overflowY: "auto",
                  flex: 1,
                }}
              >
                {/* SECTION 1: ORGANISATION */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Building2 size={16} color="#004d66" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#004d66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      1. Organisation
                    </span>
                  </div>

                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    <div style={{ position: "relative" }} ref={facilityDropdownRef}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Organisation *
                      </label>

                      {/* Custom Dropdown Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setFacilityDropdownOpen(!facilityDropdownOpen);
                          setProductDropdownOpen(false);
                          setContactDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          height: 38,
                          padding: "0 12px",
                          backgroundColor: "#ffffff",
                          border: facilityDropdownOpen ? "1px solid #004d66" : "1px solid #cbd5e1",
                          boxShadow: facilityDropdownOpen ? "0 0 0 3px rgba(0,77,102,0.12)" : "none",
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
                            const currentOrgType = formOrgType || client.orgType || "Hospital";
                            return (
                              <>
                                <span style={{ fontSize: 13 }}>{orgEmoji[currentOrgType] || "👤"}</span>
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{formOrganisation || client.name}</span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>({currentOrgType})</span>
                              </>
                            );
                          })()}
                        </div>
                        <ChevronDown size={15} color="#64748b" style={{ transform: facilityDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                      </button>

                      {/* Popover */}
                      {facilityDropdownOpen && (
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
                          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                            <Search size={14} color="#94a3b8" />
                            <input
                              type="text"
                              placeholder="Search organisation or facility..."
                              value={facilitySearchText}
                              onChange={(e) => setFacilitySearchText(e.target.value)}
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
                            {facilitySearchText && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFacilitySearchText("");
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <div style={{ maxHeight: 220, overflowY: "auto" }}>
                            {filteredClientsInModal.map((c) => {
                              const isSelected = formClientId === c.id || (!formClientId && formOrganisation === c.name);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setFormClientId(c.id);
                                    setFormOrganisation(c.name);
                                    setFormOrgType(c.orgType || "Hospital");
                                    const prime = c.contacts?.[0];
                                    setFormContactPerson(prime?.name || "");
                                    setFormContactNumber(prime?.phone || prime?.whatsapp || c.phone || "");
                                    setFormEmail(prime?.email || c.email || "");
                                    setClientContacts(c.contacts || []);
                                    setFacilityDropdownOpen(false);
                                    setFacilitySearchText("");
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "none",
                                    borderBottom: "1px solid #f8fafc",
                                    backgroundColor: isSelected ? "#f0fdfa" : "#ffffff",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                  }}
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
                                        {c.orgType || "Hospital"} {c.city ? `· ${c.city}` : ""}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && <Check size={14} color="#059669" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contact Person & Contact Phone row */}
                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                            Contact Person
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isCustomContactMode ? (
                              <button
                                type="button"
                                onClick={() => setIsCustomContactMode(false)}
                                style={{ fontSize: 11, fontWeight: 600, color: "#0284c7", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                Select from dropdown
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewContactName("");
                                  setNewContactRole("");
                                  setNewContactPhone(formContactNumber || "");
                                  setNewContactEmail(formEmail || "");
                                  setShowAddContactPanel(true);
                                }}
                                style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#0d9488", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                <Plus size={12} />
                                <span>+ Add Person</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isCustomContactMode ? (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Dr. Ahmed / Eng. Bilal"
                            value={formContactPerson}
                            onChange={(e) => setFormContactPerson(e.target.value)}
                            style={{ fontSize: 13, height: 36 }}
                            autoFocus
                          />
                        ) : (
                          <div style={{ position: "relative" }} ref={contactDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setContactDropdownOpen(!contactDropdownOpen)}
                              style={{
                                width: "100%",
                                height: 36,
                                padding: "0 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                backgroundColor: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                fontSize: 13,
                                textAlign: "left",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                {formContactPerson ? (
                                  <>
                                    <span style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {formContactPerson}
                                    </span>
                                    {(() => {
                                      const matched = clientContacts.find((c) => c.name.toLowerCase() === formContactPerson.toLowerCase());
                                      if (matched?.designation) {
                                        return <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>({matched.designation})</span>;
                                      }
                                      return null;
                                    })()}
                                  </>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>-- Select Contact Person --</span>
                                )}
                              </div>
                              <ChevronDown size={14} color="#64748b" style={{ transform: contactDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                            </button>

                            {contactDropdownOpen && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 4px)",
                                  left: 0,
                                  right: 0,
                                  minWidth: 260,
                                  zIndex: 9999,
                                  backgroundColor: "#ffffff",
                                  borderRadius: 10,
                                  border: "1px solid #e2e8f0",
                                  boxShadow: "0 12px 28px -4px rgba(0,0,0,0.15), 0 6px 12px -2px rgba(0,0,0,0.06)",
                                  overflow: "hidden",
                                }}
                              >
                                {/* Option 1: + Add New Person */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContactDropdownOpen(false);
                                    setNewContactName("");
                                    setNewContactRole("");
                                    setNewContactPhone(formContactNumber || "");
                                    setNewContactEmail(formEmail || "");
                                    setShowAddContactPanel(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "none",
                                    borderBottom: "1px solid #f1f5f9",
                                    backgroundColor: "#f0fdfa",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#0d9488",
                                  }}
                                >
                                  <Plus size={13} />
                                  <span>+ Add New Person</span>
                                </button>

                                {/* Option 2: Custom Name */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomContactMode(true);
                                    setContactDropdownOpen(false);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "7px 12px",
                                    border: "none",
                                    borderBottom: "1px solid #f1f5f9",
                                    backgroundColor: "#ffffff",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: "#0284c7",
                                  }}
                                >
                                  <Pencil size={12} />
                                  <span>Type Custom Name Manually</span>
                                </button>

                                {/* Contacts List */}
                                <div style={{ maxHeight: 180, overflowY: "auto" }}>
                                  {filteredContactsInDropdown.map((c, idx) => (
                                    <button
                                      key={c.id || idx}
                                      type="button"
                                      onClick={() => {
                                        setFormContactPerson(c.name);
                                        setFormContactNumber(c.phone || c.whatsapp || formContactNumber);
                                        setFormEmail(c.email || formEmail);
                                        setContactDropdownOpen(false);
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        border: "none",
                                        borderBottom: "1px solid #f8fafc",
                                        backgroundColor: formContactPerson === c.name ? "#e0f2fe" : "#ffffff",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        fontSize: 12,
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{c.name}</div>
                                        {c.designation && <div style={{ fontSize: 10.5, color: "#64748b" }}>{c.designation}</div>}
                                      </div>
                                      {formContactPerson === c.name && <Check size={13} color="#0284c7" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Contact Phone / Number
                        </label>
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="e.g. +971 50 123 4567"
                          value={formContactNumber}
                          onChange={(e) => setFormContactNumber(e.target.value)}
                          style={{ fontSize: 13, height: 36 }}
                        />
                      </div>
                    </div>

                    {/* Inline Add Contact Panel */}
                    {showAddContactPanel && (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          backgroundColor: "#f0fdfa",
                          border: "1px solid #99f6e4",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f766e" }}>
                              Add New Contact Person
                            </div>
                            <div style={{ fontSize: 11, color: "#0d9488" }}>
                              Will be saved to CRM Directory for {formOrganisation || "this facility"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddContactPanel(false)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#64748b",
                              cursor: "pointer",
                              padding: 2,
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                              Name *
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. Dr. Ahmed / Eng. Bilal"
                              value={newContactName}
                              onChange={(e) => setNewContactName(e.target.value)}
                              style={{ fontSize: 12, height: 32 }}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                              Role / Designation
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. Biomedical Engineer"
                              value={newContactRole}
                              onChange={(e) => setNewContactRole(e.target.value)}
                              style={{ fontSize: 12, height: 32 }}
                            />
                          </div>
                        </div>

                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                              Phone / WhatsApp
                            </label>
                            <input
                              type="tel"
                              className="form-input"
                              placeholder="+971 50 123 4567"
                              value={newContactPhone}
                              onChange={(e) => setNewContactPhone(e.target.value)}
                              style={{ fontSize: 12, height: 32 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                              Email
                            </label>
                            <input
                              type="email"
                              className="form-input"
                              placeholder="contact@example.com"
                              value={newContactEmail}
                              onChange={(e) => setNewContactEmail(e.target.value)}
                              style={{ fontSize: 12, height: 32 }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setShowAddContactPanel(false)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#ffffff",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveNewContact}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: "#0d9488",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Check size={13} />
                            <span>Save & Select Contact</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick Select Contact: pills */}
                    {clientContacts.length > 0 && (
                      <div style={{ marginTop: 2 }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                          Quick Select Contact:
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {clientContacts.map((contact, idx) => (
                            <button
                              key={contact.id || idx}
                              type="button"
                              onClick={() => {
                                setFormContactPerson(contact.name);
                                setFormContactNumber(contact.phone || contact.whatsapp || "");
                                setFormEmail(contact.email || "");
                                setIsCustomContactMode(false);
                              }}
                              style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                backgroundColor: formContactPerson === contact.name ? "#e0f2fe" : "#ffffff",
                                color: formContactPerson === contact.name ? "#0369a1" : "#334155",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {contact.name} {contact.designation ? `(${contact.designation})` : ""}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setNewContactName("");
                              setNewContactRole("");
                              setNewContactPhone(formContactNumber || "");
                              setNewContactEmail(formEmail || "");
                              setShowAddContactPanel(true);
                            }}
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 4,
                              border: "1px dashed #0d9488",
                              backgroundColor: "#f0fdfa",
                              color: "#0d9488",
                              cursor: "pointer",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Plus size={11} />
                            <span>Add Person</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: PRODUCT & EQUIPMENT */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Package size={16} color="#004d66" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#004d66", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      2. Product & Equipment
                    </span>
                  </div>

                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    <div style={{ position: "relative" }} ref={productDropdownRef}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Product / Equipment *
                      </label>

                      {/* Custom Dropdown Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setProductDropdownOpen(!productDropdownOpen);
                          setFacilityDropdownOpen(false);
                          setContactDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          height: 38,
                          padding: "0 12px",
                          backgroundColor: "#ffffff",
                          border: productDropdownOpen ? "1px solid #004d66" : "1px solid #cbd5e1",
                          boxShadow: productDropdownOpen ? "0 0 0 3px rgba(0,77,102,0.12)" : "none",
                          borderRadius: 8,
                          fontSize: 13,
                          color: formProductId || formProductName ? "#0f172a" : "#64748b",
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
                            if (formProductId === "CUSTOM") {
                              return (
                                <>
                                  <span style={{ fontSize: 13 }}>✏️</span>
                                  <span style={{ fontWeight: 600, color: "#004d66" }}>Custom Product: {formProductName || "Unspecified"}</span>
                                </>
                              );
                            }
                            const matched = products.find((p) => p.id === formProductId || p.name.toLowerCase() === formProductName.toLowerCase());
                            if (matched) {
                              return (
                                <>
                                  <Package size={14} color="#004d66" />
                                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{matched.name}</span>
                                  <span style={{ fontSize: 11, color: "#64748b" }}>• {matched.category} ({matched.brand || "FastonMed"})</span>
                                </>
                              );
                            }
                            if (formProductName) {
                              return (
                                <>
                                  <Package size={14} color="#004d66" />
                                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{formProductName}</span>
                                </>
                              );
                            }
                            return <span>-- Choose from Procurement Products Catalog --</span>;
                          })()}
                        </div>
                        <ChevronDown size={15} color="#64748b" style={{ transform: productDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                      </button>

                      {/* Popover */}
                      {productDropdownOpen && (
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
                          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                            <Search size={14} color="#94a3b8" />
                            <input
                              type="text"
                              placeholder="Type to search product name, brand, model..."
                              value={productSearchText}
                              onChange={(e) => setProductSearchText(e.target.value)}
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
                            {productSearchText && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductSearchText("");
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #e2e8f0" }}>
                            <button
                              type="button"
                              onClick={() => {
                                handleProductChange("CUSTOM");
                                setProductDropdownOpen(false);
                                setProductSearchText("");
                              }}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                border: "none",
                                backgroundColor: formProductId === "CUSTOM" ? "#e0f2fe" : "#ffffff",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#0284c7",
                              }}
                              className="hover:bg-sky-50"
                            >
                              <Plus size={13} />
                              <span>Enter Custom Product / Model</span>
                            </button>
                          </div>

                          <div style={{ padding: "5px 12px", backgroundColor: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                            <span>PRODUCTS CATALOG</span>
                            <span style={{ backgroundColor: "#e2e8f0", color: "#334155", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>
                              {filteredProductsInModal.length} Available
                            </span>
                          </div>

                          <div style={{ maxHeight: 240, overflowY: "auto" }}>
                            {filteredProductsInModal.length === 0 ? (
                              <div style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
                                No matching products found in catalog.
                              </div>
                            ) : (
                              filteredProductsInModal.map((p) => {
                                const isSelected = formProductId === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      handleProductChange(p.id);
                                      setProductDropdownOpen(false);
                                      setProductSearchText("");
                                    }}
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
                                    }}
                                    className="hover:bg-slate-50"
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                                      <div
                                        style={{
                                          width: 26,
                                          height: 26,
                                          borderRadius: 6,
                                          backgroundColor: "#e0f2fe",
                                          color: "#0284c7",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 11,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Package size={13} />
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: 12.5, color: isSelected ? "#004d66" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {p.name}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>
                                          {p.category} {p.brand ? `· ${p.brand}` : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      {p.sellingPrice > 0 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>
                                          {formatCurrency(p.sellingPrice)}
                                        </span>
                                      )}
                                      {isSelected && <Check size={14} color="#059669" />}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {formProductId === "CUSTOM" && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Custom Product / Model Name *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          required
                          placeholder="e.g. ICU Ventilator x5 - SV-300"
                          value={formProductName}
                          onChange={(e) => setFormProductName(e.target.value)}
                          style={{ fontSize: 13, height: 36 }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Product Value (AED)
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="form-input"
                        placeholder="e.g. 12000"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        style={{ fontSize: 13, height: 36 }}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: TIMELINE & INSTALLATION DETAILS */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Calendar size={16} color="#004d66" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#004d66", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      3. Timeline & Installation Details
                    </span>
                  </div>

                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          Installation Date {!installationUnknown && "*"}
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: installationUnknown ? "#b45309" : "#64748b", fontWeight: installationUnknown ? 600 : 500 }}>
                          <input
                            type="checkbox"
                            checked={installationUnknown}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setInstallationUnknown(checked);
                              if (!checked && !formInstallationDate) {
                                setFormInstallationDate(new Date().toISOString().slice(0, 10));
                              }
                            }}
                            style={{ accentColor: "#d97706", width: 13, height: 13, cursor: "pointer" }}
                          />
                          Need to Check Date
                        </label>
                      </div>
                      {installationUnknown ? (
                        <div
                          style={{
                            height: 36,
                            borderRadius: 6,
                            border: "1px dashed #f59e0b",
                            background: "#fffbeb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 10px",
                            fontSize: 12,
                            color: "#b45309",
                            fontWeight: 600,
                          }}
                        >
                          <span>Need to Check Date</span>
                          <button
                            type="button"
                            onClick={() => {
                              setInstallationUnknown(false);
                              if (!formInstallationDate) setFormInstallationDate(new Date().toISOString().slice(0, 10));
                            }}
                            style={{
                              fontSize: 11,
                              color: "#b45309",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline",
                              padding: 0,
                              fontWeight: 600,
                            }}
                          >
                            Specify
                          </button>
                        </div>
                      ) : (
                        <input
                          type="date"
                          className="form-input"
                          required={!installationUnknown}
                          value={formInstallationDate}
                          onChange={(e) => {
                            setFormInstallationDate(e.target.value);
                            if (!expiryUnknown && (!formExpiryDate || formExpiryDate === addOneYear(formInstallationDate))) {
                              setFormExpiryDate(addOneYear(e.target.value));
                            }
                          }}
                          style={{ fontSize: 13, height: 36 }}
                        />
                      )}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          Expiry Date {!expiryUnknown && "*"}
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: expiryUnknown ? "#b45309" : "#64748b", fontWeight: expiryUnknown ? 600 : 500 }}>
                          <input
                            type="checkbox"
                            checked={expiryUnknown}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setExpiryUnknown(checked);
                              if (!checked && !formExpiryDate) {
                                const base = formInstallationDate || new Date().toISOString().slice(0, 10);
                                setFormExpiryDate(addOneYear(base));
                              }
                            }}
                            style={{ accentColor: "#d97706", width: 13, height: 13, cursor: "pointer" }}
                          />
                          Need to Check Date
                        </label>
                      </div>
                      {expiryUnknown ? (
                        <div
                          style={{
                            height: 36,
                            borderRadius: 6,
                            border: "1px dashed #f59e0b",
                            background: "#fffbeb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 10px",
                            fontSize: 12,
                            color: "#b45309",
                            fontWeight: 600,
                          }}
                        >
                          <span>Need to Check Date</span>
                          <button
                            type="button"
                            onClick={() => {
                              setExpiryUnknown(false);
                              if (!formExpiryDate) {
                                const base = formInstallationDate || new Date().toISOString().slice(0, 10);
                                setFormExpiryDate(addOneYear(base));
                              }
                            }}
                            style={{
                              fontSize: 11,
                              color: "#b45309",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline",
                              padding: 0,
                              fontWeight: 600,
                            }}
                          >
                            Specify
                          </button>
                        </div>
                      ) : (
                        <input
                          type="date"
                          className="form-input"
                          required={!expiryUnknown}
                          value={formExpiryDate}
                          onChange={(e) => setFormExpiryDate(e.target.value)}
                          style={{ fontSize: 13, height: 36 }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Quick expiry buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Quick Set Expiry:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryUnknown(false);
                        const base = formInstallationDate || new Date().toISOString().slice(0, 10);
                        setFormExpiryDate(addOneYear(base));
                      }}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                    >
                      +1 Year
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryUnknown(false);
                        const base = formInstallationDate || new Date().toISOString().slice(0, 10);
                        setFormExpiryDate(addMonths(base, 24));
                      }}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                    >
                      +2 Years
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryUnknown(false);
                        const base = formInstallationDate || new Date().toISOString().slice(0, 10);
                        setFormExpiryDate(addMonths(base, 6));
                      }}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                    >
                      +6 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryUnknown(true);
                      }}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: expiryUnknown ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                        background: expiryUnknown ? "#fffbeb" : "#f8fafc",
                        color: expiryUnknown ? "#b45309" : "#475569",
                        fontWeight: expiryUnknown ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      Need to Check Date
                    </button>
                  </div>

                  {/* Installation Team */}
                  <div data-mobile-grid="stack" style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Installation Team
                      </label>
                      <select
                        className="form-input"
                        value={formInstalledBy}
                        onChange={(e) => setFormInstalledBy(e.target.value as any)}
                        style={{ fontSize: 13, height: 36 }}
                      >
                        <option value="FastonMed">FastonMed (In-House Team)</option>
                        <option value="Other Team">Other Team (External Contractor)</option>
                      </select>
                    </div>

                    {formInstalledBy === "Other Team" && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          External Team / Contractor Name
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Third-party certified biomedical installer"
                          value={formOtherTeamName}
                          onChange={(e) => setFormOtherTeamName(e.target.value)}
                          style={{ fontSize: 13, height: 36 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons (Sticky Footer) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid #e2e8f0",
                  padding: "14px 24px",
                  background: "#f8fafc",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    backgroundColor: "#f1f5f9",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#475569",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    backgroundColor: "#004d66",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 22px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: "0 2px 4px rgba(0,77,102,0.2)",
                  }}
                >
                  <Save size={15} />
                  <span>Add Tracked Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
