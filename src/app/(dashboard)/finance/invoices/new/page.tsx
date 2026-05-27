"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { InvoiceItem, InventoryItem, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Loader2, Search, Package, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewInvoicePage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");

    const [workshopCustomers, setWorkshopCustomers] = useState<User[]>([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [isCustomerOpen, setIsCustomerOpen] = useState(false);

    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventorySearch, setInventorySearch] = useState("");
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchInventory = async () => {
            if (!user?.workshopId) return;
            try {
                const data = await firebaseService.getInventoryItems(user.workshopId);
                setInventoryItems(data);
            } catch (error) {
                console.error("Error fetching inventory:", error);
            }
        };
        fetchInventory();
    }, [user]);

    useEffect(() => {
        const fetchCustomers = async () => {
            if (!user?.workshopId) return;
            try {
                const allUsers = await firebaseService.getUsersByWorkshop(user.workshopId);
                setWorkshopCustomers(allUsers.filter(u => u.role === "customer"));
            } catch (error) {
                console.error("Error fetching customers:", error);
            }
        };
        fetchCustomers();
    }, [user]);

    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

    const [newDescription, setNewDescription] = useState("");
    const [newQuantity, setNewQuantity] = useState("1");
    const [newPrice, setNewPrice] = useState("");

    const [vatRate, setVatRate] = useState("0");
    const [discount, setDiscount] = useState("0");
    const [dueDate, setDueDate] = useState<string>("");

    const handleAddItem = () => {
        if (!newDescription || !newPrice) {
            toast.error("Please enter description and price");
            return;
        }

        const quantity = parseFloat(newQuantity) || 1;
        const price = parseFloat(newPrice) || 0;

        const newItem: InvoiceItem = {
            description: newDescription,
            quantity,
            unitPrice: price,
            total: quantity * price,
        };

        setInvoiceItems([...invoiceItems, newItem]);
        setNewDescription("");
        setNewQuantity("1");
        setNewPrice("");
    };

    const toggleInventorySelection = (itemId: string) => {
        const newSelection = new Set(selectedInventoryIds);
        if (newSelection.has(itemId)) {
            newSelection.delete(itemId);
        } else {
            newSelection.add(itemId);
        }
        setSelectedInventoryIds(newSelection);
    };

    const handleAddSelectedInventoryItems = () => {
        const itemsToAdd: InvoiceItem[] = inventoryItems
            .filter(item => selectedInventoryIds.has(item.id))
            .map(item => ({
                description: item.name,
                quantity: 1,
                unitPrice: item.unitPrice,
                total: item.unitPrice,
                inventoryItemId: item.id,
                maxQty: item.quantity
            }));

        setInvoiceItems([...invoiceItems, ...itemsToAdd]);
        setSelectedInventoryIds(new Set());
        setIsInventoryOpen(false);
    };

    const filteredInventory = inventoryItems.filter((item: InventoryItem) =>
        item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.category.toLowerCase().includes(inventorySearch.toLowerCase())
    );

    const filteredCustomers = workshopCustomers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const handleSelectCustomer = (customer: User) => {
        setCustomerName(customer.name || "");
        setCustomerPhone(customer.phone || "");
        setCustomerEmail(customer.email || "");
        setIsCustomerOpen(false);
        setCustomerSearch("");
    };

    const handleUpdateItemQty = (index: number, delta: number) => {
        setInvoiceItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const newQty = Math.max(1, item.quantity + delta);
            if (delta > 0 && item.maxQty !== undefined && item.quantity >= item.maxQty) {
                toast.error(`Max available stock for "${item.description}" is ${item.maxQty}`);
                return item;
            }
            return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        }));
    };

    const handleRemoveItem = (index: number) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    };

    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = subtotal * (parseFloat(vatRate) || 0) / 100;
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal + vatAmount - discountAmount;

    const handleCreateInvoice = async () => {
        if (!customerName) {
            toast.error("Please enter customer name");
            return;
        }

        if (invoiceItems.length === 0) {
            toast.error("Please add at least one item");
            return;
        }

        if (!user?.workshopId) {
            toast.error("Workshop ID missing");
            return;
        }

        setIsSubmitting(true);
        try {
            const invoiceData = {
                customerName,
                customerPhone,
                customerEmail,
                customerAddress,
                workshopId: user.workshopId,
                items: invoiceItems,
                subtotal,
                vat: vatAmount,
                vatRate: parseFloat(vatRate) || 0,
                discount: discountAmount,
                total,
                paymentStatus: "pending" as const,
                status: "draft" as const,
                dueDate: dueDate ? new Date(dueDate) : undefined,
            };

            const invoiceId = await firebaseService.createInvoice(invoiceData);
            router.push(`/finance/invoices/${invoiceId}`);
        } catch (error) {
            console.error("Failed to create invoice:", error);
            toast.error("Failed to create invoice");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto pt-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Create New Invoice</h2>
            </div>

            {/* Customer Details */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Customer Details</CardTitle>
                    <Dialog open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Users className="mr-2 h-4 w-4" /> Select Customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Select a Customer</DialogTitle>
                            </DialogHeader>
                            <div className="relative my-3">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name, phone, or email..."
                                    className="pl-9"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>
                            <div className="overflow-y-auto flex-1 border rounded-md">
                                {filteredCustomers.length === 0 ? (
                                    <div className="py-8 text-center text-gray-500">
                                        No customers found
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredCustomers.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                                onClick={() => handleSelectCustomer(c)}
                                            >
                                                <div>
                                                    <p className="font-medium text-sm">{c.name || "Unnamed"}</p>
                                                    <p className="text-xs text-gray-500">{c.phone || c.email || "No contact info"}</p>
                                                </div>
                                                <span className="text-xs text-gray-400">Select</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="customerName">Customer Name *</Label>
                            <Input
                                id="customerName"
                                placeholder="Customer Name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="customerPhone">Phone Number</Label>
                            <Input
                                id="customerPhone"
                                placeholder="Phone Number"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="customerEmail">Email (Optional)</Label>
                            <Input
                                id="customerEmail"
                                type="email"
                                placeholder="Email"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="customerAddress">Address (Optional)</Label>
                            <Input
                                id="customerAddress"
                                placeholder="Address"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Existing Items List */}
                    {invoiceItems.length > 0 && (
                        <div className="space-y-2">
                            {invoiceItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium">{item.description}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.quantity} x ₦{item.unitPrice.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center border rounded-lg overflow-hidden h-9">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-full w-8 rounded-none hover:bg-gray-100"
                                                onClick={() => handleUpdateItemQty(index, -1)}
                                            >
                                                <Plus className="h-3 w-3 rotate-45" />
                                            </Button>
                                            <div className="w-10 text-center text-sm font-bold bg-white h-full flex items-center justify-center border-x">
                                                {item.quantity}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-full w-8 rounded-none hover:bg-gray-100"
                                                onClick={() => handleUpdateItemQty(index, 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <span className="font-semibold w-24 text-right">₦{item.total.toLocaleString()}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveItem(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Separator />

                    {/* Add Item Form */}
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Description (e.g. Service Fee)</Label>
                            <Input
                                placeholder="Description"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    placeholder="Qty"
                                    value={newQuantity}
                                    onChange={(e) => setNewQuantity(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Price (₦)</Label>
                                <Input
                                    type="number"
                                    placeholder="Price"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                type="button"
                                onClick={handleAddItem}
                                className="flex-1"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Item
                            </Button>
                            <Dialog open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="flex-1">
                                        <Package className="mr-2 h-4 w-4" /> Select from Inventory
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>Workshop Inventory</DialogTitle>
                                    </DialogHeader>
                                    <div className="relative my-4">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search parts by name or category..."
                                            className="pl-9"
                                            value={inventorySearch}
                                            onChange={(e) => setInventorySearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="overflow-y-auto flex-1 border rounded-md">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr className="border-b">
                                                    <th className="py-2 px-4 text-left w-10">
                                                        {/* Optional: Add a select-all checkbox here */}
                                                    </th>
                                                    <th className="py-2 px-4 text-left font-semibold text-gray-700">Name</th>
                                                    <th className="py-2 px-4 text-left font-semibold text-gray-700">Category</th>
                                                    <th className="py-2 px-4 text-right font-semibold text-gray-700">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filteredInventory.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-gray-500">
                                                            No matching parts found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredInventory.map((item) => (
                                                        <tr
                                                            key={item.id}
                                                            className={cn(
                                                                "hover:bg-gray-50 cursor-pointer transition-colors",
                                                                selectedInventoryIds.has(item.id) && "bg-slate-50 hover:bg-slate-50"
                                                            )}
                                                            onClick={() => toggleInventorySelection(item.id)}
                                                        >
                                                            <td className="py-2 px-4">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedInventoryIds.has(item.id)}
                                                                    onChange={() => { }}
                                                                    className="h-4 w-4 rounded border-gray-300 accent-slate-900"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-4 font-medium">{item.name}</td>
                                                            <td className="py-2 px-4 text-gray-500">{item.category}</td>
                                                            <td className="py-2 px-4 text-right font-medium">₦{item.unitPrice.toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="pt-4 flex justify-between items-center bg-white border-t mt-auto">
                                        <p className="text-sm text-gray-500">
                                            {selectedInventoryIds.size} item(s) selected
                                        </p>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setIsInventoryOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleAddSelectedInventoryItems}
                                                disabled={selectedInventoryIds.size === 0}
                                            >
                                                Add Selected Items
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">₦{subtotal.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="vatRate">VAT Rate (%)</Label>
                        <Input
                            id="vatRate"
                            type="number"
                            className="w-24 text-right"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-between">
                        <span className="text-muted-foreground">VAT Amount</span>
                        <span className="font-medium">₦{vatAmount.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="discount">Discount (₦)</Label>
                        <Input
                            id="discount"
                            type="number"
                            className="w-24 text-right"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="dueDate"
                                type="date"
                                className="w-40"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>₦{total.toLocaleString()}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4 pb-8">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleCreateInvoice} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Invoice
                </Button>
            </div>
        </div>
    );
}
