/**
 * ABMTEK — Zoho → Firebase Migration Script
 * Imports customers, invoices, and vehicles from Zoho Books into Firebase
 *
 * Run: node migrate-zoho.mjs
 */

import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, doc, setDoc, writeBatch, Timestamp, getDoc
} from 'firebase/firestore';
import { readFileSync } from 'fs';

// ── Firebase Config (your abmtek-wms project) ───────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDF8LCeU78__yuC2PJ-4wlwgsu6ypWmTpM",
    authDomain: "abmtek-wms.firebaseapp.com",
    projectId: "abmtek-wms",
    storageBucket: "abmtek-wms.firebasestorage.app",
    messagingSenderId: "377439900182",
    appId: "1:377439900182:web:7209c334955fd71236db37",
};

const WORKSHOP_ID = "abmtek-workshop";
const ADMIN_USER_ID = "nP95fUhDuMN4oo3kF4zca6ZUofs1"; // your Firebase Auth UID

// ── Init Firebase ────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Load Zoho Data ───────────────────────────────────────────────────────────
console.log("📂 Loading Zoho data files...");
const contacts = JSON.parse(readFileSync('./zoho-contacts.json', 'utf8'));
const invoices = JSON.parse(readFileSync('./zoho-invoices.json', 'utf8'));
console.log(`   ✓ ${contacts.length} contacts`);
console.log(`   ✓ ${invoices.length} invoices`);

// ── Helpers ──────────────────────────────────────────────────────────────────
function toTimestamp(dateStr) {
    if (!dateStr) return Timestamp.now();
    try { return Timestamp.fromDate(new Date(dateStr)); }
    catch { return Timestamp.now(); }
}

function parseVehicle(carBrandStr, customerId, customerName) {
    if (!carBrandStr || carBrandStr.trim() === '') return null;
    const str = carBrandStr.trim();

    // Extract plate number if present e.g. "G 63 (ABJ-242FF)"
    const plateMatch = str.match(/\(([A-Z0-9\-]+)\)/);
    const licensePlate = plateMatch ? plateMatch[1] : '';
    const modelPart = str.replace(/\([^)]*\)/g, '').trim();

    // Determine make
    const MAKES = {
        'MERCEDES': 'Mercedes-Benz', 'G WAGON': 'Mercedes-Benz', 'G63': 'Mercedes-Benz',
        'G 63': 'Mercedes-Benz', 'G550': 'Mercedes-Benz', 'C300': 'Mercedes-Benz',
        'C350': 'Mercedes-Benz', 'C200': 'Mercedes-Benz', 'C180': 'Mercedes-Benz',
        'E350': 'Mercedes-Benz', 'E300': 'Mercedes-Benz', 'E200': 'Mercedes-Benz',
        'E250': 'Mercedes-Benz', 'E400': 'Mercedes-Benz', 'S350': 'Mercedes-Benz',
        'S500': 'Mercedes-Benz', 'S400': 'Mercedes-Benz', 'S450': 'Mercedes-Benz',
        'ML350': 'Mercedes-Benz', 'ML 350': 'Mercedes-Benz', 'GLE': 'Mercedes-Benz',
        'GLC': 'Mercedes-Benz', 'GLK': 'Mercedes-Benz', 'GLS': 'Mercedes-Benz',
        'CLA': 'Mercedes-Benz', 'CLS': 'Mercedes-Benz', 'AMG': 'Mercedes-Benz',
        'C450': 'Mercedes-Benz', 'C43': 'Mercedes-Benz', 'C63': 'Mercedes-Benz',
        'TOYOTA': 'Toyota', 'CAMRY': 'Toyota', 'COROLLA': 'Toyota', 'PRADO': 'Toyota',
        'LAND CRUISER': 'Toyota', 'HILUX': 'Toyota', 'AVALON': 'Toyota',
        'BMW': 'BMW', 'X5': 'BMW', 'X6': 'BMW', 'X3': 'BMW', '320': 'BMW',
        '328': 'BMW', '530': 'BMW', '520': 'BMW', '750': 'BMW', 'M5': 'BMW',
        'LEXUS': 'Lexus', 'LX': 'Lexus', 'RX': 'Lexus', 'GX': 'Lexus', 'ES': 'Lexus',
        'RANGE ROVER': 'Land Rover', 'DISCOVERY': 'Land Rover', 'DEFENDER': 'Land Rover',
        'PORSCHE': 'Porsche', 'CAYENNE': 'Porsche', 'PANAMERA': 'Porsche',
        'HONDA': 'Honda', 'ACCORD': 'Honda', 'CRV': 'Honda', 'CR-V': 'Honda',
        'AUDI': 'Audi', 'Q7': 'Audi', 'Q5': 'Audi', 'A6': 'Audi', 'A4': 'Audi',
        'FORD': 'Ford', 'INFINITI': 'Infiniti', 'KIA': 'Kia', 'HYUNDAI': 'Hyundai',
    };

    let make = 'Unknown';
    const upper = modelPart.toUpperCase();
    for (const [key, brand] of Object.entries(MAKES)) {
        if (upper.includes(key.toUpperCase())) { make = brand; break; }
    }

    return {
        userId: customerId,
        vin: '',
        licensePlate: licensePlate || '',
        make,
        model: modelPart,
        year: new Date().getFullYear(),
        color: '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        zohoSource: true,
    };
}

async function batchWrite(items, collectionName, getDocId, transform) {
    let written = 0;
    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
            const id = getDocId(item);
            const ref = doc(db, collectionName, id);
            batch.set(ref, transform(item), { merge: false });
            written++;
        }
        await batch.commit();
        console.log(`   ✓ ${collectionName}: ${Math.min(i + BATCH_SIZE, items.length)} / ${items.length}`);
    }
    return written;
}

// ── Step 1: Create Workshop ──────────────────────────────────────────────────
async function createWorkshop() {
    console.log("\n🏭 Step 1: Creating workshop...");
    const workshopRef = doc(db, 'workshops', WORKSHOP_ID);
    await setDoc(workshopRef, {
        name: 'ABMTEK Workshop',
        subscriptionStatus: 'active',
        subscriptionPlan: 'premium',
        settings: { vatRate: 7.5, currency: 'NGN' },
        createdAt: Timestamp.now(),
    }, { merge: true });
    console.log(`   ✓ Workshop created: ${WORKSHOP_ID}`);
}

// ── Step 2: Update Admin User ────────────────────────────────────────────────
async function updateAdminUser() {
    console.log("\n👤 Step 2: Updating admin user with workshopId...");
    const userRef = doc(db, 'users', ADMIN_USER_ID);
    await setDoc(userRef, { workshopId: WORKSHOP_ID }, { merge: true });
    console.log(`   ✓ Admin user ${ADMIN_USER_ID} updated with workshopId`);
}

// ── Step 3: Import Customers ─────────────────────────────────────────────────
async function importCustomers() {
    console.log("\n👥 Step 3: Importing customers...");

    // Deduplicate by contact_id
    const unique = Array.from(new Map(contacts.map(c => [c.contact_id, c])).values());
    const valid = unique.filter(c => c.contact_name && c.contact_name.trim() !== '');

    await batchWrite(
        valid,
        'users',
        c => `zoho-${c.contact_id}`,
        c => ({
            name: c.contact_name.trim(),
            email: c.email || '',
            phone: c.phone || '',
            role: 'customer',
            workshopId: WORKSHOP_ID,
            zohoContactId: c.contact_id,
            zohoSource: true,
            createdAt: toTimestamp(c.created_time),
            updatedAt: Timestamp.now(),
        })
    );

    console.log(`   ✓ ${valid.length} customers imported`);
    return valid;
}

// ── Step 4: Import Invoices ──────────────────────────────────────────────────
async function importInvoices(customerMap) {
    console.log("\n🧾 Step 4: Importing invoices...");

    const mapStatus = s => {
        switch(s) {
            case 'paid': return { paymentStatus: 'paid', status: 'approved' };
            case 'overdue': return { paymentStatus: 'pending', status: 'approved' };
            case 'unpaid': return { paymentStatus: 'pending', status: 'approved' };
            case 'partially_paid': return { paymentStatus: 'partially_paid', status: 'approved' };
            case 'draft': return { paymentStatus: 'pending', status: 'draft' };
            default: return { paymentStatus: 'pending', status: 'draft' };
        }
    };

    await batchWrite(
        invoices,
        'invoices',
        inv => `zoho-${inv.invoice_id}`,
        inv => {
            const { paymentStatus, status } = mapStatus(inv.status);
            const customerId = customerMap[inv.customer_id] || `zoho-${inv.customer_id}`;
            return {
                workshopId: WORKSHOP_ID,
                userId: customerId,
                customerName: inv.customer_name || '',
                invoiceNumber: inv.invoice_number || '',
                items: [],
                subtotal: inv.total || 0,
                vat: 0,
                vatRate: 7.5,
                discount: 0,
                total: inv.total || 0,
                amountPaid: (inv.total || 0) - (inv.balance || 0),
                paymentStatus,
                status,
                invoiceStatus: status === 'approved' ? 'approved' : 'draft',
                carBrand: inv.cf_car_brand || '',
                zohoInvoiceId: inv.invoice_id,
                zohoInvoiceNumber: inv.invoice_number,
                zohoSource: true,
                createdAt: toTimestamp(inv.created_time),
                updatedAt: Timestamp.now(),
            };
        }
    );

    console.log(`   ✓ ${invoices.length} invoices imported`);
}

// ── Step 5: Import Vehicles ──────────────────────────────────────────────────
async function importVehicles(customerMap) {
    console.log("\n🚗 Step 5: Importing vehicles from invoice car brands...");

    // Build unique vehicles per customer
    const vehicleMap = new Map();
    for (const inv of invoices) {
        if (!inv.cf_car_brand || !inv.customer_id) continue;
        const key = `${inv.customer_id}__${inv.cf_car_brand.trim().toUpperCase()}`;
        if (!vehicleMap.has(key)) {
            const customerId = customerMap[inv.customer_id] || `zoho-${inv.customer_id}`;
            const vehicle = parseVehicle(inv.cf_car_brand, customerId, inv.customer_name);
            if (vehicle) vehicleMap.set(key, { ...vehicle, key });
        }
    }

    const vehicles = Array.from(vehicleMap.values());

    await batchWrite(
        vehicles,
        'vehicles',
        v => `zoho-${v.key.replace(/[^a-zA-Z0-9]/g, '-')}`,
        v => {
            const { key, ...rest } = v;
            return rest;
        }
    );

    console.log(`   ✓ ${vehicles.length} unique vehicles imported`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log("🚀 ABMTEK Zoho → Firebase Migration");
    console.log("=====================================");
    console.log(`   Project: abmtek-wms`);
    console.log(`   Workshop ID: ${WORKSHOP_ID}`);
    console.log(`   Contacts to import: ${contacts.length}`);
    console.log(`   Invoices to import: ${invoices.length}`);
    console.log("=====================================\n");

    try {
        await createWorkshop();
        await updateAdminUser();

        const customers = await importCustomers();

        // Build Zoho contact_id → Firestore user doc ID map
        const customerMap = {};
        for (const c of customers) {
            customerMap[c.contact_id] = `zoho-${c.contact_id}`;
        }

        await importInvoices(customerMap);
        await importVehicles(customerMap);

        console.log("\n=====================================");
        console.log("✅ Migration complete!");
        console.log(`   ✓ Workshop created: ${WORKSHOP_ID}`);
        console.log(`   ✓ Admin user updated with workshopId`);
        console.log(`   ✓ ${customers.length} customers imported`);
        console.log(`   ✓ ${invoices.length} invoices imported`);
        console.log("=====================================");
        console.log("\n👉 Next: Sign out and sign back into the web app.");
        console.log("   Your dashboard will now show all your data.\n");

    } catch (err) {
        console.error("\n❌ Migration failed:", err.message);
        console.error(err);
    }

    process.exit(0);
}

main();
