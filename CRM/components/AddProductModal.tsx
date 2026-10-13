"use client";

import React, { useState, useRef, useEffect } from "react";
import CustomLightSelect from "@/components/CustomLightSelect";
import {
  addProductWithTrader,
  getStoredCompanies,
  getStoredProducts,
  saveStoredProducts,
  DEFAULT_PRODUCT_CATEGORIES,
  getStoredBrands,
  addStoredBrand,
} from "@/lib/trader-store";
import { putWooCommerceProducts, notifyWooCommerceProductsUpdated, type LinkedProduct } from "@/lib/woocommerce/catalog-store";
import { getAuthToken } from "@/lib/api-client";
import type { Product, ProductCategory, ProcurementCompany } from "@/types";
import toast from "react-hot-toast";
import { Camera, Trash2, X } from "lucide-react";

interface AddProductModalProps {
  initialName?: string;
  initialCategory?: ProductCategory | string;
  initialTraderCompanyId?: string;
  onClose: () => void;
  onProductCreated?: (newProduct: Product) => void;
}

export default function AddProductModal({
  initialName = "",
  initialCategory,
  initialTraderCompanyId,
  onClose,
  onProductCreated,
}: AddProductModalProps) {
  const [companies, setCompanies] = useState<ProcurementCompany[]>([]);
  const [productName, setProductName] = useState(initialName);
  const [formCategory, setFormCategory] = useState<string>(initialCategory || "ICU Equipment");
  const [formBrand, setFormBrand] = useState("");
  const [formTraderId, setFormTraderId] = useState<string>(initialTraderCompanyId || "");
  const [formLeadTime, setFormLeadTime] = useState<string>("3 - 5 Days (UAE Stock)");
  const [formWarranty, setFormWarranty] = useState<string>("1 Year");
  const [formVatStatus, setFormVatStatus] = useState<string>("5% Standard Rate (UAE VAT)");
  const [formPurchaseCost, setFormPurchaseCost] = useState<string>("");
  const [formSellingPrice, setFormSellingPrice] = useState<string>("");
  const [formTraderMin, setFormTraderMin] = useState<string>("");
  const [formTraderMax, setFormTraderMax] = useState<string>("");
  const [formModel, setFormModel] = useState<string>("");
  const [formInStock, setFormInStock] = useState<string>("0");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formImage, setFormImage] = useState<string>("");

  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const formBrandDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const comps = getStoredCompanies();
    setCompanies(comps);
    if (!formTraderId && comps.length > 0) {
      setFormTraderId(comps[0].id);
    }
  }, []);

  // Handle outside click for brand dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (formBrandDropdownRef.current && !formBrandDropdownRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
        setFormImage(reader.result);
        toast.success("Equipment photo uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

  const costNum = Number(formPurchaseCost) || 0;
  const priceNum = Number(formSellingPrice) || 0;
  const marginPercent = priceNum > costNum && priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = productName.trim();
    if (!name) {
      toast.error("Please enter the product / equipment name");
      return;
    }

    const selectedComp = companies.find((c) => c.id === formTraderId) || companies[0];
    const brandVal = formBrand.trim() || selectedComp?.name || "General";
    if (brandVal) {
      addStoredBrand(brandVal);
    }

    const newProd = addProductWithTrader({
      name,
      category: (formCategory as ProductCategory) || "ICU Equipment",
      brand: brandVal,
      model: formModel.trim() || "",
      traderCompanyId: selectedComp?.id || "",
      traderCompanyName: selectedComp?.name || "",
      deliveryLeadTime: formLeadTime || "3 - 5 Days (UAE Stock)",
      traderPriceMin: Number(formTraderMin) || costNum,
      traderPriceMax: Number(formTraderMax) || priceNum,
      purchaseCost: costNum,
      sellingPrice: priceNum,
      vatStatus: formVatStatus || "5% Standard Rate (UAE VAT)",
      warrantyPeriod: formWarranty || "1 Year",
      amcAvailable: true,
      inStock: Number(formInStock) || 0,
      image: formImage || undefined,
      description: formDescription.trim(),
    });

    toast.success(`Product "${name}" saved to CRM!`);

    // Auto-publish to WooCommerce in background if logged in
    try {
      const token = getAuthToken();
      if (token && !token.startsWith("session-token-")) {
        const payload = {
          name: newProd.name,
          description: newProd.description,
          price: String(newProd.sellingPrice),
          stock: newProd.inStock,
          categories: [newProd.category],
          attributes: {
            Brand: newProd.brand,
            Model: newProd.model,
          },
          image: newProd.image && newProd.image.startsWith("http") ? newProd.image : undefined,
          crmId: newProd.id,
          sku: newProd.id,
          status: "publish",
        };
        fetch("/api/woocommerce", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((res) => res.json())
          .then(async (resData) => {
            if (resData?.id) {
              const stored = getStoredProducts() as LinkedProduct[];
              const idx = stored.findIndex((p) => p.id === newProd.id);
              if (idx !== -1) {
                stored[idx].woo = {
                  id: resData.id,
                  revision: resData.revision || "",
                  type: resData.type || "simple",
                  baseline: "",
                };
                stored[idx].productUrl = resData.url;
                saveStoredProducts(stored);
                await putWooCommerceProducts([stored[idx]]);
                notifyWooCommerceProductsUpdated();
              }
            }
          })
          .catch(() => {});
      }
    } catch {}

    if (onProductCreated) {
      onProductCreated(newProd);
    }
    onClose();
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
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 880,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 0,
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
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
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              📦
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#002735", margin: 0 }}>
                Add Medical Product & Connect Trader
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
                Link product category with authorized trader company, supply speed & pricing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Photo Upload Area */}
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                backgroundColor: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}
            >
              {formImage ? (
                <img src={formImage} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Camera size={24} style={{ color: "#94a3b8" }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  <Camera size={14} />
                  <span>{formImage ? "Change Equipment Photo" : "+ Add Equipment Photo"}</span>
                </button>
                {formImage && (
                  <button
                    type="button"
                    onClick={() => setFormImage("")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 500,
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
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
              <p style={{ margin: "5px 0 0 0", fontSize: 11.5, color: "#64748b" }}>
                PNG, JPG, or WebP up to 5MB (optional)
              </p>
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Product / Equipment Name *
              </label>
              <input
                name="name"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="form-input"
                placeholder="e.g. ICU High-Flow Ventilator HF-500"
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Equipment Category *
              </label>
              <CustomLightSelect
                value={formCategory}
                options={DEFAULT_PRODUCT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                placeholder="Select Equipment Category..."
                onChange={(val) => setFormCategory(val)}
                style={{ width: "100%" }}
                buttonStyle={{ height: 38, fontSize: 13 }}
                menuStyle={{ minWidth: 260 }}
              />
            </div>
          </div>

          {/* Pricing & Commercial Terms */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.9fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Our Purchase Cost (AED) *
              </label>
              <input
                type="number"
                step={500}
                required
                value={formPurchaseCost}
                placeholder="e.g. 28000"
                onChange={(e) => {
                  const val = e.target.value;
                  setFormPurchaseCost(val);
                  if (!formTraderMin && val) {
                    setFormTraderMin(val);
                  }
                }}
                className="form-input"
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Selling Price (AED) *
              </label>
              <input
                type="number"
                step={500}
                required
                value={formSellingPrice}
                placeholder="e.g. 38000"
                onChange={(e) => {
                  const val = e.target.value;
                  setFormSellingPrice(val);
                  if (!formTraderMax && val) {
                    setFormTraderMax(val);
                  }
                }}
                className="form-input"
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                VAT Status
              </label>
              <CustomLightSelect
                value={formVatStatus}
                options={[
                  { value: "5% Standard Rate (UAE VAT)", label: "5% Standard Rate (UAE VAT)" },
                  { value: "0% Zero-Rated", label: "0% Zero-Rated" },
                  { value: "Exempt", label: "Exempt" },
                ]}
                onChange={(val) => setFormVatStatus(val)}
                style={{ width: "100%" }}
                buttonStyle={{ height: 38, fontSize: 13 }}
                menuStyle={{ minWidth: 220 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Estimated Margin
              </label>
              <div
                style={{
                  height: 38,
                  padding: "0 12px",
                  borderRadius: 8,
                  backgroundColor: marginPercent > 0 ? "#f0fdf4" : "#f8fafc",
                  border: marginPercent > 0 ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: marginPercent > 0 ? "#15803d" : "#94a3b8",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {marginPercent > 0 ? `${marginPercent}% Margin` : "—"}
              </div>
            </div>
          </div>

          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.9fr", gap: 14 }}>
            <div ref={formBrandDropdownRef} style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 12, margin: 0 }}>
                  Brand
                </label>
                <span style={{ fontSize: 11, color: "#64748b" }}>Select or Type</span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  name="brand"
                  value={formBrand}
                  placeholder="e.g. Mindray, Dräger"
                  onChange={(e) => {
                    setFormBrand(e.target.value);
                    setBrandSearch(e.target.value);
                    setBrandDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setBrandSearch(formBrand);
                    setBrandDropdownOpen(true);
                  }}
                  className="form-input"
                  style={{ fontSize: 13, paddingRight: 28 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                    fontSize: 10,
                  }}
                >
                  ▼
                </span>
              </div>

              {/* Brand Autocomplete Popup */}
              {brandDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    maxHeight: 180,
                    overflowY: "auto",
                    zIndex: 200,
                    padding: 4,
                  }}
                >
                  {getStoredBrands()
                    .filter((b) => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase()))
                    .slice(0, 10)
                    .map((b) => (
                      <div
                        key={b}
                        onClick={() => {
                          setFormBrand(b);
                          setBrandDropdownOpen(false);
                        }}
                        style={{
                          padding: "6px 10px",
                          fontSize: 12.5,
                          cursor: "pointer",
                          borderRadius: 6,
                          color: "#0f172a",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {b}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Model Number
              </label>
              <input
                name="model"
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                className="form-input"
                placeholder="e.g. SV-300 Plus"
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                Units in Stock (UAE)
              </label>
              <input
                name="inStock"
                type="number"
                min={0}
                value={formInStock}
                onChange={(e) => setFormInStock(e.target.value)}
                placeholder="e.g. 0"
                className="form-input"
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Warranty Period
            </label>
            <CustomLightSelect
              value={formWarranty}
              options={[
                { value: "1 Year", label: "1 Year Standard Warranty" },
                { value: "2 Years", label: "2 Years Warranty" },
                { value: "3 Years", label: "3 Years Comprehensive" },
                { value: "5 Years", label: "5 Years Manufacturer Warranty" },
              ]}
              placeholder="Select Warranty Period..."
              onChange={(val) => setFormWarranty(val)}
              style={{ width: "100%" }}
              buttonStyle={{ height: 38, fontSize: 13 }}
              menuStyle={{ minWidth: 260 }}
            />
          </div>

          {/* Connected Trader Company & Supply Terms Section */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#004d66" }}>
              <span style={{ fontSize: 16 }}>🏢</span>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Connected Trader Company & Supply Agreement
              </span>
            </div>

            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Select Providing Trader Company *
                </label>
                <CustomLightSelect
                  value={formTraderId}
                  options={companies.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.uaeOffice || c.origin || "UAE"})`,
                  }))}
                  placeholder="Select Providing Trader Company..."
                  onChange={(val) => {
                    setFormTraderId(val);
                    const comp = companies.find((c) => c.id === val);
                    if (comp && !formBrand) {
                      setFormBrand(comp.name);
                    }
                  }}
                  style={{ width: "100%" }}
                  buttonStyle={{ height: 38, fontSize: 13 }}
                  menuStyle={{ minWidth: 320 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Delivery Speed / Lead Time *
                </label>
                <CustomLightSelect
                  value={formLeadTime}
                  options={[
                    { value: "Immediate / Same Day (Dubai Warehouse)", label: "Immediate / Same Day (Dubai Warehouse)" },
                    { value: "24 - 48 Hours Express", label: "24 - 48 Hours Express" },
                    { value: "3 - 5 Days (UAE Stock)", label: "3 - 5 Days (UAE Stock)" },
                    { value: "7 - 10 Days (GCC Dispatch)", label: "7 - 10 Days (GCC Dispatch)" },
                    { value: "2 - 3 Weeks (Factory Order)", label: "2 - 3 Weeks (Factory Order)" },
                  ]}
                  placeholder="Select Delivery Speed / Lead Time..."
                  onChange={(val) => setFormLeadTime(val)}
                  style={{ width: "100%" }}
                  buttonStyle={{ height: 38, fontSize: 13 }}
                  menuStyle={{ minWidth: 300 }}
                />
              </div>
            </div>

            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Trader Cost Min (AED)
                </label>
                <input
                  type="number"
                  step={500}
                  value={formTraderMin}
                  placeholder="e.g. 25000"
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormTraderMin(val);
                    if (!formPurchaseCost && val) {
                      setFormPurchaseCost(val);
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: 13 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Trader Cost Max (AED)
                </label>
                <input
                  type="number"
                  step={500}
                  value={formTraderMax}
                  placeholder="e.g. 30000"
                  onChange={(e) => setFormTraderMax(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Product Notes / Description
            </label>
            <textarea
              name="description"
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="form-input"
              placeholder="Key technical capabilities, hospital approvals (MoH/DoH), clinical applications..."
              style={{ fontSize: 12.5, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#004d66" }}>
              Save & Link Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
