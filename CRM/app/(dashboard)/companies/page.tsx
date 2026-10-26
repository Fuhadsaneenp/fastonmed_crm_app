"use client";
import "./trader-mobile.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OrganisationAvatar from "@/components/OrganisationAvatar";
import AddTraderCompanyModal from "@/components/AddTraderCompanyModal";
import CustomLightSelect from "@/components/CustomLightSelect";
import { formatCurrency } from "@/lib/utils";
import type { ProcurementCompany, ProductCategory, Product } from "@/types";
import {
  getStoredCompanies,
  saveStoredCompanies,
  getStoredProducts,
  getStoredCategories,
  DEFAULT_PRODUCT_CATEGORIES,
  isLegacyDummyCompany,
  clearDummyTraderCompanies,
  getDeterministicRepresentative,
} from "@/lib/trader-store";
import {
  getStoredClients,
  findClientForTraderCompany,
  syncTraderClientsToCompanies,
  saveStoredClients,
} from "@/lib/client-store";
import toast from "react-hot-toast";
import { Mail, Trash2, Building2, Plus, ChevronDown, ExternalLink } from "lucide-react";

const CATEGORIES: ProductCategory[] = DEFAULT_PRODUCT_CATEGORIES;



export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<ProcurementCompany[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [search, setSearch] = useState("");
  const [activeActionCompanyId, setActiveActionCompanyId] = useState<string | null>(null);

  const handleOpenCompany = (company: ProcurementCompany) => {
    const client = findClientForTraderCompany(company);
    router.push(`/clients?id=${encodeURIComponent(client.id)}&name=${encodeURIComponent(company.name)}&from=companies`);
  };
  const [partnershipFilter, setPartnershipFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);


  useEffect(() => {
    if (typeof window !== "undefined") {
      clearDummyTraderCompanies();
      const allClients = getStoredClients();
      syncTraderClientsToCompanies(allClients);
    }
    const rawCompanies = getStoredCompanies();
    const cleaned = rawCompanies.filter((c) => !isLegacyDummyCompany(c) && c.name.toLowerCase() !== "asdsad" && c.name.toLowerCase() !== "test");
    if (cleaned.length !== rawCompanies.length) {
      saveStoredCompanies(cleaned);
    }
    setCompanies(cleaned);
    setProducts(getStoredProducts());
    setCategories(getStoredCategories());

    const handleSync = () => {
      setCompanies(getStoredCompanies().filter((c) => !isLegacyDummyCompany(c) && c.name.toLowerCase() !== "asdsad" && c.name.toLowerCase() !== "test"));
      setProducts(getStoredProducts());
      setCategories(getStoredCategories());
    };

    const handleClientsUpdated = () => {
      const allClients = getStoredClients();
      syncTraderClientsToCompanies(allClients);
      handleSync();
    };

    window.addEventListener("fastonmed_companies_updated", handleSync);
    window.addEventListener("fastonmed_clients_updated", handleClientsUpdated);
    window.addEventListener("fastonmed_products_updated", handleSync);
    window.addEventListener("fastonmed_categories_updated", handleSync);
    return () => {
      window.removeEventListener("fastonmed_companies_updated", handleSync);
      window.removeEventListener("fastonmed_clients_updated", handleClientsUpdated);
      window.removeEventListener("fastonmed_products_updated", handleSync);
      window.removeEventListener("fastonmed_categories_updated", handleSync);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      if (activeActionCompanyId) {
        setActiveActionCompanyId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveActionCompanyId(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionCompanyId]);

  const handleDeleteCompany = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from trader companies?`)) {
      const targetCompany = companies.find((c) => c.id === id);
      const updated = companies.filter((c) => c.id !== id);
      setCompanies(updated);
      saveStoredCompanies(updated);

      if (targetCompany) {
        const client = findClientForTraderCompany(targetCompany);
        if (client) {
          const allClients = getStoredClients().map((c) => {
            if (c.id === client.id) {
              return {
                ...c,
                orgType: c.orgType === "Medical Equipment Trader" ? ("Hospital" as any) : c.orgType,
                connectedAs: (c.connectedAs || []).filter(
                  (item) => item.toLowerCase() !== "trader" && item.toLowerCase() !== "merchant"
                ),
              };
            }
            return c;
          });
          saveStoredClients(allClients);
        }
      }
      toast.success(`Removed "${name}"`);
    }
  };

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) ||
      c.origin.toLowerCase().includes(q) ||
      c.equipmentLine.toLowerCase().includes(q) ||
      c.contactPerson.toLowerCase().includes(q);

    const matchPartnership = partnershipFilter === "All" || c.partnership === partnershipFilter;
    const matchCategory =
      categoryFilter === "All" || (c.suppliedCategories && c.suppliedCategories.includes(categoryFilter as ProductCategory));

    return matchSearch && matchPartnership && matchCategory;
  });

  const totalProcuredVolume = companies.reduce((sum, c) => sum + c.totalVolume, 0);
  const totalModelsSupplied = products.length;
  const exclusiveCount = companies.filter((c) => c.partnership === "Exclusive Partner").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.3s ease" }}>
      {/* Filter and Search Bar */}
      <style jsx>{`
        .trader-toolbar {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) minmax(130px, 180px) minmax(140px, 180px) auto;
          gap: 8px;
          align-items: center;
        }
        .trader-toolbar :global(.form-input) { width: 100%; min-width: 0; height: 36px; font-size: 12px; }
        .trader-actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; white-space: nowrap; }
        :global(.trader-table) {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        :global(.trader-table th:not(:last-child)),
        :global(.trader-table td:not(:last-child)) {
          border-right: 1px solid #e2e8f0;
        }
        @media (max-width: 1100px) {
          .trader-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .trader-toolbar { grid-template-columns: minmax(0, 1fr); }
          .trader-actions { justify-content: space-between; flex-wrap: wrap; }
        }
      `}</style>
      <div className="card trader-filter-card" style={{ padding: "10px 12px" }}>
        <div className="trader-toolbar">
          <input
            className="form-input"
            placeholder="Search traders, products…"
            aria-label="Search trader companies, products, or contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Category Filter */}
          <CustomLightSelect
            value={categoryFilter}
            options={[{ value: "All", label: "All categories" }, ...CATEGORIES.map(value => ({ value, label: value }))]}
            onChange={(val) => setCategoryFilter(val)}
            activeColor={categoryFilter !== "All"}
            style={{ width: "auto", minWidth: 175 }}
            buttonStyle={{ height: 38, fontSize: 13 }}
            menuStyle={{ minWidth: 260, maxHeight: 300 }}
            searchable={true}
          />

          {/* Partnership Filter */}
          <CustomLightSelect
            value={partnershipFilter}
            options={[
              { value: "All", label: "All Partnerships" },
              { value: "Exclusive Partner", label: "Exclusive Partner" },
              { value: "Authorized Distributor", label: "Authorized Distributor" },
              { value: "Channel Partner", label: "Channel Partner" },
              { value: "Certified Dealer", label: "Certified Dealer" },
            ]}
            onChange={(val) => setPartnershipFilter(val)}
            activeColor={partnershipFilter !== "All"}
            style={{ width: "auto", minWidth: 175 }}
            buttonStyle={{ height: 38, fontSize: 13 }}
            menuStyle={{ minWidth: 200 }}
          />

          <div className="trader-actions">
            <button
              type="button"
              aria-label="Add trader company"
              title="Add trader company"
              className="btn btn-primary"
              style={{ backgroundColor: "#004d66", height: 36, padding: "6px 10px", fontSize: 12 }}
              onClick={() => {
                setShowAddModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" /><span className="trader-add-label">Add Trader</span>
            </button>
          </div>
        </div>
      </div>

      {/* Showing count */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          <strong>{filtered.length}</strong> trader companies
        </p>
        {(search || categoryFilter !== "All" || partnershipFilter !== "All") && <button type="button" className="trader-reset-filters" onClick={() => { setSearch(""); setCategoryFilter("All"); setPartnershipFilter("All"); }}>Reset filters</button>}
      </div>

      {/* Trader company list */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "54px 24px",
            textAlign: "center",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={26} />
          </div>
          <div>
            <h4 style={{ margin: "0 0 5px 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              No Trader Companies Registered
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", maxWidth: 440, lineHeight: 1.5 }}>
              {search || partnershipFilter !== "All" || categoryFilter !== "All"
                ? "No companies match your current search filters. Try clearing your search or filters."
                : "No trader or procurement partner companies registered yet. Click \"+ Add Trader Company\" to register a new equipment supplier."}
            </p>
          </div>
          {!search && partnershipFilter === "All" && categoryFilter === "All" && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{
                marginTop: 6,
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: "#004d66",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(0, 77, 102, 0.2)",
              }}
            >
              <Plus size={15} />
              <span>Add Trader Company</span>
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table data-mobile-cards="true" className="trader-table">
              <thead>
                <tr>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Trader Company</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Partnership</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Categories Provided</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>UAE Representative</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Product Count</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company, idx) => {
                  const badgeStyle =
                    company.partnership === "Exclusive Partner"
                      ? { bg: "#fef3c7", color: "#b45309", border: "#fde68a" }
                      : company.partnership === "Authorized Distributor"
                      ? { bg: "#eaf8f4", color: "#004d66", border: "#b2e7d9" }
                      : { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };

                  const linkedOrganisation = findClientForTraderCompany(company);
                  const companyProducts = products.filter(
                    (p) =>
                      p.traderCompanyId === company.id ||
                      p.traderCompanyName?.toLowerCase() === company.name.toLowerCase()
                  );

                  return (
                    <tr
                      key={company.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleOpenCompany(company)}
                    >
                      <td data-label="Trader Company" style={{ minWidth: 200, borderRight: "1px solid #e2e8f0" }}>
                        <div className="trader-card-identity">
                          <OrganisationAvatar name={company.name} logo={linkedOrganisation?.logo} photo={linkedOrganisation?.photo} size={46} />
                          <div><strong>{company.name}</strong><p>{[company.origin, company.uaeOffice?.split(",")[0]].filter(Boolean).join(" · ")}</p></div>
                        </div>
                      </td>
                      <td data-label="Partnership" style={{ whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                            border: `1px solid ${badgeStyle.border}`,
                            padding: "3px 9px",
                            borderRadius: 20,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {company.partnership}
                        </span>
                      </td>
                      <td data-label="Categories Provided" style={{ minWidth: 190, borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
                          {company.suppliedCategories && company.suppliedCategories.length > 0 ? (
                            <>
                              {company.suppliedCategories.slice(0, 2).map((cat) => (
                                <span
                                  key={cat}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: "#f0f9ff",
                                    color: "#0284c7",
                                    border: "1px solid #bae6fd",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {cat}
                                </span>
                              ))}
                              {company.suppliedCategories.length > 2 && (
                                <span
                                  title={company.suppliedCategories.slice(2).join(", ")}
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    backgroundColor: "#f1f5f9",
                                    color: "#475569",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    whiteSpace: "nowrap",
                                    cursor: "help",
                                  }}
                                >
                                  +{company.suppliedCategories.length - 2}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>General Medical Line</span>
                          )}
                        </div>
                      </td>
                      <td data-label="UAE Representative" style={{ whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}>
                        {(() => {
                          const fallback = getDeterministicRepresentative(company.name || company.id);
                          const repName = company.contactPerson?.trim() || fallback.name;
                          const repPhone = company.phone?.trim() || fallback.phone;

                          return (
                            <>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#004d66" }}>
                                {repName}
                              </div>
                              <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                {repPhone ? (
                                  <a
                                    href={`tel:${repPhone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: "#0284c7", textDecoration: "none", fontWeight: 500 }}
                                  >
                                    📞 {repPhone}
                                  </a>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td data-label="Product Count" style={{ textAlign: "center", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}>
                        {(() => {
                          const count = Math.max(companyProducts.length, company.productCount || 0);
                          return (
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                backgroundColor: count > 0 ? "#f0fdf4" : "#f1f5f9",
                                color: count > 0 ? "#16a34a" : "#64748b",
                                border: `1px solid ${count > 0 ? "#bbf7d0" : "#e2e8f0"}`,
                                padding: "3px 9px",
                                borderRadius: 20,
                              }}
                            >
                              {count} {count === 1 ? "Product" : "Products"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="trader-mobile-actions" data-label="Actions"
                        style={{
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          position: "relative",
                          zIndex: activeActionCompanyId === company.id ? 40 : 1,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionCompanyId(
                                activeActionCompanyId === company.id ? null : company.id
                              );
                            }}
                            title="Actions"
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: activeActionCompanyId === company.id ? "1px solid #004d66" : "1px solid #cbd5e1",
                              backgroundColor: activeActionCompanyId === company.id ? "#f0fdfa" : "#ffffff",
                              color: activeActionCompanyId === company.id ? "#004d66" : "#334155",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                            onMouseEnter={(e) => {
                              if (activeActionCompanyId !== company.id) {
                                e.currentTarget.style.borderColor = "#94a3b8";
                                e.currentTarget.style.backgroundColor = "#f8fafc";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (activeActionCompanyId !== company.id) {
                                e.currentTarget.style.borderColor = "#cbd5e1";
                                e.currentTarget.style.backgroundColor = "#ffffff";
                              }
                            }}
                          >
                            <span>Manage</span>
                            <ChevronDown
                              size={12}
                              style={{
                                transform: activeActionCompanyId === company.id ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>

                          {activeActionCompanyId === company.id && (
                            <div className="trader-action-menu"
                              style={{
                                position: "absolute",
                                right: 0,
                                ...(idx >= filtered.length - 2 && filtered.length > 2
                                  ? { bottom: "calc(100% + 4px)" }
                                  : { top: "calc(100% + 4px)" }),
                                zIndex: 100,
                                backgroundColor: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: 8,
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.14), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
                                minWidth: 160,
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
                                  setActiveActionCompanyId(null);
                                  handleOpenCompany(company);
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
                                <Building2 size={13.5} color="#004d66" />
                                <span>Open Profile</span>
                              </button>

                              {company.email && (
                                <a
                                  href={`mailto:${company.email}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionCompanyId(null);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "7px 10px",
                                    borderRadius: 6,
                                    textDecoration: "none",
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
                                  <Mail size={13.5} color="#0284c7" />
                                  <span>Send Email</span>
                                </a>
                              )}

                              {company.website && (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionCompanyId(null);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "7px 10px",
                                    borderRadius: 6,
                                    textDecoration: "none",
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
                                  <ExternalLink size={13.5} color="#006680" />
                                  <span>Visit Website</span>
                                </a>
                              )}

                              <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "3px 0" }} />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionCompanyId(null);
                                  handleDeleteCompany(company.id, company.name);
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
                                <Trash2 size={13.5} color="#dc2626" />
                                <span>Delete Company</span>
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
      )}

      {showAddModal && <AddTraderCompanyModal onClose={() => setShowAddModal(false)} />}

    </div>
  );
}
