import type { Product, ProcurementCompany, ProductCategory } from "@/types";
import { mockProducts as initialMockProducts, mockClients } from "@/lib/mock-data";

export const INITIAL_COMPANIES: ProcurementCompany[] = [];

const LEGACY_DUMMY_COMPANY_IDS = new Set([
  "comp-1", "comp-2", "comp-3", "comp-4", "comp-5", "comp-6", "comp-7", "comp-8",
]);

const LEGACY_DUMMY_COMPANY_NAMES = new Set([
  "mindray medical international",
  "mindray medical",
  "ge healthcare",
  "ge healthcare uae",
  "dräger medical",
  "draeger medical",
  "philips healthcare",
  "nihon kohden",
  "karl storz endoscopy",
  "belmont dental systems",
  "agfa radiology",
  "asdsad",
  "test",
]);

export const SYNTHESIZED_DUMMY_TRADER_NAMES = new Set<string>();

export const DEFAULT_UAE_REPRESENTATIVES = [
  { name: "Eng. Tariq Al-Nuaimi", phone: "+971 50 314 5928" },
  { name: "Sarah Mansoor", phone: "+971 52 876 5432" },
  { name: "Dr. Ziad Al-Husseini", phone: "+971 55 456 7890" },
  { name: "Eng. Fatima Al-Hosani", phone: "+971 56 332 1199" },
  { name: "Mr. Harish Kumar", phone: "+971 50 890 1234" },
  { name: "Dr. Khaled Al-Mutawa", phone: "+971 50 445 6789" },
  { name: "Dr. Rajesh Sharma", phone: "+971 50 123 4567" },
  { name: "Eng. Hamad Al-Shamsi", phone: "+971 50 778 8990" },
  { name: "Rashid Al-Nuaimi", phone: "+971 52 441 9081" },
  { name: "Ahmed Al-Suwaidi", phone: "+971 50 882 1943" },
  { name: "Sultan Al-Zaabi", phone: "+971 55 889 0011" },
  { name: "Yousef Al-Hammadi", phone: "+971 50 112 3344" },
  { name: "Dr. Farhan Qureshi", phone: "+971 50 987 1103" },
  { name: "Eng. Kareem Mostafa", phone: "+971 50 443 3221" },
  { name: "Noura Al-Shehhi", phone: "+971 52 987 6543" },
  { name: "Salim Al-Marzooqi", phone: "+971 50 111 2233" },
  { name: "Omar Al-Balooshi", phone: "+971 50 901 3456" },
  { name: "Majid Al-Falasi", phone: "+971 50 789 1234" },
  { name: "Dr. Laila Al-Qasimi", phone: "+971 50 776 5432" },
  { name: "Eng. Tariq Aziz", phone: "+971 4 290 8800" },
  { name: "Hamdan Al-Rumaithi", phone: "+971 50 662 4411" },
  { name: "Abdullah Al-Dhaheri", phone: "+971 52 553 2288" },
  { name: "Mariam Al-Kaabi", phone: "+971 56 774 1199" },
  { name: "Saeed Al-Ketbi", phone: "+971 50 889 3322" },
  { name: "Khalifa Al-Mazrouei", phone: "+971 55 331 9944" },
  { name: "Zayed Al-Muhairi", phone: "+971 50 224 8877" },
  { name: "Hassan Al-Banna", phone: "+971 52 991 4455" },
  { name: "Reem Al-Ghurair", phone: "+971 50 442 7766" },
  { name: "Mansoor Al-Habtoor", phone: "+971 50 113 5588" },
  { name: "Faisal Al-Qassimi", phone: "+971 55 667 3322" },
  { name: "Buti Al-Ghandi", phone: "+971 52 884 1133" },
  { name: "Saif Al-Naboodah", phone: "+971 50 775 9944" },
  { name: "Ibrahim Al-Midfa", phone: "+971 56 228 4477" },
  { name: "Dr. Adel Al-Awadhi", phone: "+971 50 993 6611" },
  { name: "Eng. Bilal Al-Madani", phone: "+971 52 337 8822" },
  { name: "Zubair Al-Sayegh", phone: "+971 50 551 7733" },
  { name: "Taimoor Al-Futtaim", phone: "+971 55 448 2266" },
  { name: "Waleed Al-Marri", phone: "+971 50 886 1155" },
  { name: "Khalfan Al-Shaer", phone: "+971 52 772 9944" },
  { name: "Mubarak Al-Khaili", phone: "+971 56 119 3388" },
  { name: "Nasser Al-Shamsi", phone: "+971 50 334 7722" },
  { name: "Jamal Al-Suwaidi", phone: "+971 55 226 5599" },
];

export function getDeterministicRepresentative(nameOrId: string, index?: number): { name: string; phone: string } {
  return { name: "", phone: "" };
}

export function isLegacyDummyCompany(company: Pick<ProcurementCompany, "id" | "name">): boolean {
  if (!company) return true;
  const normalizedName = (company.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedId = (company.id || "").replace(/^trader-/, "").replace(/^comp-comp-/, "comp-");
  if (LEGACY_DUMMY_COMPANY_IDS.has(normalizedId) || LEGACY_DUMMY_COMPANY_NAMES.has(normalizedName)) {
    return true;
  }
  if (normalizedName === "asdsad" || normalizedName === "test") {
    return true;
  }
  return false;
}

const defaultProductsData: Product[] = [];
import { persistSharedDataset, deleteSharedDatasetItem } from "@/lib/shared-data-client";

// Initial products list from shared catalog
export const INITIAL_PRODUCTS: Product[] = defaultProductsData as unknown as Product[];
export const EXTRA_EXPIRY_PRODUCTS: Product[] = [];
export const ALL_INITIAL_PRODUCTS: Product[] = INITIAL_PRODUCTS;

export const DUMMY_PRODUCT_IDS = new Set([
  "p-1", "p-2", "p-3", "p-4", "p-5", "p-6", "p-7", "p-8",
  "p-dialysis-5008s", "p-carm-bv-pulsera", "p-anesthesia-fabius",
  "p-dental-intego", "p-defib-zoll-r", "p-holter-se2012",
  "p-autoclave-euronda", "p-flow-sensor-sv300", "p-infant-warmer-resuscitaire",
  "p-mri-chiller-kkt", "p-surgical-light-mach", "p-syringe-pump-benefusion",
  "p-centrifuge-speedfuge",
]);

export function clearDummyProducts(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (raw) {
      const list: Product[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter(
          (p) =>
            p &&
            !DUMMY_PRODUCT_IDS.has(p.id) &&
            !p.id.startsWith("p-") &&
            !p.id.startsWith("prod-exp-") &&
            p.name?.toLowerCase().trim() !== "smarty saver aed pad" &&
            p.specifications?.["Registered Source"] !== "Product Expiry Tracking"
        );
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(filtered));
      }
    }

    // Also purge from IndexedDB fastonmed-catalog if present
    try {
      const dbRequest = indexedDB.open("fastonmed-catalog", 1);
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        if (db.objectStoreNames.contains("woocommerce-products")) {
          const tx = db.transaction("woocommerce-products", "readwrite");
          const store = tx.objectStore("woocommerce-products");
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const items = getAllReq.result || [];
            items.forEach((p: any) => {
              if (
                p &&
                (String(p.id).startsWith("prod-exp-") ||
                  p.name?.toLowerCase().trim() === "smarty saver aed pad" ||
                  p.specifications?.["Registered Source"] === "Product Expiry Tracking")
              ) {
                store.delete(p.id);
              }
            });
          };
        }
      };
    } catch {}

    window.dispatchEvent(new CustomEvent("fastonmed_products_updated"));
    window.dispatchEvent(new Event("fastonmed_products_updated"));
  } catch {}
}

const PRODUCTS_STORAGE_KEY = "fastonmed_products";
const COMPANIES_STORAGE_KEY = "fastonmed_companies";

function detectCategoryFromName(name: string): ProductCategory {
  const lower = name.toLowerCase();
  if (lower.includes("ultrasound") || lower.includes("x-ray") || lower.includes("imaging") || lower.includes("c-arm") || lower.includes("chiller") || lower.includes("mri") || lower.includes("ct scan")) return "Imaging Equipment";
  if (lower.includes("ventilator") || lower.includes("resuscitaire") || lower.includes("warmer") || lower.includes("dialysis") || lower.includes("icu")) return "ICU Equipment";
  if (lower.includes("monitor") || lower.includes("defibrillator") || lower.includes("vital")) return "Patient Monitoring";
  if (lower.includes("ecg") || lower.includes("holter") || lower.includes("diagnostic") || lower.includes("spirometer")) return "Diagnostic Equipment";
  if (lower.includes("autoclave") || lower.includes("steril")) return "Sterilization";
  if (lower.includes("dental") || lower.includes("chair")) return "Dental Equipment";
  if (lower.includes("surgical") || lower.includes("light") || lower.includes("ot") || lower.includes("anesthesia") || lower.includes("laparoscop")) return "OT Equipment";
  if (lower.includes("centrifuge") || lower.includes("analyzer") || lower.includes("pump") || lower.includes("lab")) return "Laboratory Equipment";
  return "Diagnostic Equipment";
}

function detectBrandFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("ge") || lower.includes("logiq")) return "GE HealthCare";
  if (lower.includes("mindray") || lower.includes("sv-300") || lower.includes("ba-3200") || lower.includes("benefusion")) return "Mindray Medical";
  if (lower.includes("nihon") || lower.includes("pm-7000")) return "Nihon Kohden";
  if (lower.includes("dräger") || lower.includes("draeger") || lower.includes("resuscitaire") || lower.includes("fabius")) return "Dräger Medical";
  if (lower.includes("philips") || lower.includes("pulsera") || lower.includes("cardiocare")) return "Philips Healthcare";
  if (lower.includes("edan") || lower.includes("holter")) return "Edan Instruments";
  if (lower.includes("euronda")) return "Euronda";
  if (lower.includes("kkt")) return "KKT chillers";
  if (lower.includes("mach")) return "Dr. Mach";
  if (lower.includes("thermo") || lower.includes("speedfuge")) return "Thermo Scientific";
  if (lower.includes("fresenius")) return "Fresenius Medical Care";
  if (lower.includes("sirona") || lower.includes("belmont")) return "Belmont Dental Systems";
  if (lower.includes("zoll")) return "Zoll Medical";
  return "FastonMed Partner";
}

export function getStoredProducts(): Product[] {
  if (typeof window === "undefined") return INITIAL_PRODUCTS;
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    let list: Product[] = [];
    if (!raw) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
    if (!Array.isArray(list) || list.length === 0) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }

    let changed = false;

    // Automatically purge old dummy products and unverified expiry products
    const initialLen = list.length;
    list = list.filter(
      (p) =>
        p &&
        !DUMMY_PRODUCT_IDS.has(p.id) &&
        !p.id.startsWith("p-") &&
        !p.id.startsWith("prod-exp-") &&
        p.name?.toLowerCase().trim() !== "smarty saver aed pad" &&
        p.specifications?.["Registered Source"] !== "Product Expiry Tracking" &&
        !isProductDeleted(p)
    );

    // Ensure all standard initial products are present in the list (matching by id or name)
    for (const initial of INITIAL_PRODUCTS) {
      if (isProductDeleted(initial)) continue;
      const exists = list.some(
        (p) =>
          p.id === initial.id ||
          p.name.toLowerCase().trim() === initial.name.toLowerCase().trim()
      );
      if (!exists) {
        list.push(initial);
        changed = true;
      }
    }

    if (list.length !== initialLen) {
      changed = true;
    }

    // Ensure all extra expiry products are in the list
    for (const extra of EXTRA_EXPIRY_PRODUCTS) {
      if (isProductDeleted(extra)) continue;
      const exists = list.some(
        (p) =>
          p.id === extra.id ||
          p.name.toLowerCase().trim() === extra.name.toLowerCase().trim() ||
          (p.model && extra.model && p.model.toLowerCase().trim() === extra.model.toLowerCase().trim())
      );
      if (!exists) {
        list.push(extra);
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return ALL_INITIAL_PRODUCTS;
  }
}

export function saveStoredProducts(products: Product[], strict = false): void {
  if (typeof window === "undefined") return;
  try {
    // Safely store up to 150 items in localStorage to stay comfortably under the 5MB browser quota
    const safeForLocalStorage = products.length > 200 ? products.slice(0, 150) : products;
    const serialized = JSON.stringify(safeForLocalStorage);
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, serialized);
    } catch {
      console.warn("Browser localStorage quota reached; full catalog is preserved in IndexedDB & MySQL.");
    }
    window.dispatchEvent(new Event("fastonmed_products_updated"));

    // Browser storage is only a display/offline cache. Never bulk-replace the
    // shared catalogue from here: a browser may hold only a small subset.
  } catch (err) {
    console.error("Failed to save products:", err);
    if (strict) throw new Error("CRM browser storage is full or unavailable. Products could not be saved.");
  }
}

export async function fetchStoredProductsFromServer(): Promise<Product[]> {
  if (typeof window === "undefined") return INITIAL_PRODUCTS;
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
        // Save full 2600+ product catalog to IndexedDB so all accounts (Hashim, Fuhad, etc.) get every product
        try {
          const { putWooCommerceProducts } = await import("./woocommerce/catalog-store");
          await putWooCommerceProducts(data.products as any);
        } catch (idbErr) {
          console.warn("Could not write to IndexedDB catalog store:", idbErr);
        }

        const safeSubset = data.products.slice(0, 150);
        try {
          localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(safeSubset));
        } catch {}
        window.dispatchEvent(new Event("fastonmed_products_updated"));
        return data.products;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch products from /api/products:", err);
  }
  return getStoredProducts();
}

export function syncProductFromExpiry(
  productName: string,
  category?: ProductCategory,
  amount?: number,
  supplier?: string
): Product | null {
  const products = getStoredProducts();
  const normalize = (s: string) => s.toLowerCase().replace(/[-_–—/]/g, " ").replace(/\s+/g, " ").trim();
  const normTarget = normalize(productName);

  const existing = products.find((p) => {
    const normName = normalize(p.name);
    const normModel = normalize(p.model || "");
    return (
      normName === normTarget ||
      (normName.length > 4 && normTarget.includes(normName)) ||
      (normTarget.length > 4 && normName.includes(normTarget))
    );
  });

  return existing || null;
}

export function getStoredCompanies(): ProcurementCompany[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COMPANIES_STORAGE_KEY);
    let list: ProcurementCompany[] = [];
    if (!raw) {
      localStorage.setItem(COMPANIES_STORAGE_KEY, "[]");
      return [];
    } else {
      list = JSON.parse(raw);
    }
    if (!Array.isArray(list)) list = [];
    const storedCount = list.length;

    // Check deleted client IDs and clients updated as non-trader in fastonmed_clients
    const deletedClientIds = new Set<string>();
    try {
      const delRaw = localStorage.getItem("fastonmed_deleted_clients");
      if (delRaw) {
        const arr = JSON.parse(delRaw);
        if (Array.isArray(arr)) arr.forEach((id: string) => deletedClientIds.add(id));
      }
    } catch {}

    const nonTraderClientIds = new Set<string>();
    const userTraderClients: any[] = [];
    try {
      const clientsRaw = localStorage.getItem("fastonmed_clients");
      if (clientsRaw) {
        const parsed = JSON.parse(clientsRaw);
        if (Array.isArray(parsed)) {
          for (const cl of parsed) {
            if (!cl || !cl.id || deletedClientIds.has(cl.id)) continue;
            const isTrader =
              cl.orgType === "Medical Equipment Trader" ||
              cl.orgType === "Equipment Trader" ||
              cl.id?.startsWith("trader-") ||
              (cl.connectedAs && cl.connectedAs.some((x: string) => {
                const s = String(x).trim().toLowerCase();
                return s === "trader" || s === "merchant";
              }));
            if (isTrader) {
              userTraderClients.push(cl);
            } else {
              nonTraderClientIds.add(cl.id);
            }
          }
        }
      }
    } catch {}

    // Filter out legacy dummy demo companies (comp-1 to comp-8, Mindray, etc.)
    // and companies whose source client was deleted or unmarked as a trader
    list = list.filter((company) => {
      if (isLegacyDummyCompany(company)) return false;
      if (company.sourceClientId && (deletedClientIds.has(company.sourceClientId) || nonTraderClientIds.has(company.sourceClientId))) {
        return false;
      }
      return true;
    });

    let changed = list.length !== storedCount;

    // Merge in all base trader facilities from mockClients and any user-saved trader clients
    const existingSourceIds = new Set(list.map((c) => c.sourceClientId).filter(Boolean));
    const existingIds = new Set(list.map((c) => c.id));
    const existingNames = new Set(list.map((c) => (c.name || "").trim().toLowerCase()));

    const candidates = [
      ...userTraderClients,
      ...(Array.isArray(mockClients) ? mockClients : []),
    ];

    for (const c of candidates) {
      if (!c || !c.id || deletedClientIds.has(c.id) || nonTraderClientIds.has(c.id)) continue;
      const isTrader =
        c.orgType === "Medical Equipment Trader" ||
        c.orgType === "Equipment Trader" ||
        c.id?.startsWith("trader-") ||
        (c.connectedAs && c.connectedAs.some((x: string) => {
          const s = String(x).trim().toLowerCase();
          return s === "trader" || s === "merchant";
        }));

      if (!isTrader) continue;

      const normName = (c.name || "").trim().toLowerCase();
      const generatedId = c.id.startsWith("trader-") ? c.id.slice("trader-".length) : `client-trader-${c.id}`;

      if (existingSourceIds.has(c.id) || existingIds.has(generatedId) || existingNames.has(normName)) {
        continue;
      }

      const primaryContact = c.contacts?.[0];
      const fallbackRep = getDeterministicRepresentative(c.name || c.id);
      const repName = primaryContact?.name || c.contactPerson || fallbackRep.name;
      const repPhone =
        primaryContact?.phone ||
        primaryContact?.whatsapp ||
        c.phone ||
        (c.phones && c.phones[0]) ||
        fallbackRep.phone;

      const newCompany: ProcurementCompany = {
        id: generatedId,
        sourceClientId: c.id,
        name: c.name,
        origin: c.state || "UAE",
        uaeOffice: c.address || [c.city, c.state].filter(Boolean).join(", ") || "UAE",
        partnership: "Authorized Distributor",
        equipmentLine: "General Medical Line",
        suppliedCategories: ["General Medical Line"],
        suppliedProducts: [],
        deliveryLeadTime: "3 - 5 Days (UAE Stock)",
        priceRangeText: "",
        productCount: 0,
        totalVolume: Number(c.totalRevenue) || 0,
        contactPerson: repName,
        contactRole: primaryContact?.designation || "UAE Representative",
        phone: repPhone,
        email: primaryContact?.email || c.email || "",
        website: c.website || "",
        flag: "🇦🇪",
        contacts:
          c.contacts && c.contacts.length > 0
            ? c.contacts.map((ct: any) => ({
                id: ct.id,
                name: ct.name,
                role: ct.designation,
                phone: ct.phone || ct.whatsapp,
                email: ct.email,
                isPrimary: ct.id === primaryContact?.id,
              }))
            : [
                {
                  id: `rep-${c.id}`,
                  name: repName,
                  role: "UAE Representative",
                  phone: repPhone,
                  email: c.email || "",
                  isPrimary: true,
                },
              ],
      };

      list.push(newCompany);
      existingSourceIds.add(c.id);
      existingIds.add(generatedId);
      existingNames.add(normName);
      changed = true;
    }

    // Cross-reference with real products from fastonmed_products
    let realProducts: Product[] = [];
    try {
      const pRaw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (pRaw) {
        const pList = JSON.parse(pRaw);
        if (Array.isArray(pList)) {
          realProducts = pList.filter((p) => p && !DUMMY_PRODUCT_IDS.has(p.id) && !p.id.startsWith("p-") && !isProductDeleted(p));
        }
      }
    } catch {}

    const realProductNames = new Set(realProducts.map((p) => p.name.toLowerCase().trim()));
    list = list.map((co) => {
      const coId = co.id;
      const coName = (co.name || "").trim().toLowerCase();

      // Ensure contactPerson and phone are populated
      let contactPerson = (co.contactPerson || "").trim();
      let phone = (co.phone || "").trim();
      let contactRole = (co.contactRole || "UAE Representative").trim();

      if (!contactPerson || !phone || phone === "+971 4 000 0000") {
        const fallback = getDeterministicRepresentative(co.name || co.id);
        if (!contactPerson) contactPerson = fallback.name;
        if (!phone || phone === "+971 4 000 0000") phone = fallback.phone;
        changed = true;
      }

      // Count actual products tied to this company
      const actualCompanyProducts = realProducts.filter((p) => {
        if (p.traderCompanyId && (p.traderCompanyId === coId || p.traderCompanyId === `trader-${coId}`)) return true;
        if (
          p.traders &&
          p.traders.some(
            (t) =>
              t.traderCompanyId === coId ||
              t.traderCompanyId === `trader-${coId}` ||
              (t.traderCompanyName && t.traderCompanyName.trim().toLowerCase() === coName)
          )
        ) {
          return true;
        }
        const pTrader = (p.traderCompanyName || "").trim().toLowerCase();
        if (pTrader && (pTrader === coName || pTrader.includes(coName) || coName.includes(pTrader))) return true;
        const pSupplier = (p.supplier || "").trim().toLowerCase();
        if (pSupplier && (pSupplier === coName || pSupplier.includes(coName) || coName.includes(pSupplier))) return true;
        const pBrand = (p.brand || "").trim().toLowerCase();
        if (pBrand && (pBrand === coName || pBrand.includes(coName) || coName.includes(pBrand))) return true;
        return false;
      });

      const origSupplied = co.suppliedProducts || [];
      // Only keep products that actually exist in the products catalog and are not deleted
      const cleanSupplied = origSupplied.filter(
        (sp) => realProductNames.has((sp || "").trim().toLowerCase()) && !isProductDeleted({ name: sp })
      );
      const newCount = actualCompanyProducts.length;

      if (
        cleanSupplied.length !== origSupplied.length ||
        co.productCount !== newCount ||
        co.contactPerson !== contactPerson ||
        co.phone !== phone
      ) {
        changed = true;
        return {
          ...co,
          contactPerson,
          contactRole,
          phone,
          suppliedProducts: cleanSupplied,
          productCount: newCount,
        };
      }
      return co;
    });

    if (changed || !raw) {
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [];
  }
}

export function clearDummyTraderCompanies(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(COMPANIES_STORAGE_KEY);
    if (!raw) return;
    const list: ProcurementCompany[] = JSON.parse(raw);
    if (Array.isArray(list)) {
      const clean = list.filter((c) => !isLegacyDummyCompany(c));
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent("fastonmed_companies_updated"));
    }
  } catch {}
}

export function saveStoredCompanies(companies: ProcurementCompany[]): void {
  if (typeof window === "undefined") return;
  try {
    let previous: ProcurementCompany[] = [];
    try {
      const raw = localStorage.getItem(COMPANIES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) previous = parsed;
    } catch {}
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
    const previousById = new Map(previous.map((company) => [company.id, JSON.stringify(company)]));
    const changedCompanies = companies.filter(
      (company) => previousById.get(company.id) !== JSON.stringify(company)
    );
    const currentIds = new Set(companies.map((company) => company.id));
    previous
      .filter((company) => !currentIds.has(company.id))
      .forEach((company) => void deleteSharedDatasetItem("trader-companies", { id: company.id }).catch(() => {}));
    void persistSharedDataset("trader-companies", changedCompanies).catch((error) =>
      console.warn("Trader companies are cached locally but database sync failed:", error)
    );
    window.dispatchEvent(new CustomEvent("fastonmed_companies_updated"));
    window.dispatchEvent(new Event("fastonmed_clients_updated"));
  } catch (err) {
    console.error("Failed to save companies:", err);
  }
}

export function addProductWithTrader(productData: {
  name: string;
  category: ProductCategory;
  brand: string;
  model: string;
  traderCompanyId: string;
  traderCompanyName: string;
  deliveryLeadTime: string;
  traderPriceMin: number;
  traderPriceMax: number;
  purchaseCost: number;
  sellingPrice: number;
  vatStatus?: string;
  warrantyPeriod: string;
  amcAvailable: boolean;
  inStock: number;
  description: string;
  image?: string;
  specifications?: Record<string, string>;
  tags?: string[];
}): Product {
  const products = getStoredProducts();
  const companies = getStoredCompanies();

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name: productData.name,
    category: productData.category,
    brand: productData.brand || productData.traderCompanyName,
    model: productData.model || "Standard Edition",
    supplier: productData.traderCompanyName,
    traderCompanyId: productData.traderCompanyId,
    traderCompanyName: productData.traderCompanyName,
    deliveryLeadTime: productData.deliveryLeadTime || "3 - 5 Days",
    traderPriceMin: productData.traderPriceMin,
    traderPriceMax: productData.traderPriceMax,
    traders: [
      {
        traderCompanyId: productData.traderCompanyId,
        traderCompanyName: productData.traderCompanyName,
        offeringPrice: productData.purchaseCost,
        traderPriceMin: productData.traderPriceMin,
        traderPriceMax: productData.traderPriceMax,
        deliveryLeadTime: productData.deliveryLeadTime || "3 - 5 Days",
        warrantyPeriod: productData.warrantyPeriod || "2 Years",
      },
    ],
    purchaseCost: productData.purchaseCost,
    sellingPrice: productData.sellingPrice,
    vatStatus: productData.vatStatus || "5% Standard Rate",
    warrantyPeriod: productData.warrantyPeriod || "2 Years",
    amcAvailable: productData.amcAvailable ?? true,
    inStock: productData.inStock || 1,
    image: productData.image,
    description: productData.description || `Medical equipment supplied by ${productData.traderCompanyName}`,
    specifications: productData.specifications || {
      Category: productData.category,
      Supplier: productData.traderCompanyName,
      "Lead Time": productData.deliveryLeadTime || "3 - 5 Days",
    },
    tags: productData.tags || [productData.category, productData.brand],
  };

  const updatedProducts = [newProduct, ...products];
  saveStoredProducts(updatedProducts);
  void fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newProduct),
  }).then(() => window.dispatchEvent(new Event("fastonmed_products_updated")))
    .catch((err) => console.error("Failed to save new product to shared database:", err));

  // Update associated trader company to record this product and category
  const updatedCompanies = companies.map((comp) => {
    if (comp.id === productData.traderCompanyId || comp.name.toLowerCase() === productData.traderCompanyName.toLowerCase()) {
      const categoriesSet = new Set(comp.suppliedCategories || []);
      categoriesSet.add(productData.category);

      const productsList = comp.suppliedProducts ? [...comp.suppliedProducts] : [];
      if (!productsList.includes(productData.name)) {
        productsList.push(productData.name);
      }

      return {
        ...comp,
        productCount: comp.productCount + 1,
        totalVolume: comp.totalVolume + productData.sellingPrice,
        suppliedCategories: Array.from(categoriesSet) as ProductCategory[],
        suppliedProducts: productsList,
        deliveryLeadTime: productData.deliveryLeadTime || comp.deliveryLeadTime,
        priceRangeText: comp.priceRangeText || `AED ${productData.traderPriceMin.toLocaleString()} - ${productData.traderPriceMax.toLocaleString()}`,
      };
    }
    return comp;
  });

  saveStoredCompanies(updatedCompanies);
  return newProduct;
}

export function updateProduct(updatedProduct: Product): void {
  const products = getStoredProducts();
  const companies = getStoredCompanies();

  const exists = products.some((p) => p.id === updatedProduct.id);
  const newProductsList = exists
    ? products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    : [updatedProduct, ...products];
  saveStoredProducts(newProductsList);
  void fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...updatedProduct, updatedAt: new Date().toISOString() }),
  }).then(() => window.dispatchEvent(new Event("fastonmed_products_updated")))
    .catch((err) => console.error("Failed to update product in shared database:", err));

  // Sync with trader companies
  const targetCompanyIds = new Set<string>();
  if (updatedProduct.traderCompanyId) targetCompanyIds.add(updatedProduct.traderCompanyId);
  if (updatedProduct.traders) {
    updatedProduct.traders.forEach((t) => {
      if (t.traderCompanyId) targetCompanyIds.add(t.traderCompanyId);
    });
  }

  if (targetCompanyIds.size > 0) {
    const updatedCompanies = companies.map((comp) => {
      if (targetCompanyIds.has(comp.id)) {
        const categoriesSet = new Set(comp.suppliedCategories || []);
        categoriesSet.add(updatedProduct.category);

        const productsList = comp.suppliedProducts ? [...comp.suppliedProducts] : [];
        if (!productsList.includes(updatedProduct.name)) {
          productsList.push(updatedProduct.name);
        }

        return {
          ...comp,
          suppliedCategories: Array.from(categoriesSet) as ProductCategory[],
          suppliedProducts: productsList,
          productCount: productsList.length,
          deliveryLeadTime: updatedProduct.deliveryLeadTime || comp.deliveryLeadTime,
        };
      }
      return comp;
    });
    saveStoredCompanies(updatedCompanies);
  }
}

const DELETED_PRODUCTS_KEY = "fastonmed_deleted_product_records";

export function getDeletedProductLog(): { ids: string[]; names: string[] } {
  const defaultDeleted = { ids: [], names: ["icu ventilator sv-300"] };
  if (typeof window === "undefined") return defaultDeleted;
  try {
    const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
    const data = raw ? JSON.parse(raw) : defaultDeleted;
    if (!Array.isArray(data.names)) data.names = ["icu ventilator sv-300"];
    if (!data.names.includes("icu ventilator sv-300")) data.names.push("icu ventilator sv-300");
    return data;
  } catch {
    return defaultDeleted;
  }
}

export function recordDeletedProduct(productId: string, productName?: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedProductLog();
    const ids = new Set(current.ids || []);
    const names = new Set((current.names || []).map((n: string) => n.toLowerCase().trim()));
    if (productId) ids.add(productId);
    if (productName) names.add(productName.toLowerCase().trim());
    localStorage.setItem(
      DELETED_PRODUCTS_KEY,
      JSON.stringify({ ids: Array.from(ids), names: Array.from(names) })
    );
  } catch {}
}

export function isProductDeleted(product: { id?: string; name?: string }): boolean {
  if (!product) return false;
  const log = getDeletedProductLog();
  if (product.id && log.ids.includes(product.id)) return true;
  if (product.name && log.names.includes(product.name.toLowerCase().trim())) return true;
  return false;
}

export function deleteStoredProduct(productId: string, productName?: string): void {
  const products = getStoredProducts();
  const target = products.find(
    (p) => p.id === productId || (productName && p.name.toLowerCase().trim() === productName.toLowerCase().trim())
  );
  const finalName = productName || target?.name || "";

  // 1. Record in deleted blacklist
  recordDeletedProduct(productId, finalName);

  // 2. Remove from stored products
  const filtered = products.filter(
    (p) => p.id !== productId && (!finalName || p.name.toLowerCase().trim() !== finalName.toLowerCase().trim())
  );
  saveStoredProducts(filtered);
  void fetch(`/api/products?id=${encodeURIComponent(productId)}`, { method: "DELETE" })
    .then(() => window.dispatchEvent(new Event("fastonmed_products_updated")))
    .catch((err) => console.error("Failed to delete product from shared database:", err));

  // 3. Remove from all procurement companies' suppliedProducts
  const companies = getStoredCompanies();
  const updatedCompanies = companies.map((co) => {
    const newSupplied = (co.suppliedProducts || []).filter((sp) => {
      const spLower = sp.toLowerCase().trim();
      if (finalName && spLower === finalName.toLowerCase().trim()) return false;
      if (productId && spLower === productId.toLowerCase().trim()) return false;
      if (isProductDeleted({ name: sp })) return false;
      return true;
    });

    const activeProducts = filtered.filter(
      (p) => p.traderCompanyId === co.id || p.traderCompanyName?.toLowerCase().trim() === co.name.toLowerCase().trim()
    );

    return {
      ...co,
      suppliedProducts: newSupplied,
      productCount: Math.max(0, newSupplied.length + activeProducts.length),
    };
  });
  saveStoredCompanies(updatedCompanies);

  // 4. Clean up from WooCommerce catalog if present
  if (typeof window !== "undefined") {
    try {
      const dbRequest = indexedDB.open("fastonmed-catalog", 1);
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        if (db.objectStoreNames.contains("woocommerce-products")) {
          const tx = db.transaction("woocommerce-products", "readwrite");
          tx.objectStore("woocommerce-products").delete(productId);
        }
      };
    } catch {}

    window.dispatchEvent(new Event("fastonmed_products_updated"));
    window.dispatchEvent(new Event("fastonmed_companies_updated"));
  }
}

export const DEFAULT_PRODUCT_CATEGORIES: ProductCategory[] = [
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

const CATEGORIES_STORAGE_KEY = "fastonmed_product_categories";

export function getStoredCategories(customProducts?: Product[]): ProductCategory[] {
  if (typeof window === "undefined") return DEFAULT_PRODUCT_CATEGORIES;
  try {
    const products = customProducts && customProducts.length > 0 ? customProducts : getStoredProducts();
    const productCats = products
      .map((p) => p.category?.trim())
      .filter((c): c is ProductCategory => Boolean(c && c !== "Uncategorized"));

    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    let storedList: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) storedList = parsed;
    }

    // Auto-fetch if storage has not been populated yet
    if (storedList.length === 0 && typeof window !== "undefined") {
      void fetch("/api/woocommerce?type=categories")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.categories) && d.categories.length > 0) {
            const fetched: string[] = d.categories.map((c: any) => String(c.name || '').trim()).filter(Boolean);
            const sorted = Array.from(new Set<string>(fetched)).sort((a, b) => a.localeCompare(b));
            localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(sorted));
            window.dispatchEvent(new Event("fastonmed_categories_updated"));
          }
        })
        .catch(() => {});
    }

    const baseList = storedList.length > 0 ? storedList : DEFAULT_PRODUCT_CATEGORIES;
    const categorySet = new Set<string>([...baseList, ...productCats]);
    return Array.from(categorySet).filter(Boolean).sort((a, b) => a.localeCompare(b)) as ProductCategory[];
  } catch {
    return DEFAULT_PRODUCT_CATEGORIES;
  }
}

export function addStoredCategory(newCategory: string): ProductCategory[] {
  const trimmed = newCategory.trim();
  if (!trimmed) return getStoredCategories();
  const current = getStoredCategories();
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    if (typeof window !== "undefined") {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
      void persistSharedDataset("product-categories", updated).catch(() => {});
      window.dispatchEvent(new Event("fastonmed_categories_updated"));
    }
    return updated;
  }
  return current;
}

export const DEFAULT_BRANDS: string[] = [
  "Mindray",
  "GE HealthCare",
  "Dräger",
  "Philips",
  "Nihon Kohden",
  "Karl Storz",
  "Belmont",
  "Agfa",
  "Siemens Healthineers",
  "Medtronic",
  "Stryker",
  "Olympus",
  "B. Braun",
  "Baxter",
  "Fresenius",
  "Canon Medical",
  "Hamilton Medical",
  "Getinge",
];

export const BRAND_METADATA_DEFAULTS: Record<string, { country: string; website?: string; description?: string }> = {
  "Mindray": { country: "China", website: "https://www.mindray.com", description: "Global leader in patient monitoring, ultrasound, and life support solutions." },
  "GE HealthCare": { country: "United States", website: "https://www.gehealthcare.com", description: "World-class diagnostic imaging, CT, MRI, ultrasound, and patient care systems." },
  "Dräger": { country: "Germany", website: "https://www.draeger.com", description: "Pioneering medical technology in anaesthesia, ventilation, and neonatal warming." },
  "Philips": { country: "Netherlands", website: "https://www.philips.com/healthcare", description: "Leading health technology company focused on cardiology, diagnostics, and patient monitoring." },
  "Nihon Kohden": { country: "Japan", website: "https://www.nihonkohden.com", description: "Advanced neurological diagnostics, patient monitors, and defibrillators." },
  "Karl Storz": { country: "Germany", website: "https://www.karlstorz.com", description: "Global leader in endoscopic technology and integrated operating room systems." },
  "Belmont": { country: "Japan", website: "https://www.belmont.co.jp", description: "Renowned manufacturer of high-precision dental chairs and surgical lighting." },
  "Agfa": { country: "Belgium", website: "https://www.agfa.com/radiology", description: "Innovative digital radiography and enterprise imaging solutions." },
  "Siemens Healthineers": { country: "Germany", website: "https://www.siemens-healthineers.com", description: "Leading medical technology company transforming clinical decision making." },
  "Medtronic": { country: "United States", website: "https://www.medtronic.com", description: "Global healthcare technology company creating life-saving surgical and monitoring tools." },
  "Stryker": { country: "United States", website: "https://www.stryker.com", description: "Innovative medical equipment, orthopaedics, and surgical navigation tools." },
  "Olympus": { country: "Japan", website: "https://www.olympus-global.com", description: "Precision endoscopy, laparoscopy, and minimally invasive surgery systems." },
  "B. Braun": { country: "Germany", website: "https://www.bbraun.com", description: "Specialists in infusion therapy, pain control, and surgical instruments." },
  "Baxter": { country: "United States", website: "https://www.baxter.com", description: "Critical care, nutrition, renal, and surgical products." },
  "Fresenius": { country: "Germany", website: "https://www.fresenius.com", description: "World leader in dialysis, renal care products, and infusion therapies." },
  "Canon Medical": { country: "Japan", website: "https://global.medical.canon", description: "Pioneering diagnostic ultrasound, MRI, CT, and X-ray systems." },
  "Hamilton Medical": { country: "Switzerland", website: "https://www.hamilton-medical.com", description: "Intelligent ventilation solutions for neonatal, pediatric, and adult patients." },
  "Getinge": { country: "Sweden", website: "https://www.getinge.com", description: "Operating room workstations, cardiac assist, and advanced sterilization solutions." },
};

export interface BrandInfo {
  name: string;
  country: string;
  website?: string;
  description: string;
  categories: ProductCategory[];
  productCount: number;
  traders: string[];
}

const BRANDS_STORAGE_KEY = "fastonmed_product_brands";
const DELETED_BRANDS_KEY = "fastonmed_deleted_brands";

export function getStoredBrands(customProducts?: Product[]): string[] {
  if (typeof window === "undefined") return DEFAULT_BRANDS;
  try {
    const products = customProducts && customProducts.length > 0 ? customProducts : getStoredProducts();
    const productBrands = products
      .map((p) => p.brand?.trim())
      .filter((b): b is string => Boolean(b && b.toLowerCase() !== "manufacturer" && b.toLowerCase() !== "unknown"));

    const raw = localStorage.getItem(BRANDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const storedList = Array.isArray(parsed) ? parsed : [];

    const rawDeleted = localStorage.getItem(DELETED_BRANDS_KEY);
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];

    // Combine defaults, product brands, and user-stored brands (case-insensitive deduplication)
    const brandMap = new Map<string, string>();
    [...DEFAULT_BRANDS, ...productBrands, ...storedList].forEach((b) => {
      const trimmed = b?.trim();
      if (trimmed) {
        const lower = trimmed.toLowerCase();
        if (!deletedList.includes(lower) && !brandMap.has(lower)) {
          brandMap.set(lower, trimmed);
        }
      }
    });

    return Array.from(brandMap.values()).sort((a, b) => a.localeCompare(b));
  } catch {
    return DEFAULT_BRANDS;
  }
}

export function addStoredBrand(newBrand: string, meta?: { country?: string; website?: string; description?: string }): string[] {
  const trimmed = newBrand?.trim();
  if (!trimmed || trimmed.toLowerCase() === "manufacturer" || trimmed.toLowerCase() === "unknown") {
    return getStoredBrands();
  }

  const current = getStoredBrands();
  const lower = trimmed.toLowerCase();

  if (typeof window !== "undefined") {
    try {
      // Remove from deleted list if was deleted before
      const rawDeleted = localStorage.getItem(DELETED_BRANDS_KEY);
      if (rawDeleted) {
        const deletedList: string[] = JSON.parse(rawDeleted);
        if (deletedList.includes(lower)) {
          localStorage.setItem(
            DELETED_BRANDS_KEY,
            JSON.stringify(deletedList.filter((d) => d !== lower))
          );
        }
      }

      const raw = localStorage.getItem(BRANDS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const stored = Array.isArray(parsed) ? parsed : [];
      if (!stored.some((b: string) => b.toLowerCase() === lower)) {
        const updatedBrands = [...stored, trimmed];
        localStorage.setItem(BRANDS_STORAGE_KEY, JSON.stringify(updatedBrands));
        void persistSharedDataset("product-brands", updatedBrands).catch(() => {});
      }

      if (meta) {
        BRAND_METADATA_DEFAULTS[trimmed] = {
          country: meta.country || "Global",
          website: meta.website,
          description: meta.description,
        };
      }

      window.dispatchEvent(new Event("fastonmed_brands_updated"));
    } catch (err) {
      console.error("Failed to save brand to storage", err);
    }
  }

  return getStoredBrands();
}

export function deleteStoredBrand(brandName: string): string[] {
  const lower = brandName.toLowerCase().trim();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(BRANDS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const storedList = Array.isArray(parsed) ? parsed : [];
      const updated = storedList.filter((b: string) => b.toLowerCase().trim() !== lower);
      localStorage.setItem(BRANDS_STORAGE_KEY, JSON.stringify(updated));

      const rawDeleted = localStorage.getItem(DELETED_BRANDS_KEY);
      const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedList.includes(lower)) {
        const updatedDeleted = [...deletedList, lower];
        localStorage.setItem(DELETED_BRANDS_KEY, JSON.stringify(updatedDeleted));
        void persistSharedDataset("deleted-brands", updatedDeleted).catch(() => {});
      }

      void deleteSharedDatasetItem("product-brands", { value: brandName }).catch(() => {});

      window.dispatchEvent(new Event("fastonmed_brands_updated"));
    } catch (err) {
      console.error("Failed to delete brand", err);
    }
  }
  return getStoredBrands();
}

export function getStoredBrandDetails(customProducts?: Product[]): BrandInfo[] {
  const products = customProducts && customProducts.length > 0 ? customProducts : getStoredProducts();
  const brandNames = getStoredBrands(products);

  let richWooBrands: Record<string, { count?: number; description?: string; link?: string }> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("fastonmed_woo_brands_rich");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((b: any) => {
            if (b.name) richWooBrands[b.name.toLowerCase().trim()] = b;
          });
        }
      }
    } catch {}
  }

  return brandNames.map((name) => {
    const matchingProducts = products.filter(
      (p) => p.brand?.trim().toLowerCase() === name.toLowerCase()
    );
    const categories = Array.from(new Set(matchingProducts.map((p) => p.category))).filter(Boolean) as ProductCategory[];
    const traders = Array.from(
      new Set(matchingProducts.map((p) => p.traderCompanyName || p.supplier).filter(Boolean))
    ) as string[];
    const meta = BRAND_METADATA_DEFAULTS[name] || {};
    const rich = richWooBrands[name.toLowerCase().trim()];

    const productCount = matchingProducts.length || (rich?.count ?? 0);
    const website = meta.website || rich?.link;
    const description = meta.description || (rich?.description ? rich.description : `Medical brand covering ${categories.length > 0 ? categories.join(", ") : "medical equipment"} in the UAE.`);

    return {
      name,
      country: meta.country || "Global",
      website,
      description,
      categories,
      productCount,
      traders,
    };
  });
}
