"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Client, OrgType, ClientStatus, ContactPerson, Department, LeadSource } from "@/types";
import { persistSharedDataset } from "@/lib/shared-data-client";
import CustomLightSelect from "@/components/CustomLightSelect";
import toast from "react-hot-toast";
import {
  Building2,
  Users,
  Phone,
  Mail,
  MapPin,
  Plus,
  X,
  ChevronDown,
  Camera,
  FileText,
  Globe,
  Trash2,
  Check,
} from "lucide-react";

export const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export const INITIAL_PLACES = [
  "Dubai Healthcare City (DHCC)",
  "Al Maryah Island",
  "Oud Metha",
  "Mohammed Bin Zayed City",
  "Al Mafraq",
  "Dubai Hills Estate",
  "Al Garhoud",
  "Al Barsha",
  "Deira",
  "Jumeirah",
  "Business Bay",
  "Downtown Dubai",
  "Khalifa City",
  "Al Nahda",
  "University City",
  "Al Jurf",
  "Al Qusaidat",
  "Al Faseel",
  "Al Salamah",
];

export const DEFAULT_ORG_TYPES = [
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

const CONNECTION_TYPES_STORAGE_KEY = "fastonmed_connection_types_v1";
const DEFAULT_CONNECTION_TYPES = ["Sales", "Service", "Trader"];

export function getStoredConnectionTypes(): string[] {
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

export function saveStoredConnectionTypes(types: string[]): string[] {
  const cleaned = Array.from(new Set(types.map((item) => item.trim()).filter(Boolean)));
  if (typeof window !== "undefined") {
    localStorage.setItem(CONNECTION_TYPES_STORAGE_KEY, JSON.stringify(cleaned));
    void persistSharedDataset("connection-types", cleaned).catch(() => {});
  }
  return cleaned;
}

export interface ClientModalProps {
  mode?: "create" | "edit";
  clientToEdit?: Client | null;
  onClose: () => void;
  onSave: (d: Partial<Client> & { repName?: string; repRole?: string; repPhone?: string; repEmail?: string }) => void | Promise<void>;
  orgTypes?: string[];
  onAddType?: (newType: string) => void;
  places?: string[];
  onAddPlace?: (newPlace: string) => void;
  zIndex?: number;
}

export default function ClientModal({
  mode = "create",
  clientToEdit,
  onClose,
  onSave,
  orgTypes = DEFAULT_ORG_TYPES,
  onAddType,
  places = INITIAL_PLACES,
  onAddPlace,
  zIndex = 1000,
}: ClientModalProps) {
  const isEdit = mode === "edit" && !!clientToEdit;

  const [localOrgTypes, setLocalOrgTypes] = useState<string[]>(orgTypes);
  const [localPlaces, setLocalPlaces] = useState<string[]>(places);

  useEffect(() => {
    setLocalOrgTypes(orgTypes);
  }, [orgTypes]);

  useEffect(() => {
    setLocalPlaces(places);
  }, [places]);

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
    source: (clientToEdit?.source || "Direct Enquiry") as LeadSource,
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
  const placeToEmirateMap: Record<string, string> = {
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
      toast.error("Please enter an area/district name");
      return;
    }
    if (onAddPlace) {
      onAddPlace(trimmed);
    }
    setLocalPlaces((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
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

  const handleCreateType = (customName?: string) => {
    const trimmed = (customName !== undefined ? customName : newTypeName).trim();
    if (!trimmed) {
      toast.error("Please enter a type name");
      return;
    }
    if (onAddType) {
      onAddType(trimmed);
    }
    setLocalOrgTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
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
    if (!connectionTypes.includes(trimmed)) {
      const updated = [...connectionTypes, trimmed];
      setConnectionTypes(updated);
      saveStoredConnectionTypes(updated);
    }
    if (!form.connectedAs.includes(trimmed)) {
      setForm((prev) => ({ ...prev, connectedAs: [...prev.connectedAs, trimmed] }));
    }
    setIsAddingConnectionType(false);
    setNewConnectionType("");
    toast.success(`"${trimmed}" added to connection types!`);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const facilityName = form.name.trim();
    if (!facilityName) {
      toast.error("Please enter Organisation / Hospital Name");
      return;
    }

    const trimmedCity = form.city.trim() || "Dubai Healthcare City (DHCC)";
    const trimmedState = form.state || "Dubai";
    const fullAddress = form.address.trim() || `${trimmedCity}, ${trimmedState}`;

    const orgPhone = form.phone.trim();
    const secondPhone = extraPhone.trim();
    const allPhones = [orgPhone, secondPhone].filter(Boolean);

    const orgEmail = form.email.trim();
    const secondEmail = extraEmail.trim();
    const allEmails = [orgEmail, secondEmail].filter(Boolean);

    const validContacts = contacts.filter(
      (c) => c.name.trim() || c.phone.trim() || c.email.trim()
    );
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
    <div className="directory-editor-overlay client-form-overlay" data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 25, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: zIndex,
        padding: "20px 16px",
      }}
      onClick={onClose}
    >
      <div
        className="card directory-editor directory-organisation-editor client-form-dialog"
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
        <div className="directory-editor-header client-form-header"
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
                <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  {isEdit ? "Edit organisation" : "Add Organisation"}
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
                Add the organisation details and its main contact.
              </p>
            </div>
          </div>

          <button
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
        <div className="directory-editor-body client-form-body" data-mobile-grid="stack"
          style={{
            padding: "22px 26px 26px 26px",
            overflowY: "auto",
            flex: "1 1 auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 22,
            backgroundColor: "#f8fafc",
          }}
        >
          {/* COLUMN 1: Facility Identification & Geographic Location */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Card 1: Facility Identification & Brand */}
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
                <Building2 size={14} color="#006680" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#006680", textTransform: "uppercase" }}>
                  Facility Identification & Brand
                </span>
              </div>

              {/* Logo / Photo Upload + Hospital Name in balanced flex */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* Photo Upload Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 10,
                    border: "1.5px dashed #cbd5e1",
                    backgroundColor: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
                  title="Click to upload logo or building photo"
                >
                  {photo ? (
                    <>
                      <img src={photo} alt="Facility Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: "rgba(0,0,0,0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 0.15s",
                        }}
                        className="hover:opacity-100"
                      >
                        <Camera size={16} color="#ffffff" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={20} color="#94a3b8" />
                      <span style={{ fontSize: 9.5, color: "#64748b", fontWeight: 600, marginTop: 3 }}>LOGO</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handlePhotoUpload}
                  />
                </div>

                {/* Organisation Name Input */}
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
                    style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Type & Operational Status */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Facility Type */}
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
                        onClick={() => handleCreateType()}
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
                      options={localOrgTypes.map((o) => ({ value: o, label: o }))}
                      onChange={(val) => setForm({ ...form, orgType: val as OrgType })}
                      onAddNew={(query) => {
                        if (query) {
                          handleCreateType(query);
                        } else {
                          setIsAddingType(true);
                        }
                      }}
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
                  <div style={{ position: "relative" }}>
                    <Phone size={13} style={{ position: "absolute", left: 10, top: 12, color: "#94a3b8" }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +971 4 123 4567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ paddingLeft: 30, fontSize: 12, height: 38, borderRadius: 8 }}
                    />
                  </div>
                  {showExtraPhone && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Secondary phone / tel..."
                        value={extraPhone}
                        onChange={(e) => setExtraPhone(e.target.value)}
                        style={{ fontSize: 11.5, height: 32, borderRadius: 6, flex: 1 }}
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
                          padding: "0 4px",
                        }}
                        title="Remove secondary phone"
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
                  <div style={{ position: "relative" }}>
                    <Mail size={13} style={{ position: "absolute", left: 10, top: 12, color: "#94a3b8" }} />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. info@facility.ae"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ paddingLeft: 30, fontSize: 12, height: 38, borderRadius: 8 }}
                    />
                  </div>
                  {showExtraEmail && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="Secondary email..."
                        value={extraEmail}
                        onChange={(e) => setExtraEmail(e.target.value)}
                        style={{ fontSize: 11.5, height: 32, borderRadius: 6, flex: 1 }}
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
                          padding: "0 4px",
                        }}
                        title="Remove secondary email"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected To Us By (Custom Multi-select Tags) */}
              <div style={{ position: "relative" }} ref={connectionDropdownRef}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                    Connected To Us By
                  </label>
                  {!isAddingConnectionType && (
                    <button
                      type="button"
                      onClick={() => setIsAddingConnectionType(true)}
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

                {isAddingConnectionType && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
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
                      style={{ flex: 1, fontSize: 12, height: 34, borderRadius: 6 }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateConnectionType}
                      className="btn btn-primary"
                      style={{ height: 34, padding: "0 8px", fontSize: 11, backgroundColor: "#004d66", borderRadius: 6 }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingConnectionType(false);
                        setNewConnectionType("");
                      }}
                      style={{
                        height: 34,
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
                )}

                <button
                  type="button"
                  onClick={() => setIsConnectionDropdownOpen((prev) => !prev)}
                  className="form-input"
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
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Geographic Location & TRN */}
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
                  Geographic Location & TRN
                </span>
              </div>

              {/* Emirate & Area/District */}
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
                      options={localPlaces.map((place) => ({ value: place, label: place }))}
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

              {/* Full Street Address */}
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
                    Key Stakeholders ({contacts.length})
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
                >
                  <Plus size={11} strokeWidth={2.5} />
                  <span>Add Person</span>
                </button>
              </div>

              {/* Stakeholder Person Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 290, overflowY: "auto" }}>
                {contacts.map((contact, idx) => (
                  <div
                    key={contact.id}
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: 8,
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          backgroundColor: idx === 0 ? "#ccfbf1" : "#e2e8f0",
                          color: idx === 0 ? "#0f766e" : "#475569",
                        }}
                      >
                        {idx === 0 ? "PRIMARY CONTACT" : `STAKEHOLDER #${idx + 1}`}
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
                            padding: 2,
                          }}
                          title="Remove stakeholder"
                        >
                          <Trash2 size={12} />
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

            {/* Card 4: Internal Notes & Remarks */}
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
                  Internal Facility Notes & Remarks
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
        <div className="directory-editor-footer client-form-footer"
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
              onClick={() => handleSubmit()}
            >
              <Building2 size={15} />
              <span>{isEdit ? "Save Changes" : "Save organisation"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
