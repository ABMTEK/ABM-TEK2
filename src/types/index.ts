export type UserRole =
  | 'customer'
  | 'admin'
  | 'technician'
  | 'storekeeper'
  | 'accountant'
  | 'service_advisor'
  | 'vendor'
  | 'super_admin'
  | string;

export type JobStatus =
  | 'received'
  | 'diagnosed'
  | 'repairing'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_paid';

export type QuoteStatus = 'draft' | 'pending_approval' | 'rejected' | 'converted' | 'cancelled';

export type InvoiceStatus = 'pending_approval' | 'approved' | 'in_progress' | 'settled' | 'void';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  workshopId?: string;
  connectedWorkshopIds?: string[];

  vendorStatus?: 'active' | 'pending_details' | 'pending_approval' | 'rejected';
  rejectionReason?: string;
  businessDetails?: {
    businessName: string;
    rcNumber: string;
    address: string;
    city: string;
    state: string;
    country: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    contactName?: string;
    contactRole?: string;
    nin?: string;
  };
  documents?: {
    ninImage?: string;
    proofOfAddress?: string;
    certificateOfIncorporation?: string;
  };

  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  pushToken?: string;

  selectedWorkshopIds?: string[];
  addedByWorkshopIds?: string[];

  birthday?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  userId: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusHistoryEntry {
  fromStatus: JobStatus;
  toStatus: JobStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
}

export interface Job {
  id: string;
  userId: string;
  vehicleId: string;
  workshopId: string;
  type: 'service' | 'complaint' | 'repair' | 'service_and_repair' | 'tow';
  issues?: string[];
  description: string;
  status: JobStatus;
  assignedTechnicianId?: string;
  technicianName?: string;
  assignedTechnicianIds?: string[];
  technicianNames?: string[];
  images?: string[];
  videos?: string[];
  scheduledDate?: Date;
  partsUsed?: PartUsed[];
  notes?: string;
  serviceCharge?: number;
  statusHistory?: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PartUsed {
  partId: string;
  partName: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentRecord {
  amount: number;
  date: Date;
  method: string;
  recordedBy?: string;
  recordedByName?: string;
  reference?: string;
  note?: string;
  entityType?: 'quote' | 'invoice';
  entityId?: string;
}

export interface PendingPayment {
  id: string;
  amount: number;
  method: string;
  recordedBy: string;
  recordedByName: string;
  date: Date;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface ApprovalEntry {
  approvedBy: string;
  approvedByName: string;
  approvedAmount: number;
  approvedAt: Date;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isAdditionalWork: boolean;
  addedAt: Date;
  approvedAt?: Date;
}

export interface QuoteLogEntry {
  action: 'create' | 'edit' | 'send' | 'reject' | 'approve' | 'convert' | 'other';
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface Quote {
  id: string;
  workshopId: string;
  jobId?: string;

  userId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerId?: string;

  items: QuoteItem[];
  subtotal: number;
  vatRate: number;
  vat: number;
  discount: number;
  total: number;

  status: QuoteStatus;
  convertedToInvoiceId?: string;
  rejectionReason?: string;
  history?: QuoteLogEntry[];

  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export interface Invoice {
  id: string;
  jobId?: string;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  workshopId: string;
  items: InvoiceItem[];
  pendingItems?: InvoiceItem[];
  subtotal: number;
  vat: number;
  vatRate?: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDate?: Date;
  dueDate?: Date;
  amountPaid?: number;
  paymentHistory?: PaymentRecord[];
  pendingPayments?: PendingPayment[];
  status: 'draft' | 'approved' | 'void';
  invoiceStatus?: InvoiceStatus;
  approvedAt?: Date;
  approvedBy?: string;
  approvalHistory?: ApprovalEntry[];
  sourceQuoteId?: string;
  lastUpdatedAt?: Date;
  wasUpdated?: boolean;
  createdAt: Date;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  inventoryItemId?: string;
  maxQty?: number;
}

export interface InventoryItem {
  id: string;
  workshopId: string;
  name: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier?: string;
  vendor?: string;
  sku?: string;
  costPrice?: number;
  sellingPrice?: number;
  unitIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransaction {
  id: string;
  workshopId: string;
  itemId: string;
  type: 'stock_in' | 'stock_out';
  quantity: number;
  reason: string;
  approvedBy?: string;
  createdAt: Date;
}

export interface MarketplaceProduct {
  id: string;
  vendorId: string;
  userId?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  images: string[];
  compatibility: string[];
  stock: number;
  brand?: string;
  rating?: number;
  reviews?: number;
  soldCount?: number;
  condition?: 'new' | 'used' | 'refurbished';
  approved: boolean;
  createdAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  products: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'shipment_verified' | 'delivered' | 'cancelled';
  deliveryMethod: 'delivery' | 'pickup';
  shippingAddress?: string;
  vendorIds?: string[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt: Date;
  payoutStatus?: 'pending' | 'processing' | 'paid' | 'failed';
  adminNotes?: string;
  monnifyPaymentDetails?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    reference: string;
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  vendorId?: string;
  image?: string;
}

export interface Workshop {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  subscriptionPlan: 'basic' | 'premium' | 'enterprise';
  subscriptionExpiry?: Date;
  settings: {
    vatRate: number;
    currency: string;
  };
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message?: string;
  body?: string;
  type: 'job_update' | 'payment' | 'inventory' | 'general' | 'order';
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CustomerRegistration {
  id: string;
  email: string;
  name: string;
  phone: string;
  registrationCode: string;
  registeredBy: string;
  workshopId: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
}

export interface StaffInvitation {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  invitationCode: string;
  invitedBy: string;
  workshopId: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
  expiresAt?: Date;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text?: string;
  imageUrl?: string;
  createdAt: Date;
  readBy: string[];
}

export interface RolePermissions {
  role: UserRole;
  permissions: {
    canManageJobs: boolean;
    canViewInventory: boolean;
    canManageInventory: boolean;
    canViewFinance: boolean;
    canManageFinance: boolean;
    canManageStaff: boolean;
    canManageSettings: boolean;
    canViewReports: boolean;
  };
}
