import { cleanDirectoryDataset } from "@/lib/directory-cleanup";
import { filterRetiredRecords, getRetiredIds } from "@/lib/retired-records";
import { isRetiredDirectoryRecord } from "@/lib/directory-cleanup";
import {
  getStoredCompanies as getStoredTraderCompanies,
  saveStoredCompanies,
  isLegacyDummyCompany,
  getDeterministicRepresentative,
} from "@/lib/trader-store";
import type { Client, Lead, LeadSource, OrgType, ClientStatus, ContactPerson, Department, EntityType, PipelineStage, ProcurementCompany, Quotation, ProductCategory, AMCContract } from "@/types";
import { getStoredContracts } from "@/lib/contract-store";
import { getZohoLiveQuotes, saveZohoLiveQuotes } from "@/lib/zoho-live-quotes";
import {
  deleteSharedDatasetItem,
  fetchSharedDataset,
  persistSharedDataset,
} from "@/lib/shared-data-client";

export function classifyEntity(name: string, existingOrgType?: string): { entityType: EntityType; orgType: OrgType } {
  const n = (name || "").trim();

  // 1. Is it a Person / Individual User?
  const isDoctorOrTitle = /^(Dr\b|Dr\.|Doctor\b|Mr\b|Mr\.|Mrs\b|Mrs\.|Ms\b|Ms\.|Eng\b|Eng\.)/i.test(n);
  const isFacilityNamedAfterDoctor = /clinic|hospital|center|centre|dental|polyclinic|group|llc|fzco|est\b/i.test(n);

  const personalNames = [
    "ashiq", "awaad", "emad ahmed", "krishna  kumari shenoy", "krishna kumar shenoy",
    "sulfikar ali", "vishnu", "shifin", "customer", "customer al nahdha", "customer nourin"
  ];

  if ((isDoctorOrTitle && !isFacilityNamedAfterDoctor) || personalNames.includes(n.toLowerCase())) {
    const isDoctor = /^(Dr\b|Dr\.|Doctor\b)/i.test(n);
    return {
      entityType: "Individual",
      orgType: isDoctor ? "Doctor / Practitioner" : "Individual Contact",
    };
  }

  // 2. Trader / Medical Trading Company
  if (/trading|tr\b|tr\.|traders|supplies|equipment tr|distribution|chemical supplies|electricals|computers|drug store/i.test(n)
      && !/hospital|clinic|centre|center|polyclinic|day surgery/i.test(n)) {
    return {
      entityType: "Company",
      orgType: "Medical Equipment Trader",
    };
  }

  // 3. Healthcare Facilities
  if (/pharmacy/i.test(n)) {
    return { entityType: "Company", orgType: "Pharmacy" };
  }
  if (/polyclinic|clinic|dental/i.test(n)) {
    return { entityType: "Company", orgType: "Clinic" };
  }
  if (/diagnostic|testing laboratory|bio bank|calibration/i.test(n)) {
    return { entityType: "Company", orgType: "Diagnostic Centre" };
  }
  if (/day surgery/i.test(n)) {
    return { entityType: "Company", orgType: "Day Surgery Centre" };
  }
  if (/hospital/i.test(n)) {
    return { entityType: "Company", orgType: "Hospital" };
  }

  return {
    entityType: "Company",
    orgType: (existingOrgType && existingOrgType !== "Hospital" ? existingOrgType : "Hospital") as OrgType,
  };
}

const CLIENTS_STORAGE_KEY = "fastonmed_clients";
const LEADS_STORAGE_KEY = "fastonmed_leads";

const OLD_STAGE_MAP: Record<string, PipelineStage> = {
  "Requirement Collected": "Requirement Review",
  "Demo Scheduled": "Qualified",
  "Quotation Sent": "Proposal Sent",
  "PO Received": "Won",
  "Installation Pending": "Follow Up Later",
  "Completed": "Won",
  "Lost Deal": "Lost",
};

export function normalizeLeadStage(stage: string): PipelineStage {
  if (OLD_STAGE_MAP[stage]) return OLD_STAGE_MAP[stage];
  return stage as PipelineStage;
}

export function deduceLeadCategory(productName?: string): ProductCategory {
  if (!productName) return "Diagnostic Equipment";
  const p = productName.toLowerCase();
  if (p.includes("icu") || p.includes("ventilator") || p.includes("infusion")) return "ICU Equipment";
  if (p.includes("ot") || p.includes("theatre") || p.includes("surgical") || p.includes("table")) return "OT Equipment";
  if (p.includes("monitor") || p.includes("sensor") || p.includes("spo2") || p.includes("probe")) return "Patient Monitoring";
  if (p.includes("steril") || p.includes("autoclave")) return "Sterilization";
  if (p.includes("x-ray") || p.includes("imaging") || p.includes("ultrasound") || p.includes("scan")) return "Imaging Equipment";
  if (p.includes("dental") || p.includes("chair")) return "Dental Equipment";
  if (p.includes("physio") || p.includes("rehab")) return "Physiotherapy Equipment";
  if (p.includes("lab") || p.includes("centrifuge") || p.includes("analyzer")) return "Laboratory Equipment";
  return "Diagnostic Equipment";
}

export function convertQuotationToLead(quote: Quotation): Lead {
  const item = quote.items && quote.items.length > 0 ? quote.items[0] : null;
  const productName = item?.product || item?.description || "Medical Equipment & Solutions";

  const priority: "Critical" | "High" | "Medium" | "Low" =
    quote.total >= 50000 ? "Critical" : quote.total >= 15000 ? "High" : quote.total >= 3000 ? "Medium" : "Low";

  const isFuhad = quote.preparedBy?.includes("Fuhad");
  const isHashim = quote.preparedBy?.includes("Hashim");
  const isRiyas = quote.preparedBy?.includes("Riyas");
  const assignedTo = isFuhad ? "Fuhad" : isHashim ? "Hashim" : isRiyas ? "Riyas" : "Mohammed";
  const assignedToId = isFuhad ? "emp-fuhad" : isHashim ? "emp-hashim" : isRiyas ? "emp-riyas" : "emp-user1";

  const isService =
    productName.toLowerCase().includes("service") ||
    productName.toLowerCase().includes("maintenance") ||
    productName.toLowerCase().includes("calibration");

  return {
    id: `lead-qt-${quote.quotationNumber || quote.id}`,
    clientId: quote.clientId,
    clientName: quote.clientName,
    contactName: quote.contactPerson || quote.clientName,
    phone: quote.contactPhone || "",
    email: quote.contactEmail || "",
    category: deduceLeadCategory(productName),
    product: productName,
    quantity: item?.qty || 1,
    estimatedValue: quote.total,
    quotationValue: quote.total,
    quotationNumber: quote.quotationNumber,
    stage: quote.status === "Approved" ? "Approved" : "Quotation Forwarded",
    source: "Direct Enquiry",
    assignedTo,
    assignedToId,
    priority,
    notes: quote.notes || `Zoho Books Quotation ${quote.quotationNumber}. Total: AED ${quote.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    nextFollowUp: quote.validUntil || quote.date,
    createdAt: quote.date,
    updatedAt: quote.date,
    enquiryType: isService ? "Service" : "Sales",
    comments: [
      {
        id: `comm-quote-${quote.quotationNumber}`,
        author: "Zoho Books",
        text: `📄 Quotation ${quote.quotationNumber} (AED ${quote.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}) synchronized from Zoho Books.`,
        createdAt: quote.date,
      },
    ],
  };
}

export function isDummyLead(
  lead: Lead | { id?: string; quotationNumber?: string; clientName?: string; product?: string }
): boolean {
  if (!lead) return false;
  const leadId = String(lead.id || "").trim();
  const clientName = String(lead.clientName || "").toLowerCase().trim();

  // 1. Explicit dummy test names (from legacy mock data)
  if (clientName.includes("willie") || clientName.includes("padma")) return true;

  // 2. Dummy mock hospital pipeline deals that user requested removed
  if (
    leadId.startsWith("lead-hashim-") ||
    leadId.startsWith("lead-riyas-") ||
    leadId.startsWith("lead-fuhad-") ||
    leadId.startsWith("lead-fidha-") ||
    leadId.startsWith("lead-demo-") ||
    leadId.startsWith("lead-qt-zoho-qt-") ||
    leadId === "lead-qt-FMT-QT26-0085" ||
    leadId === "lead-qt-FMT-QT26-0088"
  ) {
    return true;
  }

  return false;
}

export function deduplicateLeads(leads: Lead[]): Lead[] {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);
  const seenId = new Set<string>();
  const seenKey = new Map<string, Lead>();
  const result: Lead[] = [];

  for (const lead of leads) {
    if (!lead || !lead.id || isDummyLead(lead) || deletedIds.has(lead.id)) continue;
    if (seenId.has(lead.id)) continue;
    seenId.add(lead.id);

    // Normalize client name and product to detect exact duplicates
    const normClient = (lead.clientName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const normProduct = (lead.product || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    if (normClient.length >= 3 && normProduct.length >= 3) {
      const dedupKey = `${normClient}__${normProduct}`;
      const existing = seenKey.get(dedupKey);
      if (existing) {
        // Score completeness: prefer lead with quote, quoted items, comments, or later stage
        const score = (l: Lead) =>
          (l.quotationNumber ? 20 : 0) +
          (l.stage === "Quotation Forwarded" || l.stage === "Approved" ? 15 : 0) +
          ((l.quotedItems?.length || 0) * 5) +
          ((l.comments?.length || 0) * 2) +
          (l.notes ? 1 : 0);

        if (score(lead) > score(existing)) {
          const idx = result.indexOf(existing);
          if (idx >= 0) {
            result[idx] = lead;
            seenKey.set(dedupKey, lead);
          }
        }
        continue;
      }
      seenKey.set(dedupKey, lead);
    }

    result.push(lead);
  }

  return result;
}

export function mergeQuotationsIntoLeads(baseLeads: Lead[]): Lead[] {
  // Quotations remain in their own section; reading leads must not recreate deals.
  const deletedLeadIds = getDeletedLeadIds();
  return filterRetiredRecords("leads", deduplicateLeads((baseLeads || []).filter(
    lead => !isDummyLead(lead) && !deletedLeadIds.has(lead.id)
  )));
}

export function syncLeadToQuotations(lead: Lead, quoteNumber: string, quoteAmount?: number) {
  if (typeof window === "undefined" || !quoteNumber) return;
  try {
    const quotes = getZohoLiveQuotes();
    const existingIndex = quotes.findIndex(
      (q) => q.quotationNumber?.toLowerCase() === quoteNumber.toLowerCase()
    );

    const amount = typeof quoteAmount === "number" && quoteAmount > 0
      ? quoteAmount
      : (typeof lead.estimatedValue === "number" && lead.estimatedValue > 0
        ? lead.estimatedValue
        : (lead.quotationValue || 0));

    if (existingIndex >= 0) {
      quotes[existingIndex] = {
        ...quotes[existingIndex],
        quotationNumber: quoteNumber,
        clientName: lead.clientName,
        total: amount,
        subtotal: Math.round(amount / 1.05),
        tax: Math.round(amount - amount / 1.05),
        status: lead.stage === "Approved" ? "Approved" : (quotes[existingIndex].status || "Sent"),
      };
      if (quotes[existingIndex].items && quotes[existingIndex].items.length > 0) {
        const qty = lead.quantity || quotes[existingIndex].items[0].qty || 1;
        quotes[existingIndex].items[0].qty = qty;
        quotes[existingIndex].items[0].rate = Math.round(amount / qty);
        quotes[existingIndex].items[0].amount = amount;
        if (lead.product) quotes[existingIndex].items[0].product = lead.product;
      }
    } else {
      const newQuote: Quotation = {
        id: `quote-${Date.now()}`,
        quotationNumber: quoteNumber,
        clientId: lead.clientId || `c-${Date.now()}`,
        clientName: lead.clientName,
        contactPerson: lead.contactName,
        contactPhone: lead.phone,
        contactEmail: lead.email,
        date: lead.createdAt || new Date().toISOString().slice(0, 10),
        validUntil: lead.nextFollowUp || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        items: [
          {
            id: `item-${Date.now()}`,
            product: lead.product || "Medical Equipment Supply",
            description: `MED-${lead.category?.substring(0, 3).toUpperCase() || "EQP"}-01`,
            qty: lead.quantity || 1,
            rate: amount / (lead.quantity || 1),
            amount: amount,
          },
        ],
        subtotal: Math.round(amount / 1.05),
        tax: Math.round(amount - amount / 1.05),
        discount: 0,
        total: amount,
        status: lead.stage === "Approved" ? "Approved" : "Sent",
        createdAt: new Date().toISOString(),
        notes: `Created from Sales Pipeline: ${lead.product}`,
      };
      quotes.unshift(newQuote);
    }

    saveZohoLiveQuotes(quotes);
  } catch (err) {
    console.error("Error syncing lead to quotations:", err);
  }
}

export function clearDummyLeads(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);
        const filtered = deduplicateLeads(parsed.filter((l: Lead) => l && l.id && !deletedIds.has(l.id) && !isDummyLead(l)));
        if (filtered.length !== parsed.length) {
          localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(filtered));
          window.dispatchEvent(new Event("fastonmed_leads_updated"));
        }
      }
    }
  } catch (err) {
    console.error("Failed to clear dummy leads:", err);
  }
}

const DELETED_LEADS_KEY = "fastonmed_deleted_lead_ids";

export function getDeletedLeadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_LEADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

export function markLeadDeleted(leadId: string): void {
  if (typeof window === "undefined" || !leadId) return;
  try {
    const deleted = getDeletedLeadIds();
    deleted.add(leadId);
    localStorage.setItem(DELETED_LEADS_KEY, JSON.stringify(Array.from(deleted)));
  } catch {}
}

export function deleteStoredLead(leadId: string): Lead[] {
  if (typeof window === "undefined" || !leadId) return [];
  markLeadDeleted(leadId);

  // 1. Get current leads and filter out the target lead
  let current: Lead[] = [];
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (raw) current = JSON.parse(raw);
  } catch {}

  const target = current.find((l) => l.id === leadId);
  const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);
  const updated = current.filter((l) => l.id !== leadId && !deletedIds.has(l.id));

  localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(deduplicateLeads(updated)));

  // 2. If the lead had an associated quote or generated quote ID, clean it from fastonmed_zoho_live_quotes to prevent resurrection
  try {
    const quotes = getZohoLiveQuotes().filter((q) => {
      if (q.id === leadId || `lead-qt-${q.quotationNumber}` === leadId || `lead-qt-${q.id}` === leadId) {
        return false;
      }
      if (target?.quotationNumber && q.quotationNumber?.toLowerCase() === target.quotationNumber.toLowerCase()) {
        return false;
      }
      return true;
    });
    saveZohoLiveQuotes(quotes);
  } catch {}

  // 3. Immediately dispatch local update event
  window.dispatchEvent(new Event("fastonmed_leads_updated"));

  // 4. Send DELETE request to /api/leads
  void fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, {
    method: "DELETE",
  }).catch((e) => console.warn("DELETE /api/leads failed:", e));

  // 5. Send POST with replace: true to ensure MySQL and backup file are updated immediately
  void fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leads: deduplicateLeads(updated), replace: true }),
  }).catch((e) => console.warn("POST /api/leads sync failed:", e));

  return deduplicateLeads(updated);
}

export async function syncLeadsFromServer(): Promise<Lead[]> {
  if (typeof window === "undefined") return getStoredLeads();
  try {
    const res = await fetch("/api/leads", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const serverLeads: Lead[] = Array.isArray(data?.leads) ? data.leads : [];
      const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);

      const localData = localStorage.getItem(LEADS_STORAGE_KEY);
      let localClean: Lead[] = [];
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            localClean = parsed.filter((l) => l && l.id && !deletedIds.has(l.id) && !isDummyLead(l));
          }
        } catch {}
      }

      // Merge: keep all non-deleted server leads, plus any local leads that haven't been pushed yet
      const leadMap = new Map<string, Lead>();
      for (const sl of serverLeads) {
        if (sl && sl.id && !deletedIds.has(sl.id) && !isDummyLead(sl)) {
          leadMap.set(sl.id, { ...sl, stage: normalizeLeadStage(sl.stage) });
        }
      }

      let needsSyncToServer = false;
      for (const ll of localClean) {
        if (ll && ll.id && !deletedIds.has(ll.id)) {
          const existingSl = leadMap.get(ll.id);
          if (!existingSl) {
            leadMap.set(ll.id, { ...ll, stage: normalizeLeadStage(ll.stage) });
            needsSyncToServer = true;
          } else {
            const localTime = new Date(ll.updatedAt || ll.createdAt || 0).getTime();
            const serverTime = new Date(existingSl.updatedAt || existingSl.createdAt || 0).getTime();
            if (localTime >= serverTime) {
              leadMap.set(ll.id, {
                ...existingSl,
                ...ll,
                stage: normalizeLeadStage(ll.stage || existingSl.stage),
              });
              needsSyncToServer = true;
            }
          }
        }
      }

      const merged = deduplicateLeads(Array.from(leadMap.values()));
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event("fastonmed_leads_updated"));

      if (needsSyncToServer && merged.length > 0) {
        void fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: merged, replace: true }),
        });
      }

      return mergeQuotationsIntoLeads(merged);
    }
  } catch (err) {
    console.error("Failed to sync live leads from server:", err);
  }
  return getStoredLeads();
}

function readCachedgetStoredLeads(): Lead[] {
  let stored: Lead[] = [];
  const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);
  if (typeof window !== "undefined") {
    try {
      const data = localStorage.getItem(LEADS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          stored = parsed
            .filter((l: Lead) => l && l.id && !deletedIds.has(l.id) && !isDummyLead(l))
            .map((l: Lead) => ({
              ...l,
              stage: normalizeLeadStage(l.stage),
            }));
        }
      }
    } catch (e) {
      stored = [];
    }
  }

  // Filter out any dummy leads and persist clean real leads
  const cleaned = deduplicateLeads(stored);
  if (typeof window !== "undefined") {
    if (cleaned.length !== stored.length) {
      try {
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(cleaned));
      } catch {}
    }
    // Reading cached leads must remain synchronous. Pages initiate server
    // synchronization in their effects after mounting.
  }

  // Merge live quotations from Zoho Books so they appear in "Quotation Forwarded"
  return mergeQuotationsIntoLeads(cleaned);
}

export function saveStoredLeads(leads: Lead[]): void {
  if (typeof window === "undefined") return;
  try {
    const deletedIds = new Set([...getDeletedLeadIds(), ...getRetiredIds("leads")]);
    const filtered = deduplicateLeads((leads || []).filter((l) => !isDummyLead(l) && !deletedIds.has(l.id)));
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("fastonmed_leads_updated"));

    // Immediately sync to shared database and file storage across all user accounts
    void fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: filtered, replace: true }),
    }).catch((err) => console.warn("Failed to sync leads to server:", err));
  } catch (e) {
    console.error("Failed to save leads in localStorage:", e);
  }
}


const DELETED_CLIENTS_KEY = "fastonmed_deleted_client_ids";

export function getDeletedClientIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_CLIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

export function markClientDeleted(clientId: string): void {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedClientIds();
    deleted.add(clientId);
    localStorage.setItem(DELETED_CLIENTS_KEY, JSON.stringify(Array.from(deleted)));
  } catch {}
}

function readCachedOrganisationClients(): Client[] {
  if (typeof window === "undefined") return [];
  try {
    const deletedIds = getDeletedClientIds();
    const data = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : null;

    // Master map to merge base facilities with user edits & additions
    const clientMap = new Map<string, Client>();

    // Only use saved CRM records; never inject the bundled sample directory.
    if (Array.isArray(parsed) && parsed.length > 0) {
      for (const c of parsed) {
        if (!c || !c.id || deletedIds.has(c.id) || isRetiredDirectoryRecord(c)) continue;
        clientMap.set(c.id, normalizeClient(c));
      }
    }

    const merged = Array.from(clientMap.values());
    const withTraders = mergeTraderCompaniesIntoClients(merged);
    return mergeContractOrganisationsIntoClients(withTraders);
  } catch (e) {
    return [];
  }
}

export function getStoredCompanies(): Client[] {
  return getStoredClients().filter((c) => c.entityType === "Company");
}

export function getStoredIndividuals(): Client[] {
  return getStoredClients().filter((c) => c.entityType === "Individual");
}

export function normalizeClient(client: Client): Client {
  const { entityType, orgType } = classifyEntity(client.name, client.orgType);
  const phones = client.phones?.filter(Boolean) || [];
  const emails = client.emails?.filter(Boolean) || [];
  const phone = client.phone || phones[0] || "";
  const email = client.email || emails[0] || "";

  return {
    ...client,
    name: client.name || "Unnamed Facility",
    entityType: client.entityType || entityType,
    orgType: (client.orgType && client.orgType !== "Hospital" ? client.orgType : orgType) as OrgType,
    status: (client.status || "Lead") as ClientStatus,
    address: client.address || [client.city, client.state].filter(Boolean).join(", "),
    city: client.city || (client as any).place || client.state || "UAE",
    state: client.state || (client as any).emirate || "UAE",
    phone,
    phones: phones.length > 0 ? phones : phone ? [phone] : [],
    email,
    emails: emails.length > 0 ? emails : email ? [email] : [],
    contacts: (client.contacts || []).map((contact) => ({
      ...contact,
      clientId: contact.clientId || client.id,
      clientName: contact.clientName || client.name,
      phone: contact.phone || contact.whatsapp || "",
      email: contact.email || "",
      department: contact.department || "Purchase",
    })),
    purchases: (client.purchases || []).map((p: any) => ({
      ...p,
      productName: p.productName || p.product || "Medical Equipment / Consumables",
      product: p.product || p.productName || "Medical Equipment / Consumables",
      model: p.model || "Standard",
      brand: p.brand || "FastonMed",
      quantity: p.quantity || p.qty || 1,
      purchaseDate: p.purchaseDate || p.date || p.createdAt || "",
      date: p.date || p.purchaseDate || p.createdAt || "",
      invoiceNumber: p.invoiceNumber || "",
      amount: Number(p.amount) || 0,
      status: p.status || "Paid",
    })),
    requirements:
      client.id?.startsWith("trader-") ||
      client.orgType === "Medical Equipment Trader" ||
      client.connectedAs?.some((c) => c.toLowerCase() === "trader" || c.toLowerCase() === "merchant")
        ? []
        : (client.requirements || []).filter((r) => !r.id.startsWith("trader-req-")),
    totalRevenue: Number(client.totalRevenue) || 0,
    source: client.source || "Direct Enquiry",
    connectedAs: client.connectedAs && client.connectedAs.length > 0
      ? Array.from(new Set(client.connectedAs.map((item) => item.toLowerCase() === "merchant" ? "Trader" : item)))
      : client.orgType === "Medical Equipment Trader"
      ? ["Trader"]
      : [],
    assignedTo: client.assignedTo || "emp-1",
    createdAt: client.createdAt || new Date().toISOString().slice(0, 10),
    operationalStatus: client.operationalStatus || "Running",
    notes: client.notes || "",
  };
}

export function normalizeOrganisationName(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function traderCompanyToClient(company: ProcurementCompany): Client {
  const city = company.uaeOffice?.split(",").slice(-1)[0]?.trim() || "Dubai";
  const primaryContact = company.contactPerson?.trim();
  const contacts: ContactPerson[] =
    company.contacts && company.contacts.length > 0
      ? company.contacts.map((contact, index) => ({
          id: `trader-contact-${company.id}-${index}`,
          clientId: `trader-${company.id}`,
          clientName: company.name,
          name: contact.name,
          designation: contact.role || "Trader Contact",
          department: "Purchase",
          phone: contact.phone || company.phone,
          whatsapp: contact.phone || company.phone,
          email: contact.email || company.email,
          lastContacted: new Date().toISOString().slice(0, 10),
        }))
      : primaryContact
      ? [
          {
            id: `trader-contact-${company.id}`,
            clientId: `trader-${company.id}`,
            clientName: company.name,
            name: primaryContact,
            designation: company.contactRole || "Trader Contact",
            department: "Purchase",
            phone: company.phone,
            whatsapp: company.phone,
            email: company.email,
            lastContacted: new Date().toISOString().slice(0, 10),
          },
        ]
      : [];

  return normalizeClient({
    id: `trader-${company.id}`,
    name: company.name,
    entityType: "Company",
    orgType: "Medical Equipment Trader",
    status: "Existing Customer",
    address: company.uaeOffice || city,
    city,
    state: city,
    phone: company.phone,
    phones: company.phone ? [company.phone] : [],
    email: company.email,
    emails: company.email ? [company.email] : [],
    website: company.website,
    contacts,
    purchases: [],
    requirements: [],
    totalRevenue: company.totalVolume || 0,
    source: "Direct Enquiry",
    connectedAs: ["Trader"],
    assignedTo: "emp-1",
    createdAt: new Date().toISOString().slice(0, 10),
    operationalStatus: "Running",
    notes: [
      company.partnership,
      "Connected through procurement / trader company",
      company.equipmentLine,
      company.suppliedCategories?.length ? `Categories: ${company.suppliedCategories.join(", ")}` : "",
      company.deliveryLeadTime ? `Lead time: ${company.deliveryLeadTime}` : "",
      company.priceRangeText ? `Price range: ${company.priceRangeText}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

function mergeTraderCompaniesIntoClients(clients: Client[]): Client[] {
  if (typeof window === "undefined") return clients;

  const merged = clients.map(normalizeClient);
  const existingNames = new Map(merged.map((client, index) => [normalizeOrganisationName(client.name), index]));

  getStoredTraderCompanies()
    .filter((company) => !isLegacyDummyCompany(company))
    .forEach((company) => {
    const key = normalizeOrganisationName(company.name);
    const traderClient = traderCompanyToClient(company);
    const existingIndex = existingNames.get(key);

    if (existingIndex === undefined) {
      existingNames.set(key, merged.length);
      merged.push(traderClient);
      return;
    }

    const existing = merged[existingIndex];
    // Strip out any legacy dummy trader-req requirements
    const cleanedReqs = (existing.requirements || []).filter(
      (r) => !r.id.startsWith("trader-req-")
    );

    merged[existingIndex] = {
      ...existing,
      entityType: "Company",
      orgType: existing.orgType === "Hospital" ? "Medical Equipment Trader" : existing.orgType,
      connectedAs: Array.from(new Set([...(existing.connectedAs || []).map((c) => c.toLowerCase() === "merchant" ? "Trader" : c), "Trader"])),
      phone: existing.phone || traderClient.phone,
      phones: existing.phones && existing.phones.length > 0 ? existing.phones : traderClient.phones,
      email: existing.email || traderClient.email,
      emails: existing.emails && existing.emails.length > 0 ? existing.emails : traderClient.emails,
      website: existing.website || traderClient.website,
      contacts: existing.contacts && existing.contacts.length > 0 ? existing.contacts : traderClient.contacts,
      requirements: cleanedReqs,
      totalRevenue: existing.totalRevenue || traderClient.totalRevenue,
      source: existing.source || traderClient.source,
      notes: existing.notes || traderClient.notes,
    };
  });

  return merged;
}

function extractCityFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("abu dhabi")) return "Abu Dhabi";
  if (lower.includes("sharjah")) return "Sharjah";
  if (lower.includes("ajman")) return "Ajman";
  if (lower.includes("ras al khaimah") || lower.includes("rak")) return "Ras Al Khaimah";
  if (lower.includes("fujairah")) return "Fujairah";
  if (lower.includes("umm al quwain") || lower.includes("uaq")) return "Umm Al Quwain";
  if (lower.includes("al ain")) return "Al Ain";
  return "Dubai";
}

export function contractOrganisationToClient(contract: AMCContract): Client {
  const orgName = (contract.organisation || contract.clientName || "").trim();
  const { entityType, orgType } = classifyEntity(orgName, contract.orgType);
  const city = extractCityFromName(orgName);
  const contactPerson = contract.contactPerson?.trim();
  const contactPhone = contract.contactPhone?.trim();
  const contactEmail = contract.contactEmail?.trim();

  const clientId =
    contract.clientId &&
    contract.clientId !== "c-custom" &&
    contract.clientId !== "CUSTOM" &&
    !contract.clientId.startsWith("amc-")
      ? contract.clientId
      : `client-amc-${encodeURIComponent(
          normalizeOrganisationName(orgName).replace(/\s+/g, "-")
        )}`;

  const contacts: ContactPerson[] = contactPerson
    ? [
        {
          id: `ct-amc-${contract.id}`,
          clientId,
          clientName: orgName,
          name: contactPerson,
          designation: "Facility / Maintenance Contact",
          department: "Maintenance" as Department,
          phone: contactPhone || "",
          whatsapp: contactPhone || "",
          email: contactEmail || "",
          lastContacted: contract.startDate || new Date().toISOString().slice(0, 10),
        },
      ]
    : [];

  return normalizeClient({
    id: clientId,
    name: orgName,
    entityType: "Company",
    orgType: (contract.orgType as OrgType) || orgType || "Clinic",
    status: "Existing Customer",
    address: `${city}, UAE`,
    city,
    state: city,
    phone: contactPhone || "",
    phones: contactPhone ? [contactPhone] : [],
    email: contactEmail || "",
    emails: contactEmail ? [contactEmail] : [],
    contacts,
    purchases: [],
    requirements: [],
    totalRevenue: Number(contract.amount || contract.value) || 0,
    source: "Direct Enquiry",
    connectedAs: ["Contract"],
    assignedTo: contract.assignedEngineerId || "emp-hashim",
    createdAt: contract.startDate || new Date().toISOString().slice(0, 10),
    operationalStatus: "Running",
    notes: [
      contract.title ? `Contract: ${contract.title}` : "",
      contract.typeOfService ? `Service: ${contract.typeOfService}` : "",
      contract.existingContractor ? `Contractor: ${contract.existingContractor}` : "",
      contract.notes || "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export function mergeContractOrganisationsIntoClients(clients: Client[]): Client[] {
  if (typeof window === "undefined") return clients;

  const merged = clients.map(normalizeClient);
  const existingNames = new Map(
    merged.map((client, index) => [normalizeOrganisationName(client.name), index])
  );
  const existingIds = new Map(merged.map((client, index) => [client.id, index]));

  try {
    const contracts = getStoredContracts();
    contracts.forEach((contract) => {
      const orgName = (contract.organisation || contract.clientName || "").trim();
      if (!orgName) return;

      const key = normalizeOrganisationName(orgName);
      const existingIndexByName = existingNames.get(key);
      const existingIndexById =
        contract.clientId &&
        contract.clientId !== "c-custom" &&
        contract.clientId !== "CUSTOM"
          ? existingIds.get(contract.clientId)
          : undefined;

      const existingIndex =
        existingIndexById !== undefined ? existingIndexById : existingIndexByName;

      if (existingIndex === undefined) {
        const newClient = contractOrganisationToClient(contract);
        existingNames.set(key, merged.length);
        existingIds.set(newClient.id, merged.length);
        merged.push(newClient);
        return;
      }

      const existing = merged[existingIndex];
      const contactPerson = contract.contactPerson?.trim();
      const contactPhone = contract.contactPhone?.trim();
      const contactEmail = contract.contactEmail?.trim();

      let updatedContacts = existing.contacts || [];
      if (
        contactPerson &&
        !updatedContacts.some(
          (c) => c.name.toLowerCase() === contactPerson.toLowerCase()
        )
      ) {
        updatedContacts = [
          ...updatedContacts,
          {
            id: `ct-amc-${contract.id}`,
            clientId: existing.id,
            clientName: existing.name,
            name: contactPerson,
            designation: "Facility / Maintenance Contact",
            department: "Maintenance" as Department,
            phone: contactPhone || "",
            whatsapp: contactPhone || "",
            email: contactEmail || "",
            lastContacted: contract.startDate || new Date().toISOString().slice(0, 10),
          },
        ];
      }

      const connectedAs = Array.from(
        new Set([...(existing.connectedAs || []), "Contract"])
      );

      merged[existingIndex] = {
        ...existing,
        phone: existing.phone || contactPhone || "",
        phones:
          existing.phones && existing.phones.length > 0
            ? existing.phones
            : contactPhone
            ? [contactPhone]
            : [],
        email: existing.email || contactEmail || "",
        emails:
          existing.emails && existing.emails.length > 0
            ? existing.emails
            : contactEmail
            ? [contactEmail]
            : [],
        contacts: updatedContacts,
        connectedAs,
        totalRevenue: Math.max(
          existing.totalRevenue || 0,
          Number(contract.amount || contract.value) || 0
        ),
      };
    });
  } catch (err) {
    console.error("Error merging contract organisations into clients:", err);
  }

  return merged;
}

export function findClientForTraderCompany(company: ProcurementCompany, clients?: Client[]): Client {
  const allClients = clients && clients.length > 0 ? clients : getStoredClients();
  if (company.sourceClientId) {
    const bySource = allClients.find((c) => c.id === company.sourceClientId);
    if (bySource) return bySource;
  }
  const targetName = normalizeOrganisationName(company.name);
  const byName = allClients.find((c) => normalizeOrganisationName(c.name) === targetName);
  if (byName) return byName;
  const byId = allClients.find(
    (c) =>
      c.id === company.id ||
      c.id === `trader-${company.id}` ||
      c.id === company.id.replace(/^client-trader-/, "")
  );
  if (byId) return byId;
  return traderCompanyToClient(company);
}

export function syncTraderClientsToCompanies(clients: Client[]): void {
  if (typeof window === "undefined") return;

  const traderClients = clients.filter((client) => {
    if (!client) return false;
    if (isLegacyDummyCompany({ id: client.id, name: client.name })) return false;
    return (
      client.orgType === "Medical Equipment Trader" ||
      client.orgType === "Equipment Trader" ||
      client.id?.startsWith("trader-") ||
      Boolean(
        client.connectedAs?.some((connection) => {
          const c = String(connection).trim().toLowerCase();
          return c === "trader" || c === "merchant";
        })
      )
    );
  });
  const traderClientIds = new Set(traderClients.map((client) => client.id));
  const currentCompanies = getStoredTraderCompanies();
  const companies = currentCompanies.filter(
    (company) => !company.sourceClientId || traderClientIds.has(company.sourceClientId)
  );

  for (const client of traderClients) {
    const generatedId = client.id.startsWith("trader-")
      ? client.id.slice("trader-".length)
      : `client-trader-${client.id}`;
    const normalizedName = normalizeOrganisationName(client.name);
    const existingIndex = companies.findIndex(
      (company) =>
        company.sourceClientId === client.id ||
        company.id === generatedId ||
        normalizeOrganisationName(company.name) === normalizedName
    );
    const existing = existingIndex >= 0 ? companies[existingIndex] : undefined;
    const primaryContact = client.contacts?.[0];
    const fallbackRep = getDeterministicRepresentative(client.name || client.id);
    const repName = primaryContact?.name || existing?.contactPerson || fallbackRep.name;
    const repPhone =
      primaryContact?.phone ||
      primaryContact?.whatsapp ||
      client.phone ||
      (client.phones && client.phones[0]) ||
      existing?.phone ||
      fallbackRep.phone;

    const company: ProcurementCompany = {
      id: existing?.id || generatedId,
      sourceClientId: client.id,
      name: client.name,
      origin: existing?.origin || client.state || "UAE",
      uaeOffice: client.address || [client.city, client.state].filter(Boolean).join(", ") || "UAE",
      partnership: existing?.partnership || "Authorized Distributor",
      equipmentLine: existing?.equipmentLine || "General Medical Line",
      suppliedCategories:
        existing?.suppliedCategories && existing.suppliedCategories.length > 0
          ? existing.suppliedCategories
          : ["General Medical Line"],
      suppliedProducts: existing?.suppliedProducts || [],
      deliveryLeadTime: existing?.deliveryLeadTime || "3 - 5 Days (UAE Stock)",
      priceRangeText: existing?.priceRangeText || "",
      productCount: existing?.productCount || 0,
      totalVolume: client.totalRevenue || existing?.totalVolume || 0,
      contactPerson: repName,
      contactRole: primaryContact?.designation || existing?.contactRole || "UAE Representative",
      phone: repPhone,
      email: primaryContact?.email || client.email || existing?.email || "",
      website: client.website || existing?.website || "",
      flag: existing?.flag || "🇦🇪",
      contacts:
        client.contacts?.map((contact) => ({
          id: contact.id,
          name: contact.name,
          role: contact.designation,
          phone: contact.phone || contact.whatsapp,
          email: contact.email,
          isPrimary: contact.id === primaryContact?.id,
        })) || existing?.contacts || [],
    };

    if (existingIndex >= 0) companies[existingIndex] = company;
    else companies.push(company);
  }

  // Prevent redundant writes and event loops if companies list is already identical
  if (
    currentCompanies.length === companies.length &&
    currentCompanies.every(
      (c, i) => c.id === companies[i]?.id && c.sourceClientId === companies[i]?.sourceClientId
    )
  ) {
    return;
  }

  saveStoredCompanies(companies);
}

export function saveStoredClients(clients: Client[], syncServer = true): void {
  if (typeof window === "undefined") return;
  try {
    let previous: Client[] = [];
    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) previous = parsed;
    } catch {}
    clients = clients.filter((client) => !isRetiredDirectoryRecord(client));
    const serialized = JSON.stringify(clients);
    const changed = localStorage.getItem(CLIENTS_STORAGE_KEY) !== serialized;
    localStorage.setItem(CLIENTS_STORAGE_KEY, serialized);
    syncTraderClientsToCompanies(clients);
    syncClientContactsToPeople(clients);
    if (syncServer) {
      const previousById = new Map(previous.map((client) => [client.id, JSON.stringify(client)]));
      const changedClients = clients.filter(
        (client) => previousById.get(client.id) !== JSON.stringify(client)
      );
      void persistSharedDataset("clients", changedClients).catch((error) =>
        console.warn("Clients are cached locally but database sync failed:", error)
      );
    }
    if (changed) {
      window.dispatchEvent(new Event("fastonmed_clients_updated"));
      window.dispatchEvent(new CustomEvent("fastonmed_companies_updated"));
    }
  } catch (e) {
    console.error("Failed to save clients in localStorage:", e);
  }
}

export async function syncLiveClientsFromApi(): Promise<Client[]> {
  if (typeof window === "undefined") return getStoredClients();
  const { apiRequest } = await import("@/lib/api-client");
  const results = await Promise.allSettled([
    apiRequest<Client[]>("/api/clients"), fetchSharedDataset("clients") as Promise<Client[]>,
  ]);
  const merged = new Map<string, Client>();
  let loaded = false;
  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      loaded = true;
      for (const client of result.value) if (client?.id && !isRetiredDirectoryRecord(client)) merged.set(client.id, normalizeClient(client));
    }
  }
  if (!loaded) throw new Error("The live client database is unavailable");

  const clients = Array.from(merged.values());
  const storedRaw = localStorage.getItem(CLIENTS_STORAGE_KEY);
  if (storedRaw !== JSON.stringify(clients)) {
    // Hydrating from the server must not write the same records back or emit a
    // fresh mutation event that starts another full server load.
    saveStoredClients(clients, false);
  }
  return clients;
}

export function addClientFromLead(leadData: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  source?: LeadSource;
  assignedTo?: string;
}): Client {
  let creator: { id?: string; name?: string } = {};
  if (typeof window !== "undefined") {
    try {
      const storedUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
      creator = { id: storedUser.id || storedUser.userId, name: storedUser.name || storedUser.fullName || storedUser.username };
    } catch {}
  }
  const currentClients = getStoredClients();
  const trimmedName = leadData.name.trim();

  // Check if client already exists by name (case-insensitive)
  const existing = currentClients.find(
    (c) => c.name.toLowerCase().trim() === trimmedName.toLowerCase()
  );

  if (existing) {
    // If contact is provided and facility has no contacts, append
    if (leadData.contactName && (!existing.contacts || existing.contacts.length === 0)) {
      const updatedExisting: Client = {
        ...existing,
        contacts: [
          {
            id: `ct-${Date.now()}`,
            clientId: existing.id,
            name: leadData.contactName,
            designation: "Procurement / Key Contact",
            department: "Purchase" as Department,
            phone: leadData.phone || existing.phone,
            whatsapp: leadData.phone || existing.phone,
            email: leadData.email || existing.email,
            lastContacted: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            createdBy: creator.name || "User not recorded",
            createdById: creator.id,
          },
        ],
      };
      const updatedList = currentClients.map((c) => (c.id === existing.id ? updatedExisting : c));
      saveStoredClients(updatedList);
      return updatedExisting;
    }
    return existing;
  }

  const clientId = `c-${Date.now()}`;
  const classification = classifyEntity(trimmedName);
  const isIndividual = classification.entityType === "Individual" || /^(dr\b|doctor\b|mr\b|mrs\b|ms\b|eng\b)/i.test(trimmedName);

  const initialContacts: ContactPerson[] = leadData.contactName?.trim()
    ? [
        {
          id: `ct-${Date.now()}`,
          clientId,
          name: leadData.contactName.trim(),
          designation: isIndividual ? "Doctor / Key Contact" : "Procurement Lead / Key Contact",
          department: (isIndividual ? "Doctor" : "Purchase") as Department,
          phone: leadData.phone?.trim() || "",
          whatsapp: leadData.phone?.trim() || "",
          email: leadData.email?.trim() || "",
          lastContacted: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          createdBy: creator.name || "User not recorded",
          createdById: creator.id,
        },
      ]
    : [];

  const newClient: Client = {
    id: clientId,
    name: trimmedName,
    orgType: isIndividual ? ("Doctor / Practitioner" as OrgType) : classification.orgType,
    entityType: isIndividual ? "Individual" : "Company",
    status: "Lead" as ClientStatus,
    address: `${trimmedName}, Dubai, UAE`,
    city: "Dubai",
    state: "Dubai",
    pincode: "00000",
    phone: leadData.phone?.trim() || "",
    phones: leadData.phone?.trim() ? [leadData.phone.trim()] : [],
    email: leadData.email?.trim() || "",
    emails: leadData.email?.trim() ? [leadData.email.trim()] : [],
    source: leadData.source || "Direct Enquiry",
    assignedTo: leadData.assignedTo || "emp-1",
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: creator.name || "User not recorded",
    createdById: creator.id,
    totalRevenue: 0,
    contacts: initialContacts,
    purchases: [],
    requirements: [],
    tags: [isIndividual ? "Doctor / Practitioner" : classification.orgType, "Dubai", "Pipeline Lead"],
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${trimmedName} Dubai UAE`)}`,
  };

  const updatedList = [newClient, ...currentClients];
  saveStoredClients(updatedList);
  return newClient;
}

const PEOPLE_STORAGE_KEY = "fastonmed_people";

export function getStoredPeople(): ContactPerson[] {
  if (typeof window === "undefined") return [];
  try {
    let currentPeople: ContactPerson[] = [];
    const data = localStorage.getItem(PEOPLE_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        currentPeople = parsed;
      }
    }

    const clients = getStoredClients();

    if (currentPeople.length === 0) {
      // First time initialization
      clients.forEach((client) => {
        if (client.contacts && client.contacts.length > 0) {
          client.contacts.forEach((contact) => {
            currentPeople.push({
              ...contact,
              clientId: client.id,
              clientName: client.name,
              status: "Active at Organisation",
              previousOrganisations: [],
            });
          });
        }

        if (client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual") {
          const isDoc = /^(Dr\b|Dr\.|Doctor\b)/i.test(client.name);
          currentPeople.push({
            id: `person-${client.id}`,
            clientId: client.id,
            clientName: client.name,
            name: client.name,
            designation: isDoc ? "Doctor / Medical Specialist" : "Healthcare Key Contact / User",
            department: (isDoc ? "Doctor" : "Purchase") as Department,
            phone: client.phone || "",
            whatsapp: client.phone || "",
            email: client.email || "",
            status: "Independent / Consultant",
            notes: `Individual contact registered in UAE healthcare network (${client.city || "Dubai"}).`,
            previousOrganisations: [],
            lastContacted: client.createdAt || new Date().toISOString().slice(0, 10),
          });
        }
      });

      // Sample career mobility profiles
      currentPeople.push({
        id: "p-trans-1",
        name: "Eng. Humaid Al Nuaimi",
        designation: "Senior Clinical Engineering Consultant",
        department: "Biomedical Engineering",
        phone: "+971 50 882 1943",
        whatsapp: "+971 50 882 1943",
        email: "humaid.nuaimi@medconsult.ae",
        status: "Independent / Consultant",
        clientName: "Independent Healthcare Consultant",
        notes: "Former Head of Biomedical at Mediclinic City Hospital (2020-2024). Great key contact for private clinic equipment recommendations.",
        previousOrganisations: [
          {
            organisationName: "Mediclinic City Hospital",
            role: "Head of Biomedical Engineering",
            period: "2020 - 2024",
          },
        ],
        lastContacted: new Date().toISOString().slice(0, 10),
      });

      currentPeople.push({
        id: "p-trans-2",
        name: "Dr. Sarah Al Suwaidi",
        designation: "Procurement Advisor",
        department: "Purchase",
        phone: "+971 52 441 9081",
        whatsapp: "+971 52 441 9081",
        email: "sarah.suwaidi@medprocure.ae",
        status: "Changed Organisation",
        clientId: "c-2",
        clientName: "American Hospital Dubai",
        notes: "Moved from Burjeel Medical City to American Hospital Dubai in 2024. Handles OT & ICU tenders.",
        previousOrganisations: [
          {
            organisationName: "Burjeel Medical City",
            role: "Assistant Procurement Director",
            period: "2021 - 2024",
          },
        ],
        lastContacted: new Date().toISOString().slice(0, 10),
      });

      localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(currentPeople));
      return currentPeople;
    }

    // If people already exists, ensure all individual clients are synced in
    let hasAdditions = false;
    const existingNames = new Set(currentPeople.map((p) => p.name.toLowerCase().trim()));

    clients.forEach((client) => {
      const isInd = client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual";
      if (isInd) {
        const clean = client.name.toLowerCase().trim();
        if (!existingNames.has(clean)) {
          const isDoc = /^(Dr\b|Dr\.|Doctor\b)/i.test(client.name);
          currentPeople.push({
            id: `person-${client.id}`,
            clientId: client.id,
            clientName: client.name,
            name: client.name,
            designation: isDoc ? "Doctor / Medical Specialist" : "Healthcare Key Contact / User",
            department: (isDoc ? "Doctor" : "Purchase") as Department,
            phone: client.phone || "",
            whatsapp: client.phone || "",
            email: client.email || "",
            status: "Independent / Consultant",
            notes: `Individual contact registered in UAE healthcare network (${client.city || "Dubai"}).`,
            previousOrganisations: [],
            lastContacted: client.createdAt || new Date().toISOString().slice(0, 10),
          });
          existingNames.add(clean);
          hasAdditions = true;
        }
      }
    });

    if (hasAdditions) {
      localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(currentPeople));
    }

    return currentPeople;
  } catch (e) {
    console.error("Failed to get stored people:", e);
    return [];
  }
}

export function saveStoredPeople(people: ContactPerson[]): void {
  if (typeof window === "undefined") return;
  try {
    let previous: ContactPerson[] = [];
    try {
      const raw = localStorage.getItem(PEOPLE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) previous = parsed;
    } catch {}
    localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
    const previousById = new Map(previous.map((person) => [person.id, JSON.stringify(person)]));
    const changedPeople = people.filter((person) => previousById.get(person.id) !== JSON.stringify(person));
    const currentIds = new Set(people.map((person) => person.id));
    previous
      .filter((person) => !currentIds.has(person.id))
      .forEach((person) => void deleteSharedDatasetItem("people", { id: person.id }).catch(() => {}));
    void persistSharedDataset("people", changedPeople).catch((error) =>
      console.warn("People are cached locally but database sync failed:", error)
    );
    window.dispatchEvent(new Event("fastonmed_people_updated"));
  } catch (e) {
    console.error("Failed to save people in localStorage:", e);
  }
}

export function syncClientContactsToPeople(clients: Client[]): void {
  if (typeof window === "undefined") return;
  try {
    const people = getStoredPeople();
    let hasChanges = false;
    const updatedPeople = [...people];

    clients.forEach((client) => {
      if (client.contacts && client.contacts.length > 0) {
        client.contacts.forEach((c) => {
          const index = updatedPeople.findIndex((p) => p.id === c.id || (p.email && p.email.toLowerCase() === c.email.toLowerCase()));
          if (index >= 0) {
            updatedPeople[index] = {
              ...updatedPeople[index],
              name: c.name || updatedPeople[index].name,
              clientId: client.id,
              clientName: client.name,
              designation: c.designation || updatedPeople[index].designation,
              department: c.department || updatedPeople[index].department,
              phone: c.phone || updatedPeople[index].phone,
              whatsapp: c.whatsapp || updatedPeople[index].whatsapp,
              email: c.email || updatedPeople[index].email,
              linkedin: c.linkedin || updatedPeople[index].linkedin,
              photo: c.photo || c.avatar || updatedPeople[index].photo || updatedPeople[index].avatar,
              avatar: c.avatar || c.photo || updatedPeople[index].avatar || updatedPeople[index].photo,
              notes: c.notes !== undefined ? c.notes : updatedPeople[index].notes,
              status: updatedPeople[index].status || "Active at Organisation",
            };
            hasChanges = true;
          } else {
            updatedPeople.push({
              ...c,
              id: c.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              clientId: client.id,
              clientName: client.name,
              status: "Active at Organisation",
              previousOrganisations: [],
              lastContacted: new Date().toISOString().slice(0, 10),
            });
            hasChanges = true;
          }
        });
      }

      if (client.entityType === "Individual" || classifyEntity(client.name, client.orgType).entityType === "Individual") {
        const clean = client.name.toLowerCase().trim();
        const exists = updatedPeople.some((p) => p.name.toLowerCase().trim() === clean || p.clientId === client.id);
        if (!exists) {
          const isDoc = /^(Dr\b|Dr\.|Doctor\b)/i.test(client.name);
          updatedPeople.push({
            id: `person-${client.id}`,
            clientId: client.id,
            clientName: client.name,
            name: client.name,
            designation: isDoc ? "Doctor / Medical Specialist" : "Healthcare Key Contact / User",
            department: (isDoc ? "Doctor" : "Purchase") as Department,
            phone: client.phone || "",
            whatsapp: client.phone || "",
            email: client.email || "",
            status: "Independent / Consultant",
            notes: `Individual contact registered in UAE healthcare network (${client.city || "Dubai"}).`,
            previousOrganisations: [],
            lastContacted: client.createdAt || new Date().toISOString().slice(0, 10),
          });
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(updatedPeople));
      void persistSharedDataset("people", updatedPeople).catch(() => {});
      window.dispatchEvent(new Event("fastonmed_people_updated"));
    }
  } catch (e) {
    console.error("Failed to sync client contacts to people:", e);
  }
}

export function updatePerson(updatedPerson: ContactPerson): void {
  const people = getStoredPeople();
  const clients = getStoredClients();

  const newPeople = people.map((p) => (p.id === updatedPerson.id ? updatedPerson : p));
  saveStoredPeople(newPeople);

  // Sync with client if associated
  if (updatedPerson.clientId) {
    const updatedClients = clients.map((client) => {
      if (client.id === updatedPerson.clientId) {
        const contactExists = client.contacts.some((c) => c.id === updatedPerson.id);
        const newContacts = contactExists
          ? client.contacts.map((c) => (c.id === updatedPerson.id ? updatedPerson : c))
          : [...client.contacts, updatedPerson];
        return { ...client, contacts: newContacts };
      }
      return client;
    });
    saveStoredClients(updatedClients);
  }
}

export function transferPersonOrganisation(
  personId: string,
  newClientId: string | null,
  newRole?: string,
  leavingNotes?: string
): void {
  const people = getStoredPeople();
  const clients = getStoredClients();

  const person = people.find((p) => p.id === personId);
  if (!person) return;

  const oldClientId = person.clientId;
  const oldClientName = person.clientName;
  const oldRole = person.designation;

  const previousOrganisations = person.previousOrganisations ? [...person.previousOrganisations] : [];
  if (oldClientName && oldClientName !== "Independent Healthcare Consultant") {
    previousOrganisations.unshift({
      organisationName: oldClientName,
      role: oldRole,
      period: `Prior to ${new Date().getFullYear()}`,
    });
  }

  let updatedPerson: ContactPerson;

  if (newClientId) {
    const targetClient = clients.find((c) => c.id === newClientId);
    updatedPerson = {
      ...person,
      clientId: newClientId,
      clientName: targetClient ? targetClient.name : "Unknown Facility",
      designation: newRole ? newRole.trim() : person.designation,
      status: "Active at Organisation",
      previousOrganisations,
      notes: leavingNotes ? `${person.notes ? person.notes + "\n" : ""}${leavingNotes}` : person.notes,
      lastContacted: new Date().toISOString().slice(0, 10),
    };
  } else {
    // Marked as Left Organisation / Independent
    updatedPerson = {
      ...person,
      clientId: undefined,
      clientName: "Independent / Ex-Employee",
      status: "Independent / Consultant",
      previousOrganisations,
      notes: leavingNotes ? `${person.notes ? person.notes + "\n" : ""}${leavingNotes}` : person.notes,
      lastContacted: new Date().toISOString().slice(0, 10),
    };
  }

  // Update people list
  const newPeople = people.map((p) => (p.id === personId ? updatedPerson : p));
  saveStoredPeople(newPeople);

  // Update client lists: remove from old client, add to new client
  const updatedClients = clients.map((client) => {
    if (client.id === oldClientId) {
      return {
        ...client,
        contacts: client.contacts.filter((c) => c.id !== personId),
      };
    }
    if (newClientId && client.id === newClientId) {
      return {
        ...client,
        contacts: [...client.contacts.filter((c) => c.id !== personId), updatedPerson],
      };
    }
    return client;
  });

  saveStoredClients(updatedClients);
}

export function addStandalonePerson(personData: Omit<ContactPerson, "id">): ContactPerson {
  const people = getStoredPeople();
  const clients = getStoredClients();

  const targetClient = personData.clientId ? clients.find((c) => c.id === personData.clientId) : null;
  const newId = `person-${Date.now()}`;

  const newPerson: ContactPerson = {
    ...personData,
    id: newId,
    clientName: targetClient ? targetClient.name : personData.clientName || "Independent Healthcare Consultant",
    status: personData.status || (personData.clientId ? "Active at Organisation" : "Independent / Consultant"),
    previousOrganisations: personData.previousOrganisations || [],
    lastContacted: new Date().toISOString().slice(0, 10),
  };

  const updatedPeople = [newPerson, ...people];
  saveStoredPeople(updatedPeople);

  if (personData.clientId && targetClient) {
    const updatedClients = clients.map((c) => {
      if (c.id === personData.clientId) {
        return {
          ...c,
          contacts: [...c.contacts, newPerson],
        };
      }
      return c;
    });
    saveStoredClients(updatedClients);
  }

  return newPerson;
}

export function deleteStoredPerson(personId: string): void {
  const people = getStoredPeople();
  const target = people.find((p) => p.id === personId);
  const updatedPeople = people.filter((p) => p.id !== personId);
  saveStoredPeople(updatedPeople);

  if (target?.clientId) {
    const clients = getStoredClients();
    const updatedClients = clients.map((c) => {
      if (c.id === target.clientId) {
        return {
          ...c,
          contacts: c.contacts ? c.contacts.filter((ct) => ct.id !== personId) : [],
        };
      }
      return c;
    });
    saveStoredClients(updatedClients);
  }

  if (typeof window !== "undefined") {
    import("@/lib/api-client").then(({ apiRequest }) => {
      apiRequest(`/api/people/${personId}`, { method: "DELETE" }).catch(() => {});
    });
  }
}

export function deleteStoredClient(clientId: string): void {
  markClientDeleted(clientId);
  const currentClients = getStoredClients();
  const updatedClients = currentClients.filter((c) => c.id !== clientId);
  saveStoredClients(updatedClients, false);
  void deleteSharedDatasetItem("clients", { id: clientId }).catch((error) =>
    console.warn("Client was removed locally but database deletion failed:", error)
  );

  if (typeof window !== "undefined") {
    import("@/lib/api-client").then(({ apiRequest }) => {
      apiRequest(`/api/clients/${clientId}`, { method: "DELETE" }).catch(() => {});
    });
  }
}

export const INITIAL_DEPARTMENTS: string[] = [
  "Biomedical Engineering",
  "Purchase",
  "Doctor",
  "Administration",
  "Management",
  "Finance",
  "IT",
];

const DEPARTMENTS_STORAGE_KEY = "fastonmed_departments";

export function getStoredDepartments(): string[] {
  if (typeof window === "undefined") return INITIAL_DEPARTMENTS;
  try {
    const data = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (!data) return INITIAL_DEPARTMENTS;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return Array.from(new Set([...INITIAL_DEPARTMENTS, ...parsed]));
    }
    return INITIAL_DEPARTMENTS;
  } catch (e) {
    return INITIAL_DEPARTMENTS;
  }
}

export function saveStoredDepartments(departments: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const combined = Array.from(new Set([...INITIAL_DEPARTMENTS, ...departments]));
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(combined));
    void persistSharedDataset("departments", combined).catch(() => {});
    window.dispatchEvent(new Event("fastonmed_departments_updated"));
  } catch (e) {
    console.error("Failed to save departments:", e);
  }
}

export function getStoredLeads(): Lead[] {
  return filterRetiredRecords("leads", readCachedgetStoredLeads()).map(lead => ({
    ...lead,
    email: lead.email?.trim().toLowerCase() === "procurement@facility.ae" ? "" : lead.email,
    contacts: lead.contacts?.map(contact => ({
      ...contact,
      email: contact.email?.trim().toLowerCase() === "procurement@facility.ae" ? "" : contact.email,
    })),
  }));
}

export function getStoredClients(): Client[] {
  return cleanDirectoryDataset("clients", readCachedOrganisationClients()) as Client[];
}
