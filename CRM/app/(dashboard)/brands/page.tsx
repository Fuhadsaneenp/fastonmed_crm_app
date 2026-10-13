"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Search,
  Plus,
  ExternalLink,
  Package,
  Building2,
  Globe2,
  Layers,
  Edit3,
  Trash2,
  LayoutGrid,
  List,
  X,
  Check,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type { ProductCategory } from "@/types";
import {
  getStoredBrandDetails,
  addStoredBrand,
  deleteStoredBrand,
  type BrandInfo,
  getStoredCategories,
  getStoredProducts,
} from "@/lib/trader-store";
import { getCatalogProducts } from "@/lib/woocommerce/catalog-store";
import { syncTaxonomies } from "@/lib/woocommerce/sync";
import toast from "react-hot-toast";

const BRAND_PALETTES = [
  { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" },
  { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
  { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" },
  { bg: "#fae8ff", text: "#a21caf", border: "#f5d0fe" },
];

function getBrandBadgeColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BRAND_PALETTES.length;
  return BRAND_PALETTES[index];
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("All");
  const [view, setView] = useState<"list" | "grid">("list");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandInfo | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalCountry, setModalCountry] = useState("Germany");
  const [modalWebsite, setModalWebsite] = useState("");
  const [modalDescription, setModalDescription] = useState("");

  const [syncingWoo, setSyncingWoo] = useState(false);

  const refreshBrands = async () => {
    const catalogProds = await getCatalogProducts().catch(() => getStoredProducts());
    setBrands(getStoredBrandDetails(catalogProds));
  };

  const handleSyncTaxonomies = async () => {
    setSyncingWoo(true);
    try {
      const { categories, brands: wooBrands } = await syncTaxonomies();
      toast.success(`Synced ${wooBrands.length} brands & ${categories.length} categories from fastonmed.com!`);
      await refreshBrands();
    } catch {
      toast.error("Failed to fetch WooCommerce taxonomies");
    } finally {
      setSyncingWoo(false);
    }
  };

  useEffect(() => {
    void syncTaxonomies();
    void refreshBrands();

    const handleUpdate = () => {
      void refreshBrands();
    };

    window.addEventListener("fastonmed_brands_updated", handleUpdate);
    window.addEventListener("fastonmed_products_updated", handleUpdate);

    return () => {
      window.removeEventListener("fastonmed_brands_updated", handleUpdate);
      window.removeEventListener("fastonmed_products_updated", handleUpdate);
    };
  }, []);

  const [activeActionDropdownBrand, setActiveActionDropdownBrand] = useState<string | null>(null);

  useEffect(() => {
    if (!activeActionDropdownBrand) return;
    const handleOutsideClick = () => setActiveActionDropdownBrand(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveActionDropdownBrand(null);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionDropdownBrand]);

  const handleOpenAddModal = (brandToEdit?: BrandInfo) => {
    if (brandToEdit) {
      setEditingBrand(brandToEdit);
      setModalName(brandToEdit.name);
      setModalCountry(brandToEdit.country || "Global");
      setModalWebsite(brandToEdit.website || "");
      setModalDescription(brandToEdit.description || "");
    } else {
      setEditingBrand(null);
      setModalName("");
      setModalCountry("Germany");
      setModalWebsite("");
      setModalDescription("");
    }
    setShowAddModal(true);
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = modalName.trim();
    if (!trimmed) {
      toast.error("Please enter a brand name");
      return;
    }

    addStoredBrand(trimmed, {
      country: modalCountry.trim() || "Global",
      website: modalWebsite.trim() || undefined,
      description: modalDescription.trim() || `Medical brand specialized in clinical healthcare solutions.`,
    });

    toast.success(editingBrand ? `Brand "${trimmed}" updated!` : `New brand "${trimmed}" added!`);
    setShowAddModal(false);
    refreshBrands();
  };

  const handleDeleteBrand = (brandName: string) => {
    if (confirm(`Are you sure you want to remove brand "${brandName}"?`)) {
      deleteStoredBrand(brandName);
      toast.success(`Brand "${brandName}" removed`);
      refreshBrands();
    }
  };

  // Distinct countries for filter
  const allCountries = Array.from(
    new Set(brands.map((b) => b.country).filter(Boolean))
  ).sort();

  const allCategories = getStoredCategories();

  // Filtered list
  const filtered = brands.filter((b) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.country.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.categories.some((c) => c.toLowerCase().includes(q)) ||
      b.traders.some((t) => t.toLowerCase().includes(q));

    const matchesCountry = countryFilter === "All" || b.country === countryFilter;
    const matchesCategory =
      categoryFilter === "All" || b.categories.includes(categoryFilter as ProductCategory);

    return matchesSearch && matchesCountry && matchesCategory;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.3s ease" }}>


      {/* Filter and Search Bar */}
      <style jsx>{`
        .brand-toolbar {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) minmax(130px, 170px) minmax(130px, 170px) auto;
          gap: 8px;
          align-items: center;
        }
        .brand-toolbar :global(.form-input) { width: 100%; min-width: 0; height: 36px; font-size: 12.5px; }
        .brand-actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; white-space: nowrap; }
        :global(.brand-table) {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        :global(.brand-table th:not(:last-child)),
        :global(.brand-table td:not(:last-child)) {
          border-right: 1px solid #e2e8f0;
        }
        @media (max-width: 1000px) {
          .brand-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .brand-toolbar { grid-template-columns: minmax(0, 1fr); }
          .brand-actions { justify-content: space-between; flex-wrap: wrap; }
        }
      `}</style>
      <div className="card" style={{ padding: "10px 12px" }}>
        <div className="brand-toolbar">
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              className="form-input"
              placeholder="Search brand name, country, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories ({allCategories.length})</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="All">All Countries ({allCountries.length})</option>
            {allCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="brand-actions">
            <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 8, gap: 2 }}>
              <button
                type="button"
                className={`btn ${view === "list" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "5px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={() => setView("list")}
              >
                <List size={13} />
                List
              </button>
              <button
                type="button"
                className={`btn ${view === "grid" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "5px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={13} />
                Grid
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 36, padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              disabled={syncingWoo}
              onClick={handleSyncTaxonomies}
              title="Fetch all categories and brands from fastonmed.com"
            >
              <RefreshCw size={13} style={{ animation: syncingWoo ? "spin 1s linear infinite" : "none" }} />
              <span>{syncingWoo ? "Fetching..." : "Fetch WooCommerce"}</span>
            </button>

            <button
              className="btn btn-primary"
              style={{ backgroundColor: "#004d66", height: 36, padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={() => handleOpenAddModal()}
            >
              <Plus size={14} />
              <span>Add Brand</span>
            </button>
          </div>
        </div>
      </div>

      {/* Showing count */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Showing <strong>{filtered.length}</strong> medical equipment brands available in the CRM
        </p>
      </div>

      {/* Brand List or Grid View */}
      {view === "list" ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table data-mobile-cards="true" className="brand-table">
              <thead>
                <tr>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Brand & Overview</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Country of Origin</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>Equipment Categories</th>
                  <th style={{ borderRight: "1px solid #e2e8f0", textAlign: "center" }}>Catalog Models</th>
                  <th style={{ borderRight: "1px solid #e2e8f0" }}>UAE Distributors</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "#64748b" }}>
                      No brands found matching your search. Click <strong>+ Add Brand</strong> to register a new one.
                    </td>
                  </tr>
                ) : (
                  filtered.map((brand) => {
                    const badgeColors = getBrandBadgeColors(brand.name);
                    return (
                      <tr key={brand.name} style={{ transition: "background 0.15s ease" }}>
                        {/* Column 1: Brand & Overview */}
                        <td data-label="Brand & Overview" style={{ minWidth: 220, borderRight: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                backgroundColor: badgeColors.bg,
                                color: badgeColors.text,
                                border: `1px solid ${badgeColors.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 14,
                                flexShrink: 0,
                              }}
                            >
                              {brand.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: "#004d66" }}>
                                {brand.name}
                              </div>
                              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {brand.description}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Country */}
                        <td data-label="Country of Origin" style={{ whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              backgroundColor: "#f8fafc",
                              color: "#334155",
                              border: "1px solid #e2e8f0",
                              padding: "3px 9px",
                              borderRadius: 6,
                            }}
                          >
                            {brand.country || "Global"}
                          </span>
                        </td>

                        {/* Column 3: Categories */}
                        <td data-label="Equipment Categories" style={{ minWidth: 180, borderRight: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {brand.categories.length > 0 ? (
                              brand.categories.slice(0, 2).map((cat) => (
                                <span
                                  key={cat}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: "#f0f9ff",
                                    color: "#0284c7",
                                    border: "1px solid #bae6fd",
                                    padding: "2px 7px",
                                    borderRadius: 5,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                                Multi-specialty
                              </span>
                            )}
                            {brand.categories.length > 2 && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  backgroundColor: "#f1f5f9",
                                  color: "#475569",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                +{brand.categories.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Column 4: Catalog Models */}
                        <td data-label="Catalog Models" style={{ textAlign: "center", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}>
                          <button
                            type="button"
                            onClick={() => router.push(`/products?brand=${encodeURIComponent(brand.name)}`)}
                            title={`View ${brand.name} products in catalog`}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                backgroundColor: brand.productCount > 0 ? "#f0fdf4" : "#f1f5f9",
                                color: brand.productCount > 0 ? "#16a34a" : "#64748b",
                                border: `1px solid ${brand.productCount > 0 ? "#bbf7d0" : "#e2e8f0"}`,
                                padding: "3px 9px",
                                borderRadius: 20,
                                transition: "all 0.15s ease",
                              }}
                            >
                              {brand.productCount} {brand.productCount === 1 ? "Model" : "Models"}
                            </span>
                          </button>
                        </td>

                        {/* Column 5: UAE Distributors */}
                        <td data-label="UAE Distributors" style={{ minWidth: 180, borderRight: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                            {brand.traders.length > 0 ? brand.traders.join(", ") : "FastonMed Direct"}
                          </div>
                        </td>

                        {/* Column 6: Actions Dropdown */}
                        <td data-label="Actions"
                          style={{
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            position: "relative",
                            zIndex: activeActionDropdownBrand === brand.name ? 40 : 1,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionDropdownBrand(
                                  activeActionDropdownBrand === brand.name ? null : brand.name
                                );
                              }}
                              style={{
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: activeActionDropdownBrand === brand.name ? "1px solid #004d66" : "1px solid #cbd5e1",
                                backgroundColor: activeActionDropdownBrand === brand.name ? "#f0fdfa" : "#ffffff",
                                color: activeActionDropdownBrand === brand.name ? "#004d66" : "#334155",
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
                                  transform: activeActionDropdownBrand === brand.name ? "rotate(180deg)" : "none",
                                  transition: "transform 0.15s ease",
                                }}
                              />
                            </button>

                            {activeActionDropdownBrand === brand.name && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "calc(100% + 4px)",
                                  zIndex: 100,
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 8,
                                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                                  minWidth: 165,
                                  padding: "4px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownBrand(null);
                                    router.push(`/products?brand=${encodeURIComponent(brand.name)}`);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "7px 10px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "#004d66",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdfa")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Package size={13} style={{ color: "#004d66" }} />
                                  <span>View Products</span>
                                </button>

                                {brand.website && (
                                  <a
                                    href={brand.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setActiveActionDropdownBrand(null)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      width: "100%",
                                      padding: "7px 10px",
                                      border: "none",
                                      backgroundColor: "transparent",
                                      color: "#334155",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      textDecoration: "none",
                                      textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  >
                                    <ExternalLink size={13} style={{ color: "#64748b" }} />
                                    <span>Official Website</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownBrand(null);
                                    handleOpenAddModal(brand);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "7px 10px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "#334155",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Edit3 size={13} style={{ color: "#64748b" }} />
                                  <span>Edit Brand</span>
                                </button>

                                <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownBrand(null);
                                    handleDeleteBrand(brand.name);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "7px 10px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "#dc2626",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Trash2 size={13} style={{ color: "#dc2626" }} />
                                  <span>Delete Brand</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14, alignItems: "start" }}>
          {filtered.map((brand) => {
            const badgeColors = getBrandBadgeColors(brand.name);
            return (
              <div
                key={brand.name}
                className="card"
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 12,
                  transition: "all 0.2s ease",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          backgroundColor: badgeColors.bg,
                          color: badgeColors.text,
                          border: `1px solid ${badgeColors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {brand.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#002735" }}>
                          {brand.name}
                        </h3>
                        <span style={{ fontSize: 11.5, color: "#64748b" }}>
                          Origin: {brand.country || "Global"}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: brand.productCount > 0 ? "#f0fdf4" : "#f1f5f9",
                        color: brand.productCount > 0 ? "#16a34a" : "#64748b",
                        border: `1px solid ${brand.productCount > 0 ? "#bbf7d0" : "#e2e8f0"}`,
                        padding: "3px 8px",
                        borderRadius: 20,
                      }}
                    >
                      {brand.productCount} {brand.productCount === 1 ? "Product" : "Products"}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.45, margin: "8px 0 12px 0" }}>
                    {brand.description}
                  </p>

                  {/* Categories */}
                  {brand.categories.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                      {brand.categories.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            backgroundColor: "#f0f9ff",
                            color: "#0284c7",
                            border: "1px solid #bae6fd",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {brand.website && (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <span>Website</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(brand)}
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: 11.5 }}
                      title="Edit Brand"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBrand(brand.name)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: "4px 6px",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                      title="Delete Brand"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/products?brand=${encodeURIComponent(brand.name)}`)}
                    className="btn btn-primary"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      backgroundColor: "#004d66",
                    }}
                  >
                    View Catalog →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Brand Modal */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 520, padding: 0, borderRadius: 14, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Award size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#002735" }}>
                    {editingBrand ? "Edit Medical Brand" : "Add New Medical Brand"}
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Available across all product catalogs & expiry tracking
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBrand} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Brand Name *
                </label>
                <input
                  className="form-input"
                  placeholder="e.g. Mindray, Dräger, Philips"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Country of Origin
                  </label>
                  <input
                    className="form-input"
                    placeholder="e.g. Germany, USA, Japan"
                    value={modalCountry}
                    onChange={(e) => setModalCountry(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                    Official Website URL
                  </label>
                  <input
                    className="form-input"
                    placeholder="https://..."
                    value={modalWebsite}
                    onChange={(e) => setModalWebsite(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Overview & Medical Specialization
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Specialization, clinical equipment types, or certifications..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  style={{ fontSize: 12.5, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
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
                  style={{ backgroundColor: "#004d66", fontSize: 12.5, fontWeight: 600, padding: "7px 18px" }}
                >
                  {editingBrand ? "Save Changes" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
