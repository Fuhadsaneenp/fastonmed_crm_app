"use client";

import { useState, useEffect, useRef } from "react";
import DirectoryPagination from "@/components/DirectoryPagination";
import Link from "next/link";
import { formatCurrency, getInitials, getStatusColor } from "@/lib/utils";
import type { ContactPerson, Client, Department, ContactStatus, Lead, PipelineStage } from "@/types";
import {
  getStoredClients,
  getStoredPeople,
  saveStoredPeople,
  updatePerson,
  transferPersonOrganisation,
  addStandalonePerson,
  deleteStoredPerson,
  getStoredLeads,
  saveStoredLeads,
  syncLiveClientsFromApi,
  getStoredDepartments,
  saveStoredDepartments,
  INITIAL_DEPARTMENTS,
} from "@/lib/client-store";
import toast from "react-hot-toast";
import FacilityPicker from "@/components/FacilityPicker";
import AddPersonModal from "@/components/AddPersonModal";
import {
  Search,
  Briefcase,
  Building2,
  UserCheck,
  RotateCcw,
  LayoutGrid,
  List,
  Plus,
  X,
  Eye,
  Pencil,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  ExternalLink,
  Calendar,
  MapPin,
  Building,
  User,
  Clock,
  FileText,
  ArrowUpRight,
  History,
  Package,
  Check,
  Camera,
  Upload,
} from "lucide-react";

const DEPARTMENTS: Department[] = [
  "Biomedical Engineering",
  "Purchase",
  "Doctor",
  "Administration",
  "Management",
  "Finance",
  "IT",
];

export default function PeoplePage() {
  const [people, setPeople] = useState<ContactPerson[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Search and Filter State
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterOrg, setFilterOrg] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [view, setView] = useState<"list" | "grid">("list");

  // Modals
  const [selectedPerson, setSelectedPerson] = useState<ContactPerson | null>(null);
  const [mobilePeopleFilters, setMobilePeopleFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ContactPerson | null>(null);
  const [transferringPerson, setTransferringPerson] = useState<ContactPerson | null>(null);

  // Departments State (User extensible)
  const [departments, setDepartments] = useState<string[]>(() => getStoredDepartments());

  const handleAddDepartment = (newDept: string) => {
    const trimmed = newDept.trim();
    if (!trimmed) return;
    if (!departments.includes(trimmed)) {
      const updated = [...departments, trimmed];
      setDepartments(updated);
      saveStoredDepartments(updated);
      toast.success(`Department "${trimmed}" added!`);
    }
  };

  const loadData = async () => {
    setPeople(getStoredPeople());
    setClients(getStoredClients());
    setLeads(getStoredLeads());
    setDepartments(getStoredDepartments());

    try {
      const live = await syncLiveClientsFromApi();
      if (live && live.length > 0) {
        setClients(live);
      }
    } catch (e) {
      console.warn("Could not sync live clients in PeoplePage:", e);
    }
  };

  useEffect(() => {
    loadData();

    const handlePeopleUpdate = () => setPeople(getStoredPeople());
    const handleClientsUpdate = () => {
      setClients(getStoredClients());
      setPeople(getStoredPeople());
    };
    const handleLeadsUpdate = () => setLeads(getStoredLeads());
    const handleDeptSync = () => setDepartments(getStoredDepartments());

    window.addEventListener("fastonmed_people_updated", handlePeopleUpdate);
    window.addEventListener("fastonmed_clients_updated", handleClientsUpdate);
    window.addEventListener("fastonmed_leads_updated", handleLeadsUpdate);
    window.addEventListener("fastonmed_departments_updated", handleDeptSync);

    return () => {
      window.removeEventListener("fastonmed_people_updated", handlePeopleUpdate);
      window.removeEventListener("fastonmed_clients_updated", handleClientsUpdate);
      window.removeEventListener("fastonmed_leads_updated", handleLeadsUpdate);
      window.removeEventListener("fastonmed_departments_updated", handleDeptSync);
    };
  }, []);

  const handleDeletePerson = (person: ContactPerson) => {
    if (window.confirm(`Are you sure you want to delete ${person.name}? This will remove them from the FastonMed directory.`)) {
      deleteStoredPerson(person.id);
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      if (selectedPerson?.id === person.id) setSelectedPerson(null);
      if (editingPerson?.id === person.id) setEditingPerson(null);
      toast.success(`Removed ${person.name} from directory`);
    }
  };

  const directoryFilterKey = JSON.stringify([search, filterDept, filterOrg, filterStatus]);
  const [directoryPaging, setDirectoryPaging] = useState({ page: 1, filterKey: "" });
  const directoryPage = directoryPaging.filterKey === directoryFilterKey ? directoryPaging.page : 1;
  const setDirectoryPage = (page: number) => setDirectoryPaging({ page, filterKey: directoryFilterKey });

  const filtered = people.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.clientName && p.clientName.toLowerCase().includes(q)) ||
      (p.linkedin && p.linkedin.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q));

    const matchDept = filterDept === "All" || p.department === filterDept;
    const matchOrg =
      filterOrg === "All"
        ? true
        : filterOrg === "Independent"
        ? !p.clientId
        : p.clientId === filterOrg;
    const matchStatus = filterStatus === "All" || p.status === filterStatus;

    return matchSearch && matchDept && matchOrg && matchStatus;
  });
  const visiblePage = Math.min(directoryPage, Math.max(1, Math.ceil(filtered.length / 20)));
  const paginated = filtered.slice((visiblePage - 1) * 20, visiblePage * 20);


  const getCleanWhatsAppUrl = (whatsappOrPhone: string) => {
    const cleaned = whatsappOrPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleaned}`;
  };

  const getCleanLinkedInUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  };

  const isFiltered = Boolean(search.trim() || filterDept !== "All" || filterOrg !== "All" || filterStatus !== "All");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease" }}>
      {/* Modern Filter Toolbar */}
      <div
        className={`card people-mobile-toolbar ${mobilePeopleFilters ? "people-filters-open" : ""}`}
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: "1 1 auto", minWidth: 0 }}>
          {/* Search Box */}
          <div
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
              placeholder="Search name, hospital, phone, email..."
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

          {/* Department Filter */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <Briefcase size={13} style={{ position: "absolute", left: 10, color: filterDept !== "All" ? "#004d66" : "#64748b", pointerEvents: "none" }} />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                height: 36,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: 12.5,
                borderRadius: 8,
                border: `1px solid ${filterDept !== "All" ? "#004d66" : "#cbd5e1"}`,
                background: filterDept !== "All" ? "#f0fdfa" : "#ffffff",
                color: filterDept !== "All" ? "#004d66" : "#334155",
                fontWeight: filterDept !== "All" ? 600 : 500,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Facility Filter */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <Building2 size={13} style={{ position: "absolute", left: 10, color: filterOrg !== "All" ? "#004d66" : "#64748b", pointerEvents: "none" }} />
            <select
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
              style={{
                height: 36,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: 12.5,
                borderRadius: 8,
                border: `1px solid ${filterOrg !== "All" ? "#004d66" : "#cbd5e1"}`,
                background: filterOrg !== "All" ? "#f0fdfa" : "#ffffff",
                color: filterOrg !== "All" ? "#004d66" : "#334155",
                fontWeight: filterOrg !== "All" ? 600 : 500,
                cursor: "pointer",
                outline: "none",
                maxWidth: 190,
              }}
            >
              <option value="All">All Facilities</option>
              <option value="Independent">Independent / Free Agents</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Mobility Status Filter */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <UserCheck size={13} style={{ position: "absolute", left: 10, color: filterStatus !== "All" ? "#004d66" : "#64748b", pointerEvents: "none" }} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                height: 36,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: 12.5,
                borderRadius: 8,
                border: `1px solid ${filterStatus !== "All" ? "#004d66" : "#cbd5e1"}`,
                background: filterStatus !== "All" ? "#f0fdfa" : "#ffffff",
                color: filterStatus !== "All" ? "#004d66" : "#334155",
                fontWeight: filterStatus !== "All" ? 600 : 500,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="All">All Mobility Statuses</option>
              <option value="Active at Organisation">Active at Facility</option>
              <option value="Changed Organisation">Changed Facility</option>
              <option value="Independent / Consultant">Independent Consultant</option>
            </select>
          </div>

          {/* Reset Filters Action */}
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterDept("All");
                setFilterOrg("All");
                setFilterStatus("All");
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
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                color: "#64748b",
                cursor: "pointer",
              }}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        <button className="people-mobile-filter-toggle" type="button" aria-expanded={mobilePeopleFilters} onClick={() => setMobilePeopleFilters(value => !value)}>{mobilePeopleFilters ? "Close filters" : "Filters"}</button>
        {/* Right: Count Badge, View Switcher & Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* People Count Badge */}
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
            <span>{people.length} People</span>
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
            <span>Add Person</span>
          </button>
        </div>
      </div>

      {/* Directory Content: List vs Grid */}
      {view === "list" ? (
        <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div className="table-container" style={{ border: "none", overflowX: "auto" }}>
            <table className="people-mobile-list" data-mobile-cards="true" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #e2e8f0" }}>
                    Person / Role
                  </th>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #e2e8f0" }}>
                    Organisation
                  </th>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #e2e8f0" }}>
                    Department
                  </th>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #e2e8f0" }}>
                    Direct Contact
                  </th>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #e2e8f0" }}>
                    Status
                  </th>
                  <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((person) => {
                  const initials = getInitials(person.name);
                  const whatsappTarget = person.whatsapp || person.phone;
                  const isHospital = person.clientName?.toLowerCase().includes("hospital");
                  const isClinic = person.clientName?.toLowerCase().includes("clinic") || person.clientName?.toLowerCase().includes("center");
                  
                  // Minimal, calm styling without jarring red/pink boxes
                  const orgStyle = isHospital
                    ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", iconColor: "#16a34a" }
                    : isClinic
                    ? { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd", iconColor: "#0284c7" }
                    : person.clientName
                    ? { bg: "#f8fafc", text: "#334155", border: "#e2e8f0", iconColor: "#64748b" }
                    : { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", iconColor: "#94a3b8" };

                  return (
                    <tr
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.12s ease",
                      }}
                      className="hover:bg-slate-50/70"
                      title={`Click to view complete details for ${person.name}`}
                    >
                      {/* Person / Role */}
                      <td data-label="Person / Role" style={{ padding: "9px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "#eaf8f4",
                              color: "#004d66",
                              fontWeight: 700,
                              fontSize: 10.5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              overflow: "hidden",
                              border: "1px solid rgba(0, 77, 102, 0.12)",
                            }}
                          >
                            {person.photo || person.avatar ? (
                              <img
                                src={person.photo || person.avatar}
                                alt={person.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {person.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {person.designation || "Healthcare Specialist"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Organisation */}
                      <td data-label="Organisation" style={{ padding: "9px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                        {person.clientId ? (
                          <Link
                            href="/clients"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 500,
                              backgroundColor: orgStyle.bg,
                              color: orgStyle.text,
                              border: `1px solid ${orgStyle.border}`,
                              textDecoration: "none",
                              maxWidth: 320,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              transition: "all 0.12s ease",
                            }}
                            title={person.clientName}
                          >
                            <Building2 size={11} style={{ color: orgStyle.iconColor, flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {person.clientName}
                            </span>
                          </Link>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 7px",
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: 500,
                              backgroundColor: "#f8fafc",
                              color: "#64748b",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            Independent
                          </span>
                        )}
                      </td>

                      {/* Department */}
                      <td data-label="Department" style={{ padding: "9px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor: "#f8fafc",
                            color: "#475569",
                            border: "1px solid #e2e8f0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {person.department}
                        </span>
                      </td>

                      {/* Direct Contact */}
                      <td data-label="Direct Contact" style={{ padding: "9px 14px", verticalAlign: "middle", whiteSpace: "nowrap", borderRight: "1px solid #f1f5f9" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <a
                            href={`tel:${person.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: 11.5,
                              color: "#334155",
                              textDecoration: "none",
                              fontWeight: 500,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {person.phone}
                          </a>

                          {whatsappTarget && (
                            <a
                              href={getCleanWhatsAppUrl(whatsappTarget)}
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 10.5,
                                color: "#15803d",
                                backgroundColor: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                padding: "2px 6px",
                                borderRadius: 4,
                                textDecoration: "none",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                              title={`Open WhatsApp chat with ${person.name}`}
                            >
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td data-label="Status" style={{ padding: "9px 14px", verticalAlign: "middle", borderRight: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor:
                              person.status === "Active at Organisation"
                                ? "#ecfdf5"
                                : person.status === "Changed Organisation"
                                ? "#fffbeb"
                                : "#f8fafc",
                            color:
                              person.status === "Active at Organisation"
                                ? "#059669"
                                : person.status === "Changed Organisation"
                                ? "#b45309"
                                : "#64748b",
                            border: `1px solid ${
                              person.status === "Active at Organisation"
                                ? "#a7f3d0"
                                : person.status === "Changed Organisation"
                                ? "#fde68a"
                                : "#e2e8f0"
                            }`,
                          }}
                        >
                          <span
                            style={{
                              width: 5.5,
                              height: 5.5,
                              borderRadius: "50%",
                              backgroundColor:
                                person.status === "Active at Organisation"
                                  ? "#10b981"
                                  : person.status === "Changed Organisation"
                                  ? "#f59e0b"
                                  : "#94a3b8",
                            }}
                          />
                          {person.status === "Active at Organisation"
                            ? "Active"
                            : person.status === "Changed Organisation"
                            ? "Changed Org"
                            : "Independent"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" style={{ padding: "9px 14px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPerson(person);
                            }}
                            title={`View ${person.name} profile`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                              color: "#004d66",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#eaf8f4";
                              e.currentTarget.style.borderColor = "#99f6e4";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#ffffff";
                              e.currentTarget.style.borderColor = "#e2e8f0";
                            }}
                          >
                            <Eye size={12.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPerson(person);
                            }}
                            title={`Edit ${person.name}`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                              color: "#475569",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.borderColor = "#cbd5e1";
                              e.currentTarget.style.color = "#0f172a";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#ffffff";
                              e.currentTarget.style.borderColor = "#e2e8f0";
                              e.currentTarget.style.color = "#475569";
                            }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePerson(person);
                            }}
                            title={`Delete ${person.name}`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              border: "1px solid #fee2e2",
                              background: "#ffffff",
                              color: "#ef4444",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#fef2f2";
                              e.currentTarget.style.borderColor = "#fca5a5";
                              e.currentTarget.style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#ffffff";
                              e.currentTarget.style.borderColor = "#fee2e2";
                              e.currentTarget.style.color = "#ef4444";
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "#94a3b8" }}>
                      No healthcare contacts found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
          {paginated.map((person) => {
            const initials = getInitials(person.name);
            const whatsappTarget = person.whatsapp || person.phone;

            return (
              <div
                key={person.id}
                className="card"
                onClick={() => setSelectedPerson(person)}
                style={{
                  padding: "20px",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#004d66";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,77,102,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title={`Click to view complete details, products & timeline for ${person.name}`}
              >
                {/* Card Top */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #e0f2fe, #f0fdfa)",
                      color: "#004d66",
                      fontWeight: 700,
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {person.photo || person.avatar ? (
                      <img
                        src={person.photo || person.avatar}
                        alt={person.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      {person.name}
                    </h3>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                      {person.designation}
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        background: "#f0f9ff",
                        color: "#0284c7",
                        border: "1px solid #bae6fd",
                        padding: "1px 6px",
                        borderRadius: 4,
                        display: "inline-block",
                        marginTop: 4,
                      }}
                    >
                      {person.department}
                    </span>
                  </div>
                </div>

                {/* Organisation */}
                <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                    Organisation
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#004d66", marginTop: 2 }}>
                    {person.clientId ? `🏢 ${person.clientName}` : "👤 Independent Consultant"}
                  </div>
                  {person.previousOrganisations && person.previousOrganisations.length > 0 && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      ⏱️ Ex: {person.previousOrganisations[0].organisationName}
                    </div>
                  )}
                </div>

                {/* Direct Reach Buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={`tel:${person.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn btn-secondary"
                    style={{ padding: "5px 10px", fontSize: 11.5, flex: 1, justifyContent: "center" }}
                  >
                    📞 Call
                  </a>

                  {whatsappTarget && (
                    <a
                      href={getCleanWhatsAppUrl(whatsappTarget)}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noreferrer"
                      className="btn"
                      style={{
                        padding: "5px 12px",
                        fontSize: 11.5,
                        flex: 1,
                        justifyContent: "center",
                        backgroundColor: "#d1fae5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                      title="Open WhatsApp Chat"
                    >
                      💬 WhatsApp
                    </a>
                  )}

                  {person.linkedin && (
                    <a
                      href={getCleanLinkedInUrl(person.linkedin)}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noreferrer"
                      className="btn"
                      style={{
                        padding: "5px 10px",
                        fontSize: 11.5,
                        backgroundColor: "#e0f2fe",
                        color: "#0284c7",
                        border: "1px solid #bae6fd",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                      title="Open LinkedIn"
                    >
                      🔗 LinkedIn
                    </a>
                  )}
                </div>

                {/* Actions Footer */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: "auto", display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "4px 12px", fontSize: 12, flex: 1, justifyContent: "center" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPerson(person);
                    }}
                  >
                    ✏️ Edit Profile
                  </button>
                  <button
                    className="btn"
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      backgroundColor: "#fee2e2",
                      color: "#ef4444",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={`Delete ${person.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePerson(person);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DirectoryPagination total={filtered.length} page={visiblePage} onChange={setDirectoryPage} />

      {/* Person Detail & Selling Overview Modal */}
      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          clients={clients}
          leads={leads}
          onClose={() => setSelectedPerson(null)}
          onEdit={() => {
            setEditingPerson(selectedPerson);
            setSelectedPerson(null);
          }}
          onDelete={() => {
            handleDeletePerson(selectedPerson);
          }}
          onUpdatePerson={(updated) => {
            updatePerson(updated);
            setSelectedPerson(updated);
            setPeople(getStoredPeople());
          }}
        />
      )}

      {showAddModal && (
        <AddPersonModal
          clients={clients}
          departments={departments}
          onAddDepartment={handleAddDepartment}
          onClose={() => setShowAddModal(false)}
          onSave={(newP) => {
            addStandalonePerson(newP);
            toast.success(`Contact "${newP.name}" added successfully!`);
            setShowAddModal(false);
          }}
        />
      )}

      {editingPerson && (
        <EditPersonModal
          person={editingPerson}
          clients={clients}
          departments={departments}
          onAddDepartment={handleAddDepartment}
          onClose={() => setEditingPerson(null)}
          onSave={(updated) => {
            updatePerson(updated);
            toast.success(`Profile updated for ${updated.name}`);
            setEditingPerson(null);
          }}
        />
      )}

      {transferringPerson && (
        <TransferPersonModal
          person={transferringPerson}
          clients={clients}
          onClose={() => setTransferringPerson(null)}
          onTransfer={(newClientId, newRole, notes) => {
            transferPersonOrganisation(transferringPerson.id, newClientId, newRole, notes);
            toast.success(`Organisation updated for ${transferringPerson.name}`);
            setTransferringPerson(null);
          }}
        />
      )}
    </div>
  );
}

// ─── PERSON DETAIL MODAL (OVERVIEW, SELLING DETAILS & TIMELINE) ─────────────

function PersonDetailModal({
  person,
  clients,
  leads,
  onClose,
  onEdit,
  onDelete,
  onUpdatePerson,
}: {
  person: ContactPerson;
  clients: Client[];
  leads: Lead[];
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onUpdatePerson: (updated: ContactPerson) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "timeline">("overview");
  const [newLogType, setNewLogType] = useState<"call" | "whatsapp" | "meeting" | "quote" | "note">("call");
  const [newLogNote, setNewLogNote] = useState("");
  const [showAddDealInline, setShowAddDealInline] = useState(false);
  const [newDealProduct, setNewDealProduct] = useState("");
  const [newDealCategory, setNewDealCategory] = useState("ICU Equipment");
  const [newDealQty, setNewDealQty] = useState(1);
  const [newDealValue, setNewDealValue] = useState(45000);
  const [newDealStage, setNewDealStage] = useState<PipelineStage>("Proposal Sent");

  // Inline Editable Notes & Dossier State
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [dossierNotes, setDossierNotes] = useState(person.notes || "");

  useEffect(() => {
    setDossierNotes(person.notes || "");
  }, [person.notes]);

  const handleSaveNotes = () => {
    const updated: ContactPerson = {
      ...person,
      notes: dossierNotes.trim(),
    };
    onUpdatePerson(updated);
    setIsEditingNotes(false);
    toast.success("Notes saved successfully!");
  };

  const initials = getInitials(person.name);
  const client = clients.find((c) => c.id === person.clientId);
  const whatsappTarget = person.whatsapp || person.phone;

  // Filter associated leads and purchases
  const personLeads = leads.filter(
    (l) =>
      (l.contactName && l.contactName.toLowerCase() === person.name.toLowerCase()) ||
      (person.clientId && l.clientId === person.clientId)
  );

  const clientPurchases = client?.purchases || [];
  const totalPipelineValue = personLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const totalEquipmentValue = clientPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

  const getCleanWhatsAppUrl = (whatsappOrPhone: string) => {
    const cleaned = whatsappOrPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleaned}`;
  };

  const getCleanLinkedInUrl = (url: string) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  };

  // Structured timeline events
  const timelineEvents = [
    ...(person.notes
      ? person.notes
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line, idx) => {
            const isCall = line.includes("📞") || line.toLowerCase().includes("call");
            const isWa = line.includes("💬") || line.toLowerCase().includes("whatsapp");
            const isQuote = line.includes("📄") || line.toLowerCase().includes("quot") || line.toLowerCase().includes("transfer");
            return {
              id: `custom-note-${idx}`,
              date: "Recent Activity",
              title: isCall ? "Phone Interaction Logged" : isWa ? "WhatsApp Discussion" : isQuote ? "Commercial Note" : "CRM Note",
              desc: line,
              icon: isCall ? "📞" : isWa ? "💬" : isQuote ? "📄" : "📝",
              badge: "Logged Activity",
              badgeColor: "#0284c7",
              badgeBg: "#e0f2fe",
            };
          })
      : []),
    ...personLeads.map((l) => ({
      id: `lead-event-${l.id}`,
      date: l.updatedAt || l.createdAt || "2026-08-25",
      title: `Product Quote / Opportunity: ${l.product}`,
      desc: `Stage: ${l.stage} • Qty: ${l.quantity} units • Value: AED ${Number(l.estimatedValue || 0).toLocaleString()} • Assigned: ${l.assignedTo}`,
      icon: "📦",
      badge: l.stage,
      badgeColor: l.stage === "Won" ? "#15803d" : "#0284c7",
      badgeBg: l.stage === "Won" ? "#dcfce7" : "#e0f2fe",
    })),
    ...clientPurchases.map((p) => ({
      id: `purchase-event-${p.id}`,
      date: p.installationDate || p.purchaseDate || "2026-05-10",
      title: `Installed Equipment: ${p.productName} (${p.brand} ${p.model})`,
      desc: `Value: AED ${Number(p.amount || 0).toLocaleString()} • Invoice: ${p.invoiceNumber} • Warranty: ${p.warrantyPeriod} • Engineer: ${p.assignedEngineer}`,
      icon: "🏥",
      badge: "Installed / Commissioned",
      badgeColor: "#15803d",
      badgeBg: "#dcfce7",
    })),
    ...(person.previousOrganisations || []).map((prev, idx) => ({
      id: `transfer-event-${idx}`,
      date: prev.period || "Prior",
      title: `Organisation Mobility: Formerly at ${prev.organisationName}`,
      desc: `Previously served as "${prev.role}" before reassigning to ${person.clientName || "current position"}. Direct contact preserved in FastonMed directory.`,
      icon: "🔄",
      badge: "Facility Mobility",
      badgeColor: "#b45309",
      badgeBg: "#fef3c7",
    })),
    {
      id: "registered-event",
      date: person.lastContacted || "2026-01-15",
      title: "Contact Profile Registered in FastonMed",
      desc: `Profile confirmed for ${person.name} (${person.designation}) at ${person.clientName || "Healthcare Provider"}.`,
      icon: "🤝",
      badge: "Onboarded",
      badgeColor: "#475569",
      badgeBg: "#f1f5f9",
    },
  ];

  const handleAddTimelineNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim()) {
      toast.error("Please enter a note or discussion summary");
      return;
    }

    const typeIcons: Record<string, string> = {
      call: "📞 Call",
      whatsapp: "💬 WhatsApp",
      meeting: "🏥 Meeting",
      quote: "📄 Quotation",
      note: "📝 Note",
    };

    const stamp = `[${typeIcons[newLogType]} • ${new Date().toLocaleDateString("en-GB")}]: ${newLogNote.trim()}`;
    const updatedNotes = person.notes ? `${person.notes}\n${stamp}` : stamp;

    onUpdatePerson({
      ...person,
      notes: updatedNotes,
      lastContacted: new Date().toISOString().slice(0, 10),
    });

    setNewLogNote("");
    toast.success("Activity logged to timeline!");
  };

  const handleAddDealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealProduct.trim()) {
      toast.error("Please enter a medical product name");
      return;
    }

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      clientId: person.clientId,
      clientName: person.clientName || "Healthcare Provider",
      contactName: person.name,
      phone: person.phone,
      email: person.email,
      category: newDealCategory,
      product: newDealProduct.trim(),
      quantity: Number(newDealQty),
      estimatedValue: Number(newDealValue),
      stage: newDealStage,
      source: "Direct Enquiry",
      assignedTo: "Sales Specialist",
      assignedToId: "emp-2",
      priority: "High",
      notes: `Inquiry registered directly with ${person.name} (${person.designation})`,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const currentLeads = getStoredLeads();
    saveStoredLeads([newLead, ...currentLeads]);
    toast.success(`Product Quote "${newDealProduct}" linked to ${person.name}!`);
    setShowAddDealInline(false);
    setNewDealProduct("");
  };

  return (
    <div className="person-profile-overlay" data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div className="person-profile-dialog"
        style={{
          width: "100%",
          maxWidth: 880,
          maxHeight: "90vh",
          overflow: "hidden",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER: CLEAN MINIMAL LIGHT SURFACE */}
        <div
          style={{
            padding: "24px 28px 18px 28px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Top Profile Summary Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Refined Avatar */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
                  border: "1px solid #99f6e4",
                  color: "#0f766e",
                  fontWeight: 700,
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {person.photo || person.avatar ? (
                  <img
                    src={person.photo || person.avatar}
                    alt={person.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  initials
                )}
              </div>

              {/* Name & Subtitles */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      margin: 0,
                      color: "#0f172a",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {person.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 9px",
                      borderRadius: 9999,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      backgroundColor:
                        person.status === "Changed Organisation"
                          ? "#fffbeb"
                          : person.status === "Active at Organisation"
                          ? "#ecfdf5"
                          : "#f8fafc",
                      color:
                        person.status === "Changed Organisation"
                          ? "#b45309"
                          : person.status === "Active at Organisation"
                          ? "#047857"
                          : "#475569",
                      border: `1px solid ${
                        person.status === "Changed Organisation"
                          ? "#fef3c7"
                          : person.status === "Active at Organisation"
                          ? "#d1fae5"
                          : "#e2e8f0"
                      }`,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor:
                          person.status === "Changed Organisation"
                            ? "#f59e0b"
                            : person.status === "Active at Organisation"
                            ? "#10b981"
                            : "#94a3b8",
                      }}
                    />
                    {person.status || "Active at Organisation"}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    marginTop: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "#334155", fontWeight: 500 }}>{person.designation}</span>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <span
                    style={{
                      background: "#f1f5f9",
                      padding: "2px 8px",
                      borderRadius: 6,
                      color: "#475569",
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    {person.department}
                  </span>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  {person.clientName ? (
                    <Link
                      href="/clients"
                      style={{
                        color: "#0284c7",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                      title="View organisation profile"
                    >
                      <Building2 size={13} />
                      <span>{person.clientName}</span>
                      <ArrowUpRight size={12} />
                    </Link>
                  ) : (
                    <span style={{ color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <User size={13} /> Independent Consultant
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 13px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#334155",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={onEdit}
              >
                <Pencil size={13} />
                <span>Edit Profile</span>
              </button>

              {onDelete && (
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "7px 11px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #fee2e2",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={onDelete}
                  title={`Delete ${person.name}`}
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              )}

              <button className="person-profile-close" aria-label="Close profile"
                onClick={onClose}
                type="button"
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
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Quick Action Contact Pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a
              href={`tel:${person.phone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: "#1e293b",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <Phone size={12.5} style={{ color: "#64748b" }} />
              <span>Call</span>
            </a>

            {whatsappTarget && (
              <a
                href={getCleanWhatsAppUrl(whatsappTarget)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#047857",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #d1fae5",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <MessageSquare size={12.5} style={{ color: "#059669" }} />
                <span>WhatsApp</span>
              </a>
            )}

            {person.email && (
              <a
                href={`mailto:${person.email}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#0369a1",
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #e0f2fe",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Mail size={12.5} style={{ color: "#0284c7" }} />
                <span>{person.email}</span>
              </a>
            )}

            {person.linkedin && (
              <a
                href={getCleanLinkedInUrl(person.linkedin)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#1d4ed8",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #dbeafe",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <ExternalLink size={12.5} style={{ color: "#2563eb" }} />
                <span>LinkedIn Profile</span>
              </a>
            )}
          </div>
        </div>

        {/* MODERN TAB STRIP */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            padding: "0 28px",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "13px 4px",
              fontSize: 13,
              fontWeight: activeTab === "overview" ? 600 : 500,
              color: activeTab === "overview" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "overview" ? "2px solid #0f766e" : "2px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <User size={14} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            style={{
              padding: "13px 4px",
              fontSize: 13,
              fontWeight: activeTab === "products" ? 600 : 500,
              color: activeTab === "products" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "products" ? "2px solid #0f766e" : "2px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <Package size={14} />
            <span>Deals & quotes</span>
            <span
              style={{
                fontSize: 11,
                backgroundColor: activeTab === "products" ? "#ccfbf1" : "#f1f5f9",
                color: activeTab === "products" ? "#0f766e" : "#64748b",
                padding: "1px 7px",
                borderRadius: 9999,
                fontWeight: 600,
              }}
            >
              {personLeads.length + clientPurchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            style={{
              padding: "13px 4px",
              fontSize: 13,
              fontWeight: activeTab === "timeline" ? 600 : 500,
              color: activeTab === "timeline" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "timeline" ? "2px solid #0f766e" : "2px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <Clock size={14} />
            <span>Activity</span>
            <span
              style={{
                fontSize: 11,
                backgroundColor: activeTab === "timeline" ? "#ccfbf1" : "#f1f5f9",
                color: activeTab === "timeline" ? "#0f766e" : "#64748b",
                padding: "1px 7px",
                borderRadius: 9999,
                fontWeight: 600,
              }}
            >
              {timelineEvents.length}
            </span>
          </button>
        </div>

        {/* TAB CONTENTS AREA */}
        <div style={{ padding: "24px 28px", overflowY: "auto", maxHeight: "calc(90vh - 165px)" }}>
          {/* ──────── TAB 1: COMPLETE DETAILS & OVERVIEW ──────── */}
          {activeTab === "overview" && (
            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Direct Contact Card */}
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: 14,
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Phone size={13.5} style={{ color: "#0f766e" }} />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Direct Contact Information
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Direct Phone:</span>
                    <a
                      href={`tel:${person.phone}`}
                      style={{ color: "#0f172a", fontWeight: 600, textDecoration: "none" }}
                    >
                      {person.phone}
                    </a>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>WhatsApp:</span>
                    {whatsappTarget ? (
                      <a
                        href={getCleanWhatsAppUrl(whatsappTarget)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#059669", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#10b981" }} />
                        {whatsappTarget}
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Not provided</span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Email:</span>
                    {person.email ? (
                      <a
                        href={`mailto:${person.email}`}
                        style={{ color: "#0284c7", fontWeight: 500, textDecoration: "none" }}
                      >
                        {person.email}
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Not provided</span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>LinkedIn:</span>
                    {person.linkedin ? (
                      <a
                        href={getCleanLinkedInUrl(person.linkedin)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#0284c7", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        <span>View Profile</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Not linked</span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Last Contacted:</span>
                    <span style={{ fontWeight: 500, color: "#334155" }}>{person.lastContacted || "Recently active"}</span>
                  </div>
                </div>
              </div>

              {/* Healthcare Facility Card */}
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: 14,
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Building2 size={13.5} style={{ color: "#0f766e" }} />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Healthcare Facility & Workplace
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Current Organisation:</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>
                      {person.clientName || "Independent Healthcare Consultant"}
                    </span>
                  </div>

                  {client && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                        <span style={{ color: "#64748b" }}>Facility Type:</span>
                        <span style={{ fontWeight: 500, color: "#334155" }}>{client.orgType}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                        <span style={{ color: "#64748b" }}>Location / City:</span>
                        <span style={{ fontWeight: 500, color: "#334155" }}>{client.city}, {client.state}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                        <span style={{ color: "#64748b" }}>Installed Equipment:</span>
                        <span style={{ fontWeight: 600, color: "#047857" }}>
                          {clientPurchases.length} Units (AED {totalEquipmentValue.toLocaleString()})
                        </span>
                      </div>
                    </>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Department & Role:</span>
                    <span style={{ fontWeight: 500, color: "#334155" }}>{person.designation} ({person.department})</span>
                  </div>
                </div>
              </div>

              {/* Career History & Mobility Dossier */}
              <div
                style={{
                  gridColumn: "span 2",
                  padding: "18px 20px",
                  borderRadius: 14,
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <History size={14} style={{ color: "#0f766e" }} />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Career History & Facility Mobility
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Mobility Status: <strong style={{ color: "#0f172a" }}>{person.status || "Active at Organisation"}</strong>
                  </span>
                </div>

                {person.previousOrganisations && person.previousOrganisations.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {person.previousOrganisations.map((prev, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#ffffff",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#64748b",
                            }}
                          >
                            <Building size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                              Formerly at {prev.organisationName}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                              Role: {prev.role}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "#475569",
                            backgroundColor: "#f1f5f9",
                            padding: "3px 9px",
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          {prev.period || "Prior Record"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "#64748b", padding: "6px 0" }}>
                    Currently at <strong>{person.clientName || "Healthcare Provider"}</strong> with no prior hospital transfers recorded in the CRM.
                  </div>
                )}
              </div>

              {/* Notes & Bio Dossier (Directly Editable Here) */}
              <div
                style={{
                  gridColumn: "span 2",
                  padding: "18px 20px",
                  borderRadius: 14,
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <FileText size={14} style={{ color: "#0f766e" }} />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Notes &amp; Conversation Dossier
                    </span>
                  </div>

                  {!isEditingNotes ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#0f766e",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 9px",
                        borderRadius: 6,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        transition: "all 0.15s ease",
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
                          setDossierNotes(person.notes || "");
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
                        onClick={handleSaveNotes}
                        style={{
                          background: "#0f766e",
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
                          boxShadow: "0 1px 2px rgba(15,118,110,0.2)",
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
                      className="form-input"
                      value={dossierNotes}
                      onChange={(e) => setDossierNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSaveNotes();
                        } else if (e.key === "Escape") {
                          setDossierNotes(person.notes || "");
                          setIsEditingNotes(false);
                        }
                      }}
                      placeholder="Type notes, conversation history, client procurement details (Ctrl+Enter to save)..."
                      rows={4}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        padding: "12px 14px",
                        backgroundColor: "#ffffff",
                        border: "1.5px solid #0f766e",
                        borderRadius: 10,
                        resize: "vertical",
                        boxShadow: "0 0 0 3px rgba(15,118,110,0.1)",
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
                            setDossierNotes(person.notes || "");
                            setIsEditingNotes(false);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: 11.5 }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNotes}
                          style={{
                            background: "#0f766e",
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
                    onClick={() => setIsEditingNotes(true)}
                    title="Click to edit notes directly"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "14px 16px",
                      fontSize: 13,
                      color: person.notes ? "#334155" : "#94a3b8",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#99f6e4";
                      e.currentTarget.style.boxShadow = "0 1px 4px rgba(15,118,110,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {person.notes || "No notes logged yet. Click here to add conversation details."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────── TAB 2: PRODUCT SELLING & DEALS ──────── */}
          {activeTab === "products" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Product Selling KPI Summary Bar */}
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    padding: "16px 18px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 12,
                  }}
                >
                  <span style={{ fontSize: 11.5, color: "#166534", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Total Commercial Volume
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#15803d", marginTop: 4, letterSpacing: "-0.01em" }}>
                    AED {(totalPipelineValue + totalEquipmentValue).toLocaleString()}
                  </div>
                  <span style={{ fontSize: 11.5, color: "#166534" }}>Quoted pipeline & installed units</span>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    backgroundColor: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 12,
                  }}
                >
                  <span style={{ fontSize: 11.5, color: "#0369a1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Product Quotes
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0284c7", marginTop: 4, letterSpacing: "-0.01em" }}>
                    {personLeads.length} Deals
                  </div>
                  <span style={{ fontSize: 11.5, color: "#0369a1" }}>AED {totalPipelineValue.toLocaleString()} in progress</span>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                  }}
                >
                  <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Equipment Installed
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginTop: 4, letterSpacing: "-0.01em" }}>
                    {clientPurchases.length} Units
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>AED {totalEquipmentValue.toLocaleString()} delivered</span>
                </div>
              </div>

              {/* Action: Add New Deal / Quote */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#0f172a" }}>
                  Associated Product Deals & Quotations
                </h4>
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    backgroundColor: "#0f766e",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowAddDealInline(!showAddDealInline)}
                >
                  <Plus size={13} />
                  <span>{showAddDealInline ? "Close Form" : "Log Product Quote"}</span>
                </button>
              </div>

              {/* Inline Add Deal Form */}
              {showAddDealInline && (
                <form
                  onSubmit={handleAddDealSubmit}
                  style={{
                    padding: "18px 20px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                    Register Product Opportunity for {person.name}
                  </div>
                  <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1fr", gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4, color: "#475569" }}>Medical Product *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. ICU Ventilator (SV-300)"
                        value={newDealProduct}
                        onChange={(e) => setNewDealProduct(e.target.value)}
                        required
                        style={{ fontSize: 12.5, borderRadius: 8 }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4, color: "#475569" }}>Category</label>
                      <select
                        className="form-input"
                        value={newDealCategory}
                        onChange={(e) => setNewDealCategory(e.target.value)}
                        style={{ fontSize: 12.5, borderRadius: 8 }}
                      >
                        <option value="ICU Equipment">ICU Equipment</option>
                        <option value="OT Equipment">OT Equipment</option>
                        <option value="Imaging Equipment">Imaging Equipment</option>
                        <option value="Dental Equipment">Dental Equipment</option>
                        <option value="Diagnostic Equipment">Diagnostic Equipment</option>
                        <option value="Hospital Furniture">Hospital Furniture</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4, color: "#475569" }}>Qty</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={newDealQty}
                        onChange={(e) => setNewDealQty(Number(e.target.value))}
                        style={{ fontSize: 12.5, borderRadius: 8 }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4, color: "#475569" }}>Est. Value (AED)</label>
                      <input
                        type="number"
                        min={1000}
                        className="form-input"
                        value={newDealValue}
                        onChange={(e) => setNewDealValue(Number(e.target.value))}
                        style={{ fontSize: 12.5, borderRadius: 8 }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ width: 220 }}>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4, color: "#475569" }}>Pipeline Stage</label>
                      <select
                        className="form-input"
                        value={newDealStage}
                        onChange={(e) => setNewDealStage(e.target.value as PipelineStage)}
                        style={{ fontSize: 12.5, borderRadius: 8 }}
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Requirement Review">Requirement Review</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Proposal Sent">Proposal Sent</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Waiting Review">Waiting Review</option>
                        <option value="Follow Up Later">Follow Up Later</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      style={{
                        padding: "8px 18px",
                        fontSize: 12.5,
                        fontWeight: 500,
                        backgroundColor: "#0f766e",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        marginTop: 18,
                      }}
                    >
                      Save Product Deal
                    </button>
                  </div>
                </form>
              )}

              {/* Active Deals List */}
              {personLeads.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {personLeads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        padding: "14px 18px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            backgroundColor: "#f0fdfa",
                            border: "1px solid #ccfbf1",
                            color: "#0f766e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>
                            {lead.product}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            Category: {lead.category} • Qty: {lead.quantity} units • Specialist: {lead.assignedTo}
                          </div>
                          {lead.notes && (
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                              Note: {lead.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                          AED {Number(lead.estimatedValue || 0).toLocaleString()}
                        </div>
                        <span
                          className={`badge ${getStatusColor(lead.stage)}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            display: "inline-block",
                            marginTop: 4,
                          }}
                        >
                          {lead.stage}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 10, color: "#64748b", fontSize: 13, border: "1px solid #f1f5f9" }}>
                  No active quotations logged yet for {person.name}. Click <strong>"+ Log Product Quote"</strong> above to register an inquiry!
                </div>
              )}

              {/* Equipment Installed at Facility */}
              {clientPurchases.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                    <Building2 size={14} style={{ color: "#0f766e" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Delivered & Installed Equipment at Facility
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {clientPurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                            {purchase.productName} ({purchase.brand} - {purchase.model})
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            Invoice: #{purchase.invoiceNumber} • Installed: {purchase.installationDate} • Warranty: {purchase.warrantyPeriod}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "#047857" }}>
                            AED {Number(purchase.amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────── TAB 3: TIMELINE & ACTIVITY ──────── */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Interactive Log Activity Form */}
              <form
                onSubmit={handleAddTimelineNote}
                style={{
                  padding: "16px 18px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
                    Log Interaction Note
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["call", "whatsapp", "meeting", "quote", "note"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewLogType(t)}
                        style={{
                          padding: "4px 9px",
                          fontSize: 11.5,
                          borderRadius: 6,
                          border: newLogType === t ? "1px solid #0f766e" : "1px solid #e2e8f0",
                          backgroundColor: newLogType === t ? "#0f766e" : "#ffffff",
                          color: newLogType === t ? "#ffffff" : "#475569",
                          cursor: "pointer",
                          fontWeight: 500,
                          textTransform: "capitalize",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {t === "call" ? "Call" : t === "whatsapp" ? "WhatsApp" : t === "meeting" ? "Visit" : t === "quote" ? "Quote" : "Note"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder={`e.g. Discussed new tender specs with ${person.name}, sending updated proposal...`}
                    value={newLogNote}
                    onChange={(e) => setNewLogNote(e.target.value)}
                    style={{ fontSize: 12.5, borderRadius: 8 }}
                  />
                  <button
                    type="submit"
                    style={{
                      backgroundColor: "#0f766e",
                      color: "#ffffff",
                      flexShrink: 0,
                      padding: "8px 16px",
                      fontSize: 12.5,
                      fontWeight: 500,
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    Add to Timeline
                  </button>
                </div>
              </form>

              {/* Chronological Vertical Timeline Feed */}
              <div style={{ position: "relative", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Vertical connecting line */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    bottom: 12,
                    left: 7,
                    width: 2,
                    backgroundColor: "#e2e8f0",
                  }}
                />

                {timelineEvents.map((ev, index) => (
                  <div key={ev.id || index} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Node marker */}
                    <div
                      style={{
                        position: "absolute",
                        left: -24,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        border: "2px solid #0f766e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        top: 14,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#0f766e" }} />
                    </div>

                    <div
                      style={{
                        flex: 1,
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                          {ev.title}
                        </div>
                        <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 500 }}>
                          {ev.date}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                        {ev.desc}
                      </div>
                      {ev.badge && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 4,
                              backgroundColor: ev.badgeBg || "#f1f5f9",
                              color: ev.badgeColor || "#475569",
                            }}
                          >
                            {ev.badge}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT PERSON MODAL ──────────────────────────────────────────────────────

function EditPersonModal({
  person,
  clients,
  departments = INITIAL_DEPARTMENTS,
  onAddDepartment,
  onClose,
  onSave,
}: {
  person: ContactPerson;
  clients: Client[];
  departments?: string[];
  onAddDepartment?: (d: string) => void;
  onClose: () => void;
  onSave: (p: ContactPerson) => void;
}) {
  const [name, setName] = useState(person.name || "");
  const [designation, setDesignation] = useState(person.designation || "");
  const [department, setDepartment] = useState<Department>(person.department || "Biomedical Engineering");
  const [deptList, setDeptList] = useState<string[]>(departments);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  useEffect(() => {
    setDeptList(departments);
  }, [departments]);

  const handleCreateDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      toast.error("Please enter a department name");
      return;
    }
    if (!deptList.includes(trimmed)) {
      setDeptList((prev) => [...prev, trimmed]);
      if (onAddDepartment) {
        onAddDepartment(trimmed);
      } else {
        saveStoredDepartments([...deptList, trimmed]);
      }
    }
    setDepartment(trimmed as Department);
    setIsAddingDept(false);
    setNewDeptName("");
    toast.success(`Department "${trimmed}" selected!`);
  };

  const [phone, setPhone] = useState(person.phone || "");
  const [whatsapp, setWhatsapp] = useState(person.whatsapp || person.phone || "");
  const [email, setEmail] = useState(person.email || "");
  const [linkedin, setLinkedin] = useState(person.linkedin || "");
  const [clientId, setClientId] = useState<string>(person.clientId || "");
  const [notes, setNotes] = useState(person.notes || "");
  const [transferReason, setTransferReason] = useState("");
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
      toast.error("Please enter the contact person's name");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    const origClientId = person.clientId || "";
    const newClientId = clientId;
    let updatedPrevious = person.previousOrganisations ? [...person.previousOrganisations] : [];

    if (origClientId !== newClientId && origClientId) {
      const oldClient = clients.find((c) => c.id === origClientId);
      const oldOrgName = oldClient ? oldClient.name : person.clientName || "Previous Organisation";
      updatedPrevious.unshift({
        organisationName: oldOrgName,
        role: person.designation || "Healthcare Specialist",
        leftDate: new Date().toISOString().slice(0, 10),
        reasonForLeaving: transferReason.trim() || undefined,
      });
    }

    const selectedClient = clients.find((c) => c.id === newClientId);
    const finalClientName = selectedClient ? selectedClient.name : (newClientId ? person.clientName : undefined);
    const finalStatus: ContactStatus = newClientId ? "Active at Organisation" : "Independent / Consultant";

    const reasonNote = transferReason.trim() ? `[Transfer Note]: ${transferReason.trim()}` : "";
    const mergedNotes = [notes.trim(), reasonNote].filter(Boolean).join("\n\n");

    onSave({
      ...person,
      name: name.trim(),
      designation: designation.trim() || "Healthcare Specialist",
      department,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim(),
      linkedin: linkedin.trim() || undefined,
      status: finalStatus,
      clientId: newClientId || undefined,
      clientName: finalClientName,
      previousOrganisations: updatedPrevious,
      notes: mergedNotes.trim() || undefined,
      photo: photo || undefined,
      avatar: photo || undefined,
    });
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
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
        style={{
          width: "100%",
          maxWidth: 740,
          maxHeight: "90vh",
          overflow: "auto",
          padding: 0,
          borderRadius: 16,
          boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)",
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
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                backgroundColor: "#f0fdfa",
                border: "1px solid #ccfbf1",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Edit Profile & Organisation
              </h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {person.name} {person.clientName ? `• ${person.clientName}` : "• Independent"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
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
            }}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
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
                <select
                  className="form-input"
                  value={department}
                  onChange={(e) => {
                    if (e.target.value === "__ADD_NEW__") {
                      setIsAddingDept(true);
                    } else {
                      setDepartment(e.target.value as Department);
                    }
                  }}
                  style={{ fontSize: 13 }}
                >
                  {deptList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__ADD_NEW__">+ Add New Department...</option>
                </select>
              )}
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Direct Mobile / Phone *</label>
              <input
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>WhatsApp Number</label>
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
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Direct Email</label>
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

          {clientId !== (person.clientId || "") && (
            <div style={{ padding: 12, backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8 }}>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4, color: "#b45309" }}>
                Reason for Organisation Change / Transfer
              </label>
              <input
                className="form-input"
                placeholder="e.g. Promoted / Moved to new hospital branch"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                style={{ fontSize: 13, backgroundColor: "#ffffff" }}
              />
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Background / Notes</label>
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

// ─── TRANSFER PERSON MODAL ──────────────────────────────────────────────────

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
            💡 If <strong>{person.name}</strong> has changed organisation from <strong>{person.clientName || "their facility"}</strong>, their mobile, WhatsApp, and LinkedIn are permanently preserved so you can reach them immediately at their new hospital!
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
                  Keep contact in your directory as an independent consultant or free agent
                </div>
              </div>
            </label>
          </div>

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
                  placeholder="e.g. Procurement Director"
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
              placeholder="e.g. Moved in 2025, in charge of new ICU tender"
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
