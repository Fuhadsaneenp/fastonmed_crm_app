'use client';
import { useEffect, useRef } from 'react';
import { syncWooCommerce, syncTaxonomies } from '@/lib/woocommerce/sync';

const SYNC_COOLDOWN_KEY = 'fastonmed_woo_last_sync';
const SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes minimum between syncs

export default function WooCommerceSync() {
  const running = useRef(false);
  const mounted = useRef(false);

  async function sync() {
    if (running.current) return;

    // Skip if synced recently (prevents hammering on every navigation)
    try {
      const lastSync = localStorage.getItem(SYNC_COOLDOWN_KEY);
      if (lastSync && Date.now() - Number(lastSync) < SYNC_COOLDOWN_MS) return;
    } catch {}

    running.current = true;
    try {
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
    if (mounted.current) return;
    mounted.current = true;

    // Delay initial sync by 5 seconds so navigation isn't blocked
    const initialDelay = setTimeout(() => {
      void sync();
    }, 5000);

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
