"use client";
import { useState, useEffect, useMemo } from "react";
import { mockEmployees, mockClients, mockProducts } from "@/lib/mock-data";
import {
  addClientFromLead,
  getStoredClients,
  saveStoredClients,
  getStoredLeads,
  saveStoredLeads,
  deleteStoredLead,
  syncLeadsFromServer,
  syncLeadToQuotations,
  clearDummyLeads,
  isDummyLead,
  getStoredPeople,
  addStandalonePerson,
  INITIAL_DEPARTMENTS,
} from "@/lib/client-store";
import { getStatusColor, formatCurrency } from "@/lib/utils";
import type { Lead, LeadContact, PipelineStage, LeadSource, LeadComment, ProductCategory, Product, Client, OrgType, ContactPerson, ClientStatus } from "@/types";
import toast from "react-hot-toast";
import CustomLightSelect from "@/components/CustomLightSelect";
import ClientModal, { INITIAL_PLACES } from "@/components/ClientModal";
import AddPersonModal from "@/components/AddPersonModal";
import AddProductModal from "@/components/AddProductModal";
import { getCatalogProducts } from "@/lib/woocommerce/catalog-store";
import { getStoredProducts, addProductWithTrader, getStoredCompanies, fetchStoredProductsFromServer } from "@/lib/trader-store";
import {
  Calendar,
  Search,
  DollarSign,
  Plus,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
  Stethoscope,
  Package,
  Building2,
  Phone,
  Mail,
  User,
  UserPlus,
  Users,
  Star,
  Wrench,
  FileText,
  X,
  Check,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Pencil,
  Edit3,
  ChevronDown,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";
import { getZohoLiveQuotes } from "@/lib/zoho-live-quotes";

const STAGES: PipelineStage[] = [
  "New Lead",
  "Contacted",
  "Quotation Forwarded",
  "Approved",
  "Rejected",
  "Follow Up Later",
  "Requirement Review",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Waiting Review",
];

const STAGE_CONFIGS: Record<
  string,
  { label: string; dot: string; isCore: boolean }
> = {
  "New Lead": { label: "New Lead", dot: "#0284c7", isCore: true },
  "Contacted": { label: "Contacted", dot: "#3b82f6", isCore: true },
  "Quotation Forwarded": { label: "Quotation Forwarded", dot: "#f59e0b", isCore: true },
  "Approved": { label: "Approved", dot: "#10b981", isCore: true },
  "Rejected": { label: "Rejected", dot: "#ef4444", isCore: true },
  "Follow Up Later": { label: "Follow Up Later", dot: "#8b5cf6", isCore: true },
  "Requirement Review": { label: "Requirement Review", dot: "#8b5cf6", isCore: false },
  "Qualified": { label: "Qualified", dot: "#06b6d4", isCore: false },
  "Proposal Sent": { label: "Proposal Sent", dot: "#f59e0b", isCore: false },
  "Negotiation": { label: "Negotiation", dot: "#f97316", isCore: false },
  "Waiting Review": { label: "Waiting Review", dot: "#6366f1", isCore: false },
};

const DEFAULT_FACILITY_TYPES = [
  "Hospital",
  "Clinic",
  "Diagnostic Centre",
  "Pharmacy",
  "Medical Equipment Trader",
  "Government Institution",
  "Laboratory",
  "Day Surgery Centre",
  "Doctor / Practitioner",
];

function getLeadDateStatus(lead: Lead) {
  // Use lead created date as explicitly requested: "date should show when the lead is created not next follow up date"
  const dateStr = (lead.createdAt || lead.updatedAt || lead.nextFollowUp || "2026-09-18").slice(0, 10);
  try {
    const parts = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return { text: `${months[mIdx] || "Sep"} ${day}`, isLate: false, raw: dateStr };
    }
  } catch {
    // fallback
  }
  return { text: dateStr, isLate: false, raw: dateStr };
}

function isSameWeek(targetDateStr: string, refDate: Date = new Date()): boolean {
  if (!targetDateStr) return false;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return false;

  const day = refDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return target >= monday && target <= sunday;
}

function isSameMonth(targetDateStr: string, refDate: Date = new Date()): boolean {
  if (!targetDateStr) return false;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return false;
  return target.getFullYear() === refDate.getFullYear() && target.getMonth() === refDate.getMonth();
}

function getLeadTeamAvatars(lead: Lead) {
  const handler = (lead.assignedTo || "Unassigned").trim();
  const creator = (lead.createdBy || "Hashim").trim();

  const colorMap: Record<string, string> = {
    Fuhad: "#0f172a",
    Hashim: "#004d66",
    Riyas: "#059669",
    Fidha: "#7c3aed",
    "User 1": "#d97706",
  };

  const getBg = (name: string) => {
    for (const [key, color] of Object.entries(colorMap)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return "#004d66";
  };

  const avatars = [
    {
      name: `Handling: ${handler}`,
      initial: handler.charAt(0).toUpperCase(),
      bg: getBg(handler),
      role: "Handler",
    },
  ];

  if (creator && creator.toLowerCase() !== handler.toLowerCase()) {
    avatars.push({
      name: `Created by: ${creator}`,
      initial: creator.charAt(0).toUpperCase(),
      bg: getBg(creator),
      role: "Creator",
    });
  }

  return avatars;
}

const STAGE_COLORS: Record<string, string> = {
  "New Lead": "#0284c7",
  "Contacted": "#3b82f6",
  "Quotation Forwarded": "#f59e0b",
  "Quatation Forwarded": "#f59e0b",
  "Approved": "#10b981",
  "Rejected": "#ef4444",
  "Follow Up Later": "#8b5cf6",
  "Requirement Review": "#8b5cf6",
  "Qualified": "#06b6d4",
  "Proposal Sent": "#f59e0b",
  "Negotiation": "#f97316",
  "Waiting Review": "#6366f1",
  "Won": "#10b981",
  "Lost": "#ef4444",
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "ICU Equipment",
  "OT Equipment",
  "Diagnostic Equipment",
  "Laboratory Equipment",
  "Patient Monitoring",
  "Imaging Equipment",
  "Dental Equipment",
  "Physiotherapy Equipment",
  "Surgical Equipment",
  "Sterilization",
];

const SERVICE_REQUIREMENTS = [
  "Inspection & corrective",
  "Installation",
  "PPM",
  "AMC & CMC",
  "QA QB & calibration",
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filterAssigned, setFilterAssigned] = useState("MY_LEADS");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterRange, setDateFilterRange] = useState<"all" | "week" | "month" | "custom">("all");
  const [mobilePipelineFilters, setMobilePipelineFilters] = useState(false);
  const [mobilePipelineStage, setMobilePipelineStage] = useState("new-lead");
  const [stageViewMode, setStageViewMode] = useState<"all" | "core">("core");

  // Active User / Session info
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email?: string;
    role?: string;
  }>({
    name: "Fuhad",
    email: "fuhad@fastonmed.com",
    role: "Sales Rep",
  });

  // Drag and Drop Kanban state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  // Client Selection & Live Sync with Clients & People Directories
  const [clientRegistry, setClientRegistry] = useState(mockClients);
  const [peopleRegistry, setPeopleRegistry] = useState<ContactPerson[]>([]);
  const [clientFilterType, setClientFilterType] = useState<"ALL" | "ORGANISATIONS" | "PEOPLE">("ALL");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [customClientName, setCustomClientName] = useState("");
  const [leadContactName, setLeadContactName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadContacts, setLeadContacts] = useState<LeadContact[]>([
    { id: "c-1", name: "", role: "Key Contact", phone: "", email: "", isPrimary: true },
  ]);

  const selectedFacilityContacts = useMemo(() => {
    if (!selectedClientId) return [];
    const org = selectedClientId.startsWith("org-")
      ? clientRegistry.find((c) => c.id === selectedClientId.replace("org-", "") || c.id === selectedClientId)
      : clientRegistry.find((c) => c.id === selectedClientId);
    return org?.contacts || [];
  }, [selectedClientId, clientRegistry]);

  const updateContact = (index: number, field: keyof LeadContact, value: string | boolean) => {
    setLeadContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (updated[index]?.isPrimary || index === 0) {
        if (field === "name") setLeadContactName(value as string);
        if (field === "phone") setLeadPhone(value as string);
        if (field === "email") setLeadEmail(value as string);
      }
      return updated;
    });
  };

  const addContact = (defaultData?: Partial<LeadContact>) => {
    setLeadContacts((prev) => {
      // If the list has only 1 completely empty contact, replace it
      if (prev.length === 1 && !prev[0].name.trim() && !prev[0].phone.trim() && !prev[0].email?.trim() && defaultData?.name) {
        const first: LeadContact = {
          id: prev[0].id || `c-${Date.now()}-1`,
          name: defaultData.name || "",
          role: defaultData.role || "Key Contact",
          phone: defaultData.phone || "",
          email: defaultData.email || "",
          isPrimary: true,
        };
        setLeadContactName(first.name);
        setLeadPhone(first.phone);
        setLeadEmail(first.email || "");
        return [first];
      }
      const newContact: LeadContact = {
        id: `c-${Date.now()}-${prev.length + 1}`,
        name: defaultData?.name || "",
        role: defaultData?.role || "",
        phone: defaultData?.phone || "",
        email: defaultData?.email || "",
        isPrimary: prev.length === 0,
      };
      return [...prev, newContact];
    });
  };

  const removeContact = (index: number) => {
    setLeadContacts((prev) => {
      if (prev.length <= 1) {
        const reset: LeadContact[] = [{ id: "c-1", name: "", role: "Key Contact", phone: "", email: "", isPrimary: true }];
        setLeadContactName("");
        setLeadPhone("");
        setLeadEmail("");
        return reset;
      }
      const wasPrimary = prev[index].isPrimary;
      const updated = prev.filter((_, i) => i !== index);
      if (wasPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
        setLeadContactName(updated[0].name || "");
        setLeadPhone(updated[0].phone || "");
        setLeadEmail(updated[0].email || "");
      }
      return updated;
    });
  };

  const setPrimaryContact = (index: number) => {
    setLeadContacts((prev) => {
      const updated = prev.map((c, i) => ({
        ...c,
        isPrimary: i === index,
      }));
      setLeadContactName(updated[index]?.name || "");
      setLeadPhone(updated[index]?.phone || "");
      setLeadEmail(updated[index]?.email || "");
      return updated;
    });
  };

  // Live products loaded from WooCommerce / Website catalog
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Category & Product Connection (from Live Products Catalog)
  const [enquiryType, setEnquiryType] = useState<"Sales" | "Service">("Sales");
  const [selectedCategory, setSelectedCategory] = useState<string>("ICU Equipment");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customProductName, setCustomProductName] = useState<string>("");
  const [serviceRequirementsList, setServiceRequirementsList] = useState<string[]>(SERVICE_REQUIREMENTS);
  const [selectedServiceType, setSelectedServiceType] = useState<string>(SERVICE_REQUIREMENTS[0]);
  const [customServiceName, setCustomServiceName] = useState<string>("");
  const [leadQuantity, setLeadQuantity] = useState<number | "">(1);
  const [leadEstimatedValue, setLeadEstimatedValue] = useState<number | "">(45000);

  // Modal Dropdown controlled states
  const [leadSource, setLeadSource] = useState<LeadSource>("Direct Enquiry");
  const [leadReferredBy, setLeadReferredBy] = useState<string>("");
  const [leadStage, setLeadStage] = useState<PipelineStage>("New Lead");
  const [leadPriority, setLeadPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [leadAssignedTo, setLeadAssignedTo] = useState<string>("Riyas");
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadNotes, setLeadNotes] = useState<string>("");
  const [leadFollowUp, setLeadFollowUp] = useState<string>("");
  const [activeActionLeadId, setActiveActionLeadId] = useState<string | null>(null);

  // Close actions dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside() {
      setActiveActionLeadId(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveActionLeadId(null);
      }
    }
    if (activeActionLeadId) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionLeadId]);

  // Team members list for assignments (everyone, not only sales persons)
  const [employeeList, setEmployeeList] = useState<{ id: string; name: string; role?: string; department?: string }[]>(() => {
    return mockEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      department: e.department,
    }));
  });

  useEffect(() => {
    let isMounted = true;
    fetch("/api/ems/employees")
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setEmployeeList((prev) => {
            const map = new Map<string, { id: string; name: string; role?: string; department?: string }>();
            prev.forEach((e) => map.set(e.name.toLowerCase().trim(), e));
            res.data.forEach((emp: any) => {
              const name = (emp.fullName || `${emp.firstName || ""} ${emp.lastName || ""}`).trim();
              if (name && emp.status !== "TERMINATED") {
                const key = name.toLowerCase().trim();
                if (!map.has(key)) {
                  map.set(key, {
                    id: emp.id,
                    name: name,
                    role: emp.designationTitle || "Team Member",
                    department: emp.departmentName || "General",
                  });
                }
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Quotation Products selection state (Multiple items with individual prices)
  const [quoteProducts, setQuoteProducts] = useState<Array<{ id: string; product: string; price: number }>>([]);

  // Add Product Modal from Lead Creation
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [prodFormName, setProdFormName] = useState("");
  const [prodFormCategory, setProdFormCategory] = useState<string>("ICU Equipment");
  const [prodFormBrand, setProdFormBrand] = useState("");
  const [prodFormModel, setProdFormModel] = useState("");
  const [prodFormPrice, setProdFormPrice] = useState<number | "">("");
  const [prodFormCost, setProdFormCost] = useState<number | "">("");
  const [prodFormTraderId, setProdFormTraderId] = useState("");
  const [prodFormLeadTime, setProdFormLeadTime] = useState("3 - 5 Days");
  const [prodFormWarranty, setProdFormWarranty] = useState("2 Years");
  const [prodFormDescription, setProdFormDescription] = useState("");
  const [targetQuoteProductIdx, setTargetQuoteProductIdx] = useState<number | null>(null);

  const openAddProductModal = (initialName?: string) => {
    setProdFormName(initialName || "");
    setProdFormCategory(selectedCategory || "ICU Equipment");
    setProdFormBrand("");
    setProdFormModel("");
    setProdFormPrice("");
    setProdFormCost("");
    const comps = getStoredCompanies();
    setProdFormTraderId(comps[0]?.id || "");
    setProdFormLeadTime("3 - 5 Days");
    setProdFormWarranty("2 Years");
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
      description: prodFormDescription.trim() || `Medical product added from Lead creation. Supplied by ${selectedComp.name}.`,
    });

    setAvailableProducts((prev) => [newProd, ...prev]);

    // If added from Quotation Forwarded modal's Quoted Products row
    if (targetQuoteProductIdx !== null && targetQuoteProductIdx < quoteProducts.length) {
      const updated = quoteProducts.map((item, i) =>
        i === targetQuoteProductIdx
          ? { ...item, product: newProd.name, price: newProd.sellingPrice || item.price }
          : item
      );
      setQuoteProducts(updated);
      const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
      if (sum > 0) setEnteredQuoteAmount(sum);
      setTargetQuoteProductIdx(null);
    } else if (targetQuoteProductIdx !== null && targetQuoteProductIdx >= quoteProducts.length) {
      const newRow = {
        id: `qp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product: newProd.name,
        price: newProd.sellingPrice || 0,
      };
      const updated = [...quoteProducts, newRow];
      setQuoteProducts(updated);
      const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
      if (sum > 0) setEnteredQuoteAmount(sum);
      setTargetQuoteProductIdx(null);
    } else {
      setSelectedCategory(newProd.category);
      setSelectedProductId(newProd.id);
      setCustomProductName(newProd.name);
      if (newProd.sellingPrice > 0) {
        const q = typeof leadQuantity === "number" && leadQuantity > 0 ? leadQuantity : 1;
        setLeadEstimatedValue(newProd.sellingPrice * q);
      }
    }

    toast.success(`Product "${newProd.name}" added to catalog and selected!`);
    setShowAddProductModal(false);
  };

  // Add Organisation Modal State & Handlers
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [orgFormName, setOrgFormName] = useState("");
  const [orgFormType, setOrgFormType] = useState<string>("Hospital");
  const [facilityTypes, setFacilityTypes] = useState<string[]>(DEFAULT_FACILITY_TYPES);
  const [isAddingFacilityType, setIsAddingFacilityType] = useState(false);
  const [newFacilityTypeName, setNewFacilityTypeName] = useState("");
  const [orgFormState, setOrgFormState] = useState("Dubai");
  const [orgFormCity, setOrgFormCity] = useState("");
  const [orgFormAddress, setOrgFormAddress] = useState("");
  const [orgFormContactName, setOrgFormContactName] = useState("");
  const [orgFormContactRole, setOrgFormContactRole] = useState("Procurement Lead");
  const [orgFormPhone, setOrgFormPhone] = useState("");
  const [orgFormEmail, setOrgFormEmail] = useState("");
  const [orgFormGst, setOrgFormGst] = useState("");
  const [orgFormNotes, setOrgFormNotes] = useState("");

  const handleCreateFacilityType = (customName?: string) => {
    const trimmed = (customName !== undefined ? customName : newFacilityTypeName).trim();
    if (!trimmed) {
      toast.error("Please enter a facility type");
      return;
    }
    if (!facilityTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setFacilityTypes((prev) => [...prev, trimmed]);
    }
    setOrgFormType(trimmed);
    setIsAddingFacilityType(false);
    setNewFacilityTypeName("");
    toast.success(`"${trimmed}" added as facility type!`);
  };

  const openAddOrgModal = () => {
    setOrgFormName("");
    setOrgFormType("Hospital");
    setIsAddingFacilityType(false);
    setNewFacilityTypeName("");
    setOrgFormState("Dubai");
    setOrgFormCity("");
    setOrgFormAddress("");
    setOrgFormContactName(leadContactName || "");
    setOrgFormContactRole("Procurement Lead");
    setOrgFormPhone(leadPhone || "");
    setOrgFormEmail(leadEmail || "");
    setOrgFormGst("");
    setOrgFormNotes("");
    setShowAddOrgModal(true);
  };

  const handleSaveNewOrganisation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgFormName.trim()) {
      toast.error("Please enter healthcare facility / organisation name");
      return;
    }

    const newClientId = `c-${Date.now()}`;
    const primaryPhone = orgFormPhone.trim();
    const primaryEmail = orgFormEmail.trim();

    const newClient: Client = {
      id: newClientId,
      name: orgFormName.trim(),
      orgType: (orgFormType || "Hospital") as OrgType,
      status: "Lead",
      operationalStatus: "Running",
      state: orgFormState || "Dubai",
      city: orgFormCity.trim() || orgFormState || "Dubai",
      address: orgFormAddress.trim() || `${orgFormCity || ""}, ${orgFormState || "Dubai"}`,
      pincode: "00000",
      phone: primaryPhone,
      phones: primaryPhone ? [primaryPhone] : [],
      email: primaryEmail,
      emails: primaryEmail ? [primaryEmail] : [],
      gst: orgFormGst.trim(),
      vatNumber: orgFormGst.trim(),
      source: leadSource || "Direct Enquiry",
      connectedAs: [],
      assignedTo: leadAssignedTo || "Riyas",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: currentUser.name || "User not recorded",
      createdById: (currentUser as { id?: string }).id,
      totalRevenue: 0,
      contacts: orgFormContactName.trim()
        ? [
            {
              id: `ct-${Date.now()}`,
              clientId: newClientId,
              name: orgFormContactName.trim(),
              designation: orgFormContactRole.trim() || "Procurement Lead / Key Contact",
              department: "Purchase",
              phone: primaryPhone,
              whatsapp: primaryPhone,
              email: primaryEmail,
              lastContacted: new Date().toISOString().slice(0, 10),
              createdAt: new Date().toISOString(),
              createdBy: currentUser.name || "User not recorded",
              createdById: (currentUser as { id?: string }).id,
            },
          ]
        : [],
      purchases: [],
      requirements: [],
      tags: [orgFormType, orgFormState || "Dubai"],
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${orgFormName.trim()} ${orgFormCity.trim()} ${orgFormState || "Dubai"} UAE`
      )}`,
      place: orgFormCity.trim() || orgFormState || "Dubai",
      emirate: orgFormState || "Dubai",
      notes: orgFormNotes.trim(),
    };

    const currentClients = getStoredClients();
    const updated = [newClient, ...currentClients.filter((c) => c.id !== newClientId)];
    saveStoredClients(updated);
    setClientRegistry(updated);

    try {
      fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      }).catch(() => {});
    } catch (err) {}

    // Auto-select in the Lead modal
    setSelectedClientId(newClientId);
    setCustomClientName(newClient.name);
    if (orgFormContactName.trim()) setLeadContactName(orgFormContactName.trim());
    if (primaryPhone) setLeadPhone(primaryPhone);
    if (primaryEmail) setLeadEmail(primaryEmail);

    toast.success(`Organisation "${newClient.name}" added and selected!`);
    setShowAddOrgModal(false);
  };

  // Add Person Modal State & Handlers
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [personFormName, setPersonFormName] = useState("");
  const [personFormRole, setPersonFormRole] = useState("Doctor / Medical Specialist");
  const [personFormDept, setPersonFormDept] = useState("Doctor");
  const [personFormPhone, setPersonFormPhone] = useState("");
  const [personFormEmail, setPersonFormEmail] = useState("");
  const [personFormClientId, setPersonFormClientId] = useState("");
  const [personFormNotes, setPersonFormNotes] = useState("");

  const openAddPersonModal = () => {
    setPersonFormName("");
    setPersonFormRole("Doctor / Medical Specialist");
    setPersonFormDept("Doctor");
    setPersonFormPhone(leadPhone || "");
    setPersonFormEmail(leadEmail || "");
    setPersonFormClientId("");
    setPersonFormNotes("");
    setShowAddPersonModal(true);
  };

  const handleSaveNewPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personFormName.trim()) {
      toast.error("Please enter doctor / contact person name");
      return;
    }

    const targetClient = personFormClientId ? clientRegistry.find((c) => c.id === personFormClientId) : null;
    const newPerson = addStandalonePerson({
      name: personFormName.trim(),
      designation: personFormRole.trim() || "Doctor / Key Contact",
      department: (personFormDept || "Doctor") as any,
      phone: personFormPhone.trim(),
      whatsapp: personFormPhone.trim(),
      email: personFormEmail.trim(),
      clientId: personFormClientId || undefined,
      clientName: targetClient ? targetClient.name : "Independent Healthcare Practitioner",
      notes: personFormNotes.trim(),
    });

    const updatedPeople = getStoredPeople();
    setPeopleRegistry(updatedPeople);

    // Auto-select in Lead modal
    setSelectedClientId(`person-${newPerson.id}`);
    setCustomClientName(newPerson.name);
    setLeadContactName(newPerson.name);
    if (newPerson.phone) setLeadPhone(newPerson.phone);
    if (newPerson.email) setLeadEmail(newPerson.email);

    toast.success(`Person "${newPerson.name}" registered and selected!`);
    setShowAddPersonModal(false);
  };

  const activeProductList = useMemo(() => {
    return availableProducts.length > 0 ? availableProducts : mockProducts;
  }, [availableProducts]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    PRODUCT_CATEGORIES.forEach((c) => cats.add(c));
    activeProductList.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [activeProductList]);

  // Comments state for selected lead
  const [newCommentText, setNewCommentText] = useState("");

  // Persistent leads and clients synchronization
  useEffect(() => {
    clearDummyLeads();
    const loaded = getStoredLeads().filter((l) => !isDummyLead(l));
    setLeads(loaded);
    setClientRegistry(getStoredClients());
    setPeopleRegistry(getStoredPeople());

    const loadProducts = async () => {
      try {
        const prods = await getCatalogProducts().catch(() => getStoredProducts());
        if (prods && prods.length > 0) {
          setAvailableProducts(prods);
        } else {
          setAvailableProducts(getStoredProducts());
        }
      } catch {
        setAvailableProducts(getStoredProducts());
      }
    };
    void loadProducts();
    void fetchStoredProductsFromServer().then((fresh) => {
      if (fresh && fresh.length > 0) setAvailableProducts(fresh);
    });

    const handleSyncLeads = () => {
      const syncd = getStoredLeads().filter((l) => !isDummyLead(l));
      setLeads(syncd);
    };
    const handleSyncClients = () => setClientRegistry(getStoredClients());
    const handleSyncPeople = () => setPeopleRegistry(getStoredPeople());
    const handleSyncProducts = () => void loadProducts();

    const loadCurrentUser = () => {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("fastonmed_user") : null;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed.name) {
            setCurrentUser({
              name: parsed.name,
              email: parsed.email || `${parsed.name.toLowerCase()}@fastonmed.com`,
              role: parsed.role || "Sales Rep",
            });
          }
        } catch {}
      }
      // Re-sync leads when active user profile switches
      void syncLeadsFromServer().then((syncd) => {
        if (syncd && syncd.length > 0) {
          setLeads(syncd.filter((l) => !isDummyLead(l)));
        }
      });
    };
    loadCurrentUser();

    // Auto-polling every 8 seconds to synchronize changes across all active accounts
    const pollInterval = setInterval(() => {
      void syncLeadsFromServer();
    }, 8000);

    const handleWindowFocus = () => {
      void syncLeadsFromServer();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("fastonmed_leads_updated", handleSyncLeads);
    window.addEventListener("fastonmed_quotes_updated", handleSyncLeads);
    window.addEventListener("fastonmed_clients_updated", handleSyncClients);
    window.addEventListener("fastonmed_people_updated", handleSyncPeople);
    window.addEventListener("fastonmed_products_updated", handleSyncProducts);
    window.addEventListener("fastonmed_user_updated", loadCurrentUser);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("fastonmed_leads_updated", handleSyncLeads);
      window.removeEventListener("fastonmed_quotes_updated", handleSyncLeads);
      window.removeEventListener("fastonmed_clients_updated", handleSyncClients);
      window.removeEventListener("fastonmed_people_updated", handleSyncPeople);
      window.removeEventListener("fastonmed_products_updated", handleSyncProducts);
      window.removeEventListener("fastonmed_user_updated", loadCurrentUser);
    };
  }, []);

  const handleOpenAddModal = () => {
    setEditingLeadId(null);
    setSelectedClientId("");
    setCustomClientName("");
    setLeadContactName("");
    setLeadPhone("");
    setLeadEmail("");
    setLeadContacts([{ id: "c-1", name: "", role: "Key Contact", phone: "", email: "", isPrimary: true }]);
    setLeadSource("Direct Enquiry");
    setLeadReferredBy("");
    setLeadStage("New Lead");
    setLeadPriority("Medium");
    const defaultRep = employeeList.find((e) => e.name === "Riyas")?.name || employeeList[0]?.name || "Riyas";
    setLeadAssignedTo(defaultRep);
    setLeadNotes("");
    setLeadFollowUp(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

    // Initialize Category and connected Product
    setEnquiryType("Sales");
    const initCat = availableCategories[0] || "ICU Equipment";
    setSelectedCategory(initCat);
    setSelectedServiceType(SERVICE_REQUIREMENTS[0]);
    setCustomServiceName("");
    const matched = activeProductList.filter((p) => p.category === initCat);
    if (matched.length > 0) {
      setSelectedProductId(matched[0].id);
      setCustomProductName(matched[0].name);
      setLeadQuantity(1);
      setLeadEstimatedValue(matched[0].sellingPrice || 45000);
    } else {
      setSelectedProductId("CUSTOM");
      setCustomProductName("");
      setLeadQuantity(1);
      setLeadEstimatedValue("");
    }
    setShowAddModal(true);
  };

  // The app home shortcut opens the existing lead form; it does not create a record.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "1") {
      handleOpenAddModal();
    }
    // This is a one-time navigation action, independent of subsequent form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenEditLead = (lead: Lead) => {
    setEditingLeadId(lead.id);

    // 1. Client & Contact Person
    const existingClient = clientRegistry.find(
      (c) => c.id === lead.clientId || c.name.toLowerCase() === (lead.clientName || "").toLowerCase()
    );
    const existingPerson = !existingClient
      ? peopleRegistry.find(
          (p) => p.id === lead.clientId || p.name.toLowerCase() === (lead.clientName || "").toLowerCase()
        )
      : null;

    if (existingClient) {
      setSelectedClientId(`org-${existingClient.id}`);
      setCustomClientName(existingClient.name);
    } else if (existingPerson) {
      setSelectedClientId(`person-${existingPerson.id}`);
      setCustomClientName(existingPerson.name);
    } else {
      setSelectedClientId(lead.clientName ? "CUSTOM" : "");
      setCustomClientName(lead.clientName || "");
    }

    if (lead.contacts && lead.contacts.length > 0) {
      setLeadContacts(lead.contacts);
      const primary = lead.contacts.find((c) => c.isPrimary) || lead.contacts[0];
      setLeadContactName(primary?.name || lead.contactName || "");
      setLeadPhone(primary?.phone || lead.phone || "");
      setLeadEmail(primary?.email || lead.email || "");
    } else {
      setLeadContacts([
        {
          id: "c-1",
          name: lead.contactName || "",
          role: "Key Contact",
          phone: lead.phone || "",
          email: lead.email || "",
          isPrimary: true,
        },
      ]);
      setLeadContactName(lead.contactName || "");
      setLeadPhone(lead.phone || "");
      setLeadEmail(lead.email || "");
    }

    // 2. Source & Referral
    setLeadSource((lead.source as LeadSource) || "Direct Enquiry");
    setLeadReferredBy(lead.referredBy || "");

    // 3. Stage & Priority & Assigned
    setLeadStage(lead.stage || "New Lead");
    setLeadPriority((lead.priority as any) || "Medium");
    setLeadAssignedTo(lead.assignedTo || "Riyas");

    // 4. Notes & Follow-up
    setLeadNotes(lead.notes || "");
    setLeadFollowUp(lead.nextFollowUp || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

    // 5. Enquiry Type & Product/Service
    const isService = lead.enquiryType === "Service";
    setEnquiryType(isService ? "Service" : "Sales");

    if (isService) {
      setSelectedServiceType(lead.serviceType || lead.product || SERVICE_REQUIREMENTS[0]);
      setCustomServiceName(lead.product || "");
      setLeadQuantity(lead.quantity || 1);
      setLeadEstimatedValue(typeof lead.estimatedValue === "number" && lead.estimatedValue > 0 ? lead.estimatedValue : "");
    } else {
      const cat = lead.category || "";
      setSelectedCategory(cat);
      const matchedProd = activeProductList.find(
        (p) => p.name.toLowerCase() === (lead.product || "").toLowerCase() || p.id === lead.product
      );
      if (matchedProd) {
        setSelectedProductId(matchedProd.id);
        setCustomProductName(matchedProd.name);
      } else if (lead.product) {
        setSelectedProductId("CUSTOM");
        setCustomProductName(lead.product);
      } else {
        setSelectedProductId("");
        setCustomProductName("");
      }
      setLeadQuantity(lead.quantity || 1);
      setLeadEstimatedValue(typeof lead.estimatedValue === "number" && lead.estimatedValue > 0 ? lead.estimatedValue : "");
    }

    setShowAddModal(true);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (!cat) {
      return;
    }
    // If currently selected product does not belong to this new category, reset product
    if (selectedProductId && selectedProductId !== "CUSTOM") {
      const prod = activeProductList.find((p) => p.id === selectedProductId);
      if (prod && prod.category !== cat) {
        setSelectedProductId("");
        setCustomProductName("");
      }
    }
  };

  const handleProductSelectChange = (pId: string) => {
    setSelectedProductId(pId);
    if (!pId) {
      setCustomProductName("");
      return;
    }
    if (pId === "CUSTOM") {
      // User chooses to enter custom equipment specification
      if (leadEstimatedValue === 0 || leadEstimatedValue === 45000) {
        setLeadEstimatedValue("");
      }
    } else {
      const prod = activeProductList.find((item) => item.id === pId);
      if (prod) {
        setCustomProductName(prod.name);
        const q = typeof leadQuantity === "number" && leadQuantity > 0 ? leadQuantity : 1;
        setLeadEstimatedValue((prod.sellingPrice || 0) * q);
        // Automatically sync category to match the selected product!
        if (prod.category) {
          setSelectedCategory(prod.category);
        }
      }
    }
  };

  const handleQuantityChange = (val: string | number) => {
    if (val === "" || val === null || val === undefined) {
      setLeadQuantity("");
      return;
    }
    const num = parseInt(String(val), 10);
    if (isNaN(num)) {
      setLeadQuantity("");
      return;
    }
    setLeadQuantity(num);
    if (selectedProductId && selectedProductId !== "CUSTOM") {
      const prod = activeProductList.find((item) => item.id === selectedProductId);
      if (prod && typeof prod.sellingPrice === "number") {
        setLeadEstimatedValue((prod.sellingPrice || 45000) * Math.max(1, num));
      }
    }
  };
  const handleClientSelectChange = (val: string) => {
    if (val === "NEW" || val === "NEW_ORG") {
      openAddOrgModal();
      return;
    }
    if (val === "NEW_PERSON") {
      openAddPersonModal();
      return;
    }
    setSelectedClientId(val);
    if (!val) {
      setCustomClientName("");
      setLeadContactName("");
      setLeadPhone("");
      setLeadEmail("");
      setLeadContacts([{ id: "c-1", name: "", role: "Key Contact", phone: "", email: "", isPrimary: true }]);
      return;
    }

    if (val === "CUSTOM") {
      return;
    }

    if (val.startsWith("person-")) {
      const pId = val.replace("person-", "");
      const foundPerson = peopleRegistry.find((p) => p.id === pId || p.id === val);
      if (foundPerson) {
        setCustomClientName(foundPerson.name);
        setLeadContactName(foundPerson.name);
        setLeadPhone(foundPerson.phone || foundPerson.whatsapp || "");
        setLeadEmail(foundPerson.email || "");
        setLeadContacts([
          {
            id: foundPerson.id,
            name: foundPerson.name,
            role: foundPerson.designation || "Doctor / Healthcare Contact",
            phone: foundPerson.phone || foundPerson.whatsapp || "",
            email: foundPerson.email || "",
            isPrimary: true,
          },
        ]);
        return;
      }
    }

    const cId = val.startsWith("org-") ? val.replace("org-", "") : val;
    const foundClient = clientRegistry.find((c) => c.id === cId || c.id === val);
    if (foundClient) {
      setCustomClientName(foundClient.name);
      const contacts = foundClient.contacts && foundClient.contacts.length > 0 ? foundClient.contacts : [];
      if (contacts.length > 0) {
        const mapped: LeadContact[] = contacts.map((c, i) => ({
          id: c.id || `c-${i + 1}`,
          name: c.name,
          role: c.designation || c.department || "Key Contact",
          phone: c.phone || c.whatsapp || foundClient.phone || "",
          email: c.email || foundClient.email || "",
          isPrimary: i === 0,
        }));
        setLeadContacts(mapped);
        setLeadContactName(mapped[0]?.name || "");
        setLeadPhone(mapped[0]?.phone || "");
        setLeadEmail(mapped[0]?.email || "");
      } else {
        setLeadContacts([
          { id: "c-1", name: "", role: "Key Contact", phone: foundClient.phone || "", email: foundClient.email || "", isPrimary: true },
        ]);
        setLeadContactName("");
        setLeadPhone(foundClient.phone || "");
        setLeadEmail(foundClient.email || "");
      }
      return;
    }

    const foundPerson = peopleRegistry.find((p) => p.id === val);
    if (foundPerson) {
      setCustomClientName(foundPerson.name);
      setLeadContactName(foundPerson.name);
      setLeadPhone(foundPerson.phone || foundPerson.whatsapp || "");
      setLeadEmail(foundPerson.email || "");
      setLeadContacts([
        {
          id: foundPerson.id,
          name: foundPerson.name,
          role: foundPerson.designation || "Doctor / Healthcare Contact",
          phone: foundPerson.phone || foundPerson.whatsapp || "",
          email: foundPerson.email || "",
          isPrimary: true,
        },
      ]);
      return;
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!l || isDummyLead(l)) return false;
    // 1. Sales Rep filter: Both Creator (who created) & Handler (who is assigned) are responsible!
    let matchAssigned: boolean = true;
    if (filterAssigned !== "All") {
      const target = (filterAssigned === "MY_LEADS" || filterAssigned === "My Deals")
        ? (currentUser.name || "Fuhad").trim().toLowerCase()
        : filterAssigned.trim().toLowerCase();
      const targetFirst = target.split(" ")[0];

      const assigned = (l.assignedTo || "").trim().toLowerCase();
      const assignedId = (l.assignedToId || "").trim().toLowerCase();
      const created = (l.createdBy || "").trim().toLowerCase();
      const createdId = (l.createdById || "").trim().toLowerCase();

      const isAssigned = Boolean(
        assigned === target ||
        (targetFirst && assigned.includes(targetFirst)) ||
        (targetFirst && targetFirst.includes(assigned)) ||
        assignedId === `emp-${targetFirst}` ||
        assignedId === `u-${targetFirst}` ||
        assignedId.includes(targetFirst) ||
        (l.assignedTo && l.assignedTo.toLowerCase() === target)
      );

      const isCreated = Boolean(
        created === target ||
        (targetFirst && created.includes(targetFirst)) ||
        (targetFirst && targetFirst.includes(created)) ||
        createdId === `emp-${targetFirst}` ||
        createdId === `u-${targetFirst}` ||
        createdId.includes(targetFirst) ||
        (l.createdBy && l.createdBy.toLowerCase() === target)
      );

      matchAssigned = isAssigned || isCreated;
    }
    const matchPriority = filterPriority === "All" || l.priority === filterPriority;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      l.clientName.toLowerCase().includes(q) ||
      l.product.toLowerCase().includes(q) ||
      (l.contactName && l.contactName.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q)) ||
      (l.assignedTo && l.assignedTo.toLowerCase().includes(q)) ||
      (l.createdBy && l.createdBy.toLowerCase().includes(q));

    const leadCreatedDate = (l.createdAt || l.updatedAt || l.nextFollowUp || "").slice(0, 10);
    let matchDate = true;
    if (dateFilterRange === "week") {
      matchDate = isSameWeek(leadCreatedDate);
    } else if (dateFilterRange === "month") {
      matchDate = isSameMonth(leadCreatedDate);
    } else if (dateFilterRange === "custom" && filterDate) {
      matchDate = leadCreatedDate === filterDate;
    }
    return matchAssigned && matchPriority && matchSearch && matchDate;
  });

  const salesRepOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: "All", label: "All Sales Reps" },
      { value: "MY_LEADS", label: `My Deals (${currentUser?.name || "Myself"})` },
    ];
    const seen = new Set<string>();
    seen.add("all");
    seen.add("my_leads");
    const currentNameKey = (currentUser?.name || "").toLowerCase().trim();
    if (currentNameKey) {
      seen.add(currentNameKey);
    }

    employeeList.forEach((emp) => {
      const key = emp.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          value: emp.name,
          label: emp.name,
        });
      }
    });

    // Also include any assignedTo or createdBy names from leads that aren't yet in employeeList
    leads.forEach((l) => {
      [l.assignedTo, l.createdBy].forEach((name) => {
        if (!name) return;
        const key = name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            value: name,
            label: name,
          });
        }
      });
    });

    return list;
  }, [employeeList, currentUser?.name, leads]);

  const priorityOptions = useMemo(
    () => [
      { value: "All", label: "All Priorities" },
      { value: "Critical", label: "Critical" },
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" },
    ],
    []
  );

  // Quotation Number Popup modal state for "Quotation Forwarded"
  const [showQuotePopup, setShowQuotePopup] = useState(false);
  const [quotePromptLead, setQuotePromptLead] = useState<Lead | null>(null);
  const [enteredQuoteNumber, setEnteredQuoteNumber] = useState("");
  const [enteredQuoteAmount, setEnteredQuoteAmount] = useState<number>(0);

  // Modern confirmation modal state for deleting leads
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const moveStage = (leadId: string, newStage: PipelineStage) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    if (newStage === "Quotation Forwarded") {
      setQuotePromptLead(targetLead);
      setEnteredQuoteNumber(targetLead.quotationNumber || "");
      const initAmount = targetLead.quotationValue || targetLead.estimatedValue || 0;
      setEnteredQuoteAmount(initAmount);
      if (targetLead.quotedItems && targetLead.quotedItems.length > 0) {
        setQuoteProducts(
          targetLead.quotedItems.map((it, idx) => ({
            id: `qp-init-${idx}-${Date.now()}`,
            product: it.product,
            price: it.price,
          }))
        );
      } else if (targetLead.product) {
        setQuoteProducts([
          {
            id: `qp-init-1-${Date.now()}`,
            product: targetLead.product,
            price: initAmount,
          },
        ]);
      } else {
        setQuoteProducts([]);
      }
      setShowQuotePopup(true);
      return;
    }

    applyStageChange(leadId, newStage);
  };

  const applyStageChange = (
    leadId: string,
    newStage: PipelineStage,
    quoteNumber?: string,
    quoteAmount?: number,
    quotedProductsList?: Array<{ product: string; price: number }>
  ) => {
    const updated = leads.map((l) => {
      if (l.id !== leadId) return l;
      const updatedLead: Lead = {
        ...l,
        stage: newStage,
        updatedAt: new Date().toISOString().split("T")[0],
        ...(quoteNumber ? { quotationNumber: quoteNumber } : {}),
        ...(quoteAmount !== undefined ? { quotationValue: quoteAmount, estimatedValue: quoteAmount } : {}),
        ...(quotedProductsList && quotedProductsList.length > 0
          ? {
              quotedItems: quotedProductsList,
              product: quotedProductsList.map((p) => p.product).filter(Boolean).join(", ") || l.product,
            }
          : {}),
      };

      if (quoteNumber) {
        const quoteComment: LeadComment = {
          id: `comm-quote-${Date.now()}`,
          author: "System (Quotation)",
          text: `📄 Quotation Number recorded: ${quoteNumber}${quoteAmount ? ` (AED ${quoteAmount.toLocaleString()})` : ""}. Lead stage updated to Quotation Forwarded.`,
          createdAt: new Date().toLocaleString("en-AE", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        };
        updatedLead.comments = [quoteComment, ...(updatedLead.comments || [])];
      }

      return updatedLead;
    });

    setLeads(updated);
    saveStoredLeads(updated);

    if (quoteNumber) {
      const target = updated.find((l) => l.id === leadId);
      if (target) {
        syncLeadToQuotations(target, quoteNumber, quoteAmount);
      }
    }

    if (selectedLead && selectedLead.id === leadId) {
      const current = updated.find((l) => l.id === leadId);
      if (current) setSelectedLead(current);
    }

    toast.success(`Lead moved to "${newStage}"${quoteNumber ? ` (${quoteNumber})` : ""}`);
  };

  const handleAddComment = (leadId: string) => {
    if (!newCommentText.trim() || !selectedLead) return;
    const authorName = "Mohammed (Sales)";
    const newComment: LeadComment = {
      id: `comm-${Date.now()}`,
      author: authorName,
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleString("en-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };

    const updatedLead: Lead = {
      ...selectedLead,
      comments: [newComment, ...(selectedLead.comments || [])],
      updatedAt: new Date().toISOString().split("T")[0],
    };

    const updatedLeads = leads.map((l) => (l.id === leadId ? updatedLead : l));
    setLeads(updatedLeads);
    saveStoredLeads(updatedLeads);
    setSelectedLead(updatedLead);
    setNewCommentText("");
    toast.success("Comment added successfully!");
  };

  const priorityDot: Record<string, string> = {
    Low: "#10b981",
    Medium: "#f59e0b",
    High: "#f97316",
    Critical: "#ef4444",
  };

  const coreStagesList: { id: string; targetStage: PipelineStage; label: string; dot: string; matches: (stage: PipelineStage) => boolean }[] = [
    { id: "new-lead", targetStage: "New Lead", label: "New Lead", dot: "#0284c7", matches: (s) => s === "New Lead" },
    { id: "contacted", targetStage: "Contacted", label: "Contacted", dot: "#3b82f6", matches: (s) => s === "Contacted" },
    {
      id: "quotation-forwarded",
      targetStage: "Quotation Forwarded",
      label: "Quotation Forwarded",
      dot: "#f59e0b",
      matches: (s) =>
        s === "Quotation Forwarded" ||
        (s as string) === "Quatation Forwarded" ||
        s === "Proposal Sent" ||
        s === "Requirement Review" ||
        s === "Qualified" ||
        s === "Negotiation" ||
        (s as string) === "Quotation Sent",
    },
    {
      id: "approved",
      targetStage: "Approved",
      label: "Approved",
      dot: "#10b981",
      matches: (s) =>
        s === "Approved" ||
        s === "Won" ||
        (s as string) === "Closed Won" ||
        (s as string) === "PO Received" ||
        (s as string) === "Completed",
    },
    {
      id: "rejected",
      targetStage: "Rejected",
      label: "Rejected",
      dot: "#ef4444",
      matches: (s) =>
        s === "Rejected" ||
        s === "Lost" ||
        (s as string) === "Closed Lost" ||
        (s as string) === "Lost Deal",
    },
    {
      id: "follow-up-later",
      targetStage: "Follow Up Later",
      label: "Follow Up Later",
      dot: "#8b5cf6",
      matches: (s) =>
        s === "Follow Up Later" ||
        s === "Waiting Review" ||
        (s as string) === "Follow Up",
    },
  ];

  return (
    <div className={`mobile-pipeline-page ${mobilePipelineFilters ? "pipeline-filters-open" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.3s ease" }}>
      {/* Top Header - Compact & Space-Efficient */}
      <div className="pipeline-page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#002735", margin: 0, letterSpacing: "-0.01em" }}>
            Leads & Pipeline
          </h1>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Manage task stages dynamically by dragging and dropping cards
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: "#f1f5f9",
              padding: 3,
              borderRadius: 9,
              border: "1px solid #e2e8f0",
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setDateFilterRange("all");
                setFilterDate("");
              }}
              style={{
                border: "none",
                background: dateFilterRange === "all" ? "#ffffff" : "transparent",
                color: dateFilterRange === "all" ? "#004d66" : "#64748b",
                fontWeight: dateFilterRange === "all" ? 700 : 500,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: dateFilterRange === "all" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilterRange("week");
                setFilterDate("");
              }}
              style={{
                border: "none",
                background: dateFilterRange === "week" ? "#ffffff" : "transparent",
                color: dateFilterRange === "week" ? "#004d66" : "#64748b",
                fontWeight: dateFilterRange === "week" ? 700 : 500,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: dateFilterRange === "week" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilterRange("month");
                setFilterDate("");
              }}
              style={{
                border: "none",
                background: dateFilterRange === "month" ? "#ffffff" : "transparent",
                color: dateFilterRange === "month" ? "#004d66" : "#64748b",
                fontWeight: dateFilterRange === "month" ? 700 : 500,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: dateFilterRange === "month" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Monthly
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: "#cbd5e1", margin: "0 2px" }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Calendar size={13} style={{ position: "absolute", left: 8, color: dateFilterRange === "custom" ? "#004d66" : "#94a3b8", pointerEvents: "none" }} />
              <input
                type="date"
                aria-label="Pick custom date"
                title="Filter by specific creation date"
                value={filterDate}
                onChange={(event) => {
                  setFilterDate(event.target.value);
                  setDateFilterRange(event.target.value ? "custom" : "all");
                }}
                style={{
                  background: dateFilterRange === "custom" ? "#ffffff" : "transparent",
                  border: dateFilterRange === "custom" ? "1px solid #004d66" : "1px solid transparent",
                  borderRadius: 7,
                  padding: "0 8px 0 26px",
                  height: 26,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: dateFilterRange === "custom" ? "#004d66" : "#64748b",
                  colorScheme: "light",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>
            {dateFilterRange !== "all" && (
              <button
                type="button"
                title="Reset date filter"
                onClick={() => {
                  setDateFilterRange("all");
                  setFilterDate("");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "2px 5px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div
        className="card mobile-pipeline-controls"
        style={{
          padding: "10px 14px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200, maxWidth: 340 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals, hospitals, equipment..."
            style={{
              height: 36,
              paddingLeft: 34,
              paddingRight: searchQuery ? 28 : 12,
              fontSize: 12.5,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              width: "100%",
              boxSizing: "border-box",
              outline: "none",
              transition: "all 0.15s ease",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button type="button" className="pipeline-mobile-filter-button" aria-expanded={mobilePipelineFilters} onClick={() => setMobilePipelineFilters(value => !value)}>{mobilePipelineFilters ? "Close filters" : "Filters"}</button>
        {/* Real Sales Rep Filter */}
        <div style={{ minWidth: 175, maxWidth: 220 }}>
          <CustomLightSelect
            value={filterAssigned}
            options={salesRepOptions}
            onChange={(val) => setFilterAssigned(val || "MY_LEADS")}
            placeholder={`My Deals (${currentUser?.name || "Myself"})`}
            clearable={false}
            buttonStyle={{ height: 36, fontSize: 12.5, borderRadius: 8 }}
          />
        </div>

        {/* Priority Filter */}
        <div style={{ minWidth: 145, maxWidth: 165 }}>
          <CustomLightSelect
            value={filterPriority}
            options={priorityOptions}
            onChange={(val) => setFilterPriority(val || "All")}
            placeholder="All Priorities"
            clearable={false}
            buttonStyle={{ height: 36, fontSize: 12.5, borderRadius: 8 }}
          />
        </div>

        {/* Core 6 Stages vs All toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "#f1f5f9",
            padding: 3,
            borderRadius: 8,
            height: 36,
            boxSizing: "border-box",
            gap: 2,
          }}
        >
          <button
            type="button"
            style={{
              height: 30,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: stageViewMode === "core" ? 700 : 500,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              backgroundColor: stageViewMode === "core" ? "#ffffff" : "transparent",
              color: stageViewMode === "core" ? "#004d66" : "#64748b",
              boxShadow: stageViewMode === "core" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            onClick={() => setStageViewMode("core")}
          >
            Core 6 Stages
          </button>
          <button
            type="button"
            style={{
              height: 30,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: stageViewMode === "all" ? 700 : 500,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              backgroundColor: stageViewMode === "all" ? "#ffffff" : "transparent",
              color: stageViewMode === "all" ? "#004d66" : "#64748b",
              boxShadow: stageViewMode === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            onClick={() => setStageViewMode("all")}
          >
            All Stages ({STAGES.length})
          </button>
        </div>

        {/* Right action buttons */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#f1f5f9",
              padding: 3,
              borderRadius: 8,
              height: 36,
              boxSizing: "border-box",
              gap: 2,
            }}
          >
            <button
              type="button"
              style={{
                height: 30,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: view === "kanban" ? 700 : 500,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: view === "kanban" ? "#004d66" : "transparent",
                color: view === "kanban" ? "#ffffff" : "#64748b",
                boxShadow: view === "kanban" ? "0 1px 3px rgba(0,77,102,0.25)" : "none",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid size={13} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              style={{
                height: 30,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: view === "list" ? 700 : 500,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: view === "list" ? "#004d66" : "transparent",
                color: view === "list" ? "#ffffff" : "#64748b",
                boxShadow: view === "list" ? "0 1px 3px rgba(0,77,102,0.25)" : "none",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onClick={() => setView("list")}
            >
              <List size={13} />
              <span>List</span>
            </button>
          </div>

          <button
            className="btn btn-primary"
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(0,77,102,0.2)",
              whiteSpace: "nowrap",
            }}
            onClick={handleOpenAddModal}
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Lead
          </button>
        </div>
      </div>

      {view === "kanban" && <div className="mobile-pipeline-tabs" aria-label="Pipeline stages">
        {(stageViewMode === "core" ? coreStagesList : STAGES.map(stage => ({id:stage,label:STAGE_CONFIGS[stage]?.label || stage,matches:(value:PipelineStage) => value === stage}))).map(stage => <button key={stage.id} type="button" aria-pressed={mobilePipelineStage === stage.id} onClick={() => setMobilePipelineStage(stage.id)}>{stage.label}<span>{filteredLeads.filter(lead => stage.matches(lead.stage)).length}</span></button>)}
      </div>}
      {/* Kanban View matching Screenshot 2 */}
      {view === "kanban" && (
        <div className="mobile-pipeline-board"
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            paddingBottom: 16,
            alignItems: "flex-start",
          }}
        >
          {(stageViewMode === "core" ? coreStagesList : STAGES.map((s) => ({
            id: s,
            targetStage: s,
            label: STAGE_CONFIGS[s]?.label || s,
            dot: STAGE_CONFIGS[s]?.dot || "#3b82f6",
            matches: (st: PipelineStage) => st === s,
          }))).map((col) => {
            const stageLeads = filteredLeads.filter((l) => col.matches(l.stage));
            const isOver = dragOverStage === col.targetStage;

            return (
              <div
                key={col.id}
                className={`kanban-column ${mobilePipelineStage === col.id || (!(stageViewMode === "core" ? coreStagesList.map(stage => stage.id) : STAGES as string[]).includes(mobilePipelineStage) && col.id === (stageViewMode === "core" ? coreStagesList[0].id : STAGES[0])) ? "mobile-pipeline-active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverStage !== col.targetStage) setDragOverStage(col.targetStage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStage((curr) => (curr === col.targetStage ? null : curr));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId = e.dataTransfer.getData("text/plain") || draggedLeadId;
                  setDragOverStage(null);
                  setDraggedLeadId(null);
                  if (droppedId) moveStage(droppedId, col.targetStage);
                }}
                style={{
                  minWidth: 275,
                  width: 275,
                  maxWidth: 275,
                  flexShrink: 0,
                  backgroundColor: isOver ? "#f0f9ff" : "#f8fafc",
                  border: isOver ? "2px dashed #0284c7" : "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: "14px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "all 0.2s ease",
                  boxShadow: isOver ? "0 8px 24px rgba(2, 132, 199, 0.12)" : "none",
                }}
              >
                {/* Column Header matching Screenshot 2: ● Title     Count */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "2px 4px 6px 4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: col.dot,
                        boxShadow: `0 0 0 2px ${col.dot}30`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                      {col.label}
                    </span>
                  </div>
                  <span
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      borderRadius: 9999,
                      padding: "2px 9px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 120 }}>
                  {stageLeads.map((lead) => {
                    const isDragging = draggedLeadId === lead.id;
                    const dateInfo = getLeadDateStatus(lead);
                    const teamAvatars = getLeadTeamAvatars(lead);
                    const isCardWarning = dateInfo.isLate || lead.priority === "Critical";

                    // Client dot color like in Screenshot 2
                    const dotColor =
                      lead.priority === "Critical"
                        ? "#ef4444"
                        : lead.priority === "High"
                        ? "#f59e0b"
                        : lead.priority === "Medium"
                        ? "#3b82f6"
                        : "#10b981";

                    return (
                      <div
                        key={lead.id}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", lead.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedLeadId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverStage(null);
                        }}
                        onClick={() => setSelectedLead(lead)}
                        style={{
                          cursor: "grab",
                          backgroundColor: isCardWarning ? "#fff5f5" : "#ffffff",
                          border: isCardWarning ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: "13px 14px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          opacity: isDragging ? 0.35 : 1,
                          transform: isDragging ? "scale(0.96)" : "scale(1)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Top Line: ● Client Name (left)  +  Priority Badge (right) */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                backgroundColor: dotColor,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#004d66",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={lead.clientName}
                            >
                              {lead.clientName}
                            </span>
                          </div>

                          {/* Priority Pill & Quick Edit */}
                          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                            {lead.priority === "Critical" && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  color: "#dc2626",
                                  backgroundColor: "#fee2e2",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  letterSpacing: "0.5px",
                                }}
                              >
                                URGENT
                              </span>
                            )}
                            {lead.priority === "High" && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  color: "#d97706",
                                  backgroundColor: "#fef3c7",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  letterSpacing: "0.5px",
                                }}
                              >
                                HIGH
                              </span>
                            )}
                            {lead.priority === "Medium" && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: "#0284c7",
                                  backgroundColor: "#e0f2fe",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                MEDIUM
                              </span>
                            )}
                            {lead.priority === "Low" && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  color: "#64748b",
                                  backgroundColor: "#f1f5f9",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                NORMAL
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                padding: "2px 4px",
                                borderRadius: 4,
                                cursor: "pointer",
                                color: "#94a3b8",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease",
                              }}
                              className="hover:text-teal-700 hover:bg-slate-100"
                              title="View lead" aria-label="View lead"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Contact Person & Multi-Contact Indicator */}
                        {lead.contactName && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              marginTop: 4,
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              👤 {lead.contactName}
                            </span>
                            {lead.contacts && lead.contacts.length > 1 && (
                              <span
                                title={lead.contacts.map((c) => `${c.name || "Contact"}${c.role ? ` (${c.role})` : ""}`).join(", ")}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: "#0369a1",
                                  backgroundColor: "#e0f2fe",
                                  border: "1px solid #bae6fd",
                                  padding: "0.5px 5px",
                                  borderRadius: 8,
                                  flexShrink: 0,
                                }}
                              >
                                +{lead.contacts.length - 1}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Middle Line: Task / Deal Requirement */}
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#334155",
                            margin: "8px 0 6px 0",
                            lineHeight: 1.35,
                          }}
                        >
                          {lead.product}
                        </div>

                        {/* Value & Category Tag */}
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#059669", marginBottom: lead.quotationNumber ? 6 : 10 }}>
                          {formatCurrency(lead.estimatedValue)}
                          {lead.category && (
                            <span style={{ fontSize: 10.5, fontWeight: 500, color: "#64748b", marginLeft: 6 }}>
                              • {lead.category}
                            </span>
                          )}
                        </div>

                        {/* Quotation Number Badge if present */}
                        {lead.quotationNumber && (
                          <div
                            style={{
                              marginBottom: 8,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "2px 7px",
                              backgroundColor: "#fef3c7",
                              border: "1px solid #fde68a",
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#b45309",
                            }}
                          >
                            <FileText size={11} />
                            <span>Quote: {lead.quotationNumber}</span>
                          </div>
                        )}

                        {lead.referredBy && (
                          <div
                            style={{
                              marginBottom: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 6px",
                              backgroundColor: "#f0fdfa",
                              border: "1px solid #ccfbf1",
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: "#0f766e",
                            }}
                          >
                            <span>👥 Ref: {lead.referredBy}</span>
                          </div>
                        )}

                        {/* Bottom Footer: Date (left) + Team Avatars (right) */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingTop: 8,
                            borderTop: "1px solid rgba(0,0,0,0.05)",
                          }}
                        >
                          {/* Creation Date */}
                          <span
                            title={`Created on ${dateInfo.raw}`}
                            style={{
                              fontSize: 11.5,
                              color: "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Calendar size={12} color="#94a3b8" />
                            <span>{dateInfo.text}</span>
                          </span>

                          {/* Team initials avatars */}
                          <div style={{ display: "flex", alignItems: "center" }}>
                            {teamAvatars.map((av, idx) => (
                              <div
                                key={av.name}
                                title={av.name}
                                style={{
                                  width: 21,
                                  height: 21,
                                  borderRadius: "50%",
                                  backgroundColor: av.bg,
                                  color: "#ffffff",
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginLeft: idx > 0 ? -5 : 0,
                                  border: "1.5px solid #ffffff",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                                }}
                              >
                                {av.initial}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stageLeads.length === 0 && (
                    <div
                      style={{
                        padding: "26px 14px",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 12,
                        borderRadius: 10,
                        border: "1px dashed #e2e8f0",
                        backgroundColor: "rgba(248, 250, 252, 0.6)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 110,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>No leads in {col.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Drag a deal here or create a lead</div>
                    </div>
                  )}

                  {/* Visual Drop Zone Indicator when hovering over stage */}
                  {isOver && (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: 10,
                        border: `2px dashed ${col.dot}`,
                        backgroundColor: `${col.dot}12`,
                        color: col.dot,
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      Drop to move to {col.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table data-mobile-cards="true">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Requirement</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Source</th>
                  <th>Next Follow-up</th>
                  <th style={{ textAlign: "right", paddingRight: 18 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, rowIdx) => (
                  <tr key={lead.id}>
                    <td data-label="Client">
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.clientName}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <span>{lead.contactName || "—"}</span>
                        {lead.contacts && lead.contacts.length > 1 && (
                          <span
                            title={lead.contacts.map((c) => `${c.name || "Contact"}${c.role ? ` (${c.role})` : ""}`).join(", ")}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: "#0369a1",
                              backgroundColor: "#e0f2fe",
                              border: "1px solid #bae6fd",
                              padding: "0.5px 5px",
                              borderRadius: 10,
                              cursor: "default",
                            }}
                          >
                            +{lead.contacts.length - 1} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Requirement" style={{ fontSize: 13, maxWidth: 170 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: "#0369a1",
                          backgroundColor: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          padding: "1px 5px",
                          borderRadius: 4,
                          display: "inline-block",
                          marginBottom: 3,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {lead.category || (lead.enquiryType === "Service" ? "Service Request" : "Medical Equipment")}
                      </span>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.product}</div>
                    </td>
                    <td data-label="Stage">
                      <span className={`badge ${getStatusColor(lead.stage)}`}>{lead.stage}</span>
                    </td>
                    <td data-label="Value" style={{ fontWeight: 700, color: "#059669" }}>{formatCurrency(lead.estimatedValue)}</td>
                    <td data-label="Assigned To" style={{ fontSize: 13 }}>{lead.assignedTo}</td>
                    <td data-label="Priority">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: priorityDot[lead.priority] }} />
                        <span style={{ fontSize: 12 }}>{lead.priority}</span>
                      </div>
                    </td>
                    <td data-label="Source" style={{ fontSize: 12, color: "#64748b" }}>
                      <div>{lead.source}</div>
                      {lead.referredBy && (
                        <div style={{ fontSize: 11, color: "#004d66", fontWeight: 600 }}>
                          Ref: {lead.referredBy}
                        </div>
                      )}
                    </td>
                    <td data-label="Next Follow-up" style={{ fontSize: 12 }}>{lead.nextFollowUp || "—"}</td>
                    <td data-label="Actions"
                      style={{
                        padding: "8px 18px",
                        textAlign: "right",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        position: "relative",
                        zIndex: activeActionLeadId === lead.id ? 40 : 1,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionLeadId(activeActionLeadId === lead.id ? null : lead.id);
                          }}
                          title="Actions"
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: activeActionLeadId === lead.id ? "1px solid #004d66" : "1px solid #cbd5e1",
                            backgroundColor: activeActionLeadId === lead.id ? "#f0fdfa" : "#ffffff",
                            color: activeActionLeadId === lead.id ? "#004d66" : "#334155",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          }}
                          onMouseEnter={(e) => {
                            if (activeActionLeadId !== lead.id) {
                              e.currentTarget.style.borderColor = "#94a3b8";
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeActionLeadId !== lead.id) {
                              e.currentTarget.style.borderColor = "#cbd5e1";
                              e.currentTarget.style.backgroundColor = "#ffffff";
                            }
                          }}
                        >
                          <span>Actions</span>
                          <ChevronDown
                            size={12}
                            style={{
                              transform: activeActionLeadId === lead.id ? "rotate(180deg)" : "none",
                              transition: "transform 0.15s ease",
                            }}
                          />
                        </button>

                        {activeActionLeadId === lead.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              ...(rowIdx >= filteredLeads.length - 2 && filteredLeads.length > 2
                                ? { bottom: "calc(100% + 4px)" }
                                : { top: "calc(100% + 4px)" }),
                              zIndex: 100,
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
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
                                setSelectedLead(lead);
                                setActiveActionLeadId(null);
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
                                handleOpenEditLead(lead);
                                setActiveActionLeadId(null);
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
                              <Pencil size={13} color="#0f766e" />
                              <span>Edit Lead</span>
                            </button>

                            <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionLeadId(null);
                                setLeadToDelete(lead);
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
                              <span>Delete Lead</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Detail Popup Modal */}
      {selectedLead && (
        <div className="lead-view-overlay" data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 250,
            background: "rgba(0, 15, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="card lead-view-dialog"
            style={{
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              overflow: "hidden",
              animation: "fadeIn 0.15s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ minWidth: 0, flex: 1, paddingRight: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: "#f0fdfa",
                      border: "1px solid #ccfbf1",
                      color: "#004d66",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={16} />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                    {selectedLead.clientName}
                  </h2>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 9999,
                      fontSize: 11.5,
                      fontWeight: 700,
                      backgroundColor: `${STAGE_COLORS[selectedLead.stage] || "#0284c7"}15`,
                      color: STAGE_COLORS[selectedLead.stage] || "#0284c7",
                      border: `1px solid ${STAGE_COLORS[selectedLead.stage] || "#0284c7"}35`,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: STAGE_COLORS[selectedLead.stage] || "#0284c7",
                      }}
                    />
                    {selectedLead.stage}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#64748b", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 500, color: "#334155" }}>{selectedLead.product}</span>
                  <span>•</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>
                    {formatCurrency(selectedLead.estimatedValue)}
                  </span>
                  {selectedLead.quantity > 1 && (
                    <>
                      <span>•</span>
                      <span>{selectedLead.quantity} units</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleOpenEditLead(selectedLead)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    backgroundColor: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    color: "#004d66",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
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
                  title="Edit Lead Information"
                >
                  <Pencil size={13} color="#004d66" />
                  <span>Edit Lead</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    fontSize: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#64748b";
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Interactive Pipeline Stage Stepper */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Pipeline Stage:</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                {(["New Lead", "Contacted", "Quotation Forwarded", "Approved", "Follow Up Later", "Rejected"] as PipelineStage[]).map((s) => {
                  const isCurrent = selectedLead.stage === s;
                  const stageColor = STAGE_COLORS[s] || "#0284c7";
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => moveStage(selectedLead.id, s)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: isCurrent ? 700 : 500,
                        backgroundColor: isCurrent ? `${stageColor}18` : "#ffffff",
                        color: isCurrent ? stageColor : "#475569",
                        border: isCurrent ? `1.5px solid ${stageColor}` : "1px solid #e2e8f0",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all 0.15s ease",
                        boxShadow: isCurrent ? `0 1px 3px ${stageColor}20` : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#0f172a";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                          e.currentTarget.style.color = "#475569";
                        }
                      }}
                    >
                      {isCurrent ? (
                        <CheckCircle2 size={12} color={stageColor} />
                      ) : (
                        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: `${stageColor}80` }} />
                      )}
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 2 Main Columns */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
                
                {/* Card 1: Facility & Stakeholder */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: "#f0fdfa",
                          color: "#004d66",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Building2 size={13} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#004d66" }}>
                        Facility & Client Contact
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 12,
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {selectedLead.source || "Direct Enquiry"}
                      {selectedLead.referredBy ? ` • Ref: ${selectedLead.referredBy}` : ""}
                    </span>
                  </div>

                  {/* Primary Stakeholder */}
                  <div
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "#f8fafc",
                      borderRadius: 10,
                      border: "1px solid #edf2f7",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        backgroundColor: "#004d66",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                        boxShadow: "0 2px 4px rgba(0, 77, 102, 0.2)",
                      }}
                    >
                      {selectedLead.contactName ? selectedLead.contactName.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>
                        {selectedLead.contactName || "Contact Person"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedLead.clientName}
                      </div>
                    </div>
                  </div>

                  {/* Communication Channels */}
                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: "auto" }}>
                    {/* Phone / WhatsApp */}
                    <a
                      href={selectedLead.phone ? `tel:${selectedLead.phone}` : undefined}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        textDecoration: "none",
                        color: "inherit",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#86efac";
                        e.currentTarget.style.backgroundColor = "#f0fdf4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: "#f0fdf4",
                          color: "#16a34a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Phone size={13} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Phone / WhatsApp</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {selectedLead.phone || "—"}
                        </div>
                      </div>
                    </a>

                    {/* Official Email */}
                    <a
                      href={selectedLead.email ? `mailto:${selectedLead.email}` : undefined}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        textDecoration: "none",
                        color: "inherit",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#93c5fd";
                        e.currentTarget.style.backgroundColor = "#eff6ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Mail size={13} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Official Email</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {selectedLead.email || "—"}
                        </div>
                      </div>
                    </a>
                  </div>

                  {/* Multiple Contacts List */}
                  {selectedLead.contacts && selectedLead.contacts.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Users size={12} color="#0284c7" /> Facility Contacts & Stakeholders
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#0369a1",
                            fontWeight: 700,
                            backgroundColor: "#e0f2fe",
                            padding: "1px 6px",
                            borderRadius: 10,
                          }}
                        >
                          {selectedLead.contacts.length} {selectedLead.contacts.length === 1 ? "Contact" : "Contacts"}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedLead.contacts.map((contact, idx) => (
                          <div
                            key={contact.id || idx}
                            style={{
                              padding: "8px 10px",
                              backgroundColor: contact.isPrimary ? "#f0fdf4" : "#f8fafc",
                              border: `1px solid ${contact.isPrimary ? "#bbf7d0" : "#e2e8f0"}`,
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 5,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                  {contact.name || `Contact #${idx + 1}`}
                                </span>
                                {contact.role && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: "1px 6px",
                                      backgroundColor: "#e0f2fe",
                                      color: "#0369a1",
                                      borderRadius: 4,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {contact.role}
                                  </span>
                                )}
                              </div>
                              {contact.isPrimary && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: "#16a34a",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Star size={10} fill="#16a34a" /> Primary
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 11 }}>
                              {contact.phone && (
                                <a
                                  href={`tel:${contact.phone}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    color: "#0f766e",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                  }}
                                  title="Call or WhatsApp"
                                >
                                  <Phone size={10.5} /> {contact.phone}
                                </a>
                              )}
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    color: "#2563eb",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                  }}
                                  title="Send email"
                                >
                                  <Mail size={10.5} /> {contact.email}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 2: Equipment & Deal Specs */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: "#f0fdfa",
                          color: "#004d66",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selectedLead.enquiryType === "Service" ? <Wrench size={13} /> : <Stethoscope size={13} />}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#004d66" }}>
                        {selectedLead.enquiryType === "Service" ? "Service & Requirement" : "Equipment & Model"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        backgroundColor: "#e0f2fe",
                        color: "#0369a1",
                        border: "1px solid #bae6fd",
                      }}
                    >
                      {selectedLead.category || (selectedLead.enquiryType === "Service" ? "Service Request" : "Medical Equipment")}
                    </span>
                  </div>

                  {/* Product Highlight */}
                  <div
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "#f8fafc",
                      borderRadius: 10,
                      border: "1px solid #edf2f7",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                      {selectedLead.enquiryType === "Service" ? "Service Requirement" : "Model / Product Specification"}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
                      {selectedLead.product}
                    </div>
                  </div>

                  {/* Commercial Stats */}
                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 10, marginTop: "auto" }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Package size={13} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Quantity</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                          {selectedLead.quantity} {selectedLead.quantity === 1 ? "Unit" : "Units"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#f0fdf4",
                        borderRadius: 8,
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: "#dcfce7",
                          color: "#15803d",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 9.5,
                          fontWeight: 800,
                        }}
                      >
                        AED
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#166534" }}>Estimated Value</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#14532d" }}>
                          {formatCurrency(selectedLead.estimatedValue)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quotation Issued Banner */}
                  {selectedLead.quotationNumber && (
                    <div
                      style={{
                        padding: "9px 12px",
                        backgroundColor: "#fffbeb",
                        borderRadius: 8,
                        border: "1px solid #fde68a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            backgroundColor: "#fef3c7",
                            color: "#d97706",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={13} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Quotation Issued
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#78350f" }}>
                            {selectedLead.quotationNumber}
                          </div>
                        </div>
                      </div>
                      {selectedLead.quotationValue ? (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 9.5, color: "#92400e" }}>Quoted Total</div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#78350f" }}>
                            {formatCurrency(selectedLead.quotationValue)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Responsible Team & Follow-up Full-Width Banner */}
              <div data-mobile-grid="stack"
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: "12px 18px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                {/* Assigned Handler */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      backgroundColor: "#dcfce7",
                      color: "#15803d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {selectedLead.assignedTo ? selectedLead.assignedTo.slice(0, 2).toUpperCase() : "U"}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Handling (Assignee)</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                      {selectedLead.assignedTo || "Unassigned"}
                    </div>
                  </div>
                </div>

                {/* Creator */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {selectedLead.createdBy ? selectedLead.createdBy.slice(0, 2).toUpperCase() : "H"}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Created By</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                      {selectedLead.createdBy || "Hashim"}
                    </div>
                  </div>
                </div>

                {/* Next Follow-up */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: "#fef3c7",
                      color: "#b45309",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={13} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Next Follow-up</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                      {selectedLead.nextFollowUp || "Not scheduled"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes / Department Requirements */}
              {selectedLead.notes && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderLeft: "3.5px solid #004d66",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <FileText size={12} color="#004d66" />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#004d66" }}>
                      Requirements & Client Notes
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {selectedLead.notes}
                  </div>
                </div>
              )}

              {/* Comments & Activity Log */}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#004d66", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Conversation & Activity Notes ({selectedLead.comments?.length || 0})
                </div>

                {/* Comment Input */}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <textarea
                    className="form-input"
                    placeholder="Write a comment or follow-up note (e.g. Spoke with Biomedical Lead, demo scheduled)..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    rows={2}
                    style={{ fontSize: 12.5, resize: "vertical", minHeight: 48, padding: "8px 12px", borderRadius: 8 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(selectedLead.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleAddComment(selectedLead.id)}
                    disabled={!newCommentText.trim()}
                    style={{
                      alignSelf: "flex-end",
                      height: 38,
                      padding: "0 18px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      opacity: !newCommentText.trim() ? 0.5 : 1,
                      backgroundColor: "#004d66",
                      borderRadius: 8,
                    }}
                  >
                    Add Note
                  </button>
                </div>

                {/* Comments List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {selectedLead.comments && selectedLead.comments.length > 0 ? (
                    selectedLead.comments.map((comment) => (
                      <div
                        key={comment.id}
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#e2e8f0", color: "#475569", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700 }}>
                              {comment.author ? comment.author.slice(0, 1).toUpperCase() : "U"}
                            </span>
                            {comment.author}
                          </span>
                          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                            {comment.createdAt}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: "#334155", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                          {comment.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "10px 0", textAlign: "center" }}>
                      No activity notes yet. Write an update above to keep a record of conversations and next steps.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fafbfc",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setLeadToDelete(selectedLead);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 12px",
                  background: "transparent",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                className="hover:bg-red-50"
              >
                <Trash2 size={13} />
                <span>Delete Lead</span>
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedLead(null)}
                  style={{ fontSize: 12.5, padding: "7px 16px", borderRadius: 8 }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditLead(selectedLead)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#004d66",
                    color: "#ffffff",
                    padding: "7px 18px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0, 77, 102, 0.2)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00384d")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#004d66")}
                >
                  <Pencil size={13} />
                  <span>Edit Lead</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= COLLECT QUOTATION NUMBER POPUP ================= */}
      {showQuotePopup && quotePromptLead && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 620,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "visible",
              border: "1px solid #e2e8f0",
              animation: "fadeIn 0.15s ease",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #fef3c7",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fffbeb",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#d97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#92400e" }}>
                    Quotation Forwarded
                  </h3>
                  <div style={{ fontSize: 11.5, color: "#b45309" }}>
                    Record quotation number and optional quoted items for this lead
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowQuotePopup(false);
                  setQuotePromptLead(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!enteredQuoteNumber.trim()) {
                  toast.error("Please enter a quotation number");
                  return;
                }
                applyStageChange(
                  quotePromptLead.id,
                  "Quotation Forwarded",
                  enteredQuoteNumber.trim(),
                  Number(enteredQuoteAmount) || quotePromptLead.estimatedValue,
                  quoteProducts
                );
                setShowQuotePopup(false);
                setQuotePromptLead(null);
              }}
              style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Target Lead summary */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Lead / Opportunity
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  {quotePromptLead.clientName}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  {quotePromptLead.product} • {formatCurrency(quotePromptLead.estimatedValue)}
                </div>
              </div>

              {/* Quotation Number */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                  Quotation Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. FMT-QT26-0326"
                  value={enteredQuoteNumber}
                  onChange={(e) => setEnteredQuoteNumber(e.target.value)}
                  autoFocus
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1.5px solid #d97706",
                    fontSize: 13,
                    fontWeight: 600,
                    outline: "none",
                    color: "#0f172a",
                  }}
                />

                {/* Suggestions from Zoho Books Quotes */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    Quick Select from Recent Zoho Quotes:
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {getZohoLiveQuotes()
                      .slice(0, 4)
                      .map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setEnteredQuoteNumber(q.quotationNumber);
                            setEnteredQuoteAmount(q.total);
                            if (q.items && q.items.length > 0) {
                              setQuoteProducts(
                                q.items.map((it, idx) => ({
                                  id: `qp-zoho-${idx}-${Date.now()}`,
                                  product: it.product || it.description || "",
                                  price: it.amount || it.rate || 0,
                                }))
                              );
                            }
                          }}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            backgroundColor: enteredQuoteNumber === q.quotationNumber ? "#fef3c7" : "#f1f5f9",
                            color: enteredQuoteNumber === q.quotationNumber ? "#92400e" : "#334155",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {q.quotationNumber}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Optional Quoted Products with individual prices */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", margin: 0, display: "block" }}>
                      Quoted Products (Optional)
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Add one or multiple products with individual quoted prices
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetQuoteProductIdx(quoteProducts.length);
                        openAddProductModal();
                      }}
                      style={{
                        padding: "5px 11px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        backgroundColor: "#004d66",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: "0 1px 3px rgba(0,77,102,0.2)",
                      }}
                      title="Add a custom or new product not currently in website catalog"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      <span>+ New Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultProd = activeProductList[0];
                        const newPrice = defaultProd?.sellingPrice || 0;
                        const updated = [
                          ...quoteProducts,
                          {
                            id: `qp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            product: defaultProd ? defaultProd.name : "",
                            price: newPrice,
                          },
                        ];
                        setQuoteProducts(updated);
                        const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
                        if (sum > 0) setEnteredQuoteAmount(sum);
                      }}
                      style={{
                        padding: "5px 11px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor: "#f0fdfa",
                        color: "#0f766e",
                        border: "1px solid #99f6e4",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={13} />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                {quoteProducts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
                    {quoteProducts.map((qp, idx) => (
                      <div data-mobile-grid="stack"
                        key={qp.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 135px 32px",
                          gap: 8,
                          alignItems: "center",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          padding: "8px 10px",
                          borderRadius: 8,
                          position: "relative",
                          zIndex: 60 - idx,
                        }}
                      >
                        <div style={{ position: "relative", minWidth: 0, width: "100%" }}>
                          <CustomLightSelect
                            value={qp.product}
                            onChange={(val) => {
                              const found = activeProductList.find((p) => p.name === val);
                              const updated = quoteProducts.map((item, i) =>
                                i === idx
                                  ? { ...item, product: val, price: found?.sellingPrice || item.price }
                                  : item
                              );
                              setQuoteProducts(updated);
                              const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
                              if (sum > 0) setEnteredQuoteAmount(sum);
                            }}
                            options={activeProductList.map((p) => ({
                              value: p.name,
                              label: p.name,
                              subtext: p.category ? `${p.category} • AED ${(p.sellingPrice || 0).toLocaleString()}` : undefined,
                            }))}
                            placeholder="Select product model..."
                            searchable
                            allowCustomValue
                            onAddNew={(query) => {
                              setTargetQuoteProductIdx(idx);
                              openAddProductModal(query);
                            }}
                            addNewLabel="+ Add New Product (Not on Website)..."
                            buttonStyle={{ height: 34, fontSize: 12 }}
                            menuStyle={{ maxHeight: 260, width: "100%" }}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Price (AED)"
                            min={0}
                            step="0.01"
                            value={qp.price || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = quoteProducts.map((item, i) =>
                                i === idx ? { ...item, price: val } : item
                              );
                              setQuoteProducts(updated);
                              const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
                              setEnteredQuoteAmount(sum);
                            }}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              fontSize: 12,
                              fontWeight: 600,
                              outline: "none",
                              backgroundColor: "#ffffff",
                              height: 34,
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = quoteProducts.filter((_, i) => i !== idx);
                            setQuoteProducts(updated);
                            const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
                            setEnteredQuoteAmount(sum);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#94a3b8",
                            padding: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                          title="Remove product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quotation Amount */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", margin: 0 }}>
                    Total Quoted Value (AED) *
                  </label>
                  {quoteProducts.length > 0 && (
                    <span style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>
                      Sum of {quoteProducts.length} quoted {quoteProducts.length === 1 ? "product" : "products"}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={enteredQuoteAmount || ""}
                  onChange={(e) => setEnteredQuoteAmount(parseFloat(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 6,
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowQuotePopup(false);
                    setQuotePromptLead(null);
                  }}
                  style={{
                    backgroundColor: "#f1f5f9",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 12.5,
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
                    backgroundColor: "#d97706",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 18px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 1px 3px rgba(217, 119, 6, 0.3)",
                  }}
                >
                  <Check size={14} />
                  <span>Confirm & Move to Quotation Forwarded</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern In-App Delete Lead Confirmation Modal */}
      {leadToDelete && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            animation: "fadeIn 0.2s ease",
          }}
          onClick={() => setLeadToDelete(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Warning Icon & Title */}
            <div style={{ padding: "24px 24px 16px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  border: "2px solid #fecaca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#dc2626",
                }}
              >
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16.5, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>
                  Delete Pipeline Deal
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.45 }}>
                  Are you sure you want to permanently delete this lead? It will be removed from your active sales pipeline across all devices.
                </p>
              </div>
            </div>

            {/* Deal Summary Box */}
            <div style={{ padding: "0 24px 18px 24px" }}>
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {leadToDelete.clientName}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{leadToDelete.product}</span>
                  <span>•</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>
                    {formatCurrency(leadToDelete.quotationValue || leadToDelete.estimatedValue)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor: "#e2e8f0",
                      color: "#334155",
                    }}
                  >
                    Stage: {leadToDelete.stage}
                  </span>
                  {leadToDelete.quotationNumber && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      Quote: {leadToDelete.quotationNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div
              style={{
                padding: "14px 24px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = leadToDelete.id;
                  const clientName = leadToDelete.clientName;
                  const remaining = deleteStoredLead(targetId);
                  setLeads(remaining);
                  if (selectedLead?.id === targetId) {
                    setSelectedLead(null);
                  }
                  setLeadToDelete(null);
                  toast.success(`Lead for "${clientName}" deleted successfully`);
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.25)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
              >
                <Trash2 size={14} />
                <span>Delete Lead</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD LEAD MODAL ================= */}
      {showAddModal && (
        <div className="lead-create-overlay" data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 15, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 250,
            padding: 20,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card lead-create-dialog"
            style={{
              width: "100%",
              maxWidth: 940,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              overflow: "hidden",
              animation: "fadeIn 0.18s ease-out",
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
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                      {editingLeadId ? "Edit lead" : "New lead"}
                    </h2>
                    <span
                      style={{
                        fontSize: 11,
                        backgroundColor: editingLeadId ? "#f0fdfa" : "#eff6ff",
                        color: editingLeadId ? "#0f766e" : "#1d4ed8",
                        border: editingLeadId ? "1px solid #99f6e4" : "1px solid #bfdbfe",
                        padding: "2px 9px",
                        borderRadius: 9999,
                        fontWeight: 600,
                      }}
                    >
                      {editingLeadId ? "Edit Mode" : "UAE Pipeline"}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                    {editingLeadId
                      ? "Update facility requirements, contact persons, equipment, and stage assignments"
                      : "Record facility opportunity, medical equipment requirement, and sales ownership"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLeadId(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 2-Column Minimal Layout */}
            <form className="lead-create-form"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                let clientName = customClientName.trim();
                let personEntity: ContactPerson | undefined;
                let orgEntity: Client | undefined;

                if (selectedClientId.startsWith("person-")) {
                  const pId = selectedClientId.replace("person-", "");
                  personEntity = peopleRegistry.find((p) => p.id === pId || p.id === selectedClientId);
                  if (personEntity) clientName = personEntity.name;
                } else if (selectedClientId.startsWith("org-")) {
                  const cId = selectedClientId.replace("org-", "");
                  orgEntity = clientRegistry.find((c) => c.id === cId || c.id === selectedClientId);
                  if (orgEntity) clientName = orgEntity.name;
                } else if (
                  selectedClientId &&
                  selectedClientId !== "NEW" &&
                  selectedClientId !== "NEW_ORG" &&
                  selectedClientId !== "NEW_PERSON" &&
                  selectedClientId !== "CUSTOM"
                ) {
                  orgEntity = clientRegistry.find((c) => c.id === selectedClientId);
                  if (orgEntity) {
                    clientName = orgEntity.name;
                  } else {
                    personEntity = peopleRegistry.find((p) => p.id === selectedClientId);
                    if (personEntity) clientName = personEntity.name;
                  }
                }

                if (!clientName) {
                  clientName = customClientName.trim();
                }

                const serviceVal =
                  selectedServiceType === "CUSTOM"
                    ? customServiceName.trim()
                    : selectedServiceType;
                let product = "";
                if (enquiryType === "Service") {
                  product = selectedServiceType === "CUSTOM" ? customServiceName.trim() : (selectedServiceType || customServiceName.trim());
                } else {
                  if (selectedProductId && selectedProductId !== "CUSTOM") {
                    const found = activeProductList.find((p) => p.id === selectedProductId);
                    product = found?.name || customProductName.trim();
                  } else {
                    product = customProductName.trim();
                  }
                  if (!product && selectedCategory) {
                    product = `${selectedCategory} Equipment`;
                  }
                }

                if (!clientName) {
                  toast.error("Please select a healthcare organisation or enter contact person name");
                  return;
                }
                if (!product) {
                  toast.error(`Please select or specify the ${enquiryType === "Service" ? "service" : "equipment"} requirement`);
                  return;
                }

                const finalEstimatedValue =
                  typeof leadEstimatedValue === "number" && !isNaN(leadEstimatedValue)
                    ? leadEstimatedValue
                    : leadEstimatedValue !== "" && !isNaN(Number(leadEstimatedValue))
                    ? Number(leadEstimatedValue)
                    : fd.get("estimatedValue") !== null && fd.get("estimatedValue") !== ""
                    ? Number(fd.get("estimatedValue")) || 0
                    : 0;

                const finalCategory =
                  enquiryType === "Service"
                    ? "Service Request"
                    : ((selectedCategory || "").trim() as ProductCategory);

                if (enquiryType === "Service" && serviceVal && !serviceRequirementsList.includes(serviceVal)) {
                  setServiceRequirementsList((prev) => [...prev, serviceVal]);
                }

                const assignedRep = leadAssignedTo || employeeList[0]?.name || "Riyas";
                const repObj = employeeList.find((emp) => emp.name === assignedRep) || mockEmployees.find((emp) => emp.name === assignedRep);

                const validContacts: LeadContact[] = leadContacts
                  .map((c) => ({
                    id: c.id,
                    name: c.name.trim(),
                    role: c.role?.trim() || undefined,
                    phone: c.phone.trim(),
                    email: c.email?.trim() || undefined,
                    isPrimary: Boolean(c.isPrimary),
                  }))
                  .filter((c) => c.name || c.phone || c.email);

                const primaryContact = validContacts.find((c) => c.isPrimary) || validContacts[0];
                const resolvedContactName = primaryContact?.name || leadContactName.trim() || (personEntity ? personEntity.name : "Key Contact");
                const resolvedPhone = primaryContact?.phone || leadPhone.trim() || personEntity?.phone || "+971 50 000 0000";
                const resolvedEmail = primaryContact?.email || leadEmail.trim() || personEntity?.email || "procurement@facility.ae";

                // Automatically register / sync the client into the Clients directory!
                const syncedClient = addClientFromLead({
                  name: clientName,
                  contactName: resolvedContactName,
                  phone: resolvedPhone,
                  email: resolvedEmail,
                  source: leadSource || "Direct Enquiry",
                  assignedTo: assignedRep,
                });

                if (!personEntity && (selectedClientId === "NEW_PERSON" || /^(dr\b|doctor\b|mr\b|mrs\b|ms\b|eng\b)/i.test(clientName))) {
                  addStandalonePerson({
                    name: clientName,
                    designation: "Doctor / Key Contact",
                    department: "Doctor",
                    phone: resolvedPhone,
                    whatsapp: resolvedPhone,
                    email: resolvedEmail,
                    clientId: syncedClient.id,
                    clientName: syncedClient.name,
                    notes: `Added from pipeline lead for ${product}`,
                  });
                }

                if (editingLeadId) {
                  const existingLead = leads.find((l) => l.id === editingLeadId);
                  const updatedLeadObj: Lead = {
                    ...existingLead!,
                    clientId: existingLead?.clientId || syncedClient.id,
                    clientName: syncedClient.name,
                    contactName: resolvedContactName,
                    phone: resolvedPhone,
                    email: resolvedEmail,
                    contacts: validContacts.length > 0 ? validContacts : undefined,
                    enquiryType,
                    serviceType: enquiryType === "Service" ? serviceVal : undefined,
                    category: finalCategory,
                    product,
                    quantity: enquiryType === "Service" ? 1 : (leadQuantity === "" || Number(leadQuantity) < 1 ? 1 : Number(leadQuantity)),
                    estimatedValue: finalEstimatedValue,
                    quotationValue: existingLead?.quotationNumber ? finalEstimatedValue : existingLead?.quotationValue,
                    stage: leadStage || existingLead?.stage || "New Lead",
                    source: leadSource || existingLead?.source || "Direct Enquiry",
                    referredBy: leadSource === "Referral" ? leadReferredBy.trim() : undefined,
                    priority: leadPriority || existingLead?.priority || "Medium",
                    assignedTo: assignedRep,
                    assignedToId: repObj?.id || existingLead?.assignedToId || "emp-1",
                    createdBy: existingLead?.createdBy || currentUser.name || "Fuhad",
                    createdById: existingLead?.createdById || (currentUser.name ? `emp-${currentUser.name.toLowerCase().split(" ")[0]}` : "emp-fuhad"),
                    notes: leadNotes.trim() || (fd.get("notes") as string)?.trim() || existingLead?.notes || "",
                    nextFollowUp: leadFollowUp || (fd.get("nextFollowUp") as string) || existingLead?.nextFollowUp || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
                    updatedAt: new Date().toISOString(),
                  };

                  const cleanLeads = leads.filter((l) => !isDummyLead(l));
                  const updatedLeads = cleanLeads.map((l) => (l.id === editingLeadId ? updatedLeadObj : l));
                  setLeads(updatedLeads);
                  saveStoredLeads(updatedLeads);
                  if (selectedLead && selectedLead.id === editingLeadId) {
                    setSelectedLead(updatedLeadObj);
                  }
                  if (updatedLeadObj.quotationNumber) {
                    syncLeadToQuotations(updatedLeadObj, updatedLeadObj.quotationNumber, finalEstimatedValue);
                  }
                  toast.success(`Lead for "${syncedClient.name}" updated successfully!`);
                  setShowAddModal(false);
                  setEditingLeadId(null);
                  return;
                }

                const newLeadObj: Lead = {
                  id: `lead-${Date.now()}`,
                  clientId: syncedClient.id,
                  clientName: syncedClient.name,
                  contactName: resolvedContactName,
                  phone: resolvedPhone,
                  email: resolvedEmail,
                  contacts: validContacts.length > 0 ? validContacts : undefined,
                  enquiryType,
                  serviceType: enquiryType === "Service" ? serviceVal : undefined,
                  category: finalCategory,
                  product,
                  quantity: enquiryType === "Service" ? 1 : (leadQuantity === "" || Number(leadQuantity) < 1 ? 1 : Number(leadQuantity)),
                  estimatedValue: finalEstimatedValue,
                  stage: leadStage || "New Lead",
                  source: leadSource || "Direct Enquiry",
                  referredBy: leadSource === "Referral" ? leadReferredBy.trim() : undefined,
                  priority: leadPriority || "Medium",
                  assignedTo: assignedRep,
                  assignedToId: repObj?.id || "emp-1",
                  createdBy: currentUser.name || "Fuhad",
                  createdById: currentUser.name ? `emp-${currentUser.name.toLowerCase().split(" ")[0]}` : "emp-fuhad",
                  notes: leadNotes.trim() || (fd.get("notes") as string)?.trim() || "",
                  nextFollowUp: leadFollowUp || (fd.get("nextFollowUp") as string) || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
                  createdAt: new Date().toISOString().split("T")[0],
                  updatedAt: new Date().toISOString().split("T")[0],
                };

                const cleanLeads = leads.filter((l) => !isDummyLead(l));
                const updatedLeads = [newLeadObj, ...cleanLeads];
                setLeads(updatedLeads);
                saveStoredLeads(updatedLeads);
                toast.success(`${enquiryType} lead for "${syncedClient.name}" created successfully!`);
                setShowAddModal(false);
                setEditingLeadId(null);
              }}
              style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "22px 28px 18px 28px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <div data-mobile-grid="stack"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 28,
                    alignItems: "start",
                  }}
                >
                  {/* Column 1: Client & contact */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          backgroundColor: "#e0f2fe",
                          color: "#004d66",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        1
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#0f172a" }}>
                        Healthcare Facility & Contact
                      </span>
                    </div>

                    {/* Client Selection */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                          Choose client <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <button
                            type="button"
                            onClick={openAddOrgModal}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#004d66",
                              background: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              borderRadius: 6,
                              padding: "2px 8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              lineHeight: "18px",
                              transition: "all 0.15s ease",
                            }}
                            className="hover:bg-sky-100 hover:border-sky-300"
                            title="Add Healthcare Organisation / Facility"
                          >
                            <Building2 size={12} strokeWidth={2.2} />
                            <span>+ Org</span>
                          </button>
                          <button
                            type="button"
                            onClick={openAddPersonModal}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#0f766e",
                              background: "#f0fdfa",
                              border: "1px solid #99f6e4",
                              borderRadius: 6,
                              padding: "2px 8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              lineHeight: "18px",
                              transition: "all 0.15s ease",
                            }}
                            className="hover:bg-teal-100 hover:border-teal-300"
                            title="Add Doctor or Individual Contact"
                          >
                            <User size={12} strokeWidth={2.2} />
                            <span>+ Person</span>
                          </button>
                        </div>
                      </div>

                      {/* Filter segmented tabs */}
                      <div
                        style={{
                          display: "flex",
                          backgroundColor: "#f1f5f9",
                          padding: 3,
                          borderRadius: 8,
                          gap: 3,
                          marginBottom: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {(
                          [
                            { key: "ALL", label: "All" },
                            { key: "ORGANISATIONS", label: "Organisations" },
                            { key: "PEOPLE", label: "People" },
                          ] as const
                        ).map((tab) => {
                          const active = clientFilterType === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setClientFilterType(tab.key)}
                              style={{
                                flex: 1,
                                fontSize: 11,
                                fontWeight: active ? 600 : 500,
                                padding: "4px 6px",
                                borderRadius: 6,
                                border: "none",
                                backgroundColor: active ? "#ffffff" : "transparent",
                                color: active ? "#0f172a" : "#64748b",
                                cursor: "pointer",
                                boxShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      <CustomLightSelect
                        value={selectedClientId}
                        onChange={(val) => handleClientSelectChange(val)}
                        placeholder="Select healthcare organisation or doctor / person..."
                        searchable
                        clearable={true}
                        onAddNew={openAddOrgModal}
                        addNewLabel="+ Add New Healthcare Organisation..."
                        options={[
                          ...(clientFilterType !== "PEOPLE"
                            ? [
                                {
                                  value: "NEW_ORG",
                                  label: "+ Add New Healthcare Organisation...",
                                },
                                ...clientRegistry.map((c) => ({
                                  value: `org-${c.id}`,
                                  label: c.name,
                                  subtext: `🏢 ${c.orgType} • ${c.state || c.city || "UAE"}`,
                                })),
                              ]
                            : []),
                          ...(clientFilterType !== "ORGANISATIONS"
                            ? [
                                {
                                  value: "NEW_PERSON",
                                  label: "+ Add New Doctor / Person...",
                                },
                                ...peopleRegistry.map((p) => ({
                                  value: `person-${p.id}`,
                                  label: p.name,
                                  subtext: `👤 ${p.designation || "Doctor / Healthcare Contact"}${p.clientName ? ` • ${p.clientName}` : ""}`,
                                })),
                              ]
                            : []),
                        ]}
                        buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                      />

                      {/* Minimal subtitle info when selected */}
                      {selectedClientId &&
                        selectedClientId !== "NEW" &&
                        selectedClientId !== "NEW_ORG" &&
                        selectedClientId !== "NEW_PERSON" &&
                        selectedClientId !== "CUSTOM" &&
                        (() => {
                          const org = selectedClientId.startsWith("org-")
                            ? clientRegistry.find((c) => c.id === selectedClientId.replace("org-", "") || c.id === selectedClientId)
                            : clientRegistry.find((c) => c.id === selectedClientId);

                          const person = selectedClientId.startsWith("person-")
                            ? peopleRegistry.find((p) => p.id === selectedClientId.replace("person-", "") || p.id === selectedClientId)
                            : peopleRegistry.find((p) => p.id === selectedClientId);

                          if (person) {
                            return (
                              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#0f766e" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Check size={12} color="#0d9488" strokeWidth={2.5} />
                                  <span style={{ fontWeight: 500 }}>{person.designation || "Doctor / Healthcare Contact"}</span>
                                  {person.clientName && <span style={{ color: "#64748b" }}>• {person.clientName}</span>}
                                </span>
                              </div>
                            );
                          }

                          if (org) {
                            return (
                              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#047857" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Check size={12} color="#10b981" strokeWidth={2.5} />
                                  <span style={{ fontWeight: 500 }}>{org.orgType}</span>
                                  <span style={{ color: "#64748b" }}>• {org.state || org.city || "UAE"}</span>
                                </span>
                              </div>
                            );
                          }

                          return null;
                        })()}
                    </div>

                    {/* If user selects "+ Enter New Organisation..." */}
                    {(selectedClientId === "NEW" || selectedClientId === "NEW_ORG") && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          New Facility / Organisation Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Al Zahra Hospital Sharjah"
                          value={customClientName}
                          onChange={(e) => setCustomClientName(e.target.value)}
                          required
                          autoFocus
                          style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                        />
                      </div>
                    )}

                    {/* If user selects "+ Enter New Person..." */}
                    {selectedClientId === "NEW_PERSON" && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          New Doctor / Contact Person Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Dr. Tariq Al Nuaimi"
                          value={customClientName}
                          onChange={(e) => {
                            setCustomClientName(e.target.value);
                            setLeadContactName(e.target.value);
                          }}
                          required
                          autoFocus
                          style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                        />
                      </div>
                    )}

                    {/* If selected organisation has saved contacts in registry */}
                    {selectedFacilityContacts.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          padding: "8px 10px",
                          backgroundColor: "#f0fdfa",
                          borderRadius: 8,
                          border: "1px dashed #99f6e4",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#0d9488",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Users size={12} />
                          Facility Contacts in Directory (click to add as lead contact):
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {selectedFacilityContacts.map((c) => {
                            const alreadyAdded = leadContacts.some(
                              (lc) =>
                                lc.name.trim().toLowerCase() === c.name.trim().toLowerCase() ||
                                (c.phone && lc.phone.trim() === c.phone.trim())
                            );
                            return (
                              <button
                                type="button"
                                key={c.id || c.name}
                                onClick={() => {
                                  if (alreadyAdded) return;
                                  addContact({
                                    name: c.name,
                                    role: c.designation || c.department,
                                    phone: c.phone || c.whatsapp || "",
                                    email: c.email || "",
                                  });
                                }}
                                disabled={alreadyAdded}
                                style={{
                                  fontSize: 11,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  border: alreadyAdded ? "1px solid #e2e8f0" : "1px solid #14b8a6",
                                  backgroundColor: alreadyAdded ? "#f1f5f9" : "#ffffff",
                                  color: alreadyAdded ? "#94a3b8" : "#0f766e",
                                  cursor: alreadyAdded ? "default" : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {alreadyAdded ? <Check size={10} color="#059669" /> : <Plus size={10} />}
                                <span style={{ fontWeight: 600 }}>{c.name}</span>
                                {c.designation && <span style={{ opacity: 0.8, fontSize: 10 }}>({c.designation})</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Header: Contacts & Stakeholders */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1e293b",
                          margin: 0,
                        }}
                      >
                        <Users size={13} color="#004d66" />
                        <span>Contact details</span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 10,
                            backgroundColor: "#e0f2fe",
                            color: "#004d66",
                          }}
                        >
                          {leadContacts.length} {leadContacts.length === 1 ? "contact" : "contacts"}
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => addContact()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#004d66",
                          backgroundColor: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          borderRadius: 6,
                          padding: "3px 8px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Plus size={11} strokeWidth={2.5} />
                        Add Contact
                      </button>
                    </div>

                    {/* Hidden inputs to preserve native form data compatibility */}
                    <input type="hidden" name="contactName" value={leadContactName} />
                    <input type="hidden" name="phone" value={leadPhone} />
                    <input type="hidden" name="email" value={leadEmail} />

                    {/* Contact Person Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {leadContacts.map((contact, idx) => (
                        <div
                          className="lead-contact-form-card" key={contact.id || idx}
                          style={{
                            backgroundColor: "#f8fafc",
                            border: contact.isPrimary ? "1px solid #004d66" : "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            boxShadow: contact.isPrimary ? "0 1px 3px rgba(0, 77, 102, 0.08)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Card Header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "50%",
                                  backgroundColor: contact.isPrimary ? "#004d66" : "#cbd5e1",
                                  color: "#ffffff",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                {contact.name.trim() ? contact.name : `Contact Person #${idx + 1}`}
                              </span>
                              {contact.isPrimary ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#004d66",
                                    backgroundColor: "#e0f2fe",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Star size={9} fill="#004d66" />
                                  Primary
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPrimaryContact(idx)}
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: "#0284c7",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    padding: 0,
                                  }}
                                >
                                  Set as Primary
                                </button>
                              )}
                            </div>

                            {leadContacts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeContact(idx)}
                                title="Remove this contact"
                                style={{
                                  border: "none",
                                  backgroundColor: "transparent",
                                  color: "#94a3b8",
                                  cursor: "pointer",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#ef4444";
                                  e.currentTarget.style.backgroundColor = "#fee2e2";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "#94a3b8";
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {/* Row 1: Contact Name & Role / Designation */}
                          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                                Contact Name {contact.isPrimary && <span style={{ color: "#ef4444" }}>*</span>}
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Dr. Tariq Al Nuaimi"
                                value={contact.name}
                                onChange={(e) => updateContact(idx, "name", e.target.value)}
                                style={{ fontSize: 12.5, height: 34, borderRadius: 6, backgroundColor: "#ffffff" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                                Role / Designation
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Biomedical Lead / ICU In-Charge"
                                value={contact.role || ""}
                                onChange={(e) => updateContact(idx, "role", e.target.value)}
                                style={{ fontSize: 12.5, height: 34, borderRadius: 6, backgroundColor: "#ffffff" }}
                              />
                            </div>
                          </div>

                          {/* Row 2: Phone & Email */}
                          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                                Direct Phone / WhatsApp
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="+971 50 123 4567"
                                value={contact.phone}
                                onChange={(e) => updateContact(idx, "phone", e.target.value)}
                                style={{ fontSize: 12.5, height: 34, borderRadius: 6, backgroundColor: "#ffffff" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>
                                Official Email
                              </label>
                              <input
                                type="email"
                                className="form-input"
                                placeholder="contact@facility.ae"
                                value={contact.email || ""}
                                onChange={(e) => updateContact(idx, "email", e.target.value)}
                                style={{ fontSize: 12.5, height: 34, borderRadius: 6, backgroundColor: "#ffffff" }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add Another Contact Button */}
                      <button
                        type="button"
                        onClick={() => addContact()}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#004d66",
                          backgroundColor: "#f8fafc",
                          border: "1px dashed #cbd5e1",
                          borderRadius: 8,
                          padding: "8px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f9ff";
                          e.currentTarget.style.borderColor = "#004d66";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }}
                      >
                        <UserPlus size={14} />
                        <span>+ Add Another Contact Person (Doctor, Biomedical, Procurement...)</span>
                      </button>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                        Lead Source
                      </label>
                      <CustomLightSelect
                        value={leadSource}
                        onChange={(val) => {
                          setLeadSource(val as LeadSource);
                          if (val !== "Referral") {
                            setLeadReferredBy("");
                          }
                        }}
                        options={[
                          { value: "Direct Enquiry", label: "Direct Enquiry" },
                          { value: "Meta Ads", label: "📘 Meta Ads (Facebook/Instagram)" },
                          { value: "Google Ads", label: "🔵 Google Ads" },
                          { value: "Exhibition", label: "🏛️ Exhibition (Arab Health)" },
                          { value: "Sales Visit", label: "🤝 Sales Visit" },
                          { value: "WhatsApp", label: "💬 WhatsApp Enquiry" },
                          { value: "Referral", label: "👥 Referral" },
                          { value: "Website", label: "🌐 Website" },
                        ]}
                        buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                      />

                      {leadSource === "Referral" && (
                        <div style={{ marginTop: 8 }}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                            Referred By (Person Name / Contact) <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="text"
                            name="referredBy"
                            className="form-input"
                            placeholder="e.g. Dr. Mansoor, Eng. Ahmed, Care Medical"
                            value={leadReferredBy}
                            onChange={(e) => setLeadReferredBy(e.target.value)}
                            required
                            autoFocus
                            style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Requirement & Deal Pipeline */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          backgroundColor: "#e0f2fe",
                          color: "#004d66",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        2
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#0f172a" }}>
                        Requirement & Deal Pipeline
                      </span>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                        Enquiry Type <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div data-mobile-grid="stack"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 4,
                          background: "#f1f5f9",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: 3,
                          height: 38,
                          boxSizing: "border-box",
                        }}
                      >
                        {(["Sales", "Service"] as const).map((type) => {
                          const active = enquiryType === type;
                          const Icon = type === "Sales" ? Package : Wrench;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setEnquiryType(type);
                                if (type === "Service") {
                                  setLeadQuantity(1);
                                  setLeadEstimatedValue("");
                                } else {
                                  const prod = activeProductList.find((item) => item.id === selectedProductId);
                                  const q = typeof leadQuantity === "number" && leadQuantity > 0 ? leadQuantity : 1;
                                  setLeadEstimatedValue(prod ? (prod.sellingPrice || 45000) * q : leadEstimatedValue !== "" ? leadEstimatedValue : 45000);
                                }
                              }}
                              style={{
                                border: "none",
                                background: active ? "#ffffff" : "transparent",
                                color: active ? "#004d66" : "#64748b",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: active ? 700 : 500,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                boxShadow: active ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Icon size={13} strokeWidth={active ? 2.4 : 2} />
                              <span>{type}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {enquiryType === "Sales" ? (
                      <>
                        {/* Category Dropdown (connected to Products Catalog) */}
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                            Equipment Category (from Products) <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <CustomLightSelect
                            value={selectedCategory}
                            onChange={(val) => handleCategoryChange(val)}
                            options={availableCategories.map((cat) => ({
                              value: cat,
                              label: cat,
                            }))}
                            searchable
                            placeholder="Select Category..."
                            buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                          />
                        </div>

                        {/* Connected Product Model Dropdown */}
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                            Product / Equipment Model <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <CustomLightSelect
                            value={selectedProductId}
                            onChange={(val) => handleProductSelectChange(val)}
                            placeholder="Select Product Model..."
                            searchable
                            clearable={true}
                            options={[
                              ...activeProductList
                                .filter((p) => !selectedCategory || p.category === selectedCategory)
                                .map((p) => ({
                                  value: p.id,
                                  label: p.name,
                                  subtext: `${p.category ? p.category + " • " : ""}${p.brand ? p.brand + " • " : ""}${formatCurrency(p.sellingPrice || 0)}`,
                                })),
                              {
                                value: "CUSTOM",
                                label: customProductName ? `Custom: ${customProductName}` : "+ Custom / Other Specification...",
                              },
                            ]}
                            onAddNew={() => {
                              setSelectedProductId("CUSTOM");
                              setCustomProductName("");
                            }}
                            addNewLabel="Add Custom Equipment Model..."
                            buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                          />
                        </div>

                        {/* If CUSTOM is selected or custom product name exists, display editable text field */}
                        {(selectedProductId === "CUSTOM" || (!selectedProductId && customProductName)) && (
                          <div style={{ marginTop: 6 }}>
                            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#0f766e", marginBottom: 4 }}>
                              Custom Equipment Specification:
                            </label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. ICU Equipment, Diagnostic Penlight, Syringe Pump..."
                                value={customProductName}
                                onChange={(e) => setCustomProductName(e.target.value)}
                                style={{ fontSize: 13, height: 38, borderRadius: 8, flex: 1 }}
                              />
                              {customProductName && (
                                <button
                                  type="button"
                                  onClick={() => setCustomProductName("")}
                                  style={{
                                    padding: "0 12px",
                                    fontSize: 12,
                                    border: "1px solid #cbd5e1",
                                    backgroundColor: "#f8fafc",
                                    borderRadius: 8,
                                    color: "#64748b",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                  }}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Service Requirement <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <CustomLightSelect
                          value={selectedServiceType}
                          onChange={(val) => {
                            setSelectedServiceType(val);
                            if (val !== "CUSTOM") {
                              setCustomServiceName("");
                            }
                          }}
                          options={[
                            ...serviceRequirementsList.map((service) => ({
                              value: service,
                              label: service,
                            })),
                            {
                              value: "CUSTOM",
                              label: "+ Other / Custom Service...",
                            },
                          ]}
                          onAddNew={() => {
                            setSelectedServiceType("CUSTOM");
                            setCustomServiceName("");
                          }}
                          addNewLabel="+ Add New Service Option..."
                          placeholder="Select Service Requirement..."
                          searchable
                          buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                        />

                        {selectedServiceType === "CUSTOM" && (
                          <div style={{ marginTop: 8 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                              Specify Custom Service Requirement <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Laser Head Alignment, Decommissioning..."
                                value={customServiceName}
                                onChange={(e) => setCustomServiceName(e.target.value)}
                                required
                                autoFocus
                                style={{ fontSize: 13, height: 38, borderRadius: 8, flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const trimmed = customServiceName.trim();
                                  if (trimmed) {
                                    if (!serviceRequirementsList.includes(trimmed)) {
                                      setServiceRequirementsList((prev) => [...prev, trimmed]);
                                    }
                                    setSelectedServiceType(trimmed);
                                    setCustomServiceName("");
                                    toast.success(`"${trimmed}" added as Service Requirement`);
                                  }
                                }}
                                disabled={!customServiceName.trim()}
                                style={{
                                  padding: "0 14px",
                                  backgroundColor: customServiceName.trim() ? "#004d66" : "#cbd5e1",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: customServiceName.trim() ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                  height: 38,
                                }}
                              >
                                Add to Options
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {enquiryType === "Sales" ? (
                      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                            Quantity
                          </label>
                          <input
                            name="quantity"
                            type="number"
                            min={1}
                            value={leadQuantity}
                            placeholder="1"
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            onFocus={(e) => {
                              if (e.target.value === "1") {
                                e.target.select();
                              }
                            }}
                            className="form-input"
                            style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                            Estimated Value (AED)
                          </label>
                          <div style={{ position: "relative" }}>
                            <span
                              style={{
                                position: "absolute",
                                left: 11,
                                top: "50%",
                                transform: "translateY(-50%)",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#94a3b8",
                                pointerEvents: "none",
                              }}
                            >
                              AED
                            </span>
                            <input
                              name="estimatedValue"
                              type="number"
                              step={500}
                              value={leadEstimatedValue}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  setLeadEstimatedValue("");
                                } else {
                                  const parsed = parseFloat(val);
                                  setLeadEstimatedValue(isNaN(parsed) ? "" : parsed);
                                }
                              }}
                              onFocus={(e) => {
                                if (e.target.value === "0") {
                                  e.target.select();
                                }
                              }}
                              className="form-input"
                              style={{ fontSize: 13, height: 38, borderRadius: 8, paddingLeft: 42 }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Estimated Service Value (AED)
                        </label>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 11,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#94a3b8",
                              pointerEvents: "none",
                            }}
                          >
                            AED
                          </span>
                          <input
                            name="estimatedValue"
                            type="number"
                            step={500}
                            value={leadEstimatedValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setLeadEstimatedValue("");
                              } else {
                                const parsed = parseFloat(val);
                                setLeadEstimatedValue(isNaN(parsed) ? "" : parsed);
                              }
                            }}
                            onFocus={(e) => {
                              if (e.target.value === "0") {
                                e.target.select();
                              }
                            }}
                            placeholder="Optional"
                            className="form-input"
                            style={{ fontSize: 13, height: 38, borderRadius: 8, paddingLeft: 42 }}
                          />
                        </div>
                      </div>
                    )}

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Initial Stage
                        </label>
                        <CustomLightSelect
                          value={leadStage}
                          onChange={(val) => setLeadStage(val as PipelineStage)}
                          options={STAGES.map((s) => ({ value: s, label: s }))}
                          buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Priority
                        </label>
                        <CustomLightSelect
                          value={leadPriority}
                          onChange={(val) => setLeadPriority(val as any)}
                          options={[
                            { value: "Low", label: "🟢 Low" },
                            { value: "Medium", label: "🟡 Medium" },
                            { value: "High", label: "🟠 High" },
                            { value: "Critical", label: "🔴 Critical" },
                          ]}
                          buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                        />
                      </div>
                    </div>

                    <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Assigned Sales Rep
                        </label>
                        <CustomLightSelect
                          value={leadAssignedTo}
                          onChange={(val) => setLeadAssignedTo(val)}
                          options={employeeList.map((e) => ({
                            value: e.name,
                            label: e.name,
                            subtext: e.department && e.role ? `${e.department} • ${e.role}` : (e.department || e.role),
                          }))}
                          searchable
                          dropUp
                          buttonStyle={{ height: 38, fontSize: 13, width: "100%", borderRadius: 8 }}
                          menuStyle={{ maxHeight: 220 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                          Next Follow-Up Date
                        </label>
                        <input
                          name="nextFollowUp"
                          type="date"
                          value={leadFollowUp}
                          onChange={(e) => setLeadFollowUp(e.target.value)}
                          className="form-input"
                          style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full-width Notes / Requirements section */}
                <div style={{ paddingTop: 4, borderTop: "1px solid #f1f5f9" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                    Notes / Department Details
                  </label>
                  <input
                    name="notes"
                    type="text"
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    className="form-input"
                    placeholder="e.g. For new 12-bed surgical ICU expansion, urgent demo requested..."
                    style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Minimal Docked Footer */}
              <div
                style={{
                  padding: "16px 28px",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#fafbfc",
                }}
              >
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  <span style={{ color: "#ef4444" }}>*</span> Required fields
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingLeadId(null);
                    }}
                    style={{
                      height: 38,
                      padding: "0 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#475569",
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      height: 38,
                      padding: "0 22px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#ffffff",
                      backgroundColor: "#004d66",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0, 77, 102, 0.2)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#003b4e")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#004d66")}
                  >
                    {editingLeadId ? "Save Changes" : "Create Lead"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD PRODUCT POPUP MODAL ================= */}
      {showAddProductModal && (
        <AddProductModal
          initialName={prodFormName}
          initialCategory={prodFormCategory}
          onClose={() => setShowAddProductModal(false)}
          onProductCreated={(newProd) => {
            setAvailableProducts((prev) => [newProd, ...prev]);

            // If added from Quotation Forwarded modal's Quoted Products row
            if (targetQuoteProductIdx !== null && targetQuoteProductIdx < quoteProducts.length) {
              const updated = quoteProducts.map((item, i) =>
                i === targetQuoteProductIdx
                  ? { ...item, product: newProd.name, price: newProd.sellingPrice || item.price }
                  : item
              );
              setQuoteProducts(updated);
              const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
              if (sum > 0) setEnteredQuoteAmount(sum);
              setTargetQuoteProductIdx(null);
            } else if (targetQuoteProductIdx !== null && targetQuoteProductIdx >= quoteProducts.length) {
              const newRow = {
                id: `qp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                product: newProd.name,
                price: newProd.sellingPrice || 0,
              };
              const updated = [...quoteProducts, newRow];
              setQuoteProducts(updated);
              const sum = updated.reduce((s, p) => s + (p.price || 0), 0);
              if (sum > 0) setEnteredQuoteAmount(sum);
              setTargetQuoteProductIdx(null);
            } else {
              setSelectedCategory(newProd.category);
              setSelectedProductId(newProd.id);
              setCustomProductName(newProd.name);
              if (newProd.sellingPrice > 0) {
                const q = typeof leadQuantity === "number" && leadQuantity > 0 ? leadQuantity : 1;
                setLeadEstimatedValue(newProd.sellingPrice * q);
              }
            }
            setShowAddProductModal(false);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* ADD ORGANISATION / HEALTHCARE FACILITY MODAL POPUP                        */}
      {/* ========================================================================= */}
      {showAddOrgModal && (
        <ClientModal
          mode="create"
          onClose={() => setShowAddOrgModal(false)}
          onSave={async (data) => {
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
              source: data.source || leadSource || "Direct Enquiry",
              connectedAs: data.connectedAs || [],
              assignedTo: leadAssignedTo || "Riyas",
              createdAt: new Date().toISOString().slice(0, 10),
              createdBy: currentUser.name || "User not recorded",
              createdById: (currentUser as { id?: string }).id,
              totalRevenue: 0,
              contacts: data.contacts?.map((contact) => ({
                ...contact,
                createdAt: contact.createdAt || new Date().toISOString(),
                createdBy: contact.createdBy || currentUser.name || "User not recorded",
                createdById: contact.createdById || (currentUser as { id?: string }).id,
              })) || (data.repName ? [{
                id: `ct-${Date.now()}`,
                clientId: newClientId,
                name: data.repName,
                designation: data.repRole || "Procurement Lead",
                department: "Purchase",
                phone: data.repPhone || primaryPhone,
                whatsapp: data.repPhone || primaryPhone,
                email: data.repEmail || primaryEmail,
                lastContacted: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                createdBy: currentUser.name || "User not recorded",
                createdById: (currentUser as { id?: string }).id,
              }] : []),
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
            setClientRegistry(updated);

            try {
              fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newClient),
              }).catch(() => {});
            } catch (err) {}

            // Auto-select newly created organisation in Lead modal
            setSelectedClientId(newClientId);
            setCustomClientName(newClient.name);
            const rep = newClient.contacts[0];
            if (rep?.name) setLeadContactName(rep.name);
            if (rep?.phone || primaryPhone) setLeadPhone(rep?.phone || primaryPhone);
            if (rep?.email || primaryEmail) setLeadEmail(rep?.email || primaryEmail);

            toast.success(`Organisation "${newClient.name}" added and selected!`);
            setShowAddOrgModal(false);
          }}
          orgTypes={facilityTypes}
          onAddType={(newType) => {
            if (!facilityTypes.includes(newType)) {
              setFacilityTypes((prev) => [...prev, newType]);
            }
          }}
          places={INITIAL_PLACES}
        />
      )}

      {/* ========================================================================= */}
      {/* ADD DOCTOR / PERSON CONTACT MODAL POPUP                                  */}
      {/* ========================================================================= */}
      {showAddPersonModal && (
        <AddPersonModal
          clients={clientRegistry}
          departments={INITIAL_DEPARTMENTS}
          onClose={() => setShowAddPersonModal(false)}
          preselectedClientId={selectedClientId}
          initialName={leadContactName}
          initialPhone={leadPhone}
          initialEmail={leadEmail}
          onSave={(personData) => {
            const newPerson = addStandalonePerson({
              ...personData,
              clientId: personData.clientId || selectedClientId || undefined,
            });

            // If an organisation is linked, make sure it's selected in the lead
            if (personData.clientId) {
              setSelectedClientId(personData.clientId);
              const foundClient = clientRegistry.find((c) => c.id === personData.clientId);
              if (foundClient) setCustomClientName(foundClient.name);
            }
            if (newPerson.name) setLeadContactName(newPerson.name);
            if (newPerson.phone) setLeadPhone(newPerson.phone);
            if (newPerson.email) setLeadEmail(newPerson.email);

            setPeopleRegistry(getStoredPeople());
            toast.success(`Person "${newPerson.name}" added and selected!`);
            setShowAddPersonModal(false);
          }}
        />
      )}

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}
