"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getStoredClients, addStandalonePerson, getStoredPeople } from "@/lib/client-store";
import { getStoredContracts, syncLiveContractsFromApi } from "@/lib/contract-store";
import { getStoredServiceTickets } from "@/lib/service-store";
import { getStoredProducts, syncProductFromExpiry, addProductWithTrader, getStoredCompanies, DEFAULT_PRODUCT_CATEGORIES, fetchStoredProductsFromServer } from "@/lib/trader-store";
import { getCatalogProducts } from "@/lib/woocommerce/catalog-store";
import { INVOICES_STORAGE_KEY } from "@/lib/zoho-service";
import { formatCurrency } from "@/lib/utils";
import type { AMCContract, Client, Invoice, ServiceTicket, Product, ProductCategory, ContactPerson } from "@/types";
import toast from "react-hot-toast";
import CustomLightSelect from "@/components/CustomLightSelect";
import AddProductModal from "@/components/AddProductModal";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Download,
  Eye,
  ExternalLink,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Wrench,
  X,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Check,
  Save,
  Calendar,
  Sparkles,
  ChevronDown,
  TrendingUp,
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
  source: "Sales" | "AMC" | "Service" | "Direct Enquiry" | "Warranty" | "Tender";
  amount?: number;
  clientId?: string;
  productId?: string;
  orgType?: string;
  location?: string;
  email?: string;
  isCustom?: boolean;
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

const CUSTOM_EXPIRY_KEY = "fastonmed_custom_expiry_records";
const EDITED_EXPIRY_KEY = "fastonmed_edited_expiry_records";
const DELETED_EXPIRY_KEY = "fastonmed_deleted_expiry_ids";

function getStoredCustomRecords(): ExpiryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_EXPIRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Failed loading custom expiry records", error);
  }
  return [];
}

function saveStoredCustomRecords(records: ExpiryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_EXPIRY_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("fastonmed_expiry_updated"));
  } catch (error) {
    console.error("Failed saving custom expiry records", error);
  }
  try {
    fetch("/api/product-expiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", localCustomRecords: records }),
    }).catch((err) => console.warn("Could not sync custom records to server:", err));
  } catch {}
}

function getStoredEditedRecords(): Record<string, Partial<ExpiryRecord>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EDITED_EXPIRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (error) {
    console.error("Failed loading edited expiry records", error);
  }
  return {};
}

function saveStoredEditedRecords(records: Record<string, Partial<ExpiryRecord>>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EDITED_EXPIRY_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("fastonmed_expiry_updated"));
  } catch (error) {
    console.error("Failed saving edited expiry records", error);
  }
  try {
    fetch("/api/product-expiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", localEditedRecords: records }),
    }).catch((err) => console.warn("Could not sync edited records to server:", err));
  } catch {}
}

function getStoredDeletedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_EXPIRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Failed loading deleted expiry IDs", error);
  }
  return [];
}

function saveStoredDeletedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DELETED_EXPIRY_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event("fastonmed_expiry_updated"));
  } catch (error) {
    console.error("Failed saving deleted expiry IDs", error);
  }
  try {
    fetch("/api/product-expiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", localDeletedIds: ids }),
    }).catch((err) => console.warn("Could not sync deleted IDs to server:", err));
  } catch {}
}

function getStoredInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const legacyDummyInvoiceIds = new Set(["inv-1", "inv-2", "inv-3", "inv-4"]);
        const invoices = parsed.filter((invoice: Invoice) => !legacyDummyInvoiceIds.has(invoice.id));
        if (invoices.length !== parsed.length) {
          localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
        }
        return invoices;
      }
    }
  } catch (error) {
    console.error("Failed loading stored invoices", error);
  }
  return [];
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
  if (!date) return "-";
  if (date === "Need to Check Date" || date === "Need to Check") {
    return "Need to Check Date";
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getClientContact(client?: Client) {
  const primaryContact = client?.contacts?.[0];
  return {
    name: primaryContact?.name || client?.name || "",
    phone: primaryContact?.phone || primaryContact?.whatsapp || client?.phone || "",
    email: primaryContact?.email || client?.email || "",
  };
}

function getDaysToExpiry(expiryDate: string) {
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

function buildExpiryRecords(
  clients: Client[],
  invoices: Invoice[],
  contracts: AMCContract[],
  tickets: ServiceTicket[],
  customRecords: ExpiryRecord[],
  editedRecords: Record<string, Partial<ExpiryRecord>>,
  deletedIds: string[]
) {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const ticketByClientAndProduct = new Map<string, ServiceTicket>();

  (tickets || []).forEach((ticket) => {
    if (!ticket.clientName || !ticket.equipment) return;
    const key = `${(ticket.clientName || "").toLowerCase()}::${(ticket.equipment || "").toLowerCase()}`;
    ticketByClientAndProduct.set(key, ticket);
  });

  const fromContracts: ExpiryRecord[] = (contracts || []).flatMap((contract) => {
    const client = clientById.get(contract.clientId) || clients.find((item) => (item.name || "").toLowerCase() === (contract.clientName || "").toLowerCase());
    const contact = getClientContact(client);
    const location = client ? (client.city === client.state ? client.city : `${client.city || ""}, ${client.state || ""}`.replace(/^, |, $/g, "")) : "UAE";
    return (contract.equipments || []).map((equipment) => ({
      id: `amc-${contract.id}-${equipment.serialNumber}`,
      organisation: contract.clientName || client?.name || "Healthcare Facility",
      productName: `${equipment.name || "Equipment"} - ${equipment.model || "Standard"}`,
      contactPerson: contact.name,
      contactNumber: contact.phone,
      expiryDate: contract.endDate,
      installationDate: contract.startDate,
      installedBy: "FastonMed" as const,
      otherTeamName: "",
      source: "AMC" as const,
      amount: contract.amount,
      clientId: client?.id,
      orgType: client?.orgType || "Hospital",
      location,
      email: contact.email,
    }));
  });

  const fromInvoices: ExpiryRecord[] = (invoices || []).flatMap((invoice) => {
    const client = clientById.get(invoice.clientId) || clients.find((item) => (item.name || "").toLowerCase() === (invoice.clientName || "").toLowerCase());
    const contact = getClientContact(client);
    const location = client ? (client.city === client.state ? client.city : `${client.city || ""}, ${client.state || ""}`.replace(/^, |, $/g, "")) : "UAE";
    return (invoice.items || []).map((item, index) => {
      const ticketKey = `${(invoice.clientName || "").toLowerCase()}::${(item.product || "").toLowerCase()}`;
      const ticket = ticketByClientAndProduct.get(ticketKey);
      const installationDate = ticket?.visitDate || invoice.createdAt;

      return {
        id: `invoice-${invoice.id}-${index}`,
        organisation: invoice.clientName || client?.name || "Healthcare Facility",
        productName: item.product || "Medical Device",
        contactPerson: contact.name,
        contactNumber: contact.phone,
        expiryDate: addOneYear(installationDate),
        installationDate,
        installedBy: ticket ? ("FastonMed" as const) : ("Other Team" as const),
        otherTeamName: ticket ? "" : "External installation team",
        source: "Sales" as const,
        amount: item.amount,
        clientId: client?.id,
        orgType: client?.orgType || "Hospital",
        location,
        email: contact.email,
      };
    });
  });

  const fromTickets: ExpiryRecord[] = (tickets || [])
    .filter((ticket) => ticket.status === "Completed" || ticket.status === "Closed" || ticket.visitDate)
    .map((ticket) => {
      const client = clientById.get(ticket.clientId) || clients.find((item) => (item.name || "").toLowerCase() === (ticket.clientName || "").toLowerCase());
      const contact = getClientContact(client);
      const location = client ? (client.city === client.state ? client.city : `${client.city || ""}, ${client.state || ""}`.replace(/^, |, $/g, "")) : "UAE";
      const installationDate = ticket.visitDate || ticket.createdAt;
      return {
        id: `service-${ticket.id}`,
        organisation: ticket.clientName || client?.name || "Healthcare Facility",
        productName: `${ticket.equipment || "Equipment"} - ${ticket.model || "Service"}`,
        contactPerson: contact.name,
        contactNumber: contact.phone,
        expiryDate: addOneYear(installationDate),
        installationDate,
        installedBy: "FastonMed" as const,
        otherTeamName: "",
        source: "Service" as const,
        clientId: client?.id,
        orgType: client?.orgType || "Hospital",
        location,
        email: contact.email,
      };
    });

  const baseRows = [...fromInvoices, ...fromTickets];

  // Filter deleted
  let filtered = baseRows.filter((row) => !deletedIds.includes(row.id));

  // Apply edits to base rows
  filtered = filtered.map((row) => {
    if (editedRecords[row.id]) {
      return { ...row, ...editedRecords[row.id] };
    }
    return row;
  });

  // Include custom records with their edits
  const activeCustom = customRecords
    .filter((c) => !deletedIds.includes(c.id))
    .map((c) => (editedRecords[c.id] ? { ...c, ...editedRecords[c.id] } : c));

  const allRows = [...activeCustom, ...filtered];

  const uniqueRows = allRows.filter((row, index, rows) => {
    const key = `${(row.organisation || "").toLowerCase()}::${(row.productName || "").toLowerCase()}::${row.expiryDate || ""}`;
    return rows.findIndex((item) => `${(item.organisation || "").toLowerCase()}::${(item.productName || "").toLowerCase()}::${item.expiryDate || ""}` === key) === index;
  });

  return uniqueRows.sort((a, b) => normalizeDate(a.expiryDate) - normalizeDate(b.expiryDate));
}

function OrganisationPickerLogo({ logo, name, size = 26 }: { logo?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <img src={logo && !failed ? logo : "/company-placeholder.svg"} alt={logo && !failed ? `${name} logo` : "Organisation placeholder"} onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: "contain", borderRadius: 7, background: "#f0f7f3", padding: 3, flexShrink: 0 }} />;
}

export default function ProductExpiryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<AMCContract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Storage states for custom, edited, and deleted records
  const [customRecords, setCustomRecords] = useState<ExpiryRecord[]>([]);
  const [editedRecords, setEditedRecords] = useState<Record<string, Partial<ExpiryRecord>>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isInitialSyncing, setIsInitialSyncing] = useState(true);

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<ExpiryRecord | null>(null);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Form Fields
  const [formClientId, setFormClientId] = useState<string>("");
  const [formOrganisation, setFormOrganisation] = useState<string>("");
  const [formOrgType, setFormOrgType] = useState<string>("Hospital");
  const [formContactPerson, setFormContactPerson] = useState<string>("");
  const [formContactNumber, setFormContactNumber] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");

  const [formProductId, setFormProductId] = useState<string>("");
  const [formProductName, setFormProductName] = useState<string>("");
  const [formAmount, setFormAmount] = useState<number | string>("");

  const [formInstallationDate, setFormInstallationDate] = useState<string>("2026-09-09");
  const [formExpiryDate, setFormExpiryDate] = useState<string>("2027-09-09");
  const [installationUnknown, setInstallationUnknown] = useState<boolean>(false);
  const [expiryUnknown, setExpiryUnknown] = useState<boolean>(false);
  const [formInstalledBy, setFormInstalledBy] = useState<"FastonMed" | "Other Team">("FastonMed");
  const [formOtherTeamName, setFormOtherTeamName] = useState<string>("");
  const [formSource, setFormSource] = useState<"Sales" | "AMC" | "Service" | "Direct Enquiry" | "Warranty" | "Tender">("Sales");

  // Custom Searchable Dropdown States for Modal
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const [facilitySearchText, setFacilitySearchText] = useState("");
  const facilityDropdownRef = useRef<HTMLDivElement>(null);

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchText, setProductSearchText] = useState("");
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Contact Person Dropdown & Add Contact States
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [contactSearchText, setContactSearchText] = useState("");
  const [isCustomContactMode, setIsCustomContactMode] = useState(false);
  const [showAddContactPanel, setShowAddContactPanel] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  // Action dropdown state
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);

  // Add Product Modal State (Direct Catalog Addition)
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [prodFormName, setProdFormName] = useState("");
  const [prodFormCategory, setProdFormCategory] = useState<string>("Diagnostic Equipment");
  const [prodFormBrand, setProdFormBrand] = useState("");
  const [prodFormModel, setProdFormModel] = useState("");
  const [prodFormPrice, setProdFormPrice] = useState<number | "">("");
  const [prodFormCost, setProdFormCost] = useState<number | "">("");
  const [prodFormTraderId, setProdFormTraderId] = useState("");
  const [prodFormLeadTime, setProdFormLeadTime] = useState("3 - 5 Days");
  const [prodFormWarranty, setProdFormWarranty] = useState("1 Year");
  const [prodFormDescription, setProdFormDescription] = useState("");

  const openAddProductModal = () => {
    setProdFormName(productSearchText.trim() || "");
    setProdFormCategory("Diagnostic Equipment");
    setProdFormBrand("");
    setProdFormModel("");
    setProdFormPrice("");
    setProdFormCost("");
    const comps = getStoredCompanies();
    setProdFormTraderId(comps[0]?.id || "");
    setProdFormLeadTime("3 - 5 Days");
    setProdFormWarranty("1 Year");
    setProdFormDescription("");
    setShowAddProductModal(true);
  };

  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodFormName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    const comps = getStoredCompanies();
    const selectedComp = comps.find((c) => c.id === prodFormTraderId) || comps[0] || {
      id: "comp-fastonmed",
      name: "FastonMed Medical Trading LLC",
    };

    const selling = Number(prodFormPrice) || 0;
    const cost = Number(prodFormCost) || Math.round(selling * 0.75);

    const newProd = addProductWithTrader({
      name: prodFormName.trim(),
      category: prodFormCategory as ProductCategory,
      brand: prodFormBrand.trim() || selectedComp.name,
      model: prodFormModel.trim() || "Standard",
      traderCompanyId: selectedComp.id,
      traderCompanyName: selectedComp.name,
      deliveryLeadTime: prodFormLeadTime,
      traderPriceMin: cost,
      traderPriceMax: cost * 1.1,
      purchaseCost: cost,
      sellingPrice: selling,
      warrantyPeriod: prodFormWarranty,
      amcAvailable: true,
      inStock: 1,
      description: prodFormDescription.trim() || `Medical product added from Product Expiry. Supplied by ${selectedComp.name}.`,
    });

    setProducts((prev) => [newProd, ...prev.filter((p) => p.id !== newProd.id)]);
    setFormProductId(newProd.id);
    setFormProductName(newProd.name);
    if (newProd.sellingPrice > 0) {
      setFormAmount(newProd.sellingPrice);
    }
    setProductDropdownOpen(false);
    setProductSearchText("");

    toast.success(`Product "${newProd.name}" added to catalog and selected!`);
    setShowAddProductModal(false);
  };

  const handleSaveNewContact = () => {
    const name = newContactName.trim();
    if (!name) {
      toast.error("Please enter a contact person name");
      return;
    }

    const matchedClient = clients.find(
      (c) =>
        c.id === formClientId ||
        (c.name && formOrganisation && c.name.toLowerCase() === formOrganisation.trim().toLowerCase())
    );

    const newPerson = addStandalonePerson({
      clientId: matchedClient?.id,
      clientName: matchedClient?.name || formOrganisation.trim() || "Independent Healthcare Consultant",
      name,
      designation: newContactRole.trim() || "Contact Person",
      department: "Biomedical Engineering",
      phone: newContactPhone.trim(),
      whatsapp: newContactPhone.trim(),
      email: newContactEmail.trim(),
      status: "Active at Organisation",
    });

    const refreshedClients = getStoredClients();
    setClients(refreshedClients);
    window.dispatchEvent(new Event("fastonmed_clients_updated"));

    setFormContactPerson(newPerson.name);
    if (newPerson.phone) {
      setFormContactNumber(newPerson.phone);
    }
    if (newPerson.email) {
      setFormEmail(newPerson.email);
    }

    setShowAddContactPanel(false);
    setIsCustomContactMode(false);
    setContactDropdownOpen(false);
    toast.success(`Added ${newPerson.name} and selected as contact person!`);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (facilityDropdownRef.current && !facilityDropdownRef.current.contains(e.target as Node)) {
        setFacilityDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest("[data-expiry-actions]")) {
        setActiveActionDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveActionDropdownId(null);
        setFacilityDropdownOpen(false);
        setProductDropdownOpen(false);
        setContactDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectedOrgContacts = useMemo(() => {
    if (!formClientId && !formOrganisation) return [];
    const matchedClient = clients.find(
      (c) =>
        c.id === formClientId ||
        (c.name && formOrganisation && c.name.toLowerCase() === formOrganisation.trim().toLowerCase())
    );

    const contactsMap = new Map<string, ContactPerson>();
    if (matchedClient?.contacts) {
      matchedClient.contacts.forEach((c) => {
        if (c.name) contactsMap.set(c.name.toLowerCase().trim(), c);
      });
    }

    try {
      const allPeople = getStoredPeople();
      allPeople.forEach((p) => {
        const matchesClient =
          (matchedClient && p.clientId === matchedClient.id) ||
          (formOrganisation && p.clientName && p.clientName.toLowerCase() === formOrganisation.trim().toLowerCase());
        if (matchesClient && p.name && !contactsMap.has(p.name.toLowerCase().trim())) {
          contactsMap.set(p.name.toLowerCase().trim(), p);
        }
      });
    } catch {
      // ignore
    }

    return Array.from(contactsMap.values());
  }, [clients, formClientId, formOrganisation]);

  const filteredOrgContacts = useMemo(() => {
    if (!contactSearchText.trim()) return selectedOrgContacts;
    const q = contactSearchText.trim().toLowerCase();
    return selectedOrgContacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.designation || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [selectedOrgContacts, contactSearchText]);

  const filteredClientsInModal = useMemo(() => {
    if (!facilitySearchText.trim()) return clients;
    const q = facilitySearchText.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.orgType || "").toLowerCase().includes(q)
    );
  }, [clients, facilitySearchText]);

  const filteredProductsInModal = useMemo(() => {
    const list = products && products.length > 0 ? products : getStoredProducts();
    if (!productSearchText.trim()) return list;
    const q = productSearchText.trim().toLowerCase();
    return list.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.model || "").toLowerCase().includes(q)
    );
  }, [products, productSearchText]);

  const loadProducts = async () => {
    try {
      const prods = await getCatalogProducts().catch(() => getStoredProducts());
      if (prods && prods.length > 0) {
        setProducts(prods);
      } else {
        const stored = getStoredProducts();
        if (stored.length > 0) setProducts(stored);
      }
    } catch {
      setProducts(getStoredProducts());
    }
  };

  const syncServerExpiryRecords = async () => {
    try {
      const localCustom = getStoredCustomRecords();
      const localEdited = getStoredEditedRecords();
      const localDeleted = getStoredDeletedIds();

      const res = await fetch("/api/product-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          localCustomRecords: localCustom,
          localEditedRecords: localEdited,
          localDeletedIds: localDeleted,
        }),
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.customRecords)) {
        setCustomRecords(json.customRecords);
        try {
          localStorage.setItem(CUSTOM_EXPIRY_KEY, JSON.stringify(json.customRecords));
        } catch {}
        if (json.editedRecords) {
          setEditedRecords(json.editedRecords);
          try {
            localStorage.setItem(EDITED_EXPIRY_KEY, JSON.stringify(json.editedRecords));
          } catch {}
        }
        if (json.deletedIds) {
          setDeletedIds(json.deletedIds);
          try {
            localStorage.setItem(DELETED_EXPIRY_KEY, JSON.stringify(json.deletedIds));
          } catch {}
        }
      }
    } catch (err) {
      console.error("Failed to sync server product expiry records:", err);
    }
  };

  const loadData = () => {
    setClients(getStoredClients());
    setInvoices(getStoredInvoices());
    setContracts(getStoredContracts());
    setTickets(getStoredServiceTickets());
    void loadProducts();
    void fetchStoredProductsFromServer().then((fresh) => {
      if (fresh && fresh.length > 0) setProducts(fresh);
    });
    setCustomRecords(getStoredCustomRecords());
    setEditedRecords(getStoredEditedRecords());
    setDeletedIds(getStoredDeletedIds());
    void syncServerExpiryRecords();
  };

  useEffect(() => {
    loadData();
    void syncLiveContractsFromApi()
      .then((freshContracts) => {
        setContracts(freshContracts);
      })
      .finally(() => setIsInitialSyncing(false));
    const handleProductsUpdated = () => void loadProducts();
    const handleExpiryUpdated = () => void syncServerExpiryRecords();
    const handleWindowFocus = () => {
      void syncLiveContractsFromApi().then(setContracts);
      void syncServerExpiryRecords();
    };

    const pollTimer = setInterval(() => {
      void syncServerExpiryRecords();
    }, 60000);

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("fastonmed_contracts_updated", loadData);
    window.addEventListener("fastonmed_clients_updated", loadData);
    window.addEventListener("fastonmed_invoices_updated", loadData);
    window.addEventListener("fastonmed_services_updated", loadData);
    window.addEventListener("fastonmed_products_updated", handleProductsUpdated);
    window.addEventListener("fastonmed_expiry_updated", handleExpiryUpdated);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("fastonmed_contracts_updated", loadData);
      window.removeEventListener("fastonmed_clients_updated", loadData);
      window.removeEventListener("fastonmed_invoices_updated", loadData);
      window.removeEventListener("fastonmed_services_updated", loadData);
      window.removeEventListener("fastonmed_products_updated", handleProductsUpdated);
      window.removeEventListener("fastonmed_expiry_updated", handleExpiryUpdated);
    };
  }, []);

  const records = useMemo(
    () => buildExpiryRecords(clients, invoices, contracts, tickets, customRecords, editedRecords, deletedIds),
    [clients, invoices, contracts, tickets, customRecords, editedRecords, deletedIds]
  );

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      record.organisation.toLowerCase().includes(query) ||
      record.productName.toLowerCase().includes(query) ||
      record.contactPerson.toLowerCase().includes(query) ||
      record.contactNumber.toLowerCase().includes(query) ||
      record.otherTeamName.toLowerCase().includes(query);
    const days = getDaysToExpiry(record.expiryDate);
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Expired" && days !== null && days < 0) ||
      (statusFilter === "Due Soon" && days !== null && days >= 0 && days <= 30) ||
      (statusFilter === "Active" && days !== null && days > 30) ||
      (statusFilter === "External" && record.installedBy === "Other Team") ||
      (statusFilter === "Need to Check" &&
        (days === null ||
          record.installationDate === "Need to Check Date" ||
          record.installationDate === "Need to Check" ||
          record.expiryDate === "Need to Check Date" ||
          record.expiryDate === "Need to Check"));
    return matchesSearch && matchesStatus;
  });

  const dueSoonCount = records.filter((record) => {
    const days = getDaysToExpiry(record.expiryDate);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const expiredCount = records.filter((record) => {
    const days = getDaysToExpiry(record.expiryDate);
    return days !== null && days < 0;
  }).length;
  const externalInstallCount = records.filter((record) => record.installedBy === "Other Team").length;
  const needToCheckCount = records.filter((record) => {
    const days = getDaysToExpiry(record.expiryDate);
    return (
      days === null ||
      record.installationDate === "Need to Check Date" ||
      record.installationDate === "Need to Check" ||
      record.expiryDate === "Need to Check Date" ||
      record.expiryDate === "Need to Check"
    );
  }).length;

  // Open modal for ADD
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingRecordId(null);
    setContactDropdownOpen(false);
    setContactSearchText("");
    setIsCustomContactMode(false);
    setShowAddContactPanel(false);
    setNewContactName("");
    setNewContactRole("");
    setNewContactPhone("");
    setNewContactEmail("");

    // Pick first client if available
    const firstClient = clients[0];
    const firstContact = firstClient?.contacts?.[0];
    const firstProd = products[0];

    const today = new Date().toISOString().slice(0, 10);
    const nextYear = addOneYear(today);

    setFormClientId(firstClient?.id || "");
    setFormOrganisation(firstClient?.name || "");
    setFormOrgType(firstClient?.orgType || "Hospital");
    setFormContactPerson(firstContact?.name || "");
    setFormContactNumber(firstContact?.phone || firstClient?.phone || "");
    setFormEmail(firstContact?.email || firstClient?.email || "");

    setFormProductId(firstProd?.id || "");
    setFormProductName(firstProd?.name || "");
    setFormAmount(firstProd?.sellingPrice || 35000);

    setFormInstallationDate(today);
    setFormExpiryDate(nextYear);
    setInstallationUnknown(false);
    setExpiryUnknown(false);
    setFormInstalledBy("FastonMed");
    setFormOtherTeamName("");
    setFormSource("Sales");

    setShowAddEditModal(true);
  };

  // Open modal for EDIT
  const handleOpenEdit = (record: ExpiryRecord) => {
    setIsEditMode(true);
    setEditingRecordId(record.id);
    setContactDropdownOpen(false);
    setContactSearchText("");
    setIsCustomContactMode(false);
    setShowAddContactPanel(false);
    setNewContactName("");
    setNewContactRole("");
    setNewContactPhone("");
    setNewContactEmail("");

    setFormClientId(record.clientId || "");
    setFormOrganisation(record.organisation);
    setFormOrgType(record.orgType || "Hospital");
    setFormContactPerson(record.contactPerson && record.contactPerson !== "—" ? record.contactPerson : "");
    setFormContactNumber(record.contactNumber && record.contactNumber !== "—" ? record.contactNumber : "");
    setFormEmail(record.email || "");

    setFormProductId(record.productId || "");
    setFormProductName(record.productName);
    setFormAmount(record.amount || "");

    const isInstUnk = record.installationDate === "Need to Check Date" || record.installationDate === "Need to Check";
    const isExpUnk = record.expiryDate === "Need to Check Date" || record.expiryDate === "Need to Check";
    setInstallationUnknown(isInstUnk);
    setExpiryUnknown(isExpUnk);

    setFormInstallationDate(isInstUnk ? "" : (record.installationDate || new Date().toISOString().slice(0, 10)));
    setFormExpiryDate(isExpUnk ? "" : (record.expiryDate || addOneYear(new Date().toISOString().slice(0, 10))));
    setFormInstalledBy(record.installedBy || "FastonMed");
    setFormOtherTeamName(record.otherTeamName || "");
    setFormSource(record.source || "Sales");

    setShowAddEditModal(true);
  };

  // Delete record
  const handleDeleteRecord = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from tracked product expiry?`)) {
      return;
    }

    if (id.startsWith("custom-")) {
      const updated = customRecords.filter((r) => r.id !== id);
      setCustomRecords(updated);
      saveStoredCustomRecords(updated);
    } else {
      const updatedDeleted = [...deletedIds, id];
      setDeletedIds(updatedDeleted);
      saveStoredDeletedIds(updatedDeleted);
    }

    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
    toast.success(`Removed "${name}" from product expiry tracking.`);
  };

  // Handle Client Selection change
  const handleClientChange = (clientId: string) => {
    setFormClientId(clientId);
    setContactDropdownOpen(false);
    setContactSearchText("");
    setIsCustomContactMode(false);
    setShowAddContactPanel(false);

    if (clientId === "CUSTOM") {
      setFormOrganisation("");
      setFormOrgType("Hospital");
      setFormContactPerson("");
      setFormContactNumber("");
      setFormEmail("");
      return;
    }

    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setFormOrganisation(found.name);
      setFormOrgType(found.orgType || "Hospital");
      const primary = found.contacts?.[0];
      setFormContactPerson(primary?.name || "");
      setFormContactNumber(primary?.phone || found.phone || "");
      setFormEmail(primary?.email || found.email || "");
    }
  };

  // Handle Product Selection change
  const handleProductChange = (productId: string) => {
    setFormProductId(productId);
    if (productId === "CUSTOM") {
      setFormProductName("");
      return;
    }

    const found = products.find((p) => p.id === productId);
    if (found) {
      setFormProductName(found.name);
      setFormAmount(found.sellingPrice || "");
    }
  };

  // Form Submit (Save / Add)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formOrganisation.trim()) {
      toast.error("Please enter or select an Organisation");
      return;
    }
    if (!formProductName.trim()) {
      toast.error("Please enter or select a Product Name");
      return;
    }
    if (!expiryUnknown && !formExpiryDate) {
      toast.error("Please provide an Expiry Date or mark as Need to Check Date");
      return;
    }

    const finalInstallationDate = installationUnknown ? "Need to Check Date" : formInstallationDate;
    const finalExpiryDate = expiryUnknown ? "Need to Check Date" : formExpiryDate;
    let activeUser: { id?: string; name?: string } = {};
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      activeUser = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}

    const updatedData: Partial<ExpiryRecord> = {
      organisation: formOrganisation.trim(),
      productName: formProductName.trim(),
      contactPerson: formContactPerson.trim(),
      contactNumber: formContactNumber.trim(),
      expiryDate: finalExpiryDate,
      installationDate: finalInstallationDate,
      installedBy: formInstalledBy,
      otherTeamName: formInstalledBy === "Other Team" ? (formOtherTeamName.trim() || "External installation team") : "",
      source: formSource,
      amount: Number(formAmount) || 0,
      clientId: formClientId && formClientId !== "CUSTOM" ? formClientId : undefined,
      productId: formProductId && formProductId !== "CUSTOM" ? formProductId : undefined,
      orgType: formOrgType,
      email: formEmail.trim(),
      updatedBy: activeUser.name || "User not recorded",
      updatedById: activeUser.id,
    };

    if (isEditMode && editingRecordId) {
      // If editing a custom record
      if (editingRecordId.startsWith("custom-")) {
        const updated = customRecords.map((r) => (r.id === editingRecordId ? ({ ...r, ...updatedData } as ExpiryRecord) : r));
        setCustomRecords(updated);
        saveStoredCustomRecords(updated);
      } else {
        // If editing a base derived record, save override
        const updatedEdited = { ...editedRecords, [editingRecordId]: updatedData };
        setEditedRecords(updatedEdited);
        saveStoredEditedRecords(updatedEdited);
      }
      toast.success(`Updated details for "${formProductName}" successfully!`);
    } else {
      // Add new record
      const newRecord: ExpiryRecord = {
        id: `custom-exp-${Date.now()}`,
        organisation: formOrganisation.trim(),
        productName: formProductName.trim(),
        contactPerson: formContactPerson.trim(),
        contactNumber: formContactNumber.trim(),
        expiryDate: finalExpiryDate,
        installationDate: finalInstallationDate,
        installedBy: formInstalledBy,
        otherTeamName: formInstalledBy === "Other Team" ? (formOtherTeamName.trim() || "External installation team") : "",
        source: formSource,
        amount: Number(formAmount) || 0,
        clientId: formClientId && formClientId !== "CUSTOM" ? formClientId : undefined,
        productId: formProductId && formProductId !== "CUSTOM" ? formProductId : undefined,
        orgType: formOrgType,
        email: formEmail.trim(),
        isCustom: true,
        createdAt: new Date().toISOString(),
        createdBy: activeUser.name || "User not recorded",
        createdById: activeUser.id,
      };

      const updated = [newRecord, ...customRecords];
      setCustomRecords(updated);
      saveStoredCustomRecords(updated);
      toast.success(`Tracked product "${formProductName}" added for ${formOrganisation}!`);
    }

    setShowAddEditModal(false);
  };

  const exportCsv = () => {
    const headers = [
      "Organisation",
      "Product Name",
      "Contact Person",
      "Contact Number",
      "Expiry Date",
      "Installation Date",
      "Installation Team",
      "Other Team Name",
      "Source",
      "Value",
    ];
    const rows = filteredRecords.map((record) => [
      record.organisation,
      record.productName,
      record.contactPerson || "—",
      record.contactNumber || "—",
      record.expiryDate,
      record.installationDate,
      record.installedBy,
      record.otherTeamName,
      record.source,
      record.amount ? `AED ${record.amount}` : "—",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fastonmed-product-expiry.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Narrow column line divider style
  const colDivider = { borderRight: "1px solid #e2e8f0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.25s ease" }}>
      {/* Interactive Metric Cards */}
      <div className="expiry-mobile-summary" data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {[
          {
            key: "All",
            label: "Tracked Products",
            value: records.length,
            icon: ClipboardList,
            color: "#004d66",
            bg: "#e0f2fe",
            activeBorder: "#004d66",
          },
          {
            key: "Due Soon",
            label: "Due In 30 Days",
            value: dueSoonCount,
            icon: AlertTriangle,
            color: "#ea580c",
            bg: "#fff7ed",
            activeBorder: "#ea580c",
          },
          {
            key: "Expired",
            label: "Expired",
            value: expiredCount,
            icon: CalendarDays,
            color: "#dc2626",
            bg: "#fee2e2",
            activeBorder: "#dc2626",
          },
          {
            key: "External",
            label: "Other Team Installed",
            value: externalInstallCount,
            icon: Wrench,
            color: "#7c3aed",
            bg: "#f3e8ff",
            activeBorder: "#7c3aed",
          },
          ...(needToCheckCount > 0
            ? [
                {
                  key: "Need to Check",
                  label: "Need to Check Date",
                  value: needToCheckCount,
                  icon: Clock,
                  color: "#d97706",
                  bg: "#fef3c7",
                  activeBorder: "#d97706",
                },
              ]
            : []),
        ].filter(stat => ["All", "Due Soon", "Expired"].includes(stat.key)).map((stat) => {
          const Icon = stat.icon;
          const isActive = statusFilter === stat.key;
          return (
            <div
              key={stat.label}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setStatusFilter(prev => prev === stat.key ? "All" : stat.key); } }}
              className="card"
              onClick={() => setStatusFilter((prev) => (prev === stat.key ? "All" : stat.key))}
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                borderRadius: 9,
                border: isActive ? `2px solid ${stat.activeBorder}` : "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: 22, color: stat.color, fontWeight: 900, marginTop: 2 }}>{stat.value}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: stat.bg, display: "grid", placeItems: "center", color: stat.color }}>
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table Card */}
      <div className="card expiry-mobile-content" style={{ padding: 0, overflow: "hidden", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff" }}>
        {isInitialSyncing && (
          <div role="status" style={{ padding: "9px 14px", background: "#f0f9ff", color: "#075985", borderBottom: "1px solid #bae6fd", fontSize: 12.5, fontWeight: 600 }}>
            Loading contract and expiry records…
          </div>
        )}
        {/* Filter & Action bar */}
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
            flexWrap: "wrap",
            borderBottom: "1px solid #f1f5f9",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 300px", maxWidth: 460 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                className="form-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search organisation, product, contact, team..."
                style={{ paddingLeft: 34, paddingRight: search ? 30 : 12, height: 34, fontSize: 12.5 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Status Filter */}
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 140, height: 34, fontSize: 12 }}
            >
              <option value="All">All Statuses</option>
              <option value="Expired">Expired Only</option>
              <option value="Due Soon">Due in 30 Days</option>
              <option value="Active">Active Contract</option>
              <option value="External">External Installed</option>
              <option value="Need to Check">Need to Check Date</option>
            </select>



            {/* ADD PRODUCT BUTTON */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                fontSize: 12.5,
                padding: "0 14px",
                fontWeight: 600,
                backgroundColor: "#004d66",
                color: "#ffffff",
                boxShadow: "0 1px 2px rgba(0,77,102,0.2)",
              }}
            >
              <Plus size={14} />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Table - 7 clean, balanced, space-efficient columns */}
        <div className="table-container" style={{ border: "none", overflowX: "auto" }}>
          <table className="expiry-product-mobile-list" data-mobile-cards="true" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #f1f5f9" }}>
                  Product / Equipment
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #f1f5f9" }}>
                  Organisation
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", width: 175, borderRight: "1px solid #f1f5f9" }}>
                  Expiry Timeline
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", width: 155, borderRight: "1px solid #f1f5f9" }}>
                  Installation
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", width: 180, borderRight: "1px solid #f1f5f9" }}>
                  Key Contact
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", width: 135, borderRight: "1px solid #f1f5f9" }}>
                  Source & Value
                </th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", width: 110 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, rowIdx) => {
                const days = getDaysToExpiry(record.expiryDate);
                const badge = getExpiryBadge(days);
                const isIndividual = record.orgType === "Individual Contact";
                const hasContactPerson = Boolean(record.contactPerson && record.contactPerson !== "—" && record.contactPerson !== "-");
                const hasContactNumber = Boolean(record.contactNumber && record.contactNumber !== "—" && record.contactNumber !== "-");

                return (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.12s ease",
                    }}
                    className="hover:bg-slate-50"
                  >
                    {/* 1. Product / Equipment (First Priority) */}
                    <td data-label="Product / Equipment" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          <Package size={14} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", lineHeight: 1.25 }}>
                            {record.productName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Organisation - Minimal & Logo Removed */}
                    <td data-label="Organisation" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", lineHeight: 1.25 }}>
                            {record.organisation}
                          </span>
                          {isIndividual && (
                            <span style={{ fontSize: 9.5, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                              USER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.2 }}>
                          {record.orgType || "Healthcare Facility"}
                        </div>
                      </div>
                    </td>

                    {/* 3. Expiry Timeline */}
                    <td data-label="Expiry Timeline" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {record.expiryDate === "Need to Check Date" || record.expiryDate === "Need to Check" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px dashed #f59e0b",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          Need to Check Date
                        </span>
                      ) : (
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a" }}>
                          {formatDate(record.expiryDate)}
                        </div>
                      )}
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
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, display: "inline-block" }} />
                          {days === null
                            ? "Need to Check"
                            : days < 0
                            ? `Expired (${Math.abs(days)}d)`
                            : days <= 30
                            ? `Due in ${days}d`
                            : `Active (${days}d)`}
                        </span>
                      </div>
                    </td>

                    {/* 4. Installation Date & Team */}
                    <td data-label="Installation" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {record.installationDate === "Need to Check Date" || record.installationDate === "Need to Check" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px dashed #f59e0b",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          Need to Check Date
                        </span>
                      ) : (
                        <div style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
                          {formatDate(record.installationDate)}
                        </div>
                      )}
                      <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                        {record.installedBy === "FastonMed" ? (
                          <span style={{ fontSize: 11, color: "#059669", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ShieldCheck size={12} color="#059669" />
                            FastonMed
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }} title={record.otherTeamName || "Other Team"}>
                            <Wrench size={12} color="#7c3aed" />
                            {record.otherTeamName ? (record.otherTeamName.length > 15 ? record.otherTeamName.slice(0, 15) + "…" : record.otherTeamName) : "Other Team"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 5. Key Contact */}
                    <td data-label="Key Contact" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                      {hasContactPerson ? (
                        <div>
                          <div style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 600, lineHeight: 1.25 }}>
                            {record.contactPerson}
                          </div>
                          {hasContactNumber && (
                            <a
                              href={`tel:${record.contactNumber}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 11, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginTop: 2, fontWeight: 500 }}
                            >
                              <Phone size={10} />
                              {record.contactNumber}
                            </a>
                          )}
                        </div>
                      ) : hasContactNumber ? (
                        <a
                          href={`tel:${record.contactNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 11.5, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontWeight: 500 }}
                        >
                          <Phone size={10} />
                          {record.contactNumber}
                        </a>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* 6. Source & Value */}
                    <td data-label="Source & Value" style={{ padding: "10px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      <div>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: record.source === "AMC" ? "#004d66" : "#475569",
                            backgroundColor: record.source === "AMC" ? "#e0f2fe" : "#f1f5f9",
                            border: `1px solid ${record.source === "AMC" ? "#bae6fd" : "#e2e8f0"}`,
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {record.source === "Sales" ? "Direct" : record.source}
                        </span>
                      </div>
                      {record.amount && record.amount > 0 ? (
                        <div style={{ fontWeight: 700, color: "#059669", fontSize: 12, marginTop: 3 }}>
                          {formatCurrency(record.amount)}
                        </div>
                      ) : null}
                    </td>

                    {/* 7. Action Dropdown */}
                    <td data-label="Action"
                      data-expiry-actions
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        position: "relative",
                        zIndex: activeActionDropdownId === record.id ? 30 : 1,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          position: "relative",
                          display: "inline-block",
                          textAlign: "left",
                        }}
                      >
                        <button
                          type="button"
                          title="Actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionDropdownId(activeActionDropdownId === record.id ? null : record.id);
                          }}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: activeActionDropdownId === record.id ? "1px solid #004d66" : "1px solid #e2e8f0",
                            backgroundColor: activeActionDropdownId === record.id ? "#f0fdfa" : "#ffffff",
                            color: activeActionDropdownId === record.id ? "#004d66" : "#475569",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          }}
                        >
                          <span>Action</span>
                          <ChevronDown
                            size={12}
                            style={{
                              transform: activeActionDropdownId === record.id ? "rotate(180deg)" : "none",
                              transition: "transform 0.15s ease",
                            }}
                          />
                        </button>

                        {activeActionDropdownId === record.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              ...(rowIdx >= filteredRecords.length - 2 && filteredRecords.length > 3
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
                                setSelectedRecord(record);
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
                                handleOpenEdit(record);
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
                              <span>Edit Record</span>
                            </button>

                            <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRecord(record.id, record.productName);
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

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <CalendarDays size={32} color="#cbd5e1" />
                      <div style={{ fontWeight: 600, color: "#334155", fontSize: 14 }}>No product expiry records found</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Try adjusting your search query or add a new tracked product</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= ADD / EDIT PRODUCT EXPIRY MODAL ================= */}
      {showAddEditModal && (
        <div className="expiry-form-overlay" data-mobile-overlay="true"
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
            className="card expiry-form-dialog"
            style={{
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              animation: "scaleUp 0.15s ease",
              backgroundColor: "#ffffff",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="expiry-form-heading"
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isEditMode ? "#e0f2fe" : "#ecfdf5",
                    color: isEditMode ? "#0284c7" : "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isEditMode ? <Pencil size={18} /> : <Plus size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    {isEditMode ? "Edit Tracked Product Expiry" : "Add Tracked Product"}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Manage product warranty, AMC and installation expiry tracking
                  </div>
                </div>
              </div>

              <button aria-label="Close tracked product form"
                type="button"
                onClick={() => setShowAddEditModal(false)}
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
            <form className="expiry-product-form"
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
                          if (formClientId === "CUSTOM") {
                            return (
                              <>
                                <OrganisationPickerLogo name={formOrganisation || "Organisation"} />
                                <span style={{ fontWeight: 600, color: "#004d66" }}>Custom Organisation: {formOrganisation || "Unspecified"}</span>
                              </>
                            );
                          }
                          const matched = clients.find((c) => c.id === formClientId);
                          if (matched) {
                            return (
                              <>
                                <OrganisationPickerLogo logo={matched.logo || matched.photo} name={matched.name} />
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{matched.name}</span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>({matched.orgType || "Hospital"})</span>
                              </>
                            );
                          }
                          if (formOrganisation) {
                            return (
                              <>
                                <OrganisationPickerLogo name={formOrganisation} />
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{formOrganisation}</span>
                              </>
                            );
                          }
                          return <span>-- Choose Organisation from CRM Directory --</span>;
                        })()}
                      </div>
                      <ChevronDown size={15} color="#64748b" style={{ transform: facilityDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                    </button>

                    {/* Custom Floating Popover Matching Website View */}
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
                          animation: "fadeIn 0.15s ease",
                        }}
                      >
                        {/* Search Input Box */}
                        <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                          <Search size={14} color="#94a3b8" />
                          <input
                            type="text"
                            placeholder="Type to search facility or city..."
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

                        {/* Custom Option at Top */}
                        <button
                          type="button"
                          onClick={() => {
                            handleClientChange("CUSTOM");
                            setFacilityDropdownOpen(false);
                            setFacilitySearchText("");
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            borderBottom: "1px solid #f1f5f9",
                            backgroundColor: formClientId === "CUSTOM" ? "#e0f2fe" : "#ffffff",
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
                          <span>+ Enter Custom Organisation Name</span>
                        </button>

                        {/* Filtered Clients List */}
                        <div style={{ maxHeight: 220, overflowY: "auto" }}>
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
                                  onClick={() => {
                                    handleClientChange(c.id);
                                    setFacilityDropdownOpen(false);
                                    setFacilitySearchText("");
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
                                    transition: "background 0.1s ease",
                                  }}
                                  className="hover:bg-slate-50"
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                                    <OrganisationPickerLogo logo={c.logo || c.photo} name={c.name} size={30} />
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
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Organisation Name input if custom */}
                  {formClientId === "CUSTOM" && (
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Custom Organisation Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="e.g. American Hospital Dubai"
                        value={formOrganisation}
                        onChange={(e) => setFormOrganisation(e.target.value)}
                        style={{ fontSize: 13, height: 36 }}
                      />
                    </div>
                  )}

                  {/* Organisation Type & Contact Persons row */}
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
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#0284c7",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
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
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#0d9488",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              title="Add new contact person to this organisation"
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
                              transition: "border-color 0.15s ease",
                            }}
                            className="hover:border-slate-400"
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                              {formContactPerson ? (
                                <>
                                  <span style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {formContactPerson}
                                  </span>
                                  {(() => {
                                    const matched = selectedOrgContacts.find((c) => c.name.toLowerCase() === formContactPerson.toLowerCase());
                                    if (matched?.designation) {
                                      return (
                                        <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>
                                          ({matched.designation})
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>
                                  {selectedOrgContacts.length > 0
                                    ? "-- Select Contact Person --"
                                    : formOrganisation
                                    ? "-- Click to Add Contact Person --"
                                    : "-- Select Organisation First --"}
                                </span>
                              )}
                            </div>
                            <ChevronDown
                              size={14}
                              color="#64748b"
                              style={{
                                transform: contactDropdownOpen ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                                flexShrink: 0,
                              }}
                            />
                          </button>

                          {/* Floating Dropdown */}
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
                                animation: "fadeIn 0.15s ease",
                              }}
                            >
                              {/* Search input if multiple contacts */}
                              {selectedOrgContacts.length > 3 && (
                                <div style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
                                  <Search size={13} color="#94a3b8" />
                                  <input
                                    type="text"
                                    placeholder="Search contact person..."
                                    value={contactSearchText}
                                    onChange={(e) => setContactSearchText(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      border: "none",
                                      outline: "none",
                                      background: "transparent",
                                      fontSize: 12,
                                      width: "100%",
                                      color: "#0f172a",
                                    }}
                                  />
                                  {contactSearchText && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setContactSearchText("");
                                      }}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Option 1: + Add New Contact Person */}
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
                                className="hover:bg-teal-100/70"
                              >
                                <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e" }}>
                                  <Plus size={13} />
                                </div>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  + Add New Person {formOrganisation ? `to ${formOrganisation}` : ""}
                                </span>
                              </button>

                              {/* Option 2: Type Custom Name Manually */}
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
                                className="hover:bg-sky-50"
                              >
                                <Pencil size={12} />
                                <span>Type Custom Name Manually</span>
                              </button>

                              {/* Contacts List */}
                              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                                {filteredOrgContacts.length === 0 ? (
                                  <div style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
                                    {formOrganisation
                                      ? "No contacts recorded yet. Click above to add one!"
                                      : "Select an organisation above first."}
                                  </div>
                                ) : (
                                  filteredOrgContacts.map((contact, idx) => {
                                    const isSelected = formContactPerson.trim().toLowerCase() === contact.name.trim().toLowerCase();
                                    return (
                                      <button
                                        key={contact.id || idx}
                                        type="button"
                                        onClick={() => {
                                          setFormContactPerson(contact.name);
                                          if (contact.phone || contact.whatsapp) {
                                            setFormContactNumber(contact.phone || contact.whatsapp || "");
                                          }
                                          if (contact.email) {
                                            setFormEmail(contact.email);
                                          }
                                          setContactDropdownOpen(false);
                                          setContactSearchText("");
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
                                        className="hover:bg-slate-50"
                                      >
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: 12.5, color: isSelected ? "#0d9488" : "#0f172a" }}>
                                            {contact.name}
                                          </div>
                                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {contact.designation && <span>{contact.designation}</span>}
                                            {(contact.phone || contact.whatsapp) && <span>· 📞 {contact.phone || contact.whatsapp}</span>}
                                          </div>
                                        </div>
                                        {isSelected && <Check size={14} color="#0d9488" />}
                                      </button>
                                    );
                                  })
                                )}
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

                  {/* Inline Add Contact Person Panel */}
                  {showAddContactPanel && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        backgroundColor: "#f0fdfa",
                        border: "1px solid #99f6e4",
                        animation: "fadeIn 0.15s ease",
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

                  {/* Quick Contact suggestions if client has multiple contacts */}
                  {selectedOrgContacts.length > 0 && (
                    <div className="expiry-contact-suggestions" style={{ marginTop: 2 }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        Quick Select Contact:
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {selectedOrgContacts.map((contact, idx) => (
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

              {/* SECTION 2: CONNECTED PRODUCT (PROCUREMENT CATALOG) */}
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
                          const matched = products.find((p) => p.id === formProductId);
                          if (matched) {
                            return (
                              <>
                                <Package size={14} color="#004d66" />
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{matched.name}</span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>• {matched.category} ({matched.brand || "Medical"})</span>
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

                    {/* Custom Floating Popover Matching Website View */}
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
                          animation: "fadeIn 0.15s ease",
                        }}
                      >
                        {/* Search Input Box */}
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

                        {/* Action buttons inside dropdown header */}
                        <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #e2e8f0" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setProductDropdownOpen(false);
                              openAddProductModal();
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              border: "none",
                              borderBottom: "1px solid #f1f5f9",
                              backgroundColor: "#f0fdf4",
                              textAlign: "left",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#15803d",
                            }}
                            className="hover:bg-emerald-100"
                          >
                            <Plus size={13} />
                            <span>Add New Product to Catalog</span>
                          </button>

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

                        {/* Filtered Products List */}
                        <div style={{ padding: "5px 12px", backgroundColor: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                          <span>PRODUCTS CATALOG</span>
                          <span style={{ backgroundColor: "#e2e8f0", color: "#334155", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>
                            {filteredProductsInModal.length} Available
                          </span>
                        </div>
                        <div style={{ maxHeight: 290, overflowY: "auto" }}>
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
                                    transition: "background 0.1s ease",
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

                  {/* Product Name text field if custom */}
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

                  {/* Commercial Value */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Product Value (AED)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      placeholder="e.g. 45000"
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
                <div data-mobile-grid="stack" style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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


                </div>

                {/* Other team contractor name if external */}
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

            {/* Action Buttons (Sticky Footer) */}
            <div className="expiry-form-footer"
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
                  onClick={() => setShowAddEditModal(false)}
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
                  <span>{isEditMode ? "Save Changes" : "Add product"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= VIEW PRODUCT DETAILS MODAL ================= */}
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
              maxWidth: 540,
              padding: 0,
              overflow: "hidden",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
              animation: "scaleUp 0.15s ease",
              backgroundColor: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
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
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a", lineHeight: 1.25 }}>
                    {selectedRecord.organisation}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    {selectedRecord.orgType || "Healthcare Facility"} {selectedRecord.location ? `• ${selectedRecord.location}` : ""}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 5,
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

            {/* Modal Body */}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Product Info Banner */}
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
                <div style={{ minWidth: 0 }}>
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
                {selectedRecord.amount && selectedRecord.amount > 0 && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Value</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
                      {formatCurrency(selectedRecord.amount)}
                    </div>
                  </div>
                )}
              </div>

              {/* Unified Timeline & Status Grid */}
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
                {/* Installation Date */}
                <div style={{ padding: "9px 12px", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Installation Date</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: (selectedRecord.installationDate === "Need to Check Date" || selectedRecord.installationDate === "Need to Check") ? "#b45309" : "#0f172a", marginTop: 2 }}>
                    {formatDate(selectedRecord.installationDate)}
                  </div>
                </div>

                {/* Expiry Date */}
                <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Expiry Date</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: (selectedRecord.expiryDate === "Need to Check Date" || selectedRecord.expiryDate === "Need to Check") ? "#b45309" : "#0f172a", marginTop: 2 }}>
                    {formatDate(selectedRecord.expiryDate)}
                  </div>
                </div>

                {/* Expiry Status */}
                <div style={{ padding: "9px 12px", borderRight: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500, marginBottom: 3 }}>Expiry Status</div>
                  <div>
                    {(() => {
                      const days = getDaysToExpiry(selectedRecord.expiryDate);
                      const badge = getExpiryBadge(days);
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color }} />
                          {days === null
                            ? badge.label
                            : `${badge.label} (${days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`})`}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Installation Team */}
                <div style={{ padding: "9px 12px" }}>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>Installation Team</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    {selectedRecord.installedBy === "FastonMed" ? (
                      <ShieldCheck size={12} color="#059669" />
                    ) : (
                      <Wrench size={12} color="#7c3aed" />
                    )}
                    <span>{selectedRecord.installedBy}</span>
                    {selectedRecord.otherTeamName && (
                      <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 400 }}>({selectedRecord.otherTeamName})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Minimal Contact Row */}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      backgroundColor: "#e0f2fe",
                      color: "#004d66",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10.5,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {selectedRecord.contactPerson && selectedRecord.contactPerson !== "-" ? selectedRecord.contactPerson[0] : "C"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedRecord.contactPerson && selectedRecord.contactPerson !== "-" ? selectedRecord.contactPerson : "Facility Contact"}
                    </div>
                    {selectedRecord.contactNumber && selectedRecord.contactNumber !== "-" && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {selectedRecord.contactNumber}
                      </div>
                    )}
                  </div>
                </div>

                {selectedRecord.contactNumber && selectedRecord.contactNumber !== "-" && (
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
                      flexShrink: 0,
                    }}
                  >
                    <Phone size={11} />
                    <span>Call</span>
                  </a>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const toEdit = selectedRecord;
                  setSelectedRecord(null);
                  handleOpenEdit(toEdit);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#004d66",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Pencil size={12} />
                <span>Edit Details</span>
              </button>

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

      {/* ================= ADD PRODUCT DIRECTLY POPUP MODAL ================= */}
      {showAddProductModal && (
        <AddProductModal
          initialName={prodFormName}
          initialCategory={prodFormCategory}
          onClose={() => setShowAddProductModal(false)}
          onProductCreated={(newProd) => {
            setProducts((prev) => [newProd, ...prev.filter((p) => p.id !== newProd.id)]);
            setFormProductId(newProd.id);
            setFormProductName(newProd.name);
            if (newProd.sellingPrice > 0) {
              setFormAmount(newProd.sellingPrice);
            }
            setProductDropdownOpen(false);
            setProductSearchText("");
            setShowAddProductModal(false);
          }}
        />
      )}
    </div>
  );
}
