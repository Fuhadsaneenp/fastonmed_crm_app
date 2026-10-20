"use client";

import type { Client, ContactPerson, Invoice, OrgType, Department } from "@/types";
import {
  saveStoredClients,
  getStoredClients,
  saveStoredPeople,
  getStoredPeople,
  saveStoredLeads,
} from "@/lib/client-store";

export const ZOHO_CONFIG_KEY = "fastonmed_zoho_config";
export const ZOHO_SYNC_LOG_KEY = "fastonmed_zoho_sync_log";
export const INVOICES_STORAGE_KEY = "fastonmed_invoices";

export interface ZohoConfig {
  mode: "webhook" | "oauth";
  webhookUrl?: string;
  organizationId?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  connectionName?: string;
  lastSyncedAt?: string;
  lastSyncStats?: {
    clients: number;
    people: number;
    invoices: number;
  };
}

export interface ZohoContactPersonRaw {
  contact_person_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  designation?: string;
  department?: string;
  is_primary_contact?: boolean;
}

export interface ZohoContactRaw {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  customer_sub_type?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  vat_reg_no?: string;
  tax_reg_no?: string;
  outstanding_receivable_amount?: number;
  billing_address?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  contact_persons?: ZohoContactPersonRaw[];
  status?: string;
}

export interface ZohoInvoiceRaw {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  total: number;
  balance?: number;
  status: string;
  date?: string;
  due_date?: string;
  line_items?: {
    name?: string;
    item_name?: string;
    quantity?: number;
    rate?: number;
    item_total?: number;
  }[];
}

export interface ZohoSyncPayload {
  contacts?: ZohoContactRaw[];
  invoices?: ZohoInvoiceRaw[];
  items?: any[];
  status?: string;
  organization_id?: string;
}

export function getZohoConfig(): ZohoConfig {
  if (typeof window === "undefined") {
    return { mode: "webhook", connectionName: "fastonmedcrm" };
  }
  try {
    const saved = localStorage.getItem(ZOHO_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed reading Zoho config", e);
  }
  return {
    mode: "webhook",
    connectionName: "fastonmedcrm",
  };
}

export function saveZohoConfig(config: ZohoConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ZOHO_CONFIG_KEY, JSON.stringify(config));
}

// ─── DATA NORMALIZATION HELPERS ─────────────────────────────────────────────

function mapOrgType(subType?: string, name?: string): OrgType {
  const check = (subType || name || "").toLowerCase();
  if (check.includes("hospital")) return "Hospital";
  if (check.includes("clinic") || check.includes("polyclinic")) return "Clinic";
  if (check.includes("lab") || check.includes("diagnostic")) return "Diagnostic Centre";
  if (check.includes("pharmacy")) return "Pharmacy";
  if (check.includes("ministry") || check.includes("govt") || check.includes("authority")) return "Government Institution";
  return "Hospital";
}

function mapDepartment(dept?: string, designation?: string): Department {
  const check = (dept || designation || "").toLowerCase();
  if (check.includes("biomed") || check.includes("engineer")) return "Biomedical Engineering";
  if (check.includes("purchas") || check.includes("procure") || check.includes("supply")) return "Purchase";
  if (check.includes("dr") || check.includes("doctor") || check.includes("clinic") || check.includes("surgeon")) return "Doctor";
  if (check.includes("admin")) return "Administration";
  if (check.includes("financ") || check.includes("account")) return "Finance";
  if (check.includes("it") || check.includes("tech")) return "IT";
  return "Management";
}

function mapInvoiceStatus(status: string): "Paid" | "Pending" | "Overdue" | "Draft" {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "overdue") return "Overdue";
  if (s === "draft") return "Draft";
  return "Pending";
}

// ─── SYNC LOGIC ─────────────────────────────────────────────────────────────

export function normalizeZohoData(payload: ZohoSyncPayload): {
  clients: Client[];
  people: ContactPerson[];
  invoices: Invoice[];
} {
  const rawContacts = payload.contacts || [];
  const rawInvoices = payload.invoices || [];

  const clients: Client[] = [];
  const people: ContactPerson[] = [];

  rawContacts.forEach((contact) => {
    const orgName = (contact.company_name || contact.contact_name || "Healthcare Facility").trim();
    const city = contact.billing_address?.city || "Dubai";
    const state = contact.billing_address?.state || "Dubai";
    const address = contact.billing_address?.address || "";
    const phone = contact.mobile || contact.phone || "";
    const email = contact.email || "";
    const vat = contact.tax_reg_no || contact.vat_reg_no || "";
    const revenue = contact.outstanding_receivable_amount || 0;

    const contactPersonsList: ContactPerson[] = [];

    if (contact.contact_persons && contact.contact_persons.length > 0) {
      contact.contact_persons.forEach((cp) => {
        const fullName = `${cp.first_name || ""} ${cp.last_name || ""}`.trim() || cp.email || "Contact Specialist";
        const personObj: ContactPerson = {
          id: cp.contact_person_id || `cp-${contact.contact_id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          name: fullName,
          designation: cp.designation || (cp.is_primary_contact ? "Primary Decision Maker" : "Procurement Specialist"),
          department: mapDepartment(cp.department, cp.designation),
          phone: cp.mobile || cp.phone || phone,
          whatsapp: cp.mobile || cp.phone || phone,
          email: cp.email || email,
          clientId: contact.contact_id,
          clientName: orgName,
          status: "Active at Organisation",
          previousOrganisations: [],
          lastContacted: new Date().toISOString().slice(0, 10),
        };
        contactPersonsList.push(personObj);
        people.push(personObj);
      });
    } else {
      // Create primary contact person from main contact
      const defaultPerson: ContactPerson = {
        id: `p-${contact.contact_id}`,
        name: contact.contact_name || "Key Officer",
        designation: "Key Contact / Representative",
        department: "Purchase",
        phone: contact.mobile || contact.phone || phone,
        whatsapp: contact.mobile || contact.phone || phone,
        email: contact.email || email,
        clientId: contact.contact_id,
        clientName: orgName,
        status: "Active at Organisation",
        previousOrganisations: [],
        lastContacted: new Date().toISOString().slice(0, 10),
      };
      contactPersonsList.push(defaultPerson);
      people.push(defaultPerson);
    }

    const clientObj: Client = {
      id: contact.contact_id,
      name: orgName,
      orgType: mapOrgType(contact.customer_sub_type, orgName),
      status: contact.status === "active" ? "Existing Customer" : "Prospect",
      address,
      city,
      state,
      phone,
      email,
      gst: vat,
      vatNumber: vat,
      website: contact.website,
      source: "Direct Enquiry",
      assignedTo: "Sales Team",
      createdAt: new Date().toISOString().slice(0, 10),
      contacts: contactPersonsList,
      purchases: [],
      requirements: [],
      totalRevenue: revenue,
    };

    clients.push(clientObj);
  });

  const invoices: Invoice[] = rawInvoices.map((inv) => ({
    id: inv.invoice_id,
    invoiceNumber: inv.invoice_number,
    clientId: inv.customer_id,
    clientName: inv.customer_name,
    amount: inv.total || 0,
    status: mapInvoiceStatus(inv.status),
    dueDate: inv.due_date || new Date().toISOString().slice(0, 10),
    createdAt: inv.date || new Date().toISOString().slice(0, 10),
    items: (inv.line_items || []).map((li) => ({
      product: li.name || li.item_name || "Medical Device",
      qty: li.quantity || 1,
      rate: li.rate || 0,
      amount: li.item_total || (li.quantity || 1) * (li.rate || 0),
    })),
  }));

  return { clients, people, invoices };
}

/**
 * Wipes dummy data and replaces it with live Zoho Books production data.
 */
export function applyZohoBooksData(payload: ZohoSyncPayload): {
  clientsCount: number;
  peopleCount: number;
  invoicesCount: number;
} {
  const { clients, people, invoices } = normalizeZohoData(payload);

  // Replace local storage with real data
  saveStoredClients(clients);
  saveStoredPeople(people);

  if (typeof window !== "undefined") {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
    
    // Save Sync Log
    const syncLog = {
      timestamp: new Date().toISOString(),
      clientsCount: clients.length,
      peopleCount: people.length,
      invoicesCount: invoices.length,
    };
    localStorage.setItem(ZOHO_SYNC_LOG_KEY, JSON.stringify(syncLog));

    // Update config stats
    const currentConfig = getZohoConfig();
    currentConfig.lastSyncedAt = new Date().toISOString();
    currentConfig.lastSyncStats = {
      clients: clients.length,
      people: people.length,
      invoices: invoices.length,
    };
    saveZohoConfig(currentConfig);

    // Notify all app components to refresh immediately
    window.dispatchEvent(new Event("fastonmed_clients_updated"));
    window.dispatchEvent(new Event("fastonmed_people_updated"));
    window.dispatchEvent(new Event("fastonmed_invoices_updated"));
  }

  return {
    clientsCount: clients.length,
    peopleCount: people.length,
    invoicesCount: invoices.length,
  };
}

/**
 * Completely clears all dummy data without inserting new data.
 */
export function clearAllDummyData(): void {
  saveStoredClients([]);
  saveStoredPeople([]);
  saveStoredLeads([]);

  if (typeof window !== "undefined") {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event("fastonmed_clients_updated"));
    window.dispatchEvent(new Event("fastonmed_people_updated"));
    window.dispatchEvent(new Event("fastonmed_leads_updated"));
    window.dispatchEvent(new Event("fastonmed_invoices_updated"));
  }
}
