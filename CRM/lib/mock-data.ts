import type {
  Client,
  Lead,
  Product,
  ServiceTicket,
  AMCContract,
  Employee,
  Task,
  Campaign,
  Notification,
  Invoice,
} from "@/types"

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

export const mockEmployees: Employee[] = []

// ─── CLIENTS (UAE HEALTHCARE INSTITUTIONS) ──────────────────────────────────

export const mockClients: Client[] = [];

// ─── LEADS / PIPELINE (UAE DEALS) ───────────────────────────────────────────

export const mockLeads: Lead[] = [];

// ─── PRODUCTS (PRICED IN AED) ───────────────────────────────────────────────

export const mockProducts: Product[] = [];


// ─── SERVICE TICKETS (UAE HOSPITALS) ────────────────────────────────────────

export const mockServiceTickets: ServiceTicket[] = []

// ─── AMC CONTRACTS (PRICED IN AED) ──────────────────────────────────────────

export const mockAMCContracts: AMCContract[] = []

// ─── TASKS (UAE VENUES & CLIENTS) ───────────────────────────────────────────

export const mockTasks: Task[] = [];

// ─── CAMPAIGNS (UAE MARKET TARGETING) ───────────────────────────────────────

export const mockCampaigns: Campaign[] = []

// ─── NOTIFICATIONS (UAE HEALTHCARE & AED REVENUE) ───────────────────────────

export const mockNotifications: Notification[] = []

// ─── INVOICES (PRICED IN AED WITH 5% UAE VAT) ───────────────────────────────

export const mockInvoices: Invoice[] = []

export const monthlyRevenueData: {month:string;revenue:number;target:number}[] = [];
export const leadSourceData: {name:string;value:number;color:string}[] = [];
export const pipelineData: {stage:string;count:number;value:number}[] = [];
export const productSalesData: {product:string;sales:number;revenue:number}[] = [];
