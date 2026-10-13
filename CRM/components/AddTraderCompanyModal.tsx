"use client";
import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { getStoredCompanies, saveStoredCompanies, getStoredCategories } from "@/lib/trader-store";
import type { ProcurementCompany, ProductCategory } from "@/types";
import toast from "react-hot-toast";

const LEAD_TIME_PRESETS = [
  "Immediate (Ex-Stock Dubai)",
  "2 - 3 Business Days",
  "3 - 5 Days (UAE Stock)",
  "1 - 2 Weeks (Air Freight)",
  "2 - 3 Weeks (Regional Stock)",
  "4 - 6 Weeks (Special Import)",
];

export default function AddTraderCompanyModal({ onClose, onCreated, initialName = '' }: {
  onClose: () => void;
  onCreated?: (company: ProcurementCompany) => void;
  initialName?: string;
}) {
  // Form State for Add Trader Company
  const [selectedCategories, setSelectedCategories] = useState<ProductCategory[]>(["ICU Equipment"]);
  const [leadTime, setLeadTime] = useState<string>("3 - 5 Days (UAE Stock)");
  const [priceMin, setPriceMin] = useState<number>(25000);
  const [priceMax, setPriceMax] = useState<number>(85000);
  const [modalContacts, setModalContacts] = useState<
    { id: string; name: string; role: string; phone: string; email: string }[]
  >([
    { id: "c-1", name: "", role: "UAE Representative", phone: "", email: "" },
  ]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const [categories] = useState(() => getStoredCategories());
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);
  return createPortal((

        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 20,
          }}
          onClick={() => onClose()}
        >
          <div
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Register Trader Company" className="card"
            style={{ width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "auto", padding: 0, borderRadius: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#e0f2fe",
                    color: "#004d66",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  🏢
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: "#002735", margin: 0 }}>
                    Register Trader Company
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
                    Configure provided equipment categories, delivery speed, and wholesale price range
                  </p>
                </div>
              </div>
              <button
                onClick={() => onClose()}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = (fd.get("name") as string)?.trim();
                if (!name) {
                  toast.error("Please enter the company name");
                  return;
                }
                if (selectedCategories.length === 0) {
                  toast.error("Please select at least one equipment category");
                  return;
                }

                const validContacts = modalContacts.filter((c) => c.name.trim() !== "");
                const primary = validContacts[0] || {
                  name: "Regional Manager",
                  role: "UAE Representative",
                  phone: "+971 4 000 0000",
                  email: "info@supplier.ae",
                };

                const newC: ProcurementCompany = {
                  id: `comp-${Date.now()}`,
                  name,
                  origin: (fd.get("origin") as string) || "Global",
                  uaeOffice: (fd.get("uaeOffice") as string) || "Dubai, UAE",
                  partnership: (fd.get("partnership") as ProcurementCompany["partnership"]) || "Authorized Distributor",
                  equipmentLine: selectedCategories.join(", "),
                  suppliedCategories: selectedCategories,
                  suppliedProducts: [],
                  deliveryLeadTime: leadTime,
                  priceRangeText: `AED ${priceMin.toLocaleString()} - ${priceMax.toLocaleString()}`,
                  productCount: 0,
                  totalVolume: 0,
                  contactPerson: primary.name,
                  contactRole: primary.role || "UAE Representative",
                  phone: primary.phone || "+971 4 000 0000",
                  email: primary.email || "info@supplier.ae",
                  website: (fd.get("website") as string) || "https://medical.ae",
                  flag: "🏢",
                  contacts: validContacts.map((c, idx) => ({
                    id: c.id,
                    name: c.name,
                    role: c.role,
                    phone: c.phone,
                    email: c.email,
                    isPrimary: idx === 0,
                  })),
                };

                const updated = [newC, ...getStoredCompanies()];
                saveStoredCompanies(updated);
                toast.success(`Trader Company "${name}" registered with ${selectedCategories.length} categories!`);
                onCreated?.(newC);
                onClose();
              }}
              style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Company Name *</label>
                <input autoFocus defaultValue={initialName} name="name" className="form-input" placeholder="e.g. Olympus Middle East, Stryker Medical..." required style={{ fontSize: 13 }} />
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Country of Origin</label>
                  <input name="origin" className="form-input" placeholder="e.g. Germany, Japan, USA" style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Partnership Level</label>
                  <select name="partnership" className="form-input" style={{ fontSize: 13 }}>
                    <option value="Exclusive Partner">Exclusive Partner</option>
                    <option value="Authorized Distributor">Authorized Distributor</option>
                    <option value="Channel Partner">Channel Partner</option>
                    <option value="Certified Dealer">Certified Dealer</option>
                  </select>
                </div>
              </div>

              {/* Equipment Categories Provided */}
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Equipment Categories Provided * ({selectedCategories.length} selected)
                </label>
                <select
                  className="form-input"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value as ProductCategory;
                    if (val && !selectedCategories.includes(val)) {
                      setSelectedCategories([...selectedCategories, val]);
                    }
                  }}
                  style={{ fontSize: 13, marginBottom: selectedCategories.length > 0 ? 8 : 0 }}
                >
                  <option value="">-- Select category from dropdown --</option>
                  {categories.map((cat) => (
                    <option
                      key={cat}
                      value={cat}
                      disabled={selectedCategories.includes(cat)}
                    >
                      {selectedCategories.includes(cat) ? `✓ ${cat} (Selected)` : `+ ${cat}`}
                    </option>
                  ))}
                </select>

                {/* Selected category chips */}
                {selectedCategories.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {selectedCategories.map((cat) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                          padding: "3px 8px",
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() => setSelectedCategories(selectedCategories.filter((c) => c !== cat))}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0369a1",
                            cursor: "pointer",
                            fontSize: 12,
                            padding: 0,
                            lineHeight: 1,
                            fontWeight: 800,
                          }}
                          title="Remove category"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Speed & Price Range */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Guaranteed Delivery Speed / Lead Time *
                  </label>
                  <select
                    className="form-input"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    {LEAD_TIME_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </div>

                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                      Wholesale Price Min (AED)
                    </label>
                    <input
                      type="number"
                      step={500}
                      value={priceMin}
                      onChange={(e) => setPriceMin(Number(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                      Wholesale Price Max (AED)
                    </label>
                    <input
                      type="number"
                      step={500}
                      value={priceMax}
                      onChange={(e) => setPriceMax(Number(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>
              </div>

              {/* UAE Office Address */}
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>UAE Office Address</label>
                <input name="uaeOffice" className="form-input" placeholder="e.g. Dubai Silicon Oasis, DTEC Tower, Dubai" style={{ fontSize: 13 }} />
              </div>

              {/* Multiple Contact Persons / Representatives */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#004d66" }}>
                      👥 UAE Contact Persons & Representatives ({modalContacts.length})
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: "#64748b" }}>
                      Add one or multiple contacts for this trader company
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setModalContacts([
                        ...modalContacts,
                        { id: `c-${Date.now()}`, name: "", role: "Sales Rep", phone: "", email: "" },
                      ]);
                    }}
                    style={{ fontSize: 11.5, padding: "5px 10px", fontWeight: 700, color: "#004d66" }}
                  >
                    + Add Person
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {modalContacts.map((contact, idx) => (
                    <div
                      key={contact.id}
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: idx === 0 ? "#0284c7" : "#475569",
                            backgroundColor: idx === 0 ? "#e0f2fe" : "#f1f5f9",
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          {idx === 0 ? "★ Primary Contact Person" : `Person #${idx + 1}`}
                        </span>
                        {modalContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalContacts(modalContacts.filter((c) => c.id !== contact.id));
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#dc2626",
                              fontSize: 11.5,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Trash2 size={12} />
                              Remove
                            </span>
                          </button>
                        )}
                      </div>

                      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                            Contact Person Name *
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Eng. Liu Wei"
                            value={contact.name}
                            onChange={(e) => {
                              const updated = modalContacts.map((c) =>
                                c.id === contact.id ? { ...c, name: e.target.value } : c
                              );
                              setModalContacts(updated);
                            }}
                            style={{ fontSize: 12.5 }}
                            required={idx === 0}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                            Designation / Role
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Regional Director, Sales Lead"
                            value={contact.role}
                            onChange={(e) => {
                              const updated = modalContacts.map((c) =>
                                c.id === contact.id ? { ...c, role: e.target.value } : c
                              );
                              setModalContacts(updated);
                            }}
                            style={{ fontSize: 12.5 }}
                          />
                        </div>
                      </div>

                      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                            Phone Number
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="+971 4 000 0000"
                            value={contact.phone}
                            onChange={(e) => {
                              const updated = modalContacts.map((c) =>
                                c.id === contact.id ? { ...c, phone: e.target.value } : c
                              );
                              setModalContacts(updated);
                            }}
                            style={{ fontSize: 12.5 }}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                            Email Address
                          </label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="rep@company.ae"
                            value={contact.email}
                            onChange={(e) => {
                              const updated = modalContacts.map((c) =>
                                c.id === contact.id ? { ...c, email: e.target.value } : c
                              );
                              setModalContacts(updated);
                            }}
                            style={{ fontSize: 12.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalContacts([
                      ...modalContacts,
                      { id: `c-${Date.now()}`, name: "", role: "Sales Rep", phone: "", email: "" },
                    ]);
                  }}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "#004d66",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  + Add Another Contact Person
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => onClose()}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#004d66" }}>
                  Register Trader Company
                </button>
              </div>
            </form>
          </div>
        </div>
  ), document.body);
}
