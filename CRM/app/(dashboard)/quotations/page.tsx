"use client";
import "./pagination.css";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FileText,
  Search,
  Plus,
  ChevronDown,
  X,
  Building2,
  Calendar,
  Eye,
  RefreshCw,
  Printer,
  FileCheck,
  Check,
  Download,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Filter,
} from "lucide-react";
import type { Quotation, QuotationItem, QuotationStatus, Client } from "@/types";
import {
  getZohoLiveQuotes,
  saveZohoLiveQuotes,
  fetchZohoLiveQuotesFromServer,
} from "@/lib/zoho-live-quotes";
import { convertQuotationToInvoice } from "@/lib/quotations-store";
import { getStoredClients } from "@/lib/client-store";

function formatZohoDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, "0");
      return `${day} ${months[mIdx] || parts[1]} ${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(d.getDate()).padStart(2, "0");
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatZohoAmount(amount: number): string {
  return `AED${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCreatorBadge(name: string = "") {
  const n = name.trim();
  let bg = "#64748b";
  let initial = n ? n.charAt(0).toUpperCase() : "U";

  if (n.toLowerCase().includes("riyas")) {
    bg = "#059669";
    initial = "R";
  } else if (n.toLowerCase().includes("hashim")) {
    bg = "#0284c7";
    initial = "H";
  } else if (n.toLowerCase().includes("fuhad")) {
    bg = "#7c3aed";
    initial = "F";
  } else if (n.toLowerCase().includes("fidha")) {
    bg = "#db2777";
    initial = "F";
  } else if (n.toLowerCase().includes("user")) {
    bg = "#ea580c";
    initial = "U";
  } else if (n.toLowerCase().includes("faston")) {
    bg = "#2563eb";
    initial = "FM";
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: bg,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
        {n || "FastonMed Trading LLC"}
      </span>
    </div>
  );
}

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [creatorFilter, setCreatorFilter] = useState<string>("All");
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Selected Quote for View Modal
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);

  // New Quotation Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCustomer, setFormCustomer] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formAmount, setFormAmount] = useState<number>(5000);
  const [formDate, setFormDate] = useState("2026-09-09");
  const [formStatus, setFormStatus] = useState<QuotationStatus>("Draft");
  const [formItemName, setFormItemName] = useState("Biomedical Equipment Diagnostic & Inspection Package");
  const [formPreparedBy, setFormPreparedBy] = useState("Riyas");

  const loadCurrentUser = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("fastonmed_user");
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser(u);
        if (u.name) {
          setFormPreparedBy(u.name);
        }
      }
    } catch {}
  };

  const loadData = () => {
    // 1. Immediately read synchronously from local store / seed (guarantees no 0-quotes flash)
    const localQuotes = getZohoLiveQuotes();
    setQuotes(localQuotes);
    setClients(getStoredClients());

    // 2. Fetch cross-account quotes from server in background
    fetchZohoLiveQuotesFromServer().then((serverQuotes) => {
      if (Array.isArray(serverQuotes)) {
        setQuotes(serverQuotes);
      }
    });
  };

  useEffect(() => {
    loadCurrentUser();
    loadData();

    window.addEventListener("fastonmed_quotes_updated", loadData);
    window.addEventListener("fastonmed_user_updated", loadCurrentUser);

    return () => {
      window.removeEventListener("fastonmed_quotes_updated", loadData);
      window.removeEventListener("fastonmed_user_updated", loadCurrentUser);
    };
  }, []);

  // Unique list of creators
  const uniqueCreators = useMemo(() => {
    const list = ["Riyas", "Hashim", "Eng. Fuhad Saneen", "Fidha", "User 1", "FastonMed Trading LLC"];
    quotes.forEach((q) => {
      if (q.preparedBy && q.preparedBy.trim() && !list.includes(q.preparedBy.trim())) {
        list.push(q.preparedBy.trim());
      }
    });
    return list;
  }, [quotes]);

  // Sync Live Data from Zoho Books
  const handleSyncZoho = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/zoho/quotations", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.quotes)) {
        throw new Error(data.error || "Could not synchronize quotations from Zoho Books.");
      }
      localStorage.setItem("fastonmed_zoho_live_quotes", JSON.stringify(data.quotes));
      setQuotes(data.quotes);
      window.dispatchEvent(new Event("fastonmed_quotes_updated"));
      toast.success(`Updated ${data.count} quotations from Zoho Books.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not synchronize quotations. Existing quotations were preserved.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Import Quotes from Zoho Books CSV or JSON Export
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          const rawList = Array.isArray(json) ? json : json.quotes || json.estimates || [];
          if (rawList.length > 0) {
            const mapped: Quotation[] = rawList.map((item: any, i: number) => ({
              id: item.estimate_id || item.id || `quote-${Date.now()}-${i}`,
              quotationNumber: item.estimate_number || item.quotationNumber || `FMT-QT26-0${300 + i}`,
              referenceNumber: item.reference_number || item.referenceNumber || "",
              clientId: item.customer_id || `cust-${i}`,
              clientName: item.customer_name || item.clientName || "Customer",
              date: item.date || new Date().toISOString().slice(0, 10),
              validUntil: item.expiry_date || item.validUntil || "",
              status: (item.status === "draft" ? "Draft" : item.status === "approved" ? "Approved" : "Sent") as QuotationStatus,
              total: Number(item.total || item.amount || 0),
              subtotal: Number(item.total || item.amount || 0),
              tax: Number(item.total || item.amount || 0) * 0.05,
              discount: 0,
              items: item.items || [{ id: `it-${i}`, product: "Medical Equipment & Solutions", qty: 1, rate: Number(item.total || 0), amount: Number(item.total || 0) }],
              preparedBy: item.preparedBy || item.salesperson_name || currentUser?.name || "Riyas",
              createdAt: item.date || new Date().toISOString().slice(0, 10),
            }));
            saveZohoLiveQuotes(mapped);
            setQuotes(mapped);
            toast.success(`Imported all ${mapped.length} quotes from Zoho Books!`);
            return;
          }
        }

        // CSV parsing
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) return;

        const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes("date") && !h.includes("expiry") && !h.includes("due"));
        const quoteNumIdx = headers.findIndex((h) => h.includes("quote") || h.includes("estimate"));
        const refIdx = headers.findIndex((h) => h.includes("reference"));
        const customerIdx = headers.findIndex((h) => h.includes("customer") || h.includes("client"));
        const statusIdx = headers.findIndex((h) => h.includes("status"));
        const totalIdx = headers.findIndex((h) => h.includes("total") || h.includes("amount"));
        const creatorIdx = headers.findIndex((h) => h.includes("prepared") || h.includes("salesperson") || h.includes("created"));

        const parsedQuotes: Quotation[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (row.length < 3) continue;

          const qNum = row[quoteNumIdx] || `FMT-QT26-0${i}`;
          const clientName = row[customerIdx] || "Customer";
          const date = row[dateIdx] || new Date().toISOString().slice(0, 10);
          const ref = refIdx >= 0 ? row[refIdx] : "";
          const status = (row[statusIdx] || "Draft") as QuotationStatus;
          const amt = parseFloat(row[totalIdx]?.replace(/[^0-9.]/g, "") || "0");
          const creator = creatorIdx >= 0 && row[creatorIdx] ? row[creatorIdx] : currentUser?.name || "Riyas";

          parsedQuotes.push({
            id: `zoho-import-${i}-${Date.now()}`,
            quotationNumber: qNum,
            referenceNumber: ref,
            clientId: `client-${i}`,
            clientName,
            date,
            validUntil: "",
            status,
            total: amt,
            subtotal: amt,
            tax: amt * 0.05,
            discount: 0,
            items: [{ id: `it-${i}`, product: "Medical Equipment Supply & Service", qty: 1, rate: amt, amount: amt }],
            preparedBy: creator,
            createdAt: date,
          });
        }

        if (parsedQuotes.length > 0) {
          saveZohoLiveQuotes(parsedQuotes);
          setQuotes(parsedQuotes);
          toast.success(`Successfully imported all ${parsedQuotes.length} quotes from Zoho Books!`);
        }
      } catch (err) {
        toast.error("Failed to parse quotes file");
      }
    };
    reader.readAsText(file);
  };

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "total" || column === "date" ? "desc" : "asc");
    }
  };

  // Filtered and Sorted quotes
  const filteredQuotes = useMemo(() => {
    const list = quotes.filter((q) => {
      const s = search.trim().toLowerCase();
      const matchQuery =
        !s ||
        q.quotationNumber.toLowerCase().includes(s) ||
        q.clientName.toLowerCase().includes(s) ||
        (q.referenceNumber && q.referenceNumber.toLowerCase().includes(s)) ||
        (q.preparedBy && q.preparedBy.toLowerCase().includes(s)) ||
        q.items?.some((it) => it.product.toLowerCase().includes(s));

      let matchStatus = true;
      if (statusFilter !== "All") {
        matchStatus = (q.status || "").toLowerCase() === statusFilter.toLowerCase();
      }

      let matchCreator = true;
      if (creatorFilter === "My Quotes") {
        const myName = (currentUser?.name || "riyas").toLowerCase();
        matchCreator = (q.preparedBy || "").toLowerCase().includes(myName);
      } else if (creatorFilter !== "All") {
        matchCreator = (q.preparedBy || "").toLowerCase() === creatorFilter.toLowerCase();
      }

      return matchQuery && matchStatus && matchCreator;
    });

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortColumn as keyof Quotation] ?? "";
      let valB: any = b[sortColumn as keyof Quotation] ?? "";

      if (sortColumn === "total" || sortColumn === "subtotal") {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (sortColumn === "date") {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [quotes, search, statusFilter, creatorFilter, sortColumn, sortDirection, currentUser]);

  const [quotePage, setQuotePage] = useState(1);
  const quotePageSize = 25;
  const quotePageCount = Math.max(1, Math.ceil(filteredQuotes.length / quotePageSize));
  const activeQuotePage = Math.min(quotePage, quotePageCount);
  const pageQuotes = filteredQuotes.slice((activeQuotePage - 1) * quotePageSize, activeQuotePage * quotePageSize);
  useEffect(() => { setQuotePage(1); setSelectedIds([]); }, [search, statusFilter, creatorFilter, sortColumn, sortDirection]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(pageQuotes.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomer.trim()) {
      toast.error("Please enter a customer name");
      return;
    }

    const nextNumber = `FMT-QT26-0${Math.floor(Math.random() * 70 + 330)}`;
    const authorName = formPreparedBy.trim() || currentUser?.name || "Riyas";

    const newQuote: Quotation = {
      id: `zoho-qt-${Date.now()}`,
      quotationNumber: nextNumber,
      referenceNumber: formReference.trim(),
      clientId: `cust-${Date.now()}`,
      clientName: formCustomer.trim(),
      date: formDate,
      validUntil: "2026-10-09",
      status: formStatus,
      items: [
        {
          id: `item-${Date.now()}`,
          product: formItemName.trim() || "Medical Equipment Supply",
          qty: 1,
          rate: Number(formAmount) || 0,
          amount: Number(formAmount) || 0,
        },
      ],
      subtotal: Number(formAmount) || 0,
      tax: (Number(formAmount) || 0) * 0.05,
      discount: 0,
      total: Number(formAmount) || 0,
      notes: "Commercial quote created in FastonMed CRM",
      terms: "Payment upon delivery.",
      preparedBy: authorName,
      createdAt: formDate,
    };

    const updated = [newQuote, ...quotes];
    saveZohoLiveQuotes(updated);
    setQuotes(updated);
    setShowAddModal(false);
    toast.success(`Created Quote ${nextNumber} for ${formCustomer} (by ${authorName})`);
  };

  const handleConvertToInvoice = (quote: Quotation) => {
    const inv = convertQuotationToInvoice(quote.id);
    if (inv) {
      toast.success(`Converted ${quote.quotationNumber} into Sales Invoice ${inv.invoiceNumber}!`);
      loadData();
      if (selectedQuote && selectedQuote.id === quote.id) {
        setSelectedQuote({ ...selectedQuote, status: "Approved" });
      }
    } else {
      toast.error("Failed to convert quotation.");
    }
  };

  const renderStatusBadge = (status: QuotationStatus) => {
    const s = (status || "").toLowerCase();
    if (s === "draft") {
      return (
        <span style={{ color: "#64748b", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.02em" }}>
          DRAFT
        </span>
      );
    }
    if (s === "approved") {
      return (
        <span style={{ color: "#059669", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.02em" }}>
          APPROVED
        </span>
      );
    }
    if (s === "sent") {
      return (
        <span style={{ color: "#0284c7", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.02em" }}>
          SENT
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.02em" }}>
          REJECTED
        </span>
      );
    }
    return (
      <span style={{ color: "#64748b", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.02em" }}>
        {String(status).toUpperCase()}
      </span>
    );
  };

  const renderSortHeader = (
    label: string,
    column: string,
    width?: string | number,
    textAlign: "left" | "right" | "center" = "left"
  ) => {
    const isCurrent = sortColumn === column;
    return (
      <th
        onClick={() => handleSort(column)}
        style={{
          padding: "12px 14px",
          width,
          textAlign,
          cursor: "pointer",
          userSelect: "none",
          color: isCurrent ? "#1d4ed8" : "#64748b",
          whiteSpace: "nowrap",
        }}
        title={`Click to sort by ${label}`}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            justifyContent: textAlign === "right" ? "flex-end" : textAlign === "center" ? "center" : "flex-start",
            width: "100%",
          }}
        >
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === "asc" ? (
              <ArrowUp size={13} style={{ color: "#2563eb" }} />
            ) : (
              <ArrowDown size={13} style={{ color: "#2563eb" }} />
            )
          ) : (
            <ArrowUpDown size={11} style={{ color: "#cbd5e1", opacity: 0.7 }} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
      {/* Top Header Matching Zoho Books */}
      <div className="quotes-mobile-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>All Quotes</span>
              <ChevronDown size={18} style={{ color: "#2563eb", cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                ({filteredQuotes.length} of {quotes.length})
              </span>
            </h1>
            <span
              style={{
                fontSize: 11,
                background: "#dcfce7",
                color: "#15803d",
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a" }} />
              Shared Quotations
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "#64748b", margin: "3px 0 0 0" }}>
            FastonMed Trading • Real-time customer price estimates & commercial quotes from Zoho Books
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            id="quote-file-import"
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => document.getElementById("quote-file-import")?.click()}
            className="btn btn-secondary"
            title="Import Zoho Books exported quotes CSV"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            <span>Import Quotes</span>
          </button>

          <button
            onClick={handleSyncZoho}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? "Syncing..." : "Sync from Zoho Books"}</span>
          </button>

          <button
            onClick={() => {
              if (currentUser?.name) {
                setFormPreparedBy(currentUser.name);
              }
              setShowAddModal(true);
            }}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "7px 16px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} />
            <span>New</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* Main Table Container (Zoho Books Style) */}
      <div
        className="card mobile-quotes-list"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Filter Controls Row */}
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left: Search input */}
          <div className="quotes-mobile-search" style={{ position: "relative", maxWidth: 300, flex: "1 1 240px" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Search in Quotes ( / )..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                fontSize: 12.5,
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                outline: "none",
              }}
            />
          </div>

          {/* Right: Filters (Status + Creator / Who Did This) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Status Filter Buttons */}
            <div className="mobile-quote-status-tabs" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["All", "Draft", "Approved", "Sent"].map((st) => (
                <button
                  key={st}
                  aria-pressed={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    border: "1px solid",
                    borderColor: statusFilter === st ? "#2563eb" : "#e2e8f0",
                    backgroundColor: statusFilter === st ? "#eff6ff" : "#ffffff",
                    color: statusFilter === st ? "#1d4ed8" : "#64748b",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: statusFilter === st ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Vertical Divider */}
            <div style={{ width: 1, height: 20, backgroundColor: "#e2e8f0" }} />

            {/* Who Did This Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <User size={12} />
                Who Did This:
              </span>

              {/* Creator Dropdown */}
              <div style={{ position: "relative" }}>
                <select
                  aria-label="Filter quotes by creator"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  style={{
                    padding: "4px 26px 4px 10px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: creatorFilter !== "All" && creatorFilter !== "My Quotes" ? "#2563eb" : "#cbd5e1",
                    backgroundColor: creatorFilter !== "All" && creatorFilter !== "My Quotes" ? "#eff6ff" : "#ffffff",
                    color: creatorFilter !== "All" && creatorFilter !== "My Quotes" ? "#1d4ed8" : "#334155",
                    fontSize: 11.5,
                    fontWeight: creatorFilter !== "All" && creatorFilter !== "My Quotes" ? 700 : 500,
                    cursor: "pointer",
                    outline: "none",
                    appearance: "none",
                  }}
                >
                  <option value="All">Everyone’s quotes</option>
                  {currentUser?.name && <option value="My Quotes">My quotes</option>}
                  {uniqueCreators.map((creator) => {
                    const count = quotes.filter((q) => (q.preparedBy || "").toLowerCase() === creator.toLowerCase()).length;
                    return (
                      <option key={creator} value={creator}>
                        {creator} ({count})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                />
              </div>

              {creatorFilter !== "All" && (
                <button
                  onClick={() => setCreatorFilter("All")}
                  title="Clear creator filter"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    fontSize: 11,
                    padding: "2px 4px",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quotes Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="mobile-quotes-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                <th style={{ padding: "12px 14px", width: 40, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={pageQuotes.length > 0 && pageQuotes.every((quote) => selectedIds.includes(quote.id))}
                    onChange={handleSelectAll}
                    style={{ cursor: "pointer", borderRadius: 3 }}
                  />
                </th>
                {renderSortHeader("DATE", "date", 110)}
                {renderSortHeader("QUOTE NUMBER", "quotationNumber", 140)}
                {renderSortHeader("REFERENCE NUMBER", "referenceNumber", 150)}
                {renderSortHeader("CUSTOMER NAME", "clientName", 220)}
                {renderSortHeader("PREPARED BY", "preparedBy", 160)}
                {renderSortHeader("STATUS", "status", 120)}
                {renderSortHeader("AMOUNT", "total", 130, "right")}
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                    <FileText size={32} style={{ margin: "0 auto 8px auto", opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No Quotes Recorded</div>
                    <div style={{ fontSize: 11.5, marginTop: 4 }}>
                      {creatorFilter !== "All" || statusFilter !== "All" || search
                        ? "No quotes match your selected filters. Try clearing your filters."
                        : "All quotes will appear here once generated or synced from Zoho Books."}
                    </div>
                  </td>
                </tr>
              ) : (
                pageQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      transition: "background-color 0.12s",
                      backgroundColor: selectedIds.includes(quote.id) ? "#f8fafc" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedIds.includes(quote.id)) e.currentTarget.style.backgroundColor = "#fafafa";
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedIds.includes(quote.id)) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(quote.id)}
                        onChange={() => handleSelectOne(quote.id)}
                        style={{ cursor: "pointer", borderRadius: 3 }}
                      />
                    </td>

                    {/* Date */}
                    <td style={{ padding: "12px 14px", color: "#334155", whiteSpace: "nowrap" }}>
                      {formatZohoDate(quote.date)}
                    </td>

                    {/* Quote Number (Clickable link) */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => setSelectedQuote(quote)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "#2563eb",
                          fontWeight: 600,
                          fontSize: 12.5,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {quote.quotationNumber}
                      </button>
                    </td>

                    {/* Reference Number */}
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>
                      {quote.referenceNumber || ""}
                    </td>

                    {/* Customer Name */}
                    <td style={{ padding: "12px 14px", color: "#0f172a", fontWeight: 500 }}>
                      <span style={{ maxWidth: 260, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {quote.clientName}
                      </span>
                    </td>

                    {/* Prepared By (Who Did This) */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {getCreatorBadge(quote.preparedBy)}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px" }}>
                      {renderStatusBadge(quote.status)}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                      {formatZohoAmount(quote.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav className="quotes-pagination" aria-label="Quotation pages">
        <p aria-live="polite">{filteredQuotes.length ? (activeQuotePage - 1) * quotePageSize + 1 : 0}–{Math.min(activeQuotePage * quotePageSize, filteredQuotes.length)} of {filteredQuotes.length} quotes</p>
        <div>
          <button type="button" disabled={activeQuotePage === 1} onClick={() => { setQuotePage(activeQuotePage - 1); setSelectedIds([]); }}>Previous</button>
          <span>Page {activeQuotePage} of {quotePageCount}</span>
          <button type="button" disabled={activeQuotePage === quotePageCount} onClick={() => { setQuotePage(activeQuotePage + 1); setSelectedIds([]); }}>Next</button>
        </div>
      </nav>

      {/* MODAL: Quote Details & Proposal Preview */}
      {selectedQuote && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(2px)",
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
              borderRadius: 12,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Action Bar */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {selectedQuote.quotationNumber}
                </span>
                {renderStatusBadge(selectedQuote.status)}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => handleConvertToInvoice(selectedQuote)}
                  style={{
                    backgroundColor: "#059669",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FileCheck size={13} />
                  <span>Convert to Invoice</span>
                </button>

                <button
                  onClick={() => setSelectedQuote(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #2563eb", paddingBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e40af" }}>
                    FASTONMED TRADING LLC
                  </h3>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                    Biomedical Equipment & Healthcare Supplies
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Dubai, United Arab Emirates • info@fastonmed.com
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                    QUOTE ESTIMATE
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
                    {selectedQuote.quotationNumber}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                    <strong>Date:</strong> {formatZohoDate(selectedQuote.date)}
                  </div>
                </div>
              </div>

              {/* Customer Info & Prepared By Info */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                    Quotation For:
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    {selectedQuote.clientName}
                  </div>
                </div>

                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                    Prepared By:
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {getCreatorBadge(selectedQuote.preparedBy)}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <table data-mobile-cards="true" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9", color: "#475569", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "9px 12px", width: 40 }}>#</th>
                      <th style={{ padding: "9px 12px" }}>Description</th>
                      <th style={{ padding: "9px 12px", width: 60, textAlign: "center" }}>Qty</th>
                      <th style={{ padding: "9px 12px", width: 110, textAlign: "right" }}>Rate</th>
                      <th style={{ padding: "9px 12px", width: 120, textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedQuote.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td data-label="#" style={{ padding: "10px 12px", color: "#94a3b8" }}>{idx + 1}</td>
                        <td data-label="Description" style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{it.product}</div>
                          {it.description && (
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{it.description}</div>
                          )}
                        </td>
                        <td data-label="Qty" style={{ padding: "10px 12px", textAlign: "center", color: "#475569" }}>{it.qty}</td>
                        <td data-label="Rate" style={{ padding: "10px 12px", textAlign: "right", color: "#475569" }}>
                          {formatZohoAmount(it.rate)}
                        </td>
                        <td data-label="Amount" style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                          {formatZohoAmount(it.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                    <span>Sub Total:</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatZohoAmount(selectedQuote.subtotal || selectedQuote.total)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      fontSize: 15,
                      color: "#0f172a",
                      borderTop: "2px solid #0f172a",
                      paddingTop: 8,
                    }}
                  >
                    <span>Total:</span>
                    <span style={{ color: "#2563eb" }}>{formatZohoAmount(selectedQuote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: + New Quote */}
      {showAddModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(2px)",
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
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Create New Quote
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Willie Eroy or Hospital LLC"
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    outline: "none",
                  }}
                />
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Reference Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REF-2026-01"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Quoted Item / Service
                </label>
                <input
                  type="text"
                  placeholder="e.g. Medical Diagnostic Equipment & Sensors"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    outline: "none",
                  }}
                />
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Amount (AED) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as QuotationStatus)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>

              {/* Prepared By (Who Did This) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Prepared By (Who Did This) *
                </label>
                <select
                  value={formPreparedBy}
                  onChange={(e) => setFormPreparedBy(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    outline: "none",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="Riyas">Riyas (Sales Executive)</option>
                  <option value="Hashim">Hashim (Operations Manager)</option>
                  <option value="Eng. Fuhad Saneen">Eng. Fuhad Saneen (Growth Head)</option>
                  <option value="Fidha">Fidha (Client Relations)</option>
                  <option value="User 1">User 1 (Sales Executive)</option>
                  <option value="FastonMed Trading LLC">FastonMed Trading LLC</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 10,
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    backgroundColor: "#2563eb",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 18px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#ffffff",
                  }}
                >
                  Save Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
