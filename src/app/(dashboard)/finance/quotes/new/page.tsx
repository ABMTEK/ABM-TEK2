"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, QuoteItem, Quote, InventoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, Save, Send, Search, Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
}

export default function CreateQuotePage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [customers, setCustomers] = useState<User[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [lineItems, setLineItems] = useState<LineItem[]>([
        { id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0 }
    ]);
    const [vatRate, setVatRate] = useState(7.5);
    const [discount, setDiscount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventorySearch, setInventorySearch] = useState("");
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const [customersData, inventoryData] = await Promise.all([
                    firebaseService.getUsersByWorkshop(user.workshopId),
                    firebaseService.getInventoryItems(user.workshopId)
                ]);
                setCustomers(customersData.filter(u => u.role === 'customer'));
                setInventoryItems(inventoryData);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [user]);

    const handleAddItem = () => {
        setLineItems([...lineItems, { id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (lineItems.length === 1) return;
        setLineItems(lineItems.filter(item => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(lineItems.map(item => item.id === id ? { ...item, [field]: value } : item));
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
        const itemsToAdd: LineItem[] = inventoryItems
            .filter(item => selectedInventoryIds.has(item.id))
            .map(item => ({
                id: Math.random().toString(),
                description: item.name,
                quantity: 1,
                unitPrice: item.unitPrice,
            }));

        setLineItems([...lineItems, ...itemsToAdd]);
        setSelectedInventoryIds(new Set());
        setIsInventoryOpen(false);
    };

    const filteredInventory = inventoryItems.filter((item: InventoryItem) =>
        item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.category.toLowerCase().includes(inventorySearch.toLowerCase())
    );

    const totals = useMemo(() => {
        const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const vat = (subtotal * vatRate) / 100;
        const total = subtotal + vat - discount;
        return { subtotal, vat, total };
    }, [lineItems, vatRate, discount]);

    const handleCreateQuote = async (status: 'draft' | 'pending_approval' = 'draft') => {
        if (!user?.workshopId || !selectedCustomerId) {
            toast.error("Please select a customer");
            return;
        }

        setLoading(true);
        try {
            const customer = customers.find(c => c.id === selectedCustomerId);
            const quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> = {
                workshopId: user.workshopId,
                userId: selectedCustomerId,
                customerName: customer?.name || "Unknown",
                customerEmail: customer?.email,
                customerPhone: customer?.phone,
                items: lineItems.map(item => ({
                    id: item.id,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    isAdditionalWork: false,
                    addedAt: new Date()
                })),
                subtotal: totals.subtotal,
                vatRate,
                vat: totals.vat,
                discount,
                total: totals.total,
                status,
                history: [{
                    action: 'create',
                    description: `Created quote as ${status}`,
                    userId: user.id,
                    userName: user.name,
                    timestamp: new Date()
                }]
            };

            const quoteId = await firebaseService.createQuote(quoteData);
            router.push(`/finance/quotes/${quoteId}`);
        } catch (error) {
            console.error("Error creating quote:", error);
            toast.error("Failed to create quote");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20 pt-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Create Quote</h2>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Left Column: Form */}
                <Card className="col-span-2 shadow-sm border-none">
                    <CardHeader>
                        <CardTitle className="text-lg">Line Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-12 gap-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                                <div className="col-span-6">Description</div>
                                <div className="col-span-2">Qty</div>
                                <div className="col-span-3 text-right">Unit Price</div>
                                <div className="col-span-1"></div>
                            </div>
                            <Separator />
                            {lineItems.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-4 items-start group">
                                    <div className="col-span-6">
                                        <Input
                                            placeholder="Item description..."
                                            value={item.description}
                                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                            className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                            className="bg-gray-50/50 border-gray-200"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₦</span>
                                            <Input
                                                type="number"
                                                value={item.unitPrice}
                                                onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                className="pl-7 bg-gray-50/50 border-gray-200"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 pt-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 border-dashed" onClick={handleAddItem}>
                                <Plus className="mr-2 h-4 w-4" /> Add Manual Item
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
                                                    <th className="py-2 px-4 text-left w-10"></th>
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
                    </CardContent>
                </Card>

                {/* Right Column: Customer & Summary */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Customer Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Customer</Label>
                                <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                                    <SelectTrigger className="bg-gray-50/50 border-gray-200">
                                        <SelectValue placeholder="Choose a customer..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedCustomerId && (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {customers.find(c => c.id === selectedCustomerId)?.name}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        {customers.find(c => c.id === selectedCustomerId)?.email}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        {customers.find(c => c.id === selectedCustomerId)?.phone}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-none bg-gray-900 text-white">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Quote Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Subtotal</span>
                                    <span>₦{totals.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm items-center">
                                        <span className="text-gray-400">VAT (%)</span>
                                        <Input
                                            type="number"
                                            value={vatRate}
                                            onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                                            className="w-16 h-8 bg-gray-800 border-gray-700 text-white text-right"
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>VAT Amount</span>
                                        <span>₦{totals.vat.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm items-center pt-2">
                                    <span className="text-gray-400">Discount (₦)</span>
                                    <Input
                                        type="number"
                                        value={discount}
                                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                        className="w-24 h-8 bg-gray-800 border-gray-700 text-white text-right"
                                    />
                                </div>
                            </div>
                            <Separator className="bg-gray-800" />
                            <div className="flex justify-between items-center py-2">
                                <span className="text-lg font-bold text-white">Total Quote</span>
                                <span className="text-2xl font-bold text-white">₦{totals.total.toLocaleString()}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <Button
                                className="w-full bg-white text-black hover:bg-gray-200 font-bold"
                                onClick={() => handleCreateQuote('pending_approval')}
                                disabled={loading || !selectedCustomerId}
                            >
                                Send for Approval
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full border-gray-600 text-white hover:bg-gray-800 font-bold"
                                onClick={() => handleCreateQuote('draft')}
                                disabled={loading || !selectedCustomerId}
                            >
                                <Save className="mr-2 h-4 w-4" /> Save Draft
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
