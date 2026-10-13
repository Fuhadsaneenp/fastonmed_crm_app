"use client";

import React, { useState, useEffect, useMemo } from "react";
import CustomLightSelect from "@/components/CustomLightSelect";
import type { Client, Product, ProductCategory, ProcurementCompany } from "@/types";
import {
  getStoredProducts,
  getStoredCompanies,
  getStoredCategories,
  addProductWithTrader,
  updateProduct,
  deleteStoredProduct,
  saveStoredCompanies,
  isProductDeleted,
} from "@/lib/trader-store";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Package,
  Plus,
  Search,
  Tag,
  ShieldCheck,
  Clock,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";

/**
 * Check if a client represents a trader company
 */
export function isTraderCompany(client: Client): boolean {
  if (!client) return false;
  if (client.id?.startsWith("trader-")) return true;
  if (client.orgType === "Medical Equipment Trader" || client.orgType === "Equipment Trader") return true;
  if (
    client.connectedAs?.some((c) => {
      const s = String(c).toLowerCase().trim();
      return s === "trader" || s === "merchant";
    })
  ) {
    return true;
  }
  const companies = getStoredCompanies();
  const cName = (client.name || "").trim().toLowerCase();
  const rawId = (client.id || "").replace(/^trader-/, "");
  return companies.some((co) => co.id === rawId || co.sourceClientId === client.id || co.name.trim().toLowerCase() === cName);
}

/**
 * Find the associated ProcurementCompany record for a client (if any)
 */
export function findAssociatedProcurementCompany(client: Client): ProcurementCompany | undefined {
  const companies = getStoredCompanies();
  const rawId = (client.id || "").replace(/^trader-/, "");
  const cName = (client.name || "").trim().toLowerCase();

  return companies.find((co) => {
    if (co.sourceClientId === client.id) return true;
    if (co.id === rawId || `trader-${co.id}` === client.id) return true;
    const compName = co.name.trim().toLowerCase();
    return compName === cName || compName.includes(cName) || cName.includes(compName);
  });
}

/**
 * Helper to fetch all products this specific trader company is selling
 */
export function getCompanyProducts(client: Client): Product[] {
  if (!client) return [];
  const allProducts = getStoredProducts();
  const traderComp = findAssociatedProcurementCompany(client);

  const compId = traderComp?.id;
  const rawId = (client.id || "").replace(/^trader-/, "");
  const clientName = (client.name || "").trim().toLowerCase();

  // 1. Find all products directly linked to this company
  const matched = allProducts.filter((p) => {
    if (isProductDeleted(p)) return false;
    if (compId && p.traderCompanyId === compId) return true;
    if (p.traderCompanyId === client.id || p.traderCompanyId === rawId) return true;
    if (
      p.traders?.some(
        (t) =>
          (compId && t.traderCompanyId === compId) ||
          t.traderCompanyId === client.id ||
          t.traderCompanyId === rawId ||
          (t.traderCompanyName &&
            (t.traderCompanyName.trim().toLowerCase() === clientName ||
              clientName.includes(t.traderCompanyName.trim().toLowerCase()) ||
              t.traderCompanyName.trim().toLowerCase().includes(clientName)))
      )
    ) {
      return true;
    }
    const pTrader = (p.traderCompanyName || "").trim().toLowerCase();
    if (pTrader && (pTrader === clientName || pTrader.includes(clientName) || clientName.includes(pTrader))) return true;
    const pBrand = (p.brand || "").trim().toLowerCase();
    if (pBrand && (pBrand === clientName || pBrand.includes(clientName) || clientName.includes(pBrand))) return true;
    const pSupplier = (p.supplier || "").trim().toLowerCase();
    if (pSupplier && (pSupplier === clientName || pSupplier.includes(clientName) || clientName.includes(pSupplier))) return true;
    return false;
  });

  return matched;
}

const COMMON_LEAD_TIMES = [
  "Immediate (Ex-Stock Dubai)",
  "2 - 4 Days (Business Bay Stock)",
  "3 - 5 Days (UAE Stock)",
  "1 - 2 Weeks (Air Freight)",
  "2 - 3 Weeks (Direct Import)",
  "4 - 6 Weeks (Special Order)",
];

const COMMON_WARRANTIES = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Months"];

export default function TraderCompanyProductsTab({ client }: { client: Client }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);

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

  // Form State for Adding / Editing Product
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ProductCategory>("ICU Equipment");
  const [formBrand, setFormBrand] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formLeadTime, setFormLeadTime] = useState("3 - 5 Days (UAE Stock)");
  const [formPurchaseCost, setFormPurchaseCost] = useState<number>(30000);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(42000);
  const [formTraderMin, setFormTraderMin] = useState<number>(28000);
  const [formTraderMax, setFormTraderMax] = useState<number>(33000);
  const [formWarranty, setFormWarranty] = useState("2 Years");
  const [formInStock, setFormInStock] = useState<number>(2);
  const [formAmc, setFormAmc] = useState(true);
  const [formImage, setFormImage] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const traderCompany = useMemo(() => findAssociatedProcurementCompany(client), [client]);

  const loadData = () => {
    const list = getCompanyProducts(client);
    setProducts(list);
    setCategories(getStoredCategories());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener("fastonmed_products_updated", handleUpdate);
    window.addEventListener("fastonmed_companies_updated", handleUpdate);
    return () => {
      window.removeEventListener("fastonmed_products_updated", handleUpdate);
      window.removeEventListener("fastonmed_companies_updated", handleUpdate);
    };
  }, [client]);

  // Reset Add Form
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory(categories[0] || "ICU Equipment");
    setFormBrand(client.name || "");
    setFormModel("");
    setFormLeadTime(traderCompany?.deliveryLeadTime || "3 - 5 Days (UAE Stock)");
    setFormPurchaseCost(30000);
    setFormSellingPrice(42000);
    setFormTraderMin(28000);
    setFormTraderMax(33000);
    setFormWarranty("2 Years");
    setFormInStock(2);
    setFormAmc(true);
    setFormImage("");
    setFormDescription(`Authorized equipment supplied by ${client.name}.`);
    setShowAddModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormBrand(p.brand || client.name);
    setFormModel(p.model || "");
    setFormLeadTime(p.deliveryLeadTime || "3 - 5 Days (UAE Stock)");
    setFormPurchaseCost(p.purchaseCost || 0);
    setFormSellingPrice(p.sellingPrice || 0);
    setFormTraderMin(p.traderPriceMin || p.purchaseCost * 0.95);
    setFormTraderMax(p.traderPriceMax || p.purchaseCost * 1.05);
    setFormWarranty(p.warrantyPeriod || "2 Years");
    setFormInStock(p.inStock || 1);
    setFormAmc(p.amcAvailable ?? true);
    setFormImage(p.image || "");
    setFormDescription(p.description || "");
    setShowAddModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = formName.trim();
    if (!nameTrimmed) {
      toast.error("Please enter a product name");
      return;
    }

    const traderCompanyId = traderCompany?.id || client.id.replace(/^trader-/, "");
    const traderCompanyName = traderCompany?.name || client.name;

    if (editingProduct) {
      const existingTraders = editingProduct.traders || [];
      const offerPrice = Number(formPurchaseCost) || 0;
      const traderMin = Number(formTraderMin) || 0;
      const traderMax = Number(formTraderMax) || 0;
      const updatedTraders = existingTraders.some((t) => t.traderCompanyId === traderCompanyId)
        ? existingTraders.map((t) =>
            t.traderCompanyId === traderCompanyId
              ? {
                  ...t,
                  traderCompanyName,
                  offeringPrice: offerPrice,
                  traderPriceMin: traderMin,
                  traderPriceMax: traderMax,
                  deliveryLeadTime: formLeadTime,
                  warrantyPeriod: formWarranty,
                }
              : t
          )
        : [
            ...existingTraders,
            {
              traderCompanyId,
              traderCompanyName,
              offeringPrice: offerPrice,
              traderPriceMin: traderMin,
              traderPriceMax: traderMax,
              deliveryLeadTime: formLeadTime,
              warrantyPeriod: formWarranty,
            },
          ];

      const updated: Product = {
        ...editingProduct,
        name: nameTrimmed,
        category: formCategory,
        brand: formBrand.trim() || traderCompanyName,
        model: formModel.trim() || "Standard Edition",
        supplier: traderCompanyName,
        traderCompanyId,
        traderCompanyName,
        deliveryLeadTime: formLeadTime,
        purchaseCost: offerPrice,
        sellingPrice: Number(formSellingPrice) || 0,
        traderPriceMin: traderMin,
        traderPriceMax: traderMax,
        traders: updatedTraders,
        warrantyPeriod: formWarranty,
        inStock: Number(formInStock) || 1,
        amcAvailable: formAmc,
        image: formImage.trim() || editingProduct.image,
        description: formDescription.trim() || `Supplied by ${traderCompanyName}`,
      };

      updateProduct(updated);
      toast.success(`Updated "${nameTrimmed}"`);
    } else {
      // Add new product
      addProductWithTrader({
        name: nameTrimmed,
        category: formCategory,
        brand: formBrand.trim() || traderCompanyName,
        model: formModel.trim() || "Model " + Math.floor(Math.random() * 9000 + 1000),
        traderCompanyId,
        traderCompanyName,
        deliveryLeadTime: formLeadTime,
        traderPriceMin: Number(formTraderMin) || 0,
        traderPriceMax: Number(formTraderMax) || 0,
        purchaseCost: Number(formPurchaseCost) || 0,
        sellingPrice: Number(formSellingPrice) || 0,
        warrantyPeriod: formWarranty,
        amcAvailable: formAmc,
        inStock: Number(formInStock) || 1,
        image: formImage.trim() || undefined,
        description: formDescription.trim() || `Medical equipment supplied by ${traderCompanyName}`,
      });
      toast.success(`Added "${nameTrimmed}" to ${client.name}'s product catalog`);
    }

    setShowAddModal(false);
    loadData();
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    if (confirm(`Are you sure you want to remove "${productName}" from this company's products?`)) {
      deleteStoredProduct(productId, productName);

      // Also clean up from traderCompany suppliedProducts if matching
      if (traderCompany) {
        const companies = getStoredCompanies();
        const updated = companies.map((co) => {
          if (co.id === traderCompany.id) {
            return {
              ...co,
              suppliedProducts: co.suppliedProducts?.filter((p) => p.toLowerCase() !== productName.toLowerCase()),
              productCount: Math.max(0, (co.productCount || 1) - 1),
            };
          }
          return co;
        });
        saveStoredCompanies(updated);
      }

      toast.success(`Removed "${productName}"`);
      loadData();
    }
  };

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);

      const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCategory]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  const totalInStock = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.inStock || 0), 0);
  }, [products]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Filter & Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Left: Search & Category Filter */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 260, flexWrap: "wrap" }}>
          {/* Search Input with Clear button */}
          <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
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
              placeholder={`Search products or models...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                paddingLeft: 34,
                paddingRight: search ? 30 : 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                backgroundColor: "#ffffff",
                color: "#0f172a",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
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

          {/* Category Filter */}
          <CustomLightSelect
            value={selectedCategory}
            options={[
              { value: "all", label: `All Categories (${products.length})` },
              ...uniqueCategories.map((cat) => ({
                value: cat,
                label: cat,
                badge: String(products.filter((p) => p.category === cat).length),
              })),
            ]}
            onChange={(val) => setSelectedCategory(val)}
            activeColor={selectedCategory !== "all"}
            style={{ width: "auto", minWidth: 175 }}
            buttonStyle={{ height: 38, fontSize: 13 }}
            menuStyle={{ minWidth: 260, maxHeight: 300 }}
            searchable={uniqueCategories.length > 6}
          />
        </div>

        {/* Right: Add Product Button */}
        <button
          onClick={openAddModal}
          style={{
            height: 38,
            backgroundColor: "#004d66",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            transition: "background-color 0.15s ease",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00384a")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#004d66")}
        >
          <Plus size={15} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Results Summary Bar (matching main products page) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "0 2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Showing <strong style={{ color: "#0f172a" }}>{filteredProducts.length}</strong> of{" "}
            <strong style={{ color: "#0f172a" }}>{products.length}</strong> products
          </p>
          {(selectedCategory !== "all" || search) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setSearch("");
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
          {traderCompany?.partnership && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#0284c7",
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {traderCompany.partnership}
            </span>
          )}
        </div>
      </div>

      {/* Minimal & Elegant Products Table */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table data-mobile-cards="true" style={{ width: "100%", minWidth: 920, borderCollapse: "separate", borderSpacing: 0, margin: 0 }}>
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
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Product / Model
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
                    borderBottom: "1px solid #e2e8f0",
                    width: 140,
                  }}
                >
                  Category
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
                    borderBottom: "1px solid #e2e8f0",
                    width: 160,
                  }}
                >
                  Lead Time
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
                    borderBottom: "1px solid #e2e8f0",
                    width: 130,
                  }}
                >
                  Trader Cost
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
                    borderBottom: "1px solid #e2e8f0",
                    width: 130,
                  }}
                >
                  Selling Price
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
                    borderBottom: "1px solid #e2e8f0",
                    width: 150,
                  }}
                >
                  Stock & Warranty
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid #e2e8f0",
                    width: 110,
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, rowIdx) => {
                const traderOffer = p.traders?.find(
                  (t) =>
                    t.traderCompanyId === traderCompany?.id ||
                    t.traderCompanyId === client.id ||
                    (t.traderCompanyName && t.traderCompanyName.toLowerCase().trim() === client.name?.toLowerCase().trim())
                );
                const cost = traderOffer?.offeringPrice ?? p.purchaseCost ?? p.traderPriceMin ?? 0;
                const leadTime = traderOffer?.deliveryLeadTime || p.deliveryLeadTime || "3 - 5 Days";
                const warranty = traderOffer?.warrantyPeriod || p.warrantyPeriod || "1 Year";
                const minRange = traderOffer?.traderPriceMin ?? p.traderPriceMin;
                const maxRange = traderOffer?.traderPriceMax ?? p.traderPriceMax;

                const hasMargin = p.sellingPrice && cost && p.sellingPrice > cost;
                const marginPct = hasMargin ? Math.round(((p.sellingPrice - cost) / cost) * 100) : null;

                return (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff")
                    }
                  >
                    {/* Column 1: Product thumbnail & name */}
                    <td data-label="Product / Model" style={{ minWidth: 240, padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <Package size={20} color="#004d66" />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13.5,
                              color: "#0f172a",
                              cursor: "pointer",
                              lineHeight: 1.35,
                            }}
                            onClick={() => setSelectedProduct(p)}
                            title={p.name}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#004d66")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {p.brand} {p.model && p.model !== p.name ? `· ${p.model}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Category Badge */}
                    <td data-label="Category" style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          backgroundColor: "#f1f5f9",
                          color: "#334155",
                          border: "1px solid #e2e8f0",
                          padding: "3px 8px",
                          borderRadius: 6,
                          display: "inline-block",
                        }}
                      >
                        {p.category}
                      </span>
                    </td>

                    {/* Column 3: Lead Time */}
                    <td data-label="Lead Time" style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#334155" }}>
                        <Clock size={13} style={{ color: "#0284c7" }} />
                        <span>{leadTime}</span>
                      </div>
                    </td>

                    {/* Column 4: Trader Cost */}
                    <td data-label="Trader Cost" style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#334155" }}>
                        {formatCurrency(cost)}
                      </div>
                      {minRange && maxRange && minRange !== maxRange ? (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                          Range: {minRange.toLocaleString()} - {maxRange.toLocaleString()}
                        </div>
                      ) : null}
                    </td>

                    {/* Column 5: Selling Price */}
                    <td data-label="Selling Price" style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                        {formatCurrency(p.sellingPrice || 0)}
                      </div>
                      {marginPct !== null && marginPct > 0 ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "#059669",
                            backgroundColor: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            padding: "1px 6px",
                            borderRadius: 4,
                            display: "inline-block",
                            marginTop: 2,
                          }}
                        >
                          +{marginPct}% margin
                        </span>
                      ) : null}
                    </td>

                    {/* Column 6: Stock & Warranty */}
                    <td data-label="Stock & Warranty" style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: (p.inStock || 0) > 0 ? "#059669" : "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: (p.inStock || 0) > 0 ? "#10b981" : "#94a3b8",
                            }}
                          />
                          {(p.inStock || 0) > 0 ? `${p.inStock} in stock` : "Available on request"}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ShieldCheck size={12} style={{ color: "#64748b" }} />
                          {warranty}
                        </span>
                      </div>
                    </td>

                    {/* Column 7: Action Dropdown */}
                    <td data-label="Action"
                      style={{
                        padding: "8px 14px",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        position: "relative",
                        zIndex: activeActionDropdownId === p.id ? 30 : 1,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ position: "relative", display: "inline-block", textAlign: "left" }}>
                        <button
                          type="button"
                          title="Actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionDropdownId(activeActionDropdownId === p.id ? null : p.id);
                          }}
                          style={{
                            padding: "5px 11px",
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
                          onMouseEnter={(e) => {
                            if (activeActionDropdownId !== p.id) {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.borderColor = "#cbd5e1";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeActionDropdownId !== p.id) {
                              e.currentTarget.style.backgroundColor = "#ffffff";
                              e.currentTarget.style.borderColor = "#e2e8f0";
                            }
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
                              ...(rowIdx >= filteredProducts.length - 2 && filteredProducts.length > 2
                                ? { bottom: "calc(100% + 4px)" }
                                : { top: "calc(100% + 4px)" }),
                              zIndex: 100,
                              backgroundColor: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                              minWidth: 160,
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
                                setSelectedProduct(p);
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
                              <span>View Product</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(p);
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
                              <span>Edit Details</span>
                            </button>

                            <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "2px 0" }} />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionDropdownId(null);
                                handleDeleteProduct(p.id, p.name);
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
                              <Trash2 size={13} color="#ef4444" />
                              <span>Remove Product</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <Package size={24} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                        {search ? "No matching products found" : `No products registered for ${client.name}`}
                      </div>
                      <p style={{ fontSize: 12.5, color: "#64748b", maxWidth: 360, margin: 0 }}>
                        {search
                          ? "Try adjusting your search keywords or category filters."
                          : "Add medical products supplied by this trader company to track stock, pricing, and supply lead times."}
                      </p>
                      {!search && (
                        <button
                          onClick={openAddModal}
                          style={{
                            backgroundColor: "#004d66",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                          }}
                        >
                          <Plus size={15} />
                          <span>Add First Product</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
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
                  }}
                >
                  <Package size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    {editingProduct ? "Edit Product" : "Add Product to Trader Catalog"}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Trader Partner: <strong style={{ color: "#004d66" }}>{client.name}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProduct} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Product Name & Category */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. ICU Ventilator SV-300"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Category *
                  </label>
                  <CustomLightSelect
                    value={formCategory}
                    options={categories.map((cat) => ({ value: cat, label: cat }))}
                    onChange={(val) => setFormCategory(val as ProductCategory)}
                    style={{ width: "100%" }}
                    buttonStyle={{ height: 38, fontSize: 13 }}
                    menuStyle={{ minWidth: 260, maxHeight: 280 }}
                    searchable={true}
                  />
                </div>
              </div>

              {/* Brand & Model */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Brand / OEM Manufacturer
                  </label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder={client.name}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Model / Series Code
                  </label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="e.g. SV-300 Edition 2026"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Pricing Row: Purchase Cost, Selling Price, Min/Max Trader Price */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Purchase / Trader Cost (AED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formPurchaseCost}
                    onChange={(e) => {
                      const cost = Number(e.target.value);
                      setFormPurchaseCost(cost);
                      if (!editingProduct) {
                        setFormSellingPrice(Math.round(cost * 1.3));
                        setFormTraderMin(Math.round(cost * 0.95));
                        setFormTraderMax(Math.round(cost * 1.1));
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Selling Price (AED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Stock Units Available
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formInStock}
                    onChange={(e) => setFormInStock(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Supply Speed & Warranty */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Delivery Lead Time
                  </label>
                  <CustomLightSelect
                    value={formLeadTime}
                    options={COMMON_LEAD_TIMES.map((lt) => ({ value: lt, label: lt }))}
                    onChange={(val) => setFormLeadTime(val)}
                    style={{ width: "100%" }}
                    buttonStyle={{ height: 38, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Warranty Period
                  </label>
                  <CustomLightSelect
                    value={formWarranty}
                    options={COMMON_WARRANTIES.map((w) => ({ value: w, label: w }))}
                    onChange={(val) => setFormWarranty(val)}
                    style={{ width: "100%" }}
                    buttonStyle={{ height: 38, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Image URL & AMC Toggle */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Product Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Product Description & Clinical Notes
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Key features, specifications, and clinical applications..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="amcAvailable"
                  checked={formAmc}
                  onChange={(e) => setFormAmc(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="amcAvailable" style={{ fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  FastonMed AMC / Annual Maintenance Contract available for this equipment
                </label>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 10,
                  paddingTop: 16,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    backgroundColor: "#004d66",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editingProduct ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProduct(null);
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 580,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: "#e0f2fe",
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {selectedProduct.image ? (
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Package size={24} />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                    {selectedProduct.name}
                  </h3>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                    {selectedProduct.brand} · <span style={{ fontFamily: "monospace" }}>{selectedProduct.model}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Details */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Key Specs Grid */}
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  backgroundColor: "#f8fafc",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Category</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedProduct.category}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Trader Partner</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#004d66" }}>
                    {selectedProduct.traderCompanyName || client.name}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Supply Lead Time</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                    {selectedProduct.deliveryLeadTime || "3 - 5 Days"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Stock Status</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: (selectedProduct.inStock || 0) > 0 ? "#059669" : "#dc2626",
                    }}
                  >
                    {(selectedProduct.inStock || 0) > 0 ? `${selectedProduct.inStock} In Stock` : "On Request"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Trader Cost</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                    {formatCurrency(selectedProduct.purchaseCost || selectedProduct.traderPriceMin || 0)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Selling Price</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
                    {formatCurrency(selectedProduct.sellingPrice || 0)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Warranty</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                    {selectedProduct.warrantyPeriod || "2 Years"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>AMC Eligible</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: selectedProduct.amcAvailable ? "#059669" : "#94a3b8" }}>
                    {selectedProduct.amcAvailable ? "Yes - Comprehensive" : "No"}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Clinical Description & Notes
                  </div>
                  <p style={{ fontSize: 12.5, color: "#334155", margin: 0, lineHeight: 1.5 }}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 24px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => {
                  const p = selectedProduct;
                  setSelectedProduct(null);
                  openEditModal(p);
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Pencil size={13} />
                <span>Edit Product</span>
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  backgroundColor: "#004d66",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
