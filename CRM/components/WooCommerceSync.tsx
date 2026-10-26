'use client';
import { useEffect, useRef } from 'react';

const SYNC_COOLDOWN_KEY = 'fastonmed_woo_last_sync';
const SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes minimum between syncs

export default function WooCommerceSync() {
  const running = useRef(false);

  async function sync() {
    if (running.current || document.visibilityState !== "visible") return;

    // Skip if synced recently (prevents hammering on every navigation)
    try {
      const lastSync = localStorage.getItem(SYNC_COOLDOWN_KEY);
      if (lastSync && Date.now() - Number(lastSync) < SYNC_COOLDOWN_MS) return;
    } catch {}

    running.current = true;
    try {
      const { syncWooCommerce, syncTaxonomies } = await import("@/lib/woocommerce/sync");
      await syncTaxonomies();
      await syncWooCommerce(false);
      try {
        localStorage.setItem(SYNC_COOLDOWN_KEY, String(Date.now()));
      } catch {}
    } catch (error) {
      console.warn('WooCommerce background sync error:', error);
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    // Let the initial screen and its data finish before the full catalogue sync.
    const initialDelay = setTimeout(() => {
      void sync();
    }, 30000);

    // Auto-sync every 15 minutes
    const timer = setInterval(() => {
      void sync();
    }, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(timer);
    };
  }, []);

  return null;
}
