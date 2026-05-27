
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  Timestamp,
  onSnapshot,
  QueryConstraint,
  writeBatch,
  arrayUnion,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';
import { sendPasswordResetEmail as firebaseSendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { emailService } from './emailService';
import { db, storage, auth, functions } from '@/lib/firebase';
import {
  User,
  Vehicle,
  Job,
  Invoice,
  InventoryItem,
  StockTransaction,
  MarketplaceProduct,
  Order,
  Workshop,
  Notification,
  CustomerRegistration,
  StaffInvitation,
  ChatMessage,
  RolePermissions,
  Quote,
  QuoteItem,
  QuoteStatus,
  InvoiceStatus,
} from '@/types';

const uploadImageToMethods = async (file: File | Blob, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

const adjustStock = async (items: { partId?: string; inventoryItemId?: string; quantity: number }[], workshopId: string, type: 'deduct' | 'restore') => {
  const batch = writeBatch(db);
  for (const item of items) {
    const itemId = item.partId || item.inventoryItemId;
    if (!itemId) continue;

    const itemRef = doc(db, 'inventory', itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) continue;

    const currentQty = itemSnap.data().quantity || 0;
    const newQty = type === 'deduct'
      ? Math.max(0, currentQty - item.quantity)
      : currentQty + item.quantity;

    batch.update(itemRef, {
      quantity: newQty,
      updatedAt: Timestamp.now()
    });

    const transRef = doc(collection(db, 'stockTransactions'));
    batch.set(transRef, {
      workshopId,
      itemId,
      type: type === 'deduct' ? 'stock_out' : 'stock_in',
      quantity: item.quantity,
      reason: `Automated ${type} from document update`,
      createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
};

export const firebaseService = {
  async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseSendPasswordResetEmail(auth, email);
  },

  sanitizeUser(data: any): any {
    if (!data) return data;
    const sanitized = { ...data };
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.rawPassword;
    return sanitized;
  },

  async getUser(userId: string): Promise<User | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = this.sanitizeUser(docSnap.data());
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as User;
    }
    return null;
  },

  async getUsersByWorkshop(workshopId?: string): Promise<User[]> {
    const constraints: QueryConstraint[] = [];
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    const directQuery = query(collection(db, 'users'), ...constraints);

    const selectedConstraints: QueryConstraint[] = [];
    if (workshopId) {
      selectedConstraints.push(where('selectedWorkshopIds', 'array-contains', workshopId));
    }
    const selectedQuery = query(collection(db, 'users'), ...selectedConstraints);

    const [directSnapshot, selectedSnapshot] = await Promise.all([
      getDocs(directQuery),
      getDocs(selectedQuery)
    ]);

    const userMap = new Map<string, User>();

    const processDoc = (docSnap: any) => {
      if (!userMap.has(docSnap.id)) {
        const data = this.sanitizeUser(docSnap.data());
        userMap.set(docSnap.id, {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as User);
      }
    };

    directSnapshot.docs.forEach(processDoc);
    selectedSnapshot.docs.forEach(processDoc);

    return Array.from(userMap.values());
  },

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async createCustomer(data: { name: string; phone: string; email?: string; birthday?: string; workshopId: string }): Promise<string> {
    const docRef = doc(collection(db, 'users'));
    await setDoc(docRef, {
      name: data.name,
      phone: data.phone,
      email: data.email || '',
      birthday: data.birthday || '',
      role: 'customer',
      workshopId: data.workshopId,
      connectedWorkshopIds: [data.workshopId],
      selectedWorkshopIds: [data.workshopId],
      addedByWorkshopIds: [data.workshopId],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getInvoices(userId?: string, workshopId?: string): Promise<Invoice[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'invoices'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        paymentDate: data.paymentDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        status: data.status || 'draft',
        approvedBy: data.approvedBy,
        amountPaid: data.amountPaid || 0,
        paymentHistory: Array.isArray(data.paymentHistory)
          ? data.paymentHistory.map((record: any) => ({
            ...record,
            date: record.date?.toDate() || new Date(),
          }))
          : [],
      };
    }) as Invoice[];
  },

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const docRef = doc(db, 'invoices', invoiceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        paymentDate: data.paymentDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        status: data.status || 'draft',
        approvedBy: data.approvedBy,
        amountPaid: data.amountPaid || 0,
        paymentHistory: Array.isArray(data.paymentHistory)
          ? data.paymentHistory.map((record: any) => ({
            ...record,
            date: record.date?.toDate() || new Date(),
          }))
          : [],
      } as Invoice;
    }
    return null;
  },

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
    const timestamp = Date.now().toString();
    const lastFour = timestamp.slice(-4);
    const customerIdentifier = invoice.userId ? invoice.userId.slice(0, 8) : 'DIRECT';
    const invoiceId = `INV-${customerIdentifier}-${lastFour}`;

    const cleanInvoice = Object.entries(invoice).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    const docRef = doc(db, 'invoices', invoiceId);
    await setDoc(docRef, {
      ...cleanInvoice,
      status: cleanInvoice.status || 'draft',
      createdAt: Timestamp.now(),
    });

    const inventoryItems = invoice.items.filter(item => item.inventoryItemId);
    if (inventoryItems.length > 0) {
      await adjustStock(inventoryItems, invoice.workshopId, 'deduct');
    }

    return invoiceId;
  },

  async updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<void> {
    const docRef = doc(db, 'invoices', invoiceId);
    const oldInvoiceSnap = await getDoc(docRef);
    const oldInvoice = oldInvoiceSnap.data() as Invoice;

    const updateData: any = { ...data };
    if (updateData.dueDate) updateData.dueDate = Timestamp.fromDate(updateData.dueDate);
    if (updateData.paymentDate) updateData.paymentDate = Timestamp.fromDate(updateData.paymentDate);
    if (updateData.approvedAt) updateData.approvedAt = Timestamp.fromDate(updateData.approvedAt);
    if (updateData.paymentHistory) {
      updateData.paymentHistory = updateData.paymentHistory.map((record: any) => ({
        ...record,
        date: Timestamp.fromDate(record.date),
      }));
    }

    if (data.items && oldInvoice.items) {
      const oldInvItems = oldInvoice.items.filter(i => i.inventoryItemId);
      const newInvItems = data.items.filter(i => i.inventoryItemId);
      await adjustStock(oldInvItems, oldInvoice.workshopId, 'restore');
      await adjustStock(newInvItems, oldInvoice.workshopId, 'deduct');

      const newTotal = data.total ?? oldInvoice.total;
      const amountPaid = data.amountPaid ?? oldInvoice.amountPaid ?? 0;
      if (oldInvoice.paymentStatus === 'paid' && newTotal > amountPaid) {
        updateData.paymentStatus = 'partially_paid';
      }
    }

    await updateDoc(docRef, updateData);
  },

  async approveInvoice(invoiceId: string, approvedBy: string, explicitDueDate?: Date, isOfflineOverride: boolean = false): Promise<void> {
    const now = new Date();
    let dueDate = explicitDueDate;

    if (!dueDate) {
      dueDate = new Date();
      dueDate.setDate(now.getDate() + 7);
    }

    const docRef = doc(db, 'invoices', invoiceId);
    await updateDoc(docRef, {
      status: 'approved',
      invoiceStatus: 'approved',
      approvedBy,
      approvedAt: now,
      dueDate: dueDate,
      wasUpdated: isOfflineOverride,
      updatedAt: Timestamp.now(),
    });
  },

  async getInventoryItems(workshopId?: string): Promise<InventoryItem[]> {
    const constraints: QueryConstraint[] = [];
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    const q = query(
      collection(db, 'inventory'),
      ...constraints
    );

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as InventoryItem[];

    return items.sort((a, b) => {
      const aName = a.name?.toLowerCase() || '';
      const bName = b.name?.toLowerCase() || '';
      return aName.localeCompare(bName);
    });
  },

  async createInventoryItem(
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'inventory'), {
      ...item,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateInventoryItem(itemId: string, data: Partial<InventoryItem>): Promise<void> {
    const docRef = doc(db, 'inventory', itemId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async getOrders(userId?: string, vendorId?: string): Promise<Order[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'orders'), ...constraints);
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as Order[];

    if (vendorId) {
      const vendorProductIds = new Set<string>();
      const vendorProductsQuery = query(
        collection(db, 'marketplaceProducts'),
        where('vendorId', '==', vendorId)
      );
      const vendorProductsSnapshot = await getDocs(vendorProductsQuery);
      vendorProductsSnapshot.docs.forEach((doc) => {
        vendorProductIds.add(doc.id);
      });

      orders = orders.filter((order) =>
        order.products.some((item) => vendorProductIds.has(item.productId))
      );
    }
    return orders;
  },

  async getOrder(orderId: string): Promise<Order | null> {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
      } as Order;
    }
    return null;
  },

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  },

  async updateOrderPayoutStatus(orderId: string, status: 'pending' | 'processing' | 'paid' | 'failed', adminNotes?: string): Promise<void> {
    const docRef = doc(db, 'orders', orderId);
    const updateData: any = {
      payoutStatus: status,
      updatedAt: Timestamp.now(),
    };
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    await updateDoc(docRef, updateData);
  },

  async getWorkshop(workshopId: string): Promise<Workshop | null> {
    const docRef = doc(db, 'workshops', workshopId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        subscriptionExpiry: docSnap.data().subscriptionExpiry?.toDate(),
      } as Workshop;
    }
    return null;
  },

  async createQuote(quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'quotes'), {
      ...quote,
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const invItems = (quote.items || []).filter(i => (i as any).inventoryItemId);
    if (invItems.length > 0) {
      await adjustStock(invItems as any, quote.workshopId, 'deduct');
    }

    return docRef.id;
  },

  async getQuote(quoteId: string): Promise<Quote | null> {
    const docRef = doc(db, 'quotes', quoteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        sentAt: data.sentAt?.toDate(),
        items: Array.isArray(data.items) ? data.items.map((item: any) => ({
          ...item,
          addedAt: item.addedAt?.toDate(),
          approvedAt: item.approvedAt?.toDate(),
        })) : [],
        history: Array.isArray(data.history) ? data.history.map((log: any) => ({
          ...log,
          timestamp: log.timestamp?.toDate(),
        })) : [],
      } as Quote;
    }
    return null;
  },

  async getQuotes(workshopId?: string, userId?: string): Promise<Quote[]> {
    const constraints: QueryConstraint[] = [];
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'quotes'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        sentAt: data.sentAt?.toDate(),
        items: Array.isArray(data.items) ? data.items.map((item: any) => ({
          ...item,
          addedAt: item.addedAt?.toDate(),
          approvedAt: item.approvedAt?.toDate(),
        })) : [],
        history: Array.isArray(data.history) ? data.history.map((log: any) => ({
          ...log,
          timestamp: log.timestamp?.toDate(),
        })) : [],
      };
    }) as Quote[];
  },

  async updateQuote(quoteId: string, data: Partial<Quote>): Promise<void> {
    const docRef = doc(db, 'quotes', quoteId);
    const oldQuoteSnap = await getDoc(docRef);
    const oldQuote = oldQuoteSnap.data() as Quote;

    if (data.items && oldQuote.items) {
      const oldInvItems = oldQuote.items.filter(i => (i as any).inventoryItemId);
      const newInvItems = data.items.filter(i => (i as any).inventoryItemId);
      await adjustStock(oldInvItems as any, oldQuote.workshopId, 'restore');
      await adjustStock(newInvItems as any, oldQuote.workshopId, 'deduct');
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async convertQuoteToInvoice(quoteId: string, userId: string, userName: string): Promise<string> {
    const quote = await this.getQuote(quoteId);
    if (!quote) throw new Error("Quote not found");

    const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
      jobId: quote.jobId,
      userId: quote.userId,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      customerEmail: quote.customerEmail,
      customerAddress: quote.customerAddress,
      workshopId: quote.workshopId,
      items: quote.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      })),
      subtotal: quote.subtotal,
      vat: quote.vat,
      vatRate: quote.vatRate,
      discount: quote.discount,
      total: quote.total,
      paymentStatus: 'pending',
      status: 'approved',
      invoiceStatus: 'approved',
      approvedAt: new Date(),
      approvedBy: userId,
      sourceQuoteId: quoteId,
    };

    const invoiceId = await this.createInvoice(invoiceData);

    await this.updateQuote(quoteId, {
      status: 'converted',
      convertedToInvoiceId: invoiceId,
      history: [
        ...(quote.history || []),
        {
          action: 'convert',
          description: `Converted to invoice #${invoiceId.slice(-4)} by admin override`,
          userId,
          userName,
          timestamp: new Date()
        }
      ]
    } as any);

    return invoiceId;
  },

  async getJobs(userId?: string, workshopId?: string, status?: string[]): Promise<Job[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    if (status && status.length > 0) {
      constraints.push(where('status', 'in', status));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'jobs'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      scheduledDate: doc.data().scheduledDate?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
    })) as Job[];
  },

  async getJob(jobId: string): Promise<Job | null> {
    const docRef = doc(db, 'jobs', jobId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        scheduledDate: data.scheduledDate?.toDate(),
        completedAt: data.completedAt?.toDate(),
        statusHistory: data.statusHistory?.map((entry: any) => ({
          ...entry,
          changedAt: entry.changedAt?.toDate(),
        })),
      } as Job;
    }
    return null;
  },

  async createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'jobs'), {
      ...job,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    if (job.partsUsed && job.partsUsed.length > 0) {
      await adjustStock(job.partsUsed, job.workshopId, 'deduct');
    }

    return docRef.id;
  },

  async updateJob(jobId: string, data: Partial<Job>): Promise<void> {
    const docRef = doc(db, 'jobs', jobId);
    const oldJobSnap = await getDoc(docRef);
    const oldJob = oldJobSnap.data() as Job;

    if (data.partsUsed && oldJob.partsUsed) {
      await adjustStock(oldJob.partsUsed, oldJob.workshopId, 'restore');
      await adjustStock(data.partsUsed, oldJob.workshopId, 'deduct');
    } else if (data.partsUsed) {
      await adjustStock(data.partsUsed, oldJob.workshopId, 'deduct');
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async updateJobStatus(jobId: string, status: string, changedByName: string): Promise<void> {
    const docRef = doc(db, 'jobs', jobId);
    const jobSnap = await getDoc(docRef);
    if (!jobSnap.exists()) throw new Error('Job not found');

    const jobData = jobSnap.data();
    const historyEntry = {
      fromStatus: jobData.status,
      toStatus: status,
      changedAt: Timestamp.now(),
      changedByName,
    };

    await updateDoc(docRef, {
      status,
      statusHistory: arrayUnion(historyEntry),
      updatedAt: Timestamp.now(),
      ...(status === 'completed' ? { completedAt: Timestamp.now() } : {}),
    });
  },

  async getVehicles(userId: string): Promise<Vehicle[]> {
    const q = query(
      collection(db, 'vehicles'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const vehicles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Vehicle[];

    return vehicles.sort((a, b) => {
      const aDate = a.createdAt?.getTime() || 0;
      const bDate = b.createdAt?.getTime() || 0;
      return bDate - aDate;
    });
  },

  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    const docRef = doc(db, 'vehicles', vehicleId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
      } as Vehicle;
    }
    return null;
  },

  async addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'vehicles'), {
      ...vehicle,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateVehicle(vehicleId: string, data: Partial<Vehicle>): Promise<void> {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async getStaffInvitations(workshopId: string): Promise<StaffInvitation[]> {
    const q = query(
      collection(db, 'staffInvitations'),
      where('workshopId', '==', workshopId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        usedAt: data.usedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as StaffInvitation;
    });
  },

  async createStaffInvitation(
    email: string,
    name: string,
    role: string,
    invitedBy: string,
    workshopId: string,
    phone?: string
  ): Promise<{ id: string; invitationCode: string }> {
    const invitationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const invitationData = {
      email: email.toLowerCase().trim(),
      name,
      ...(phone ? { phone } : {}),
      role,
      invitationCode,
      invitedBy,
      workshopId,
      used: false,
    };
    const docRef = await addDoc(collection(db, 'staffInvitations'), {
      ...invitationData,
      createdAt: Timestamp.now(),
    });

    (async () => {
      try {
        let workshopName = '';
        const wsDoc = await getDoc(doc(db, 'workshops', workshopId));
        if (wsDoc.exists()) {
          workshopName = wsDoc.data().name || '';
        }
        await emailService.sendStaffInvite(email, name, invitationCode, role, workshopName);
      } catch (err) {
        console.error('Failed to send invitation email:', err);
      }
    })();

    return { id: docRef.id, invitationCode };
  },

  async cancelStaffInvitation(invitationId: string): Promise<void> {
    const docRef = doc(db, 'staffInvitations', invitationId);
    await deleteDoc(docRef);
  },

  async getWorkshopPermissions(workshopId: string): Promise<Record<string, RolePermissions['permissions']>> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Record<string, RolePermissions['permissions']>;
    }
    return {};
  },

  async updateWorkshopPermissions(
    workshopId: string,
    role: string,
    permissions: RolePermissions['permissions']
  ): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    await setDoc(docRef, { [role]: permissions }, { merge: true });
  },

  async deleteWorkshopRole(workshopId: string, role: string): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    await updateDoc(docRef, {
      [role]: deleteField()
    });
  },

  async deleteUser(userId: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await deleteDoc(docRef);
  },

  async approveVendor(userId: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      vendorStatus: 'active',
      updatedAt: Timestamp.now(),
    });
  },

  async rejectVendor(userId: string, reason?: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      vendorStatus: 'rejected',
      rejectionReason: reason || 'Application declined by admin.',
      updatedAt: Timestamp.now(),
    });
  },

  async getUsersByRole(role: string, workshopId: string): Promise<User[]> {
    const directQuery = query(
      collection(db, 'users'),
      where('role', '==', role),
      where('workshopId', '==', workshopId)
    );
    const arrayQuery = query(
      collection(db, 'users'),
      where('role', '==', role),
      where('selectedWorkshopIds', 'array-contains', workshopId)
    );
    const [directSnapshot, arraySnapshot] = await Promise.all([
      getDocs(directQuery),
      getDocs(arrayQuery)
    ]);
    const userMap = new Map<string, User>();
    const processDoc = (docSnap: any) => {
      const data = docSnap.data();
      if (!userMap.has(docSnap.id)) {
        userMap.set(docSnap.id, {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as User);
      }
    };
    directSnapshot.docs.forEach(processDoc);
    arraySnapshot.docs.forEach(processDoc);
    return Array.from(userMap.values()).sort((a, b) =>
      (a.name?.toLowerCase() || '').localeCompare(b.name?.toLowerCase() || '')
    );
  },

  async getWorkshops(): Promise<any[]> {
    const q = query(collection(db, 'workshops'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  },

  async createWorkshop(data: {
    name: string;
    subscriptionPlan: string;
    subscriptionStatus?: string;
    subscriptionExpiry?: Date;
  }): Promise<string> {
    const expiryDate = data.subscriptionExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const docRef = await addDoc(collection(db, 'workshops'), {
      name: data.name,
      subscriptionStatus: data.subscriptionStatus || 'active',
      subscriptionPlan: data.subscriptionPlan,
      subscriptionExpiry: Timestamp.fromDate(expiryDate),
      settings: { currency: 'NGN', vatRate: 7.5 },
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateWorkshopSubscription(
    workshopId: string,
    status: string,
    expiry: Date
  ): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId);
    await updateDoc(docRef, {
      subscriptionStatus: status,
      subscriptionExpiry: Timestamp.fromDate(expiry),
    });
  },

  async deleteWorkshop(workshopId: string): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId);
    await deleteDoc(docRef);
  },
};
