export type EntityType = "Company" | "Individual";

export type OrgType =
  | "Hospital"
  | "Clinic"
  | "Laboratory"
  | "Pharmacy"
  | "Diagnostic Centre"
  | "Government Institution"
  | "Medical Equipment Trader"
  | "Doctor / Practitioner"
  | "Individual Contact"
  | "Day Surgery Centre"
  | (string & {});

export type ClientStatus =
  | "Lead"
  | "Prospect"
  | "Existing Customer"
  | "Lost Customer"

export type Department =
  | "Purchase"
  | "Biomedical Engineering"
  | "Administration"
  | "Finance"
  | "Doctor"
  | "Management"
  | "IT"
  | (string & {});

export type ContactStatus =
  | "Active at Organisation"
  | "Changed Organisation"
  | "Independent / Consultant";

export type CareerHistoryItem = {
  organisationName: string;
  role: string;
  period?: string;
  leftDate?: string;
  reasonForLeaving?: string;
};

export type ContactPerson = {
  id: string;
  clientId?: string;
  clientName?: string;
  name: string;
  designation: string;
  department: Department;
  phone: string;
  whatsapp?: string;
  email: string;
  linkedin?: string;
  notes?: string;
  avatar?: string;
  photo?: string;
  lastContacted?: string;
  status?: ContactStatus;
  previousOrganisations?: CareerHistoryItem[];
  createdBy?: string;
  createdById?: string;
  createdAt?: string;
};

export type Purchase = {
  id: string
  clientId: string
  productName: string
  model: string
  brand: string
  quantity: number
  purchaseDate: string
  invoiceNumber: string
  warrantyPeriod: string
  installationDate: string
  assignedEngineer: string
  amount: number
  createdBy?: string
  createdById?: string
}

export type Requirement = {
  id: string
  clientId: string
  product: string
  quantity: number
  budget?: number
  requirementDate: string
  priority: "Low" | "Medium" | "High" | "Critical"
  salesPersonId: string
  status: "Open" | "In Progress" | "Quoted" | "Closed"
  notes?: string
  createdBy?: string
  createdById?: string
}

export type Client = {
  id: string
  name: string
  entityType?: EntityType
  orgType: OrgType
  status: ClientStatus
  address: string
  city: string
  state: string
  place?: string
  emirate?: string
  photo?: string
  logo?: string
  pincode?: string
  website?: string
  gst?: string
  vatNumber?: string
  phone: string
  phones?: string[]
  email: string
  emails?: string[]
  source: LeadSource
  connectedAs?: string[]
  assignedTo: string
  createdAt: string
  createdBy?: string
  createdById?: string
  updatedBy?: string
  updatedById?: string
  updatedAt?: string
  contacts: ContactPerson[]
  purchases: Purchase[]
  requirements: Requirement[]
  tags?: string[]
  totalRevenue: number
  googleMapsUrl?: string
  operationalStatus?: "Running" | "Closed" | "Upcoming" | string
  notes?: string
}

export type OperationalStatus = "Running" | "Closed" | "Upcoming";

export type PipelineStage =
  | "New Lead"
  | "Contacted"
  | "Quotation Forwarded"
  | "Approved"
  | "Rejected"
  | "Follow Up Later"
  | "Requirement Review"
  | "Qualified"
  | "Proposal Sent"
  | "Negotiation"
  | "Waiting Review"
  | "Won"
  | "Lost"
  | (string & {});

export type LeadSource =
  | "Meta Ads"
  | "Google Ads"
  | "Website"
  | "Referral"
  | "Exhibition"
  | "Direct Enquiry"
  | "Sales Visit"
  | "WhatsApp"

export type LeadComment = {
  id: string
  author: string
  text: string
  createdAt: string
}

export type LeadContact = {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  role?: string;
  isPrimary?: boolean;
};

export type Lead = {
  id: string
  clientId?: string
  clientName: string
  contactName: string
  phone: string
  email: string
  contacts?: LeadContact[]
  enquiryType?: "Sales" | "Service"
  serviceType?: string
  category?: ProductCategory | string
  product: string
  quantity: number
  estimatedValue: number
  stage: PipelineStage
  source: LeadSource
  referredBy?: string
  assignedTo: string
  assignedToId: string
  priority: "Low" | "Medium" | "High" | "Critical"
  notes: string
  quotationNumber?: string
  quotationValue?: number
  quotedItems?: Array<{ product: string; price: number; quantity?: number }>
  nextFollowUp?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdById?: string
  lostReason?: string
  comments?: LeadComment[]
}

export type ProductCategory =
  | "ICU Equipment"
  | "OT Equipment"
  | "Diagnostic Equipment"
  | "Laboratory Equipment"
  | "Patient Monitoring"
  | "Imaging Equipment"
  | "Dental Equipment"
  | "Physiotherapy Equipment"
  | "Surgical Equipment"
  | "Sterilization"
  | (string & {});

export type ProductTraderOffer = {
  traderCompanyId: string;
  traderCompanyName: string;
  offeringPrice?: number;
  traderPriceMin?: number;
  traderPriceMax?: number;
  deliveryLeadTime?: string;
  warrantyPeriod?: string;
  notes?: string;
};

export type Product = {
  id: string
  name: string
  category: ProductCategory
  brand: string
  model: string
  supplier: string
  traderCompanyId?: string
  traderCompanyName?: string
  deliveryLeadTime?: string // e.g. "Immediate (Ex-Stock Dubai)", "3 - 5 Days (UAE Stock)", "1 - 2 Weeks"
  traderPriceMin?: number // e.g. 30000
  traderPriceMax?: number // e.g. 35000
  traders?: ProductTraderOffer[] // Multiple traders with offering prices
  purchaseCost: number
  sellingPrice: number
  vatStatus?: "5% Standard Rate" | "0% Zero-Rated" | "Exempt" | "Inclusive of 5% VAT" | string
  warrantyPeriod: string
  amcAvailable: boolean
  specifications: Record<string, string>
  inStock: number
  image?: string
  description: string
  tags?: string[]
  productUrl?: string
  slug?: string
  sku?: string
  status?: "publish" | "draft" | "private" | "auto-draft" | string
  regularPrice?: number
  salePrice?: number | null
  stockStatus?: string
  manageStock?: boolean
  categories?: string[]
  galleryImages?: string[]
  shortDescription?: string
  wordpressSource?: {
    wordpressId: number
    postType: "product" | "product_variation"
    content: string
    excerpt: string
    [key: string]: unknown
  }
}

export interface CompanyContactPerson {
  id?: string
  name: string
  role?: string
  phone?: string
  email?: string
  isPrimary?: boolean
}

export interface ProcurementCompany {
  id: string
  sourceClientId?: string
  name: string
  origin: string
  uaeOffice: string
  partnership: "Exclusive Partner" | "Authorized Distributor" | "Channel Partner" | "Certified Dealer"
  equipmentLine: string
  suppliedCategories: ProductCategory[]
  suppliedProducts?: string[]
  deliveryLeadTime: string // e.g. "Immediate (Ex-Stock Dubai)", "3 - 5 Days"
  priceRangeText: string // e.g. "AED 12,000 - 85,000"
  productCount: number
  totalVolume: number
  contactPerson: string
  contactRole: string
  phone: string
  email: string
  website: string
  flag: string
  contacts?: CompanyContactPerson[]
}

export type ServiceStatus =
  | "New Request"
  | "Assigned"
  | "Visit Scheduled"
  | "Under Repair"
  | "Waiting Parts"
  | "Completed"
  | "Closed"

export type ServiceTicket = {
  id: string
  ticketNumber: string
  clientId: string
  clientName: string
  concernedPerson?: string
  contactPhone?: string
  serviceType?: string
  equipment: string
  model: string
  serialNumber: string
  complaint: string
  priority: "Low" | "Medium" | "High" | "Critical"
  status: ServiceStatus
  assignedEngineerId: string
  assignedEngineerName: string
  visitDate?: string
  spareParts?: string[]
  engineerNotes?: string
  customerFeedback?: number
  createdAt: string
  resolvedAt?: string
  amcCovered: boolean
}

export type AMCStatus = "Active" | "Expired" | "Expiring Soon" | "Pending Renewal"

export type AMCContract = {
  id: string
  title?: string
  contractNumber: string
  typeOfService?: string
  clientId: string
  clientName: string
  organisation?: string
  orgType?: string
  equipments: {
    name: string
    model: string
    serialNumber: string
  }[]
  startDate: string
  endDate: string
  expiryDate?: string
  amount: number
  value?: number
  existingContractor?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  paymentStatus: "Paid" | "Pending" | "Overdue"
  status: AMCStatus
  serviceSchedule: string[]
  assignedEngineerId: string
  notes?: string
  createdBy?: string
  createdById?: string
}

export type EmployeeRole =
  | "Super Admin"
  | "Operations Manager"
  | "Client Relations"
  | "Sales Executive"
  | "Sales Manager"
  | "Biomedical Engineer"
  | "Service Engineer"
  | "Installation Engineer"
  | "Admin"
  | "Finance"
  | "Director"
  | "Staff"

export type Employee = {
  id: string
  name: string
  role: EmployeeRole
  department: string
  phone: string
  email: string
  joiningDate: string
  avatar?: string
  assignedClients: string[]
  performance: {
    leadsAssigned: number
    dealsClosed: number
    revenue: number
    serviceTickets: number
    rating: number
  }
  status: "Active" | "Inactive"
}

export type TaskType =
  | "Call"
  | "Site Visit"
  | "Demo"
  | "Installation"
  | "Service Visit"
  | "Meeting"
  | "Follow-up"
  | (string & {});

export type TaskPriority = "Low" | "Medium" | "High";

export type TaskStatus =
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Cancelled"
  | "Under Review"
  | "Edit / Rework"
  | "Approved"
  | "Declined"
  | (string & {});

export type Task = {
  declineReason?: string
  declinedAt?: string
  id: string
  title: string
  type: TaskType
  assignedTo: string
  assignedToId: string
  clientId?: string
  clientName?: string
  createdBy?: string
  createdById?: string
  dueDate: string
  dueTime?: string
  priority: TaskPriority
  status: TaskStatus
  notes?: string
  createdAt: string
  completedDate?: string
  completedAt?: string
  serviceTicketId?: string
}

export type Campaign = {
  id: string
  name: string
  platform: "Meta" | "Google"
  status: "Active" | "Paused" | "Ended"
  budget: number
  spend: number
  leads: number
  conversions: number
  costPerLead: number
  startDate: string
  endDate?: string
  objective: string
}

export type Notification = {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  read: boolean
  createdAt: string
  link?: string
}

export type Invoice = {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  orderNumber?: string
  amount: number
  balanceDue?: number
  status: "Paid" | "Pending" | "Overdue" | "Draft" | "Partially Paid" | "Void" | (string & {})
  dueDate: string
  createdAt: string
  items: {
    product: string
    qty: number
    rate: number
    amount: number
  }[]
}

export type ClientTimelineEvent = {
  id: string
  clientId: string
  clientName: string
  source: "Zoho Books" | "FastonMed CRM"
  type: "quote" | "invoice" | "contact" | "system"
  title: string
  description: string
  date: string
  time?: string
  transactionId?: string
  transactionNumber?: string
  status?: string
  amount?: number
}

export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Expired"
  | (string & {})

export type QuotationItem = {
  id: string
  product: string
  description?: string
  qty: number
  rate: number
  discount?: number
  taxRate?: number
  amount: number
}

export type Quotation = {
  id: string
  quotationNumber: string
  referenceNumber?: string
  clientId: string
  clientName: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  date: string
  validUntil: string
  status: QuotationStatus
  items: QuotationItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  notes?: string
  terms?: string
  preparedBy?: string
  convertedToInvoiceId?: string
  createdAt: string
  updatedAt?: string
}
