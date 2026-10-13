"use client";
import AddProductModal from "@/components/AddProductModal";
import ProductDescription from "@/components/ProductDescription";
import WooCommerceSync from "@/components/WooCommerceSync";
import CustomLightSelect from "@/components/CustomLightSelect";
import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductCategory, ProcurementCompany, ProductTraderOffer } from "@/types";
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredCompanies,
  saveStoredCompanies,
  addProductWithTrader,
  updateProduct,
  deleteStoredProduct,
  getStoredCategories,
  addStoredCategory,
  DEFAULT_PRODUCT_CATEGORIES,
  getStoredBrands,
  addStoredBrand,
  clearDummyProducts,
} from "@/lib/trader-store";
import toast from "react-hot-toast";
import { getCatalogProducts, putWooCommerceProducts, notifyWooCommerceProductsUpdated, type LinkedProduct } from "@/lib/woocommerce/catalog-store";
import { syncTaxonomies, syncWooCommerce } from "@/lib/woocommerce/sync";
import { getAuthToken } from "@/lib/api-client";

import {
  FileText,
  Sliders,
  Globe,
  ExternalLink,
  Sparkles,
  Loader2,
  Link as LinkIcon,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  X,
  Search,
  Building2,
  ShieldCheck,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Eye,
  Edit3,
  Package,
  Layers,
  LayoutGrid,
  List,
  CheckCircle2,
  Tag,
  Plus,
  ArrowRight,
  Check,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

function decodeHtml(html: string) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘');
}

const CATEGORIES: ProductCategory[] = DEFAULT_PRODUCT_CATEGORIES;

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "ICU Equipment": { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  "OT Equipment": { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe" },
  "Diagnostic Equipment": { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "Laboratory Equipment": { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "Patient Monitoring": { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  "Imaging Equipment": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  "Dental Equipment": { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  "Physiotherapy Equipment": { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5" },
  "Surgical Equipment": { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  "Sterilization": { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

const PRODUCT_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22120%22%3E%3Crect%20width%3D%22160%22%20height%3D%22120%22%20fill%3D%22%23f1f5f9%22%2F%3E%3Ctext%20x%3D%2280%22%20y%3D%2265%22%20text-anchor%3D%22middle%22%20fill%3D%22%2364748b%22%20font-family%3D%22Arial%22%20font-size%3D%2214%22%3ENo%20image%3C%2Ftext%3E%3C%2Fsvg%3E";

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  "ICU Equipment": "/products/ventilator.jpg",
  "Patient Monitoring": "/products/patient-monitor.jpg",
  "Imaging Equipment": "/products/ultrasound.jpg",
  "Diagnostic Equipment": "/products/ecg-machine.jpg",
  "Dental Equipment": "/products/dental-chair.jpg",
  "Laboratory Equipment": "/products/biochemistry.jpg",
  "Surgical Equipment": "/products/ventilator.jpg",
  "OT Equipment": "/products/ultrasound.jpg",
  "Physiotherapy Equipment": "/products/patient-monitor.jpg",
  "Sterilization": "/products/biochemistry.jpg",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  "ICU Equipment": "🏥",
  "OT Equipment": "🔬",
  "Diagnostic Equipment": "🩺",
  "Laboratory Equipment": "⚗️",
  "Patient Monitoring": "📊",
  "Imaging Equipment": "📡",
  "Dental Equipment": "🦷",
  "Physiotherapy Equipment": "💪",
  "Surgical Equipment": "🔪",
  "Sterilization": "🧪",
};

const BG_GRADIENTS = [
  "linear-gradient(135deg, #f8fafc, #edf2f7)",
  "linear-gradient(135deg, #f0fdf4, #e6f7ef)",
  "linear-gradient(135deg, #f0f9ff, #e0f2fe)",
  "linear-gradient(135deg, #fdf4ff, #fae8ff)",
];

const LEAD_TIME_PRESETS = [
  "Immediate (Ex-Stock Dubai)",
  "2 - 3 Business Days",
  "3 - 5 Days (UAE Stock)",
  "1 - 2 Weeks (Air Freight)",
  "2 - 3 Weeks (Regional Stock)",
  "4 - 6 Weeks (Special Import)",
];

export default function ProductsPage() {
  return <Suspense fallback={<p>Loading products…</p>}><ProductsContent /></Suspense>;
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [companies, setCompanies] = useState<ProcurementCompany[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [mobileCatalogFilters, setMobileCatalogFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterTrader, setFilterTrader] = useState("All");
  const [sortBy, setSortBy] = useState<"default" | "id" | "name" | "brand" | "price_asc" | "price_desc" | "stock">("default");
  const [entriesPerPage, setEntriesPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [view, setView] = useState<"grid" | "list">("list");
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    const brandParam = searchParams?.get("brand");
    if (brandParam) {
      setFilterBrand(brandParam);
    }
  }, [searchParams]);

  // Handle Back to Product List when viewing product details
  useEffect(() => {
    if (!selected) return;

    const handleHeaderBack = (e: Event) => {
      e.preventDefault();
      setSelected(null);
    };

    window.addEventListener("fastonmed_header_back", handleHeaderBack);
    return () => {
      window.removeEventListener("fastonmed_header_back", handleHeaderBack);
    };
  }, [selected]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);

  const openWebsiteProductEditor = (product: Product) => {
    router.push(`/products/${encodeURIComponent(product.id)}`);
  };

  // Close actions dropdown on click outside or escape key
  useEffect(() => {
    if (!activeActionDropdownId) return;
    const handleOutsideClick = () => setActiveActionDropdownId(null);
    window.addEventListener("click", handleOutsideClick);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveActionDropdownId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionDropdownId]);

  // Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📦");

  // Form State for Add Product
  const [formCategory, setFormCategory] = useState<string>("");
  const [formBrand, setFormBrand] = useState<string>("");
  const [formBrandDropdownOpen, setFormBrandDropdownOpen] = useState(false);
  const formBrandDropdownRef = useRef<HTMLDivElement>(null);
  const [storedBrands, setStoredBrands] = useState<string[]>([]);
  const [formTraderId, setFormTraderId] = useState<string>("");
  const [formLeadTime, setFormLeadTime] = useState<string>("");
  const [formTraderMin, setFormTraderMin] = useState<string>("");
  const [formTraderMax, setFormTraderMax] = useState<string>("");
  const [formPurchaseCost, setFormPurchaseCost] = useState<string>("");
  const [formSellingPrice, setFormSellingPrice] = useState<string>("");
  const [formVatStatus, setFormVatStatus] = useState<string>("5% Standard Rate");
  const [formWarranty, setFormWarranty] = useState<string>("");
  const [formImage, setFormImage] = useState<string>("");
  const modalImageFileRef = useRef<HTMLInputElement>(null);

  const handleModalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP, SVG)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormImage(result);
      toast.success("Product image attached!");
    };
    reader.readAsDataURL(file);
  };

  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  const handleManualSync = async () => {
    try {
      setIsSyncingCatalog(true);
      toast.loading("Loading the shared website catalog...", { id: "sync-catalog" });
      const response = await fetch('/api/products', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.products)) throw new Error('Shared catalog unavailable. Please retry.');
      const prods: Product[] = data.products;
      setProducts(prods);
      setCatalogError('');
      setCategories(Array.from(new Set([...getStoredCategories(), ...prods.map(p => p.category).filter(Boolean)])).sort());
      setStoredBrands(Array.from(new Set(prods.map(p => p.brand).filter(Boolean))).sort());
      toast.success(`Catalog updated successfully (${prods.length} products available)`, { id: "sync-catalog" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync catalog", { id: "sync-catalog" });
    } finally {
      setIsSyncingCatalog(false);
      setCatalogLoading(false);
    }
  };

  // Persistent live syncing
  useEffect(() => {
    clearDummyProducts();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let refreshing = false;
    let queuedRefresh = false;
    const refreshProducts = async () => {
      if (refreshing) { queuedRefresh = true; return; }
      refreshing = true;
      setCatalogLoading(true);
      setCatalogError('');
      let freshReceived = false;
      const prods = await getCatalogProducts({ onCached: cached => {
        if (!cancelled && !freshReceived) {
          setProducts(cached);
          setStoredBrands(Array.from(new Set(cached.map(p => p.brand).filter(Boolean))).sort());
        }
      }, onError: () => {
        if (!cancelled) setCatalogError('Could not refresh the shared catalog. Showing cached products; click Sync to retry.');
      } }).catch(() => getStoredProducts());
      freshReceived = true;
      refreshing = false;
      if (cancelled) return;
      setProducts(prods);
      setCatalogLoading(false);

      const catSet = new Set<string>(getStoredCategories());
      prods.forEach((p) => {
        if (p.category && p.category !== "Uncategorized") catSet.add(p.category.trim());
      });
      setCategories(Array.from(catSet).filter(Boolean).sort((a, b) => a.localeCompare(b)));

      const brandSet = new Set<string>(getStoredBrands(prods));
      prods.forEach((p) => {
        if (p.brand && p.brand.toLowerCase() !== "manufacturer" && p.brand.toLowerCase() !== "unknown") {
          brandSet.add(p.brand.trim());
        }
      });
      setStoredBrands(Array.from(brandSet).filter(Boolean).sort((a, b) => a.localeCompare(b)));
      if (queuedRefresh) {
        queuedRefresh = false;
        void refreshProducts();
      }
    };
    void syncTaxonomies();
    void refreshProducts();
    setCompanies(getStoredCompanies());

    const handleSync = () => {
      // Several stores announce the same update at once; render once after
      // they settle instead of starting overlapping IndexedDB reads.
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refreshProducts(), 80);
      setCompanies(getStoredCompanies());
    };

    window.addEventListener("fastonmed_products_updated", handleSync);
    const refreshTaxonomies = () => {
      setCompanies(getStoredCompanies());
      setCategories(getStoredCategories());
    };
    window.addEventListener("fastonmed_companies_updated", refreshTaxonomies);
    window.addEventListener("fastonmed_categories_updated", refreshTaxonomies);
    window.addEventListener("fastonmed_brands_updated", refreshTaxonomies);
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("fastonmed_products_updated", handleSync);
      window.removeEventListener("fastonmed_companies_updated", refreshTaxonomies);
      window.removeEventListener("fastonmed_categories_updated", refreshTaxonomies);
      window.removeEventListener("fastonmed_brands_updated", refreshTaxonomies);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formBrandDropdownRef.current && !formBrandDropdownRef.current.contains(e.target as Node)) {
        setFormBrandDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenAddModal = () => {
    setFormCategory("");
    setFormBrand("");
    setFormTraderId("");
    setFormLeadTime("");
    setFormTraderMin("");
    setFormTraderMax("");
    setFormPurchaseCost("");
    setFormSellingPrice("");
    setFormVatStatus("5% Standard Rate");
    setFormWarranty("");
    setFormImage("");
    router.push('/products/new');
  };

  const handleTraderSelectionChange = (cId: string) => {
    setFormTraderId(cId);
    const comp = companies.find((c) => c.id === cId);
    if (comp) {
      setFormLeadTime(comp.deliveryLeadTime || "3 - 5 Days (UAE Stock)");
      if (comp.suppliedCategories && comp.suppliedCategories.length > 0 && !comp.suppliedCategories.includes(formCategory)) {
        setFormCategory(comp.suppliedCategories[0]);
      }
    }
  };

  const getProductId = (p?: Product | null) => {
    if (!p) return "#77000";
    const cleanId = String(p.id || "");
    const cleanName = String(p.name || "");
    const digits = cleanId.replace(/\D/g, "");
    const fallbackNum = cleanName.length > 0 ? Math.abs(cleanName.charCodeAt(0) * 17) : 100;
    return `#77${(digits || fallbackNum).toString().padStart(5, "0").slice(0, 5)}`;
  };

  const getProductRecency = (p?: Product | null): number => {
    if (!p) return 0;
    if ((p as any).createdAt) {
      const d = new Date((p as any).createdAt).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
    const cleanId = String(p.id || "");
    const match = cleanId.match(/^prod-(?:exp-)?(\d{12,})/);
    if (match) {
      return Number(match[1]);
    }
    const wooId = (p as LinkedProduct).woo?.id || (cleanId.startsWith("woo-") ? Number(cleanId.replace("woo-", "")) : 0);
    if (wooId && !isNaN(wooId)) {
      return 1000000000000 + wooId;
    }
    const digits = Number(cleanId.replace(/\D/g, ""));
    return isNaN(digits) ? 0 : digits;
  };

  const getStartDate = (p?: Product | null) => {
    if (!p) return "01/01/2026";
    if ((p as any).createdAt) {
      const d = new Date((p as any).createdAt);
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        return `${month}/${day}/${year}`;
      }
    }
    const cleanId = String(p.id || "");
    const match = cleanId.match(/^prod-(?:exp-)?(\d{12,})/);
    if (match) {
      const d = new Date(Number(match[1]));
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        return `${month}/${day}/${year}`;
      }
    }
    const cleanName = String(p.name || "");
    const charSum = cleanName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const day = ((charSum % 27) + 1).toString().padStart(2, "0");
    const month = ((charSum % 11) + 1).toString().padStart(2, "0");
    return `${month}/${day}/2026`;
  };

  const filteredAndSorted = (products || [])
    .filter((p) => {
      if (!p) return false;
      const prodId = getProductId(p).toLowerCase();
      const cleanSearch = search.trim().toLowerCase();
      let matchSearch = true;
      if (cleanSearch) {
        const normalize = (str: string) => str.toLowerCase().replace(/[-_–—/]/g, " ").replace(/\s+/g, " ").trim();
        const normSearch = normalize(cleanSearch);
        const targetStr = `${p.name || ""} ${p.brand || ""} ${p.model || ""} ${prodId} ${p.traderCompanyName || ""} ${p.category || ""} ${(p.tags || []).join(" ")} ${p.description || ""}`;
        const normTarget = normalize(targetStr);

        if (normTarget.includes(normSearch) || targetStr.toLowerCase().includes(cleanSearch)) {
          matchSearch = true;
        } else {
          // Tokenized search: all keywords in search query must appear in target
          const tokens = normSearch.split(" ").filter((t) => t.length > 0 && t !== "x" && t !== "units" && t !== "unit");
          matchSearch = tokens.length > 0 && tokens.every((tok) => normTarget.includes(tok));
        }
      }

      const matchCat = !filterCategory || filterCategory === "All" || p.category === filterCategory;
      const matchBrand =
        !filterBrand ||
        filterBrand === "All" ||
        (p.brand || "").trim().toLowerCase() === filterBrand.trim().toLowerCase();
      const matchTrader = !filterTrader || filterTrader === "All" || p.traderCompanyId === filterTrader || p.traderCompanyName === filterTrader;
      return matchSearch && matchCat && matchBrand && matchTrader;
    })
    .sort((a, b) => {
      if (sortBy === "id") return getProductId(a).localeCompare(getProductId(b));
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "brand") return (a.brand || "").localeCompare(b.brand || "");
      if (sortBy === "price_asc") return (Number(a.sellingPrice) || 0) - (Number(b.sellingPrice) || 0);
      if (sortBy === "price_desc") return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
      if (sortBy === "stock") return (Number(a.inStock) || 0) - (Number(b.inStock) || 0);
      // Default: Recently added products come above (at the top)
      return getProductRecency(b) - getProductRecency(a);
    });

  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>(storedBrands);
    (products || []).forEach((p) => {
      if (!p) return;
      const b = (p.brand || "").trim();
      if (b && b.toLowerCase() !== "manufacturer" && b.toLowerCase() !== "unknown") {
        brandSet.add(b);
      }
    });
    return Array.from(brandSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [storedBrands, products]);

  const brandCounts = useMemo(() => {
    return availableBrands.reduce<Record<string, number>>((acc, b) => {
      const normB = b.trim().toLowerCase();
      acc[b] = (products || []).filter((p) => p && (p.brand || "").trim().toLowerCase() === normB).length;
      return acc;
    }, {});
  }, [availableBrands, products]);

  if (selected) {
    return (
      <ProductDetail
        product={selected}
        companies={companies}
        allCategories={categories}
        onBack={() => setSelected(null)}
        onUpdate={async (updated) => {
          setSelected(updated);
          await putWooCommerceProducts([updated as LinkedProduct]);
          notifyWooCommerceProductsUpdated();
          void getCatalogProducts().then(setProducts);

          const token = getAuthToken();
          const wooId = (updated as LinkedProduct).woo?.id ||
                        (String(updated.id).startsWith('woo-') ? Number(String(updated.id).replace('woo-', '')) : undefined);
          if (wooId && token) {
            toast.loading(`Syncing "${updated.name}" to fastonmed.com...`, { id: "woo-sync" });
            void fetch("/api/woocommerce", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                id: wooId,
                crmId: updated.id,
                name: updated.name,
                description: updated.description,
                price: String(updated.sellingPrice),
                stock: updated.inStock,
                categories: [updated.category],
                attributes: { Brand: updated.brand, Model: updated.model },
                image: updated.image && updated.image.startsWith("http") ? updated.image : undefined,
              }),
            })
              .then(async (res) => {
                const resData = await res.json().catch(() => null);
                if (res.ok && resData?.id) {
                  toast.success(`Price & details updated live on fastonmed.com!`, { id: "woo-sync" });
                } else {
                  toast.error(resData?.error || "Could not sync update to fastonmed.com.", { id: "woo-sync" });
                }
              })
              .catch((err) => {
                toast.error("Network error while syncing to fastonmed.com", { id: "woo-sync" });
                console.warn(err);
              });
          }
        }}
      />
    );
  }

  const totalInStock = products.reduce((acc, p) => acc + (p.inStock || 0), 0);
  const categoryCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = products.filter((p) => p.category === cat).length;
    return acc;
  }, {});

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedProducts = filteredAndSorted.slice(startIndex, startIndex + entriesPerPage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      <WooCommerceSync />
      {/* Dataflow eCommerce Controls Bar */}
      <div className={`card catalog-mobile-toolbar ${mobileCatalogFilters ? "catalog-filters-open" : ""}`} style={{ padding: "14px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left: Entries selector + Search input */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, minWidth: 320 }}>
            {/* Showing entries selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
              <span>Showing</span>
              <CustomLightSelect
                value={String(entriesPerPage)}
                options={["10", "25", "50", "100"]}
                onChange={(val) => {
                  setEntriesPerPage(Number(val));
                  setCurrentPage(1);
                }}
                style={{ width: 70 }}
                buttonStyle={{ height: 38, fontSize: 13, paddingLeft: 10, paddingRight: 22 }}
                menuStyle={{ minWidth: 70 }}
              />
              <span>entries</span>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
              <Search
                size={15}
                color="#94a3b8"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              />
              <input
                className="form-input"
                placeholder="Search by ID, model, brand..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: "100%", paddingLeft: 34, paddingRight: search ? 30 : 12, fontSize: 13, height: 38 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <button className="catalog-mobile-filter-toggle" type="button" aria-expanded={mobileCatalogFilters} onClick={() => setMobileCatalogFilters(value => !value)}>{mobileCatalogFilters ? "Close filters" : "Filters"}</button>
          {/* Right: Dropdowns + View Switcher + Add Actions */}
          <div className="catalog-toolbar-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Category Filter */}
            <CustomLightSelect
              value={filterCategory || "All"}
              clearable={filterCategory !== "All"}
              options={[
                { value: "All", label: `All Categories (${categories.length})` },
                ...categories.map((c) => ({
                  value: c,
                  label: c,
                  badge: String(categoryCounts[c] || 0),
                })),
              ]}
              onChange={(val) => {
                if (val === "__ADD_NEW__") {
                  setShowAddCategoryModal(true);
                } else {
                  setFilterCategory(val || "All");
                  setCurrentPage(1);
                }
              }}
              onAddNew={() => setShowAddCategoryModal(true)}
              addNewLabel="+ Add New Category..."
              activeColor={Boolean(filterCategory && filterCategory !== "All")}
              style={{ width: "auto", minWidth: 175 }}
              buttonStyle={{ height: 38, fontSize: 13 }}
              menuStyle={{ minWidth: 280, maxHeight: 320 }}
              searchable={true}
            />

            {/* Brand Filter */}
            <CustomLightSelect
              value={filterBrand || "All"}
              clearable={filterBrand !== "All"}
              options={[
                { value: "All", label: `All Brands (${availableBrands.length})` },
                ...availableBrands.map((b) => ({
                  value: b,
                  label: b,
                  badge: String(brandCounts[b] || 0),
                })),
              ]}
              onChange={(val) => {
                setFilterBrand(val || "All");
                setCurrentPage(1);
              }}
              activeColor={Boolean(filterBrand && filterBrand !== "All")}
              style={{ width: "auto", minWidth: 165 }}
              buttonStyle={{ height: 38, fontSize: 13 }}
              menuStyle={{ minWidth: 260, maxHeight: 320 }}
              searchable={true}
            />

            {/* Sort Dropdown */}
            <CustomLightSelect
              value={sortBy}
              options={[
                { value: "default", label: "Recently Added (Default)" },
                { value: "id", label: "Product ID" },
                { value: "name", label: "Product Name (A-Z)" },
                { value: "brand", label: "Brand (A-Z)" },
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
                { value: "stock", label: "Stock Quantity" },
              ]}
              onChange={(val) => {
                setSortBy(val as any);
                setCurrentPage(1);
              }}
              activeColor={sortBy !== "default"}
              style={{ width: "auto", minWidth: 175 }}
              buttonStyle={{ height: 38, fontSize: 13 }}
              menuStyle={{ minWidth: 220 }}
            />

            {/* View Mode Toggle */}
            <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 8, gap: 2 }}>
              <button
                type="button"
                className={`btn ${view === "grid" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: view === "grid" ? "#004d66" : "transparent",
                  color: view === "grid" ? "#ffffff" : "#64748b",
                  border: "none",
                  borderRadius: 6,
                }}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={13} />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`btn ${view === "list" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: view === "list" ? "#004d66" : "transparent",
                  color: view === "list" ? "#ffffff" : "#64748b",
                  border: "none",
                  borderRadius: 6,
                }}
                onClick={() => setView("list")}
              >
                <List size={13} />
                <span>List</span>
              </button>
            </div>

            {/* Sync Catalog Button */}
            <button
              type="button"
              className="btn btn-secondary"
              title="Sync WooCommerce and Shared Catalog"
              onClick={handleManualSync}
              disabled={isSyncingCatalog}
              style={{
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#004d66",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 38,
                opacity: isSyncingCatalog ? 0.7 : 1,
                cursor: isSyncingCatalog ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw size={13} className={isSyncingCatalog ? "animate-spin" : ""} />
              <span>{isSyncingCatalog ? "Syncing..." : "Sync"}</span>
            </button>

            {/* Quick Actions */}
            <button
              type="button"
              className="btn btn-secondary"
              title="Add New Category"
              onClick={() => setShowAddCategoryModal(true)}
              style={{
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#004d66",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 38,
              }}
            >
              <Plus size={13} />
              <span>Category</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              style={{
                backgroundColor: "#004d66",
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 38,
              }}
            >
              <Plus size={14} />
              <span>Add New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "0 2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {catalogLoading ? (products.length ? 'Refreshing shared product catalog…' : 'Loading shared product catalog…') : <>Showing <strong style={{ color: "#0f172a" }}>{paginatedProducts.length}</strong> of{" "}
            <strong style={{ color: "#0f172a" }}>{filteredAndSorted.length}</strong> products
            </>}
          </p>
          {catalogError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: 0 }}>{catalogError}</p>}
          {(filterCategory !== "All" || filterBrand !== "All" || filterTrader !== "All" || search || sortBy !== "default") && (
            <button
              type="button"
              onClick={() => {
                setFilterCategory("All");
                setFilterBrand("All");
                setFilterTrader("All");
                setSortBy("default");
                setSearch("");
                setCurrentPage(1);
              }}
              style={{
                fontSize: 12,
                color: "#004d66",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />
            <strong style={{ color: "#0f172a" }}>{totalInStock}</strong> Units in Stock
          </span>
          <span style={{ fontSize: 12, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Building2 size={13} color="#0284c7" />
            <strong style={{ color: "#0f172a" }}>{companies.length}</strong> Partner Traders
          </span>
        </div>
      </div>

      {/* View: Grid or List */}
      {view === "grid" ? (
        <>
          <style jsx>{`
            .product-modern-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 12px;
            }
            @media (max-width: 1199px) {
              .product-modern-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            @media (max-width: 800px) {
              .product-modern-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 480px) {
              .product-modern-grid { grid-template-columns: minmax(0, 1fr); }
            }
            .product-catalog-card {
              min-width: 0;
              background-color: #ffffff;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
              overflow: hidden;
              cursor: pointer;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }
            .product-catalog-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 10px 24px -4px rgba(0, 39, 53, 0.12);
              border-color: #004d66;
            }
            .product-image-stage {
              height: 130px;
              background: radial-gradient(circle at 50% 35%, #ffffff 0%, #f8fafc 70%, #f1f5f9 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              overflow: hidden;
              border-bottom: 1px solid #f1f5f9;
            }
            .product-img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              padding: 8px 10px;
              transition: transform 0.25s ease;
            }
            .product-catalog-card:hover .product-img {
              transform: scale(1.05);
            }
          `}</style>
          <div className="product-modern-grid">
            {paginatedProducts.map((product) => {
              const productImage = product.image || PRODUCT_IMAGE_PLACEHOLDER;
              const prodId = getProductId(product);
              const isAvailable = product.inStock > 5;
              const isLow = product.inStock > 0 && product.inStock <= 5;

              return (
                <div key={product.id} className="product-catalog-card">
                  <div
                    className="product-image-stage"
                    style={{ width: "100%", cursor: "pointer" }}
                    onClick={() => setSelected(product)}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: "rgba(255,255,255,0.92)",
                        color: "#475569",
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {prodId}
                    </span>
                    <img
                      src={productImage}
                      alt={product.name}
                      className="product-img"
                      onError={(e) => {
                        e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                      }}
                    />
                  </div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1, width: "100%", boxSizing: "border-box" }}>
                    <span style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {product.brand} · {product.category}
                    </span>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        minHeight: 36,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      title={product.name}
                      onClick={() => setSelected(product)}
                    >
                      {product.name}
                    </h4>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                      <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{formatCurrency(product.sellingPrice)}</strong>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: isAvailable ? "#ecfdf5" : isLow ? "#fffbeb" : "#fef2f2",
                          color: isAvailable ? "#059669" : isLow ? "#d97706" : "#ef4444",
                          border: `1px solid ${isAvailable ? "#a7f3d0" : isLow ? "#fde68a" : "#fecaca"}`,
                        }}
                      >
                        {isAvailable ? "In Stock" : isLow ? "Low Stock" : "Out of stock"}
                      </span>
                    </div>

                    {/* Card Actions Strip */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
                      <button
                        type="button"
                        title="View Details & Specs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(product);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#f8fafc",
                          color: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        title="Edit Product"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWebsiteProductEditor(product);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#f8fafc",
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        title="Delete Product"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProduct(product);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid #fecaca",
                          backgroundColor: "#fef2f2",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Dataflow eCommerce Table (List View) with Narrow Column Dividers */
        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0, boxShadow: "none" }}>
            <table className="catalog-mobile-list" data-mobile-cards="true" style={{ width: "100%", minWidth: 1040, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    Product
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 140,
                    }}
                  >
                    Brand
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    Price
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      width: 105,
                    }}
                  >
                    Listed date
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid #e2e8f0",
                      width: 110,
                      position: "sticky",
                      right: 0,
                      zIndex: 2,
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((p, rowIdx) => {
                  const productImage = p.image || PRODUCT_IMAGE_PLACEHOLDER;
                  const prodId = getProductId(p);
                  const startDate = getStartDate(p);
                  const marginPct =
                    p.sellingPrice && p.purchaseCost
                      ? Math.round(((p.sellingPrice - p.purchaseCost) / p.sellingPrice) * 100)
                      : null;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff")
                      }
                    >
                      {/* Column 1: Product thumbnail & details */}
                      <td data-label="Product" style={{ padding: "10px 16px", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              overflow: "hidden",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <img
                              src={productImage}
                              alt={p.name}
                              onError={(e) => {
                                e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                              }}
                              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }}
                            />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", lineHeight: 1.3 }}>{p.name}</div>
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                              <strong style={{ color: "#004d66" }}>{p.brand}</strong> · {p.model} ·{" "}
                              <span style={{ color: "#0284c7" }}>{p.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Brand */}
                      <td data-label="Brand"
                        style={{
                          padding: "10px 14px",
                          borderRight: "1px solid #f1f5f9",
                          borderBottom: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#0f172a",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: "#0284c7",
                              flexShrink: 0,
                            }}
                          />
                          {p.brand || "—"}
                        </span>
                      </td>


                      {/* Column 3: Price + Margin */}
                      <td data-label="Price"
                        style={{
                          padding: "10px 14px",
                          borderRight: "1px solid #f1f5f9",
                          borderBottom: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 13.5 }}>
                            {formatCurrency(p.sellingPrice)}
                          </span>
                          {marginPct !== null && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#059669",
                                backgroundColor: "#ecfdf5",
                                border: "1px solid #a7f3d0",
                                padding: "1px 5px",
                                borderRadius: 4,
                              }}
                            >
                              +{marginPct}%
                            </span>
                          )}
                        </div>
                      </td>


                      {/* Column 6: Start Date */}
                      <td data-label="Listed date"
                        style={{
                          padding: "10px 14px",
                          textAlign: "center",
                          borderRight: "1px solid #f1f5f9",
                          borderBottom: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {startDate}
                        </span>
                      </td>

                      {/* Column 8: Dataflow Action Dropdown */}
                      <td data-label="Action"
                        style={{
                          padding: "8px 14px",
                          textAlign: "center",
                          borderBottom: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          right: 0,
                          zIndex: activeActionDropdownId === p.id ? 30 : 1,
                          backgroundColor: rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            display: "inline-block",
                            textAlign: "left",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionDropdownId(activeActionDropdownId === p.id ? null : p.id);
                            }}
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: activeActionDropdownId === p.id ? "1px solid #004d66" : "1px solid #e2e8f0",
                              backgroundColor: activeActionDropdownId === p.id ? "#f0fdfa" : "#ffffff",
                              color: activeActionDropdownId === p.id ? "#004d66" : "#475569",
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
                                transform: activeActionDropdownId === p.id ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>

                          {activeActionDropdownId === p.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                ...(rowIdx >= paginatedProducts.length - 2 && paginatedProducts.length > 3
                                  ? { bottom: "calc(100% + 4px)" }
                                  : { top: "calc(100% + 4px)" }),
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
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(p);
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
                                <span>View Specs</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionDropdownId(null);
                                  openWebsiteProductEditor(p);
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
                                <Edit3 size={14} color="#475569" />
                                <span>Edit Product</span>
                              </button>

                              <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingProduct(p);
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
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <Trash2 size={14} color="#ef4444" />
                                <span>Delete Product</span>
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

      {filteredAndSorted.length > 0 && (
        <nav className="catalog-pagination" aria-label="Product catalogue pages">
          <div className="catalog-pagination-summary">
            <span>{startIndex + 1}–{Math.min(startIndex + entriesPerPage, filteredAndSorted.length)} of {filteredAndSorted.length.toLocaleString()} products</span>
            <select aria-label="Products per page" value={entriesPerPage} onChange={(event) => { setEntriesPerPage(Number(event.target.value)); setCurrentPage(1); }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
            </select>
          </div>
          <div className="catalog-pagination-navigation">
            <button type="button" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(safeCurrentPage - 1)}><ChevronLeft size={16} />Previous</button>
            <label>Page <select aria-label="Go to product page" value={safeCurrentPage} onChange={(event) => setCurrentPage(Number(event.target.value))}>
              {Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select> of {totalPages}</label>
            <button type="button" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(safeCurrentPage + 1)}>Next<ChevronRight size={16} /></button>
          </div>
        </nav>
      )}

      {/* Add Medical Equipment Category Modal */}
      {showAddCategoryModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
          onClick={() => setShowAddCategoryModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 460,
              width: "100%",
              padding: "24px 26px",
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              animation: "scaleUp 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#002735", margin: 0 }}>
                  Add Medical Category
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Add new medical equipment & device category to the catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newCategoryName.trim();
                if (!trimmed) {
                  toast.error("Please enter a category name");
                  return;
                }
                const updated = addStoredCategory(trimmed);
                setCategories(updated);
                setFilterCategory(trimmed);
                setFormCategory(trimmed as ProductCategory);
                setNewCategoryName("");
                setShowAddCategoryModal(false);
                toast.success(`Category "${trimmed}" added successfully!`);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cardiology Equipment, Ophthalmology, Endoscopy..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  autoFocus
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
                  Quick Suggested Categories
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    "Cardiology Equipment",
                    "Ophthalmology",
                    "Orthopedic & Spine",
                    "Endoscopy Systems",
                    "Neonatal & Pediatric",
                    "Emergency & Trauma",
                    "Dialysis & Nephrology",
                    "Dermatology & Aesthetics",
                    "Pathology & Histology",
                    "Audiology",
                  ]
                    .filter((c) => !categories.includes(c))
                    .slice(0, 8)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewCategoryName(preset)}
                        style={{
                          fontSize: 11,
                          padding: "4px 9px",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          backgroundColor: newCategoryName === preset ? "#e0f2fe" : "#f8fafc",
                          color: newCategoryName === preset ? "#0369a1" : "#475569",
                          fontWeight: newCategoryName === preset ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        + {preset}
                      </button>
                    ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCategoryModal(false)}
                  style={{ fontSize: 12.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", fontSize: 12.5 }}
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal (Connected to Trader Company) */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onProductCreated={() => {
            void getCatalogProducts().then(setProducts);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Edit Product Modal (Dataflow style) */}
      {editingProduct && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 0,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              animation: "scaleUp 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 24px",
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
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#002735", margin: 0 }}>
                    Edit Product Details
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
                    Update catalog pricing, inventory count, and trader connection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            {/* Edit Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const updated: Product = {
                  ...editingProduct,
                  name: (fd.get("name") as string)?.trim() || editingProduct.name,
                  category: (fd.get("category") as ProductCategory) || editingProduct.category,
                  brand: (fd.get("brand") as string)?.trim() || editingProduct.brand,
                  model: (fd.get("model") as string)?.trim() || editingProduct.model,
                  sellingPrice: Number(fd.get("sellingPrice")) || editingProduct.sellingPrice,
                  purchaseCost: Number(fd.get("purchaseCost")) || editingProduct.purchaseCost,
                  inStock: Number(fd.get("inStock")) >= 0 ? Number(fd.get("inStock")) : editingProduct.inStock,
                  warrantyPeriod: (fd.get("warrantyPeriod") as string) || editingProduct.warrantyPeriod,
                  deliveryLeadTime: (fd.get("deliveryLeadTime") as string) || editingProduct.deliveryLeadTime,
                  description: (fd.get("description") as string)?.trim() || editingProduct.description,
                  amcAvailable: editingProduct.amcAvailable ?? true,
                };

                updateProduct(updated);
                await putWooCommerceProducts([updated as LinkedProduct]);
                notifyWooCommerceProductsUpdated();
                void getCatalogProducts().then(setProducts);
                setEditingProduct(null);
                toast.success(`Product "${updated.name}" updated successfully!`);

                const token = getAuthToken();
                const wooId = (updated as LinkedProduct).woo?.id ||
                              (String(updated.id).startsWith('woo-') ? Number(String(updated.id).replace('woo-', '')) : undefined);
                if (wooId && token) {
                  toast.loading(`Syncing "${updated.name}" to fastonmed.com...`, { id: "woo-edit-sync" });
                  void fetch("/api/woocommerce", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: wooId,
                      crmId: updated.id,
                      name: updated.name,
                      description: updated.description,
                      price: String(updated.sellingPrice),
                      stock: updated.inStock,
                      categories: [updated.category],
                      attributes: { Brand: updated.brand, Model: updated.model },
                      image: updated.image && updated.image.startsWith("http") ? updated.image : undefined,
                    }),
                  })
                    .then(async (res) => {
                      const resData = await res.json().catch(() => null);
                      if (res.ok && resData?.id) {
                        toast.success(`Price & details updated live on fastonmed.com!`, { id: "woo-edit-sync" });
                      } else {
                        toast.error(resData?.error || "Could not sync update to fastonmed.com.", { id: "woo-edit-sync" });
                      }
                    })
                    .catch((err) => {
                      toast.error("Network error while syncing to fastonmed.com", { id: "woo-edit-sync" });
                      console.warn(err);
                    });
                }
              }}
              style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Product Name *
                </label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingProduct.name}
                  className="form-input"
                  style={{ fontSize: 13 }}
                  required
                />
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    name="category"
                    defaultValue={editingProduct.category}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Brand
                  </label>
                  <input
                    name="brand"
                    type="text"
                    defaultValue={editingProduct.brand}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Model
                  </label>
                  <input
                    name="model"
                    type="text"
                    defaultValue={editingProduct.model}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Purchase Cost (AED)
                  </label>
                  <input
                    name="purchaseCost"
                    type="number"
                    step={500}
                    defaultValue={editingProduct.purchaseCost}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Selling Price (AED) *
                  </label>
                  <input
                    name="sellingPrice"
                    type="number"
                    step={500}
                    defaultValue={editingProduct.sellingPrice}
                    className="form-input"
                    style={{ fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Units in Stock (UAE)
                  </label>
                  <input
                    name="inStock"
                    type="number"
                    min={0}
                    defaultValue={editingProduct.inStock}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Delivery Lead Time
                  </label>
                  <input
                    name="deliveryLeadTime"
                    type="text"
                    defaultValue={editingProduct.deliveryLeadTime || "3 - 5 Days (UAE Stock)"}
                    className="form-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Warranty Period
                </label>
                <select
                  name="warrantyPeriod"
                  defaultValue={editingProduct.warrantyPeriod || "2 Years"}
                  className="form-input"
                  style={{ fontSize: 13 }}
                >
                  <option value="1 Year">1 Year Standard Warranty</option>
                  <option value="2 Years">2 Years Warranty</option>
                  <option value="3 Years">3 Years Comprehensive</option>
                  <option value="5 Years">5 Years Manufacturer Warranty</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Product Notes / Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingProduct.description}
                  className="form-input"
                  style={{ fontSize: 12.5, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingProduct(null)}
                  style={{ fontSize: 12.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", fontSize: 12.5 }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Dataflow style) */}
      {deletingProduct && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => setDeletingProduct(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: "100%",
              padding: "24px 26px",
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              animation: "scaleUp 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Delete Product?
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>
                  Are you sure you want to remove <strong>&quot;{deletingProduct.name}&quot;</strong> from your catalog? This action will remove it from active procurement listings.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={deletingProduct.image || PRODUCT_IMAGE_PLACEHOLDER}
                  alt={deletingProduct.name}
                  onError={(e) => {
                    e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{deletingProduct.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {getProductId(deletingProduct)} · {deletingProduct.category}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingProduct(null)}
                style={{ fontSize: 12.5 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteStoredProduct(deletingProduct.id, deletingProduct.name);
                  setProducts((current) => current.filter((p) => p.id !== deletingProduct.id));
                  toast.success(`Product "${deletingProduct.name}" removed successfully!`);
                  setDeletingProduct(null);
                }}
                style={{
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDetail({
  product,
  companies,
  onBack,
  onUpdate,
  allCategories,
}: {
  product: Product;
  companies: ProcurementCompany[];
  onBack: () => void;
  onUpdate: (updated: Product) => void;
  allCategories?: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product>(product);

  // Edit fields
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [model, setModel] = useState(product.model);
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    const list = getStoredCategories();
    const cur = product.category?.trim();
    const set = new Set<string>([...list, ...(allCategories || [])]);
    if (cur && cur !== "Uncategorized") set.add(cur);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  });
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [fetchingWoo, setFetchingWoo] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }
    addStoredCategory(trimmed);
    setCategory(trimmed as ProductCategory);
    setCategoriesList((prev) => Array.from(new Set([...prev, trimmed])).sort((a, b) => a.localeCompare(b)));
    setShowAddCategoryModal(false);
    setNewCategoryName("");
    toast.success(`Category "${trimmed}" created and selected!`);
  };

  const handleFetchFromWoo = async () => {
    const wooId = (currentProduct as LinkedProduct).woo?.id ||
      (String(currentProduct.id).startsWith("woo-") ? Number(String(currentProduct.id).replace("woo-", "")) : undefined);

    if (!wooId) {
      toast.error("This product is not linked to WooCommerce.");
      return;
    }

    setFetchingWoo(true);
    try {
      const res = await fetch(`https://www.fastonmed.com/wp-json/wc/store/v1/products/${wooId}`);
      if (!res.ok) throw new Error("Could not fetch product from fastonmed.com");
      const data = await res.json();

      const wooCat = data.categories?.[0]?.name ? decodeHtml(data.categories[0].name).trim() : undefined;
      const rawBrand = data.brands?.[0]?.name || data.attributes?.find((a: any) => a.name === "Brand")?.terms?.[0]?.name;
      const wooBrand = rawBrand ? decodeHtml(rawBrand).trim() : undefined;
      const minorUnit = Number(data.prices?.currency_minor_unit) || 0;
      const wooPrice = data.prices?.price ? Number(data.prices.price) / (10 ** minorUnit) : undefined;

      if (wooCat) {
        setCategory(wooCat as ProductCategory);
        setCategoriesList((prev) => Array.from(new Set([...prev, wooCat])).sort((a, b) => a.localeCompare(b)));
      }
      if (wooBrand) {
        setBrand(wooBrand);
        const matchTrader = companiesList.find(
          (c) =>
            c.name.toLowerCase().trim() === wooBrand.toLowerCase().trim() ||
            c.name.toLowerCase().includes(wooBrand.toLowerCase().trim()) ||
            wooBrand.toLowerCase().includes(c.name.toLowerCase().trim())
        );
        if (matchTrader) {
          setTraderCompanyId(matchTrader.id);
          if (matchTrader.deliveryLeadTime) setDeliveryLeadTime(matchTrader.deliveryLeadTime);
        }
      }
      if (wooPrice !== undefined && wooPrice > 0) setSellingPrice(wooPrice);
      if (data.name) setName(decodeHtml(data.name).trim());

      toast.success("Updated with live data from fastonmed.com!");
    } catch {
      toast.error("Could not fetch latest details from fastonmed.com");
    } finally {
      setFetchingWoo(false);
    }
  };

  useEffect(() => {
    void syncTaxonomies();
    const handleCatsUpdate = () => {
      const list = getStoredCategories();
      const cur = (currentProduct.category || product.category)?.trim();
      const set = new Set<string>([...list, ...(allCategories || [])]);
      if (cur && cur !== "Uncategorized") set.add(cur);
      setCategoriesList(Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b)));
    };
    handleCatsUpdate();
    window.addEventListener("fastonmed_categories_updated", handleCatsUpdate);
    return () => window.removeEventListener("fastonmed_categories_updated", handleCatsUpdate);
  }, [allCategories, currentProduct.category, product.category]);

  useEffect(() => {
    setBrands(getStoredBrands());
    const handleBrandsUpdate = () => setBrands(getStoredBrands());
    window.addEventListener("fastonmed_brands_updated", handleBrandsUpdate);
    return () => window.removeEventListener("fastonmed_brands_updated", handleBrandsUpdate);
  }, []);

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [openTraderDropdownIdx, setOpenTraderDropdownIdx] = useState<number | null>(null);
  const [traderSearchText, setTraderSearchText] = useState("");
  const traderDropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (traderDropdownContainerRef.current && !traderDropdownContainerRef.current.contains(e.target as Node)) {
        setOpenTraderDropdownIdx(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [companiesList, setCompaniesList] = useState<ProcurementCompany[]>(() => {
    return companies && companies.length > 0 ? companies : getStoredCompanies();
  });

  const [productTraders, setProductTraders] = useState<ProductTraderOffer[]>(() => {
    if (product.traders && product.traders.length > 0) {
      return product.traders;
    }
    const compList = companies && companies.length > 0 ? companies : getStoredCompanies();
    if (product.traderCompanyId || product.traderCompanyName) {
      const match = compList.find(
        (c) =>
          (product.traderCompanyId && c.id === product.traderCompanyId) ||
          (product.traderCompanyName && c.name.toLowerCase().trim() === product.traderCompanyName.toLowerCase().trim())
      );
      if (match || product.traderCompanyId) {
        return [
          {
            traderCompanyId: product.traderCompanyId || match?.id || "",
            traderCompanyName: product.traderCompanyName || match?.name || "Authorized Trader",
            offeringPrice: product.purchaseCost || product.traderPriceMin || 0,
            traderPriceMin: product.traderPriceMin || product.purchaseCost || 0,
            traderPriceMax: product.traderPriceMax || product.purchaseCost || 0,
            deliveryLeadTime: product.deliveryLeadTime || match?.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
            warrantyPeriod: product.warrantyPeriod || "2 Years",
          },
        ];
      }
    }
    return [];
  });

  const handleAddTraderOffer = () => {
    const available = companiesList.find((c) => !productTraders.some((t) => t.traderCompanyId === c.id)) || companiesList[0];
    const defCost = Number(purchaseCost) || 25000;
    setProductTraders((prev) => [
      ...prev,
      {
        traderCompanyId: available?.id || "",
        traderCompanyName: available?.name || "",
        offeringPrice: defCost,
        traderPriceMin: Math.round(defCost * 0.95),
        traderPriceMax: Math.round(defCost * 1.05),
        deliveryLeadTime: available?.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
      },
    ]);
  };

  const handleUpdateTraderOffer = (idx: number, updates: Partial<ProductTraderOffer>) => {
    setProductTraders((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
    if (idx === 0) {
      if (updates.offeringPrice !== undefined) {
        setPurchaseCost(updates.offeringPrice || 0);
        setTraderPriceMin(Math.round((updates.offeringPrice || 0) * 0.95));
        setTraderPriceMax(Math.round((updates.offeringPrice || 0) * 1.05));
      }
      if (updates.traderCompanyId !== undefined) {
        setTraderCompanyId(updates.traderCompanyId);
      }
      if (updates.deliveryLeadTime !== undefined) {
        setDeliveryLeadTime(updates.deliveryLeadTime);
      }
    }
  };

  const handleRemoveTraderOffer = (idx: number) => {
    setProductTraders((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (idx === 0 && next.length > 0) {
        setTraderCompanyId(next[0].traderCompanyId);
        setPurchaseCost(next[0].offeringPrice || 0);
        setDeliveryLeadTime(next[0].deliveryLeadTime || "3 - 5 Days (UAE Stock)");
      } else if (next.length === 0) {
        setTraderCompanyId("");
      }
      return next;
    });
  };

  const [traderCompanyId, setTraderCompanyId] = useState<string>(() => {
    if (product.traders && product.traders.length > 0) {
      return product.traders[0].traderCompanyId;
    }
    if (product.traderCompanyId) return product.traderCompanyId;
    if (product.traderCompanyName) {
      const match = (companies && companies.length > 0 ? companies : getStoredCompanies()).find(
        (c) => c.name.toLowerCase().trim() === product.traderCompanyName?.toLowerCase().trim()
      );
      if (match) return match.id;
    }
    return "";
  });

  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyOrigin, setNewCompanyOrigin] = useState("UAE");
  const [newCompanyPartnership, setNewCompanyPartnership] = useState<"Exclusive Partner" | "Authorized Distributor" | "Channel Partner" | "Certified Dealer">("Authorized Distributor");
  const [newCompanyDelivery, setNewCompanyDelivery] = useState("3 - 5 Days (UAE Stock)");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCompanyName.trim();
    if (!trimmedName) {
      toast.error("Please enter a company name");
      return;
    }

    const newCompany: ProcurementCompany = {
      id: "tc-" + Date.now(),
      name: trimmedName,
      origin: newCompanyOrigin.trim() || "UAE",
      uaeOffice: "Dubai, UAE",
      partnership: newCompanyPartnership,
      equipmentLine: category || "Medical Equipment",
      suppliedCategories: [category],
      deliveryLeadTime: newCompanyDelivery,
      priceRangeText: "AED 5,000 - 50,000",
      productCount: 1,
      totalVolume: 0,
      contactPerson: "Account Manager",
      contactRole: "Procurement Lead",
      phone: newCompanyPhone.trim() || "+971 4 000 0000",
      email: newCompanyEmail.trim() || `sales@${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      website: `https://${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      flag: "🏢",
    };

    const currentCompanies = getStoredCompanies();
    const updated = [newCompany, ...currentCompanies];
    saveStoredCompanies(updated);
    setCompaniesList(updated);
    setTraderCompanyId(newCompany.id);
    setDeliveryLeadTime(newCompany.deliveryLeadTime);

    setProductTraders((prev) => [
      ...prev,
      {
        traderCompanyId: newCompany.id,
        traderCompanyName: newCompany.name,
        offeringPrice: Number(purchaseCost) || 25000,
        traderPriceMin: Math.round((Number(purchaseCost) || 25000) * 0.95),
        traderPriceMax: Math.round((Number(purchaseCost) || 25000) * 1.05),
        deliveryLeadTime: newCompany.deliveryLeadTime,
      },
    ]);

    setShowAddCompanyModal(false);
    setNewCompanyName("");
    setNewCompanyPhone("");
    setNewCompanyEmail("");
    toast.success(`Trader Company "${trimmedName}" created and assigned!`);
  };

  useEffect(() => {
    const handleCompaniesUpdate = () => {
      setCompaniesList(getStoredCompanies());
    };
    window.addEventListener("fastonmed_companies_updated", handleCompaniesUpdate);
    return () => window.removeEventListener("fastonmed_companies_updated", handleCompaniesUpdate);
  }, []);

  const [deliveryLeadTime, setDeliveryLeadTime] = useState(product.deliveryLeadTime || "3 - 5 Days (UAE Stock)");
  const [traderPriceMin, setTraderPriceMin] = useState<number>(product.traderPriceMin || product.purchaseCost * 0.95);
  const [traderPriceMax, setTraderPriceMax] = useState<number>(product.traderPriceMax || product.purchaseCost * 1.05);
  const [purchaseCost, setPurchaseCost] = useState<number>(product.purchaseCost);
  const [sellingPrice, setSellingPrice] = useState<number>(product.sellingPrice);
  const [vatStatus, setVatStatus] = useState<string>(product.vatStatus || "5% Standard Rate");
  const [inStock, setInStock] = useState<number>(product.inStock);
  const [warrantyPeriod, setWarrantyPeriod] = useState(product.warrantyPeriod);
  const [amcAvailable, setAmcAvailable] = useState(product.amcAvailable);
  const [description, setDescription] = useState(product.description);
  const [specifications, setSpecifications] = useState<Record<string, string>>(product.specifications || {});
  const [productUrl, setProductUrl] = useState(product.productUrl || "");
  const [image, setImage] = useState(product.image || "");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP, SVG)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImage(result);
      toast.success("Equipment photo updated!");
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInputValue.trim()) {
      toast.error("Please enter an image URL");
      return;
    }
    setImage(urlInputValue.trim());
    setShowUrlInput(false);
    setUrlInputValue("");
    toast.success("Equipment image URL applied!");
  };

  const handleRemoveImage = () => {
    setImage("");
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
    toast.success("Equipment photo removed");
  };

  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecVal, setNewSpecVal] = useState("");

  const resetFields = () => {
    setName(currentProduct.name);
    setBrand(currentProduct.brand);
    setModel(currentProduct.model);
    setCategory(currentProduct.category);
    setImage(currentProduct.image || "");
    setShowUrlInput(false);
    setUrlInputValue("");
    setTraderCompanyId(currentProduct.traderCompanyId || "");
    setDeliveryLeadTime(currentProduct.deliveryLeadTime || "3 - 5 Days (UAE Stock)");
    setTraderPriceMin(currentProduct.traderPriceMin || currentProduct.purchaseCost * 0.95);
    setTraderPriceMax(currentProduct.traderPriceMax || currentProduct.purchaseCost * 1.05);
    setPurchaseCost(currentProduct.purchaseCost);
    setSellingPrice(currentProduct.sellingPrice);
    setVatStatus(currentProduct.vatStatus || "5% Standard Rate");
    setProductTraders(() => {
      if (currentProduct.traders && currentProduct.traders.length > 0) {
        return currentProduct.traders;
      }
      if (currentProduct.traderCompanyId || currentProduct.traderCompanyName) {
        const match = companiesList.find(
          (c) =>
            (currentProduct.traderCompanyId && c.id === currentProduct.traderCompanyId) ||
            (currentProduct.traderCompanyName && c.name.toLowerCase().trim() === currentProduct.traderCompanyName?.toLowerCase().trim())
        );
        return [
          {
            traderCompanyId: currentProduct.traderCompanyId || match?.id || "",
            traderCompanyName: currentProduct.traderCompanyName || match?.name || "Authorized Trader",
            offeringPrice: currentProduct.purchaseCost || currentProduct.traderPriceMin || 0,
            traderPriceMin: currentProduct.traderPriceMin || currentProduct.purchaseCost || 0,
            traderPriceMax: currentProduct.traderPriceMax || currentProduct.purchaseCost || 0,
            deliveryLeadTime: currentProduct.deliveryLeadTime || match?.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
          },
        ];
      }
      return [];
    });
    setInStock(currentProduct.inStock);
    setWarrantyPeriod(currentProduct.warrantyPeriod);
    setAmcAvailable(currentProduct.amcAvailable);
    setDescription(currentProduct.description);
    setSpecifications(currentProduct.specifications || {});
    setProductUrl(currentProduct.productUrl || "");
    setIsEditing(false);
  };

  const handleFetchLink = async () => {
    if (!productUrl.trim()) {
      toast.error("Please enter or paste a product link URL");
      return;
    }

    setIsFetchingLink(true);
    const toastId = toast.loading("Fetching product details & technical specifications from link...");

    try {
      const res = await fetch("/api/products/fetch-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch link details");
      }

      if (data.description) {
        setDescription(data.description);
      }

      if (data.specifications && Object.keys(data.specifications).length > 0) {
        setSpecifications((prev) => ({
          ...prev,
          ...data.specifications,
        }));
      }

      if (data.brand && (!brand || brand === "Manufacturer")) {
        setBrand(data.brand);
      }

      if (data.model && (!model || model === "Standard Edition")) {
        setModel(data.model);
      }

      if (data.category) {
        setCategory(data.category);
      }

      if (data.image && !image) {
        setImage(data.image);
      }

      toast.success("Successfully fetched description & technical specs from link!", { id: toastId });
    } catch (err: any) {
      console.error("Link fetch error:", err);
      toast.error(err?.message || "Failed to fetch link", { id: toastId });
    } finally {
      setIsFetchingLink(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a product name");
      return;
    }

    const firstTrader = productTraders[0];
    const selectedTrader = firstTrader
      ? companiesList.find((c) => c.id === firstTrader.traderCompanyId)
      : companiesList.find((c) => c.id === traderCompanyId);
    const finalBrand = brand.trim() || selectedTrader?.name || "Manufacturer";
    if (finalBrand) {
      addStoredBrand(finalBrand);
    }
    const updated: Product = {
      ...currentProduct,
      name: name.trim(),
      brand: finalBrand,
      model: model.trim() || "Standard Edition",
      category,
      image: image.trim() || undefined,
      traderCompanyId: firstTrader?.traderCompanyId || traderCompanyId || undefined,
      traderCompanyName: firstTrader?.traderCompanyName || selectedTrader?.name || undefined,
      supplier: firstTrader?.traderCompanyName || selectedTrader?.name || currentProduct.supplier || "",
      deliveryLeadTime: firstTrader?.deliveryLeadTime || deliveryLeadTime,
      traderPriceMin: firstTrader?.offeringPrice ? Math.round(firstTrader.offeringPrice * 0.95) : Number(traderPriceMin) || purchaseCost,
      traderPriceMax: firstTrader?.offeringPrice ? Math.round(firstTrader.offeringPrice * 1.05) : Number(traderPriceMax) || purchaseCost,
      traders: productTraders,
      purchaseCost: firstTrader?.offeringPrice || Number(purchaseCost) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      vatStatus,
      inStock: Number(inStock) || 0,
      warrantyPeriod,
      amcAvailable,
      description: description.trim(),
      specifications,
      productUrl: productUrl.trim() || undefined,
    };

    updateProduct(updated);
    setCurrentProduct(updated);
    onUpdate(updated);
    setIsEditing(false);
    toast.success(`Product "${updated.name}" updated successfully!`);
  };

  const handleTraderChange = (cId: string) => {
    if (cId === "__ADD_NEW__") {
      setShowAddCompanyModal(true);
      return;
    }
    setTraderCompanyId(cId);
    const comp = companiesList.find((c) => c.id === cId);
    if (comp && comp.deliveryLeadTime) {
      setDeliveryLeadTime(comp.deliveryLeadTime);
    }
  };

  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) {
      toast.error("Enter both specification title and value");
      return;
    }
    setSpecifications({ ...specifications, [newSpecKey.trim()]: newSpecVal.trim() });
    setNewSpecKey("");
    setNewSpecVal("");
  };

  const handleRemoveSpec = (key: string) => {
    const copy = { ...specifications };
    delete copy[key];
    setSpecifications(copy);
  };

  const activeSellingPrice = Number(isEditing ? sellingPrice : currentProduct.sellingPrice) || 0;
  const activePurchaseCost = Number(isEditing ? purchaseCost : currentProduct.purchaseCost) || 0;
  const margin = Math.round(((activeSellingPrice - activePurchaseCost) / (activeSellingPrice || 1)) * 100);

  const getCatalogId = (p: Product) => {
    const num = (p.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 9000000) + 1000000;
    return `#${num}`;
  };

  const currentCategory = isEditing ? category : currentProduct.category;
  const categoryBadgeStyle = CATEGORY_STYLES[currentCategory] || { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.25s ease", width: "100%" }}>
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          backgroundColor: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        {/* Left: Breadcrumbs & Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#004d66",
              fontWeight: 600,
              fontSize: 13.5,
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 6,
              transition: "background 0.15s ease",
            }}
            className="hover:bg-slate-100"
          >
            <ChevronLeft size={16} />
            <span>Back to Products</span>
          </button>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 5,
              backgroundColor: categoryBadgeStyle.bg,
              color: categoryBadgeStyle.text,
              border: `1px solid ${categoryBadgeStyle.border}`,
            }}
          >
            {currentCategory}
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: "#94a3b8",
              fontFamily: "monospace",
            }}
          >
            {getCatalogId(currentProduct)}
          </span>
        </div>

        {/* Right: Primary Action Buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isEditing ? (
            <>
              <span style={{ fontSize: 12, color: "#d97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
                Editing Mode
              </span>
              {Boolean((currentProduct as LinkedProduct).woo?.id || String(currentProduct.id).startsWith("woo-")) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={fetchingWoo}
                  onClick={handleFetchFromWoo}
                  title="Match category, brand & price with live fastonmed.com data"
                  style={{ fontSize: 12, height: 34, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, color: "#004d66" }}
                >
                  <Globe size={13} />
                  <span>{fetchingWoo ? "Matching..." : "Match from Website"}</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFields}
                style={{ fontSize: 12.5, height: 34, padding: "0 14px", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                style={{
                  backgroundColor: "#004d66",
                  fontSize: 12.5,
                  height: 34,
                  padding: "0 16px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={14} />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <>
              <a
                href={`/products/${encodeURIComponent(product.id)}`}
                className="btn btn-secondary"
                style={{
                  fontSize: 12.5,
                  height: 34,
                  padding: "0 14px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#334155",
                }}
              >
                <Edit3 size={13} />
                <span>Edit Product</span>
              </a>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => toast.success(`"${currentProduct.name}" added to quotation draft`)}
                style={{
                  backgroundColor: "#004d66",
                  fontSize: 12.5,
                  height: 34,
                  padding: "0 16px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,77,102,0.2)",
                }}
              >
                <Plus size={14} />
                <span>Add to Quote</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode Alert Banner */}
      {isEditing && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "9px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#15803d",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <span>✏️ Edit Mode Active: Modify specifications, trader pricing, delivery lead times, or clinical description.</span>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{ backgroundColor: "#15803d", fontSize: 12, padding: "3px 12px", height: 28 }}
          >
            Save
          </button>
        </div>
      )}

      {/* 2-Column Balanced Grid */}
      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "380px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        {/* Left Column: Visual & Commercial Snapshot */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card 1: Product Photo Box */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Main Visual Display Area */}
            <div
              style={{
                height: 230,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f8fafc",
                overflow: "hidden",
              }}
            >
              {(isEditing ? image : currentProduct.image) ? (
                <img
                  src={isEditing ? image : currentProduct.image}
                  alt={isEditing ? name : currentProduct.name}
                  onError={(e) => {
                    e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: 14,
                  }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <img
                    src={PRODUCT_IMAGE_PLACEHOLDER}
                    alt={isEditing ? name : currentProduct.name}
                    onError={(e) => {
                      e.currentTarget.src = "/products/ventilator.jpg";
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: 14,
                      opacity: 0.85,
                    }}
                  />
                  {isEditing && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 8,
                        fontSize: 11,
                        color: "#64748b",
                        fontWeight: 600,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      Default category photo shown
                    </span>
                  )}
                </div>
              )}


              {/* View mode quick-edit button */}
              {!isEditing && (
                <a
                  href={`/products/${encodeURIComponent(product.id)}`}
                  title="Click to edit product and change photo"
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    backgroundColor: "rgba(255, 255, 255, 0.92)",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#0f172a",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  <Camera size={12} />
                  <span>{currentProduct.image ? "Change Photo" : "+ Add Photo"}</span>
                </a>
              )}
            </div>

            {/* In Edit Mode: Dedicated Image Editing Toolbar */}
            {isEditing && (
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor: "#f8fafc",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Hidden File Input */}
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      fontSize: 11.5,
                      padding: "5px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      height: 30,
                    }}
                  >
                    <Upload size={12} />
                    <span>{image ? "Change Photo" : "+ Upload Photo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: 11.5,
                      padding: "5px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      height: 30,
                      backgroundColor: showUrlInput ? "#e2e8f0" : "#ffffff",
                    }}
                    title="Paste Image Link / URL"
                  >
                    <LinkIcon size={12} />
                    <span>URL</span>
                  </button>

                  {image && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        padding: "5px 8px",
                        fontSize: 11.5,
                        borderRadius: 6,
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#dc2626",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        height: 30,
                      }}
                      title="Remove photo"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Collapsible Image URL Input Bar */}
                {showUrlInput && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                    <input
                      className="form-input"
                      placeholder="Paste image URL (https://...)"
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyUrl();
                        }
                      }}
                      style={{ fontSize: 11.5, height: 28, padding: "2px 8px", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyUrl}
                      className="btn btn-primary"
                      style={{
                        backgroundColor: "#004d66",
                        fontSize: 11,
                        padding: "0 8px",
                        height: 28,
                      }}
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: 2,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Unified Commercial & Procurement Snapshot */}
          <div
            className="card"
            style={{
              padding: "18px 20px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Section 1: Commercial Pricing */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Commercial Pricing
              </div>

              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      Selling Price (AED)
                    </label>
                    <input
                      type="number"
                      step={500}
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(Number(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 13, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      Purchase Cost (AED)
                    </label>
                    <input
                      type="number"
                      step={500}
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Number(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 13, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      VAT Status
                    </label>
                    <select
                      value={vatStatus}
                      onChange={(e) => setVatStatus(e.target.value)}
                      className="form-input"
                      style={{
                        height: 34,
                        fontSize: 12,
                        backgroundColor: "#ffffff",
                        fontWeight: 600,
                        color: "#0f172a",
                        borderRadius: 7,
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                      }}
                    >
                      <option value="5% Standard Rate">5% Standard Rate (UAE VAT)</option>
                      <option value="0% Zero-Rated">0% Zero-Rated (Designated Medical)</option>
                      <option value="Exempt">Exempt from VAT</option>
                      <option value="Inclusive of 5% VAT">Price Inclusive of 5% VAT</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Gross Margin:</span>
                    <span style={{ fontWeight: 700, color: margin > 20 ? "#059669" : margin >= 0 ? "#d97706" : "#dc2626", fontSize: 13 }}>
                      {margin}%
                    </span>
                  </div>
                  {vatStatus === "5% Standard Rate" && sellingPrice > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b" }}>
                      <span>Total incl. 5% VAT:</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>
                        AED {Math.round(sellingPrice * 1.05).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>
                      {formatCurrency(currentProduct.sellingPrice)}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 4,
                        backgroundColor: margin >= 20 ? "#ecfdf5" : margin >= 0 ? "#fff7ed" : "#fef2f2",
                        color: margin >= 20 ? "#059669" : margin >= 0 ? "#c2410c" : "#dc2626",
                        border: `1px solid ${margin >= 20 ? "#a7f3d0" : margin >= 0 ? "#fed7aa" : "#fecaca"}`,
                      }}
                    >
                      {margin}% Margin
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#64748b" }}>
                    <span>Purchase Cost:</span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{formatCurrency(currentProduct.purchaseCost)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>VAT Status:</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 5,
                        backgroundColor: (currentProduct.vatStatus || "5% Standard Rate").includes("Zero") || (currentProduct.vatStatus || "").includes("Exempt") ? "#f1f5f9" : "#eff6ff",
                        color: (currentProduct.vatStatus || "5% Standard Rate").includes("Zero") || (currentProduct.vatStatus || "").includes("Exempt") ? "#475569" : "#1e40af",
                        border: `1px solid ${(currentProduct.vatStatus || "5% Standard Rate").includes("Zero") || (currentProduct.vatStatus || "").includes("Exempt") ? "#e2e8f0" : "#bfdbfe"}`,
                      }}
                    >
                      {currentProduct.vatStatus || "5% Standard Rate (UAE VAT)"}
                    </span>
                  </div>
                  {(!currentProduct.vatStatus || currentProduct.vatStatus === "5% Standard Rate") && currentProduct.sellingPrice > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11.5, color: "#64748b" }}>
                      <span>Total with 5% VAT:</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>
                        {formatCurrency(Math.round(currentProduct.sellingPrice * 1.05))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ height: 1, backgroundColor: "#f1f5f9" }} />

            {/* Section 2: Trader & Procurement Logistics */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Authorized Trader Companies
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleAddTraderOffer}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#004d66",
                      backgroundColor: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: 6,
                      padding: "2px 8px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Trader</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {productTraders.length === 0 ? (
                    <div
                      style={{
                        padding: "14px 12px",
                        backgroundColor: "#f8fafc",
                        borderRadius: 8,
                        border: "1px dashed #cbd5e1",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginBottom: 6 }}>
                        No Trader Company Assigned
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTraderOffer}
                        className="btn btn-secondary"
                        style={{ fontSize: 11.5, padding: "4px 10px", color: "#004d66" }}
                      >
                        + Add Trader & Offering Price
                      </button>
                    </div>
                  ) : (
                    productTraders.map((trader, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#004d66", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              Trader Company #{idx + 1}
                              {idx === 0 && (
                                <span style={{ fontSize: 10, color: "#0284c7", fontWeight: 600, marginLeft: 6 }}>
                                  (Primary)
                                </span>
                              )}
                            </span>
                            {productTraders.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTraderOffer(idx)}
                                title="Remove this trader"
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#94a3b8",
                                  cursor: "pointer",
                                  padding: "2px 4px",
                                  display: "flex",
                                  alignItems: "center",
                                  borderRadius: 4,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>
                              Trader Company
                            </label>
                            <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
                              <div
                                onClick={() => {
                                  setOpenTraderDropdownIdx(openTraderDropdownIdx === idx ? null : idx);
                                  setTraderSearchText("");
                                }}
                                className="form-input"
                                style={{
                                  fontSize: 12.5,
                                  height: 36,
                                  width: "100%",
                                  minWidth: 0,
                                  boxSizing: "border-box",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  cursor: "pointer",
                                  userSelect: "none",
                                  backgroundColor: "#ffffff",
                                  padding: "0 10px",
                                  borderRadius: 7,
                                  borderColor: !trader.traderCompanyId ? "#fca5a5" : openTraderDropdownIdx === idx ? "#004d66" : "#cbd5e1",
                                  boxShadow: openTraderDropdownIdx === idx ? "0 0 0 2px rgba(0,77,102,0.12)" : "none",
                                }}
                              >
                                <div
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: !trader.traderCompanyId ? "#dc2626" : "#0f172a",
                                    fontWeight: !trader.traderCompanyId ? 600 : 500,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    minWidth: 0,
                                    flex: 1,
                                  }}
                                >
                                  {(() => {
                                    if (!trader.traderCompanyId) {
                                      return <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Not Found - Trader Company</span>;
                                    }
                                    const match = companiesList.find((c) => c.id === trader.traderCompanyId);
                                    return (
                                      <>
                                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {match ? match.name : trader.traderCompanyName || "Trader Company"}
                                        </span>
                                        {match?.partnership && (
                                          <span
                                            style={{
                                              fontSize: 9.5,
                                              fontWeight: 600,
                                              color: "#0369a1",
                                              backgroundColor: "#e0f2fe",
                                              padding: "1px 5px",
                                              borderRadius: 4,
                                              flexShrink: 0,
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {match.partnership}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                <ChevronDown
                                  size={14}
                                  style={{
                                    color: "#64748b",
                                    transform: openTraderDropdownIdx === idx ? "rotate(180deg)" : "none",
                                    transition: "transform 0.15s ease",
                                    flexShrink: 0,
                                    marginLeft: 6,
                                  }}
                                />
                              </div>

                              {openTraderDropdownIdx === idx && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    marginTop: 4,
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 10,
                                    boxShadow: "0 12px 30px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.06)",
                                    zIndex: 1000,
                                    maxHeight: 280,
                                    display: "flex",
                                    flexDirection: "column",
                                    overflow: "hidden",
                                  }}
                                >
                                  {/* Search box inside dropdown */}
                                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                                    <div style={{ position: "relative" }}>
                                      <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search trader company..."
                                        value={traderSearchText}
                                        onChange={(e) => setTraderSearchText(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          width: "100%",
                                          padding: "5px 8px 5px 26px",
                                          fontSize: 12,
                                          borderRadius: 6,
                                          border: "1px solid #cbd5e1",
                                          outline: "none",
                                          backgroundColor: "#ffffff",
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Options List */}
                                  <div style={{ overflowY: "auto", maxHeight: 210, padding: "4px 0" }}>
                                    <div
                                      onClick={() => {
                                        handleUpdateTraderOffer(idx, { traderCompanyId: "", traderCompanyName: "" });
                                        setOpenTraderDropdownIdx(null);
                                      }}
                                      className="hover:bg-slate-50"
                                      style={{
                                        padding: "7px 12px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        color: !trader.traderCompanyId ? "#dc2626" : "#64748b",
                                        fontWeight: !trader.traderCompanyId ? 700 : 500,
                                        backgroundColor: !trader.traderCompanyId ? "#fef2f2" : "transparent",
                                      }}
                                    >
                                      <span>Not Found - Trader Company</span>
                                      {!trader.traderCompanyId && <span style={{ color: "#dc2626", fontWeight: 700 }}>✓</span>}
                                    </div>

                                    {companiesList
                                      .filter((comp) =>
                                        comp.name.toLowerCase().includes(traderSearchText.toLowerCase().trim()) ||
                                        (comp.partnership && comp.partnership.toLowerCase().includes(traderSearchText.toLowerCase().trim()))
                                      )
                                      .map((comp) => {
                                        const isSelected = comp.id === trader.traderCompanyId;
                                        return (
                                          <div
                                            key={comp.id}
                                            onClick={() => {
                                              handleUpdateTraderOffer(idx, {
                                                traderCompanyId: comp.id,
                                                traderCompanyName: comp.name,
                                                deliveryLeadTime: comp.deliveryLeadTime || trader.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
                                              });
                                              setOpenTraderDropdownIdx(null);
                                            }}
                                            className="hover:bg-slate-50"
                                            style={{
                                              padding: "7px 12px",
                                              fontSize: 12,
                                              cursor: "pointer",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "space-between",
                                              color: isSelected ? "#004d66" : "#1e293b",
                                              fontWeight: isSelected ? 700 : 500,
                                              backgroundColor: isSelected ? "#f0f9ff" : "transparent",
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                              <span>{comp.name}</span>
                                              <span style={{ fontSize: 10, color: "#64748b" }}>({comp.partnership})</span>
                                            </div>
                                            {isSelected && <span style={{ color: "#0284c7", fontWeight: 700 }}>✓</span>}
                                          </div>
                                        );
                                      })}
                                  </div>

                                  {/* Add New Trader button at bottom */}
                                  <div
                                    onClick={() => {
                                      setOpenTraderDropdownIdx(null);
                                      setShowAddCompanyModal(true);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      borderTop: "1px solid #f1f5f9",
                                      backgroundColor: "#f8fafc",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: "#004d66",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <span>➕ Add New Trader Company...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginTop: 2 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>
                                Offering Price (AED)
                              </label>
                              <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                                  AED
                                </span>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ height: 34, fontSize: 12.5, paddingLeft: 38, fontWeight: 600, color: "#0f172a", backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box" }}
                                  placeholder="0"
                                  value={trader.offeringPrice ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? undefined : Number(e.target.value);
                                    handleUpdateTraderOffer(idx, {
                                      offeringPrice: val,
                                      traderPriceMin: val ? Math.round(val * 0.95) : undefined,
                                      traderPriceMax: val ? Math.round(val * 1.05) : undefined,
                                    });
                                  }}
                                />
                              </div>
                            </div>

                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>
                                Lead Time
                              </label>
                              <CustomLightSelect
                                value={trader.deliveryLeadTime || "3 - 5 Days (UAE Stock)"}
                                options={[
                                  { value: "1 - 2 Days (Ready Stock UAE)", label: "1 - 2 Days (UAE)" },
                                  { value: "3 - 5 Days (UAE Stock)", label: "3 - 5 Days (UAE)" },
                                  { value: "7 - 10 Days (Regional Transit)", label: "7 - 10 Days" },
                                  { value: "2 - 3 Weeks (Import on Demand)", label: "2 - 3 Weeks" },
                                  { value: "4 - 6 Weeks (Factory Order)", label: "4 - 6 Weeks" },
                                ]}
                                onChange={(val) => {
                                  handleUpdateTraderOffer(idx, { deliveryLeadTime: val });
                                }}
                                style={{ width: "100%", minWidth: 0 }}
                                buttonStyle={{ height: 34, fontSize: 12, paddingLeft: 8, paddingRight: 22 }}
                                menuStyle={{ minWidth: 200 }}
                                align="right"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {productTraders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddTraderOffer}
                      style={{
                        padding: "7px 12px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "#004d66",
                        backgroundColor: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f0f9ff";
                        e.currentTarget.style.borderColor = "#7dd3fc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#cbd5e1";
                      }}
                    >
                      <Plus size={13} />
                      <span>Add Another Trader & Offering Price</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const displayTraders =
                      currentProduct.traders && currentProduct.traders.length > 0
                        ? currentProduct.traders
                        : currentProduct.traderCompanyName || currentProduct.traderCompanyId || currentProduct.supplier
                        ? [
                            {
                              traderCompanyId: currentProduct.traderCompanyId || "",
                              traderCompanyName: currentProduct.traderCompanyName || currentProduct.supplier || "Authorized Trader",
                              offeringPrice: currentProduct.purchaseCost || currentProduct.traderPriceMin || 0,
                              deliveryLeadTime: currentProduct.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
                            },
                          ]
                        : [];

                    if (displayTraders.length === 0) {
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#64748b", fontSize: 12 }}>Trader Company:</span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#dc2626",
                              fontSize: 11.5,
                              backgroundColor: "#fef2f2",
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid #fecaca",
                              fontWeight: 600,
                            }}
                          >
                            Not Found - Trader Company
                          </span>
                        </div>
                      );
                    }

                    return displayTraders.map((t, idx) => {
                      const comp = companiesList.find(
                        (c) =>
                          (t.traderCompanyId && c.id === t.traderCompanyId) ||
                          (t.traderCompanyName && c.name.toLowerCase().trim() === t.traderCompanyName.toLowerCase().trim())
                      );
                      const isAssigned = !!(t.traderCompanyId || (comp && comp.id));

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "9px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {isAssigned ? (
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                                    {t.traderCompanyName || comp?.name || "Trader Company"}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      color: "#dc2626",
                                      fontSize: 11.5,
                                      backgroundColor: "#fef2f2",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      border: "1px solid #fecaca",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Not Found - Trader Company
                                  </span>
                                )}
                                {comp?.partnership && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      backgroundColor: "#e0f2fe",
                                      color: "#0369a1",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {comp.partnership}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                                <span>⏱ {t.deliveryLeadTime || currentProduct.deliveryLeadTime || "3 - 5 Days"}</span>
                                {comp?.origin && <span>• 📍 {comp.origin}</span>}
                              </div>
                            </div>

                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>
                                AED {Number(t.offeringPrice ?? currentProduct.purchaseCost ?? 0).toLocaleString()}
                              </div>
                              <div style={{ fontSize: 9.5, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                                Offering Price
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div style={{ height: 1, backgroundColor: "#f1f5f9" }} />

            {/* Section 3: Stock & Warranty */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Stock & Service Protection
              </div>

              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      In Stock (Units)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={inStock}
                      onChange={(e) => setInStock(Number(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 13, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      Warranty Period
                    </label>
                    <CustomLightSelect
                      value={warrantyPeriod}
                      options={[
                        { value: "1 Year", label: "1 Year Warranty" },
                        { value: "2 Years", label: "2 Years Warranty" },
                        { value: "3 Years", label: "3 Years Comprehensive" },
                        { value: "5 Years", label: "5 Years Manufacturer Warranty" },
                      ]}
                      onChange={(val) => setWarrantyPeriod(val)}
                      style={{ width: "100%" }}
                      buttonStyle={{ height: 34, fontSize: 12.5 }}
                      menuStyle={{ minWidth: 220 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={amcAvailable}
                        onChange={(e) => setAmcAvailable(e.target.checked)}
                      />
                      <span>AMC Eligible for this equipment</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Warranty:</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{currentProduct.warrantyPeriod}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>FastonMed AMC:</span>
                    <span style={{ fontWeight: 600, color: currentProduct.amcAvailable ? "#059669" : "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {currentProduct.amcAvailable ? (
                        <>
                          <ShieldCheck size={13} color="#059669" />
                          <span>Eligible</span>
                        </>
                      ) : (
                        "Not Eligible"
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Deep Details & Specifications */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card 1: Product Overview Card */}
          <div
            className="card"
            style={{
              padding: "22px 24px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
            }}
          >
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 3 }}>
                    Product Name *
                  </label>
                  <input
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ fontSize: 15, fontWeight: 700, height: 38 }}
                    required
                  />
                </div>
                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div ref={brandDropdownRef} style={{ position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <label className="form-label" style={{ fontSize: 11.5, margin: 0 }}>
                        Brand
                      </label>
                      <span style={{ fontSize: 10.5, color: "#64748b" }}>
                        Select or Type
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        className="form-input"
                        value={brand}
                        onChange={(e) => {
                          setBrand(e.target.value);
                          setBrandDropdownOpen(true);
                        }}
                        onFocus={() => setBrandDropdownOpen(true)}
                        placeholder="Select or enter brand..."
                        list="stored-brands-list-edit"
                        style={{ fontSize: 12.5, height: 34, paddingRight: 28 }}
                      />
                      <button
                        type="button"
                        onClick={() => setBrandDropdownOpen((prev) => !prev)}
                        style={{
                          position: "absolute",
                          right: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <ChevronDown size={14} style={{ transform: brandDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                      </button>
                    </div>

                    <datalist id="stored-brands-list-edit">
                      {brands.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>

                    {/* Custom Styled Brand List Popover */}
                    {brandDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.06)",
                          zIndex: 100,
                          maxHeight: 220,
                          overflowY: "auto",
                          padding: "4px 0",
                        }}
                      >
                        {brand.trim() && !brands.some((b) => b.toLowerCase() === brand.trim().toLowerCase()) && (
                          <div
                            onClick={() => {
                              const newB = brand.trim();
                              addStoredBrand(newB);
                              setBrand(newB);
                              setBrandDropdownOpen(false);
                              toast.success(`Saved new brand: "${newB}"`);
                            }}
                            style={{
                              padding: "7px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#004d66",
                              backgroundColor: "#f0fdfa",
                              borderBottom: "1px solid #e2e8f0",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>➕ Add "{brand.trim()}" as new brand</span>
                          </div>
                        )}
                        {brands
                          .filter((b) => b.toLowerCase().includes((brand || "").toLowerCase().trim()))
                          .map((b) => {
                            const isSelected = b.toLowerCase() === brand.trim().toLowerCase();
                            return (
                              <div
                                key={b}
                                onClick={() => {
                                  setBrand(b);
                                  addStoredBrand(b);
                                  setBrandDropdownOpen(false);
                                }}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  backgroundColor: isSelected ? "#f0fdfa" : "transparent",
                                  color: isSelected ? "#004d66" : "#1e293b",
                                  fontWeight: isSelected ? 700 : 500,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  transition: "background-color 0.1s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <span>{b}</span>
                                {isSelected && <span style={{ color: "#059669", fontSize: 12 }}>✓</span>}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      Model
                    </label>
                    <input
                      className="form-input"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      style={{ fontSize: 12.5, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 3 }}>
                      Category
                    </label>
                    <CustomLightSelect
                      value={category}
                      options={categoriesList.map((c) => ({ value: c, label: c }))}
                      onChange={(val) => setCategory(val as ProductCategory)}
                      onAddNew={() => setShowAddCategoryModal(true)}
                      addNewLabel="+ Add New Category..."
                      style={{ width: "100%" }}
                      buttonStyle={{ height: 34, fontSize: 12.5 }}
                      menuStyle={{ minWidth: 260, maxHeight: 280 }}
                      searchable={true}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a", lineHeight: 1.25 }}>
                  {currentProduct.name}
                </h1>
                <p style={{ color: "#64748b", fontSize: 13.5, margin: "6px 0 0 0" }}>
                  {currentProduct.brand} {currentProduct.model ? `· Model: ${currentProduct.model}` : ""}
                </p>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 5,
                      backgroundColor: categoryBadgeStyle.bg,
                      color: categoryBadgeStyle.text,
                      border: `1px solid ${categoryBadgeStyle.border}`,
                    }}
                  >
                    {currentProduct.category}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 5,
                      backgroundColor: (currentProduct.traderCompanyName || currentProduct.supplier) ? "#f0f9ff" : "#fef2f2",
                      color: (currentProduct.traderCompanyName || currentProduct.supplier) ? "#0369a1" : "#dc2626",
                      border: `1px solid ${(currentProduct.traderCompanyName || currentProduct.supplier) ? "#bae6fd" : "#fecaca"}`,
                    }}
                  >
                    Trader: {currentProduct.traderCompanyName || currentProduct.supplier || "Not Found - Trader Company"}
                  </span>
                  {currentProduct.amcAvailable && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 5,
                        backgroundColor: "#ecfdf5",
                        color: "#047857",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      FastonMed AMC Ready
                    </span>
                  )}
                </div>
              </div>
            )}

            <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "16px 0" }} />

            {/* Product Description Section */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Clinical Overview & Specifications
                </div>
                {!isEditing && currentProduct.productUrl && (
                  <a
                    href={currentProduct.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      color: "#0284c7",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <span>View product on web</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Edit Mode Auto-Fetcher */}
              {isEditing && (
                <div
                  style={{
                    backgroundColor: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0f766e", display: "flex", alignItems: "center", gap: 5 }}>
                      <Globe size={13} />
                      Auto-Fetch Specs from URL
                    </span>
                    <span style={{ fontSize: 10.5, color: "#0d9488" }}>
                      Paste manufacturer URL to automatically extract details
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <LinkIcon size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        className="form-input"
                        placeholder="e.g. https://www.mindray.com/products/ventilator"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleFetchLink();
                          }
                        }}
                        style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleFetchLink}
                      disabled={isFetchingLink}
                      style={{
                        backgroundColor: "#004d66",
                        fontSize: 11.5,
                        padding: "0 12px",
                        height: 32,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isFetchingLink ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          <span>Auto-Fill</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Description Body */}
              {isEditing ? (
                <div>
                  <textarea
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    style={{ fontSize: 12.5, resize: "vertical", lineHeight: 1.6 }}
                    placeholder="Provide clinical details, intended hospital environment, and device performance..."
                  />
                </div>
              ) : (
                <div>
                  <ProductDescription content={currentProduct.description || "No description provided for this equipment."} />

                  {/* Minimal Tags */}
                  {currentProduct.tags && currentProduct.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                      {currentProduct.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            backgroundColor: "#f8fafc",
                            color: "#64748b",
                            border: "1px solid #e2e8f0",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Technical Specifications Card */}
          <div
            className="card"
            style={{
              padding: "20px 24px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Technical Parameters
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 4,
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                }}
              >
                {Object.keys(specifications).length} Parameters
              </span>
            </div>

            {/* Specifications Grid */}
            {Object.keys(specifications).length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12.5,
                  border: "1px dashed #e2e8f0",
                  borderRadius: 8,
                  backgroundColor: "#fafbfc",
                }}
              >
                No technical specifications configured. {isEditing && "Use the link fetcher or add parameters below."}
              </div>
            ) : (
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 0,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: isEditing ? 12 : 0,
                }}
              >
                {Object.entries(specifications).map(([key, value], i) => (
                  <div
                    key={key}
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid #f1f5f9",
                      borderRight: i % 2 === 0 ? "1px solid #f1f5f9" : "none",
                      backgroundColor: i % 4 < 2 ? "#fcfdfd" : "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{key}</div>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={value}
                          onChange={(e) =>
                            setSpecifications({
                              ...specifications,
                              [key]: e.target.value,
                            })
                          }
                          style={{ fontSize: 12, height: 30, padding: "2px 8px" }}
                        />
                      ) : (
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{value}</div>
                      )}
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(key)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          fontSize: 14,
                          marginLeft: 8,
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Remove specification"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add New Specification Row in Edit Mode */}
            {isEditing && (
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  className="form-input"
                  placeholder="Parameter (e.g. Battery Life)"
                  value={newSpecKey}
                  onChange={(e) => setNewSpecKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSpec();
                    }
                  }}
                  style={{ fontSize: 12, height: 32, flex: 1 }}
                />
                <input
                  className="form-input"
                  placeholder="Value (e.g. 72 Hours)"
                  value={newSpecVal}
                  onChange={(e) => setNewSpecVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSpec();
                    }
                  }}
                  style={{ fontSize: 12, height: 32, flex: 1.5 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddSpec}
                  style={{ backgroundColor: "#004d66", fontSize: 11.5, height: 32, padding: "0 12px", whiteSpace: "nowrap" }}
                >
                  + Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddCategoryModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setShowAddCategoryModal(false)}
        >
          <div
            style={{
              maxWidth: 440,
              width: "100%",
              padding: "24px 26px",
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#002735", margin: 0 }}>
                  Add Medical Category
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Create a new category for this product and the catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ultrasound Accessories, Endoscopy..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  autoFocus
                  style={{ width: "100%", fontSize: 13, height: 38 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCategoryModal(false)}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", padding: "8px 18px", fontSize: 13 }}
                >
                  Create & Select Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCompanyModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setShowAddCompanyModal(false)}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              padding: "24px 26px",
              borderRadius: 14,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#002735", margin: 0 }}>
                  Add Trader Company
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Register a new supplier / authorized trader partner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompany}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 5, display: "block" }}>
                    Company / Supplier Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Siemens Healthineers, Olympus Medical..."
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    autoFocus
                    required
                    style={{ width: "100%", fontSize: 13, height: 38 }}
                  />
                </div>

                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, display: "block" }}>
                      Country of Origin
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UAE, Germany, Japan"
                      value={newCompanyOrigin}
                      onChange={(e) => setNewCompanyOrigin(e.target.value)}
                      style={{ width: "100%", fontSize: 12.5, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, display: "block" }}>
                      Partnership Status
                    </label>
                    <CustomLightSelect
                      value={newCompanyPartnership}
                      options={[
                        { value: "Authorized Distributor", label: "Authorized Distributor" },
                        { value: "Exclusive Partner", label: "Exclusive Partner" },
                        { value: "Channel Partner", label: "Channel Partner" },
                        { value: "Certified Dealer", label: "Certified Dealer" },
                      ]}
                      onChange={(val) => setNewCompanyPartnership(val as any)}
                      style={{ width: "100%" }}
                      buttonStyle={{ height: 34, fontSize: 12.5 }}
                      menuStyle={{ minWidth: 200 }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, display: "block" }}>
                    Delivery Lead Time
                  </label>
                  <CustomLightSelect
                    value={newCompanyDelivery}
                    options={LEAD_TIME_PRESETS.map((preset) => ({
                      value: preset,
                      label: preset,
                    }))}
                    onChange={(val) => setNewCompanyDelivery(val)}
                    style={{ width: "100%" }}
                    buttonStyle={{ height: 34, fontSize: 12.5 }}
                    menuStyle={{ minWidth: 220 }}
                  />
                </div>

                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, display: "block" }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+971 4 000 0000"
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                      style={{ width: "100%", fontSize: 12.5, height: 34 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, display: "block" }}>
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="sales@company.com"
                      value={newCompanyEmail}
                      onChange={(e) => setNewCompanyEmail(e.target.value)}
                      style={{ width: "100%", fontSize: 12.5, height: 34 }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCompanyModal(false)}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", padding: "8px 18px", fontSize: 13 }}
                >
                  Create & Select Trader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
