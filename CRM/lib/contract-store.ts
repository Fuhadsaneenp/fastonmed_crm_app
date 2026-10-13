import type { AMCContract } from "@/types";

const STORAGE_KEY = "fastonmed_amc_contracts";

// Only remove the ancient mock template IDs (amc-1 through amc-8)
const LEGACY_MOCK_IDS = new Set([
  "amc-1", "amc-2", "amc-3", "amc-4", "amc-5", "amc-6", "amc-7", "amc-8",
]);

export const INITIAL_HASHIM_CONTRACTS: AMCContract[] = [];

function isLegacyMock(contract: AMCContract): boolean {
  return Boolean(contract?.id && LEGACY_MOCK_IDS.has(contract.id));
}

function notifyContractsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("fastonmed_contracts_updated"));
    window.dispatchEvent(new Event("fastonmed_clients_updated"));
  }
}

export function getStoredContracts(): AMCContract[] {
  if (typeof window === "undefined") return INITIAL_HASHIM_CONTRACTS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_HASHIM_CONTRACTS));
      return INITIAL_HASHIM_CONTRACTS;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_HASHIM_CONTRACTS));
      return INITIAL_HASHIM_CONTRACTS;
    }

    const contracts = parsed.filter(
      (contract): contract is AMCContract => Boolean(contract?.id) && !isLegacyMock(contract)
    );

    // If all stored contracts were removed or filtered out, seed with Hashim's contracts
    if (contracts.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_HASHIM_CONTRACTS));
      return INITIAL_HASHIM_CONTRACTS;
    }

    if (contracts.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
    }
    return contracts;
  } catch (error) {
    console.error("Failed to load stored contracts", error);
    return INITIAL_HASHIM_CONTRACTS;
  }
}

export function saveStoredContracts(contracts: AMCContract[]): void {
  if (typeof window === "undefined") return;
  try {
    const realContracts = contracts.filter((c) => Boolean(c?.id) && !isLegacyMock(c));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(realContracts));
  } catch (error) {
    console.error("Failed to save contracts", error);
  }
}

/**
 * Two-way live sync with shared Next.js server API / MySQL CompanySetting.
 * Merges local browser contracts with shared contracts and returns the full canonical list.
 */
export async function syncLiveContractsFromApi(): Promise<AMCContract[]> {
  if (typeof window === "undefined") return INITIAL_HASHIM_CONTRACTS;

  try {
    const local = getStoredContracts();
    const res = await fetch("/api/maintenance-contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", localContracts: local }),
    });

    if (res.ok) {
      const json = await res.json();
      const list: AMCContract[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.contracts)
        ? json.contracts
        : Array.isArray(json?.data)
        ? json.data
        : [];

      if (list.length > 0) {
        const realContracts = list.filter((c) => Boolean(c?.id) && !isLegacyMock(c));
        saveStoredContracts(realContracts);
        notifyContractsUpdated();
        return realContracts;
      }
    }
  } catch (error) {
    console.warn("POST /api/maintenance-contracts sync fallback, trying GET:", error);
  }

  // Fallback to GET if POST failed
  try {
    const getRes = await fetch("/api/maintenance-contracts");
    if (getRes.ok) {
      const getJson = await getRes.json();
      const list = Array.isArray(getJson?.contracts) ? getJson.contracts : [];
      if (list.length > 0) {
        const real = list.filter((c: AMCContract) => Boolean(c?.id) && !isLegacyMock(c));
        saveStoredContracts(real);
        notifyContractsUpdated();
        return real;
      }
    }
  } catch (err) {
    console.error("Failed to sync live maintenance contracts from server:", err);
  }

  return getStoredContracts();
}

export async function addStoredContract(contract: AMCContract): Promise<AMCContract[]> {
  const previous = getStoredContracts();
  const next = [contract, ...previous.filter((item) => item.id !== contract.id)];
  saveStoredContracts(next);
  notifyContractsUpdated();

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/maintenance-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.contracts)) {
          saveStoredContracts(json.contracts);
          notifyContractsUpdated();
          return json.contracts;
        }
      }
    } catch (err) {
      console.error("Error saving contract to server:", err);
    }
  }
  return next;
}

export async function updateStoredContract(contract: AMCContract): Promise<AMCContract[]> {
  const previous = getStoredContracts();
  const next = previous.map((item) => (item.id === contract.id ? contract : item));
  saveStoredContracts(next);
  notifyContractsUpdated();

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/maintenance-contracts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contract.id, data: contract }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.contracts)) {
          saveStoredContracts(json.contracts);
          notifyContractsUpdated();
          return json.contracts;
        }
      }
    } catch (err) {
      console.error("Error updating contract on server:", err);
    }
  }
  return next;
}

export async function deleteStoredContract(id: string): Promise<AMCContract[]> {
  const previous = getStoredContracts();
  const next = previous.filter((contract) => contract.id !== id);
  saveStoredContracts(next);
  notifyContractsUpdated();

  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/maintenance-contracts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.contracts)) {
          saveStoredContracts(json.contracts);
          notifyContractsUpdated();
          return json.contracts;
        }
      }
    } catch (err) {
      console.error("Error deleting contract from server:", err);
    }
  }
  return next;
}
