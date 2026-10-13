import type { Product } from '@/types';
import { getStoredProducts, saveStoredProducts, isProductDeleted, INITIAL_PRODUCTS, DUMMY_PRODUCT_IDS } from '@/lib/trader-store';

export type LinkedProduct = Product & {
  woo?: { id: number; revision: string; baseline: string; type: string };
};

const DB_NAME = 'fastonmed-catalog';
const STORE_NAME = 'woocommerce-products';

function openCatalog(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the WooCommerce catalogue.'));
  });
}

export async function getWooCommerceProducts(): Promise<LinkedProduct[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return [];
  const db = await openCatalog();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result || []) as LinkedProduct[]);
      request.onerror = () => reject(request.error || new Error('Could not read the WooCommerce catalogue.'));
    });
  } finally {
    db.close();
  }
}

export async function replaceWooCommerceProducts(products: LinkedProduct[]): Promise<void> {
  const db = await openCatalog();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      products.forEach(product => store.put(product));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save the WooCommerce catalogue.'));
      transaction.onabort = () => reject(transaction.error || new Error('WooCommerce catalogue storage was interrupted.'));
    });
  } finally {
    db.close();
  }
  if (typeof window !== 'undefined' && products.length > 0) {
    try {
      saveStoredProducts(products);
    } catch {}
  }
  window.dispatchEvent(new Event('fastonmed_products_updated'));
}

export async function getWooCommerceProductIds(): Promise<Set<number>> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return new Set();
  const db = await openCatalog();
  try {
    const products = await new Promise<LinkedProduct[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result || []) as LinkedProduct[]);
      request.onerror = () => reject(request.error || new Error('Could not read WooCommerce product IDs.'));
    });
    const ids = new Set<number>();
    for (const p of products) {
      if (!p) continue;
      if (p.woo?.id) ids.add(Number(p.woo.id));
      else if (String(p.id).startsWith('woo-')) {
        const num = Number(String(p.id).replace('woo-', ''));
        if (Number.isFinite(num)) ids.add(num);
      }
    }
    const local = getStoredProducts() as LinkedProduct[];
    for (const p of local) {
      if (!p) continue;
      if (p.woo?.id) ids.add(Number(p.woo.id));
    }
    return ids;
  } finally {
    db.close();
  }
}

export async function putWooCommerceProducts(products: LinkedProduct[]): Promise<void> {
  if (!products.length) return;
  const db = await openCatalog();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      products.forEach(product => store.put(product));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save a WooCommerce catalogue page.'));
      transaction.onabort = () => reject(transaction.error || new Error('WooCommerce catalogue storage was interrupted.'));
    });
  } finally {
    db.close();
  }

  // Cross-user persistence to MySQL:
  if (typeof window !== 'undefined') {
    try {
      const current = getStoredProducts();
      const currentIds = new Set(current.map((p) => p.id));
      let hasNew = false;
      const combined = [...current];
      for (const p of products) {
        if (p && p.id && !currentIds.has(p.id)) {
          combined.push(p);
          currentIds.add(p.id);
          hasNew = true;
        }
      }
      if (hasNew) {
        saveStoredProducts(combined);
      }
    } catch {}
  }
}

export function notifyWooCommerceProductsUpdated(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fastonmed_products_updated'));
}

export async function finishWooCommerceSync(_activeWooIds?: Set<number>): Promise<void> {
  notifyWooCommerceProductsUpdated();
}

let serverHydratePromise: Promise<LinkedProduct[] | null> | null = null;
let lastServerProducts: LinkedProduct[] | null = null;

// Save an exact offline snapshot without broadcasting another refresh event.
async function cacheServerProducts(products: LinkedProduct[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openCatalog();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      products.forEach(product => store.put(product));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

async function hydrateCatalogFromServer(): Promise<LinkedProduct[] | null> {
  if (serverHydratePromise) return serverHydratePromise;
  serverHydratePromise = (async () => {
    try {
      const res = await fetch('/api/products', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.products)) {
          const prods = data.products as LinkedProduct[];
          lastServerProducts = prods;
          void cacheServerProducts(prods).catch(error => console.warn('Offline catalog cache unavailable:', error));
          return prods;
        }
      }
    } catch (e) {
      console.warn('Auto-hydrate products from server error:', e);
    } finally {
      serverHydratePromise = null;
    }
    return null;
  })();
  return serverHydratePromise;
}

export async function getCatalogProducts(options?: { onCached?: (products: LinkedProduct[]) => void; onError?: () => void }): Promise<LinkedProduct[]> {
  const isInvalidExpiryProduct = (p: Product, applyBrowserDeletions = true) =>
    !p ||
    p.name?.trim().toUpperCase() === 'AUTO-DRAFT' ||
    String((p as any).status || '').toLowerCase() === 'auto-draft' ||
    String((p as any).status || '').toLowerCase() === 'trash' ||
    DUMMY_PRODUCT_IDS.has(p.id) ||
    p.id.startsWith('prod-exp-') ||
    p.name?.toLowerCase().trim() === 'smarty saver aed pad' ||
    p.specifications?.['Registered Source'] === 'Product Expiry Tracking' ||
    (applyBrowserDeletions && isProductDeleted(p));

  if (options?.onCached) {
    // Start the network request before opening IndexedDB; neither waits for the other.
    const request = hydrateCatalogFromServer();
    if (lastServerProducts) options.onCached(lastServerProducts.filter(p => !isInvalidExpiryProduct(p, false)));
    else {
      void getWooCommerceProducts().then(cached => {
        if (cached.length > 0) options.onCached?.(cached.filter(p => !isInvalidExpiryProduct(p)));
      }).catch(() => {});
    }
    const fresh = await request;
    if (fresh !== null) return fresh.filter(p => !isInvalidExpiryProduct(p, false));
    options.onError?.();
  }

  // MySQL via /api/products is the single catalogue authority shared by CRM
  // and Website admin. IndexedDB/localStorage are only offline fallbacks.
  if (typeof window !== 'undefined' && !options?.onCached) {
    const serverProducts = await hydrateCatalogFromServer();
    if (serverProducts !== null) {
      // Database status is authoritative. A stale per-browser deletion log
      // must not hide shared records for one staff account.
      return serverProducts.filter(p => !isInvalidExpiryProduct(p, false));
    }
  }

  let local = (getStoredProducts() as LinkedProduct[]).filter(p => !isInvalidExpiryProduct(p));

  // Ensure all standard initial products are present in local list
  for (const initProd of INITIAL_PRODUCTS) {
    if (!isInvalidExpiryProduct(initProd)) {
      const exists = local.some(p => p.id === initProd.id || p.name.toLowerCase().trim() === initProd.name.toLowerCase().trim());
      if (!exists) {
        local.push(initProd as LinkedProduct);
      }
    }
  }

  let remote = (await getWooCommerceProducts()).filter(p => !isInvalidExpiryProduct(p));

  const seenIds = new Set<string>();
  const seenWooIds = new Set<number>();
  const seenNames = new Set<string>();
  const result: LinkedProduct[] = [];

  const addUnique = (product: LinkedProduct) => {
    if (!product || isProductDeleted(product)) return;
    const cleanId = String(product.id).trim();
    if (seenIds.has(cleanId)) return;

    if (product.woo?.id) {
      if (seenWooIds.has(product.woo.id)) return;
      seenWooIds.add(product.woo.id);
    }

    const cleanName = product.name ? product.name.trim().toLowerCase() : "";
    if (cleanName && seenNames.has(cleanName)) return;
    if (cleanName) seenNames.add(cleanName);

    seenIds.add(cleanId);
    result.push(product);
  };

  local.forEach(addUnique);
  remote.forEach(addUnique);

  return result;
}
