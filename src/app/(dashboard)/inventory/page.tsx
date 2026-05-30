"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { InventoryItem, StockTransaction, RestockRequest } from "@/types";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Search, Plus, Minus, Inbox, Loader2, Package, Trash2, Pencil,
    TrendingDown, AlertTriangle, ArrowDownCircle, ArrowUpCircle, RefreshCw,
    CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = [
    "Engine Parts", "Transmission", "Brakes & Rotors", "Electrical",
    "Suspension & Steering", "Body & Trim", "Filters & Fluids", "Tyres & Wheels", "General",
];

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";

export default function InventoryPage() {
    const { user } = useAuthStore();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [stockFilter, setStockFilter] = useState<StockFilter>("all");
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("inventory");

    // Add/Edit dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [dialogTab, setDialogTab] = useState("details");

    // Form fields
    const [formVendor, setFormVendor] = useState("");
    const [formName, setFormName] = useState("");
    const [formSku, setFormSku] = useState("");
    const [formCategory, setFormCategory] = useState("General");
    const [formMinStock, setFormMinStock] = useState("5");
    const [formCostPrice, setFormCostPrice] = useState("");
    const [formSellingPrice, setFormSellingPrice] = useState("");
    const [existingUnitIds, setExistingUnitIds] = useState<string[]>([]);
    const [newUnitIds, setNewUnitIds] = useState<string[]>([]);

    // Stock adjustment
    const [adjustType, setAdjustType] = useState<"in" | "out">("in");
    const [adjustQty, setAdjustQty] = useState("");
    const [adjustReason, setAdjustReason] = useState("");
    const [adjusting, setAdjusting] = useState(false);
    const [showAdjustForm, setShowAdjustForm] = useState(false);

    // Stock history
    const [stockHistory, setStockHistory] = useState<StockTransaction[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Delete
    const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Restock requests
    const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
    const [restockLoading, setRestockLoading] = useState(false);
    const [showRestockDialog, setShowRestockDialog] = useState(false);
    const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
    const [restockQty, setRestockQty] = useState("");
    const [restockReason, setRestockReason] = useState("");
    const [submittingRestock, setSubmittingRestock] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectingRequest, setRejectingRequest] = useState<RestockRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const totalQuantity = existingUnitIds.length + newUnitIds.length;
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    const fetchInventory = useCallback(async () => {
        if (!user?.workshopId) { setLoading(false); return; }
        try {
            const data = await firebaseService.getInventoryItems(user.workshopId);
            setItems(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user?.workshopId]);

    const fetchRestockRequests = useCallback(async () => {
        if (!user?.workshopId) return;
        setRestockLoading(true);
        try {
            const data = await firebaseService.getRestockRequests(user.workshopId);
            setRestockRequests(data);
        } catch (error) {
            console.error(error);
        } finally {
            setRestockLoading(false);
        }
    }, [user?.workshopId]);

    useEffect(() => { fetchInventory(); }, [fetchInventory]);
    useEffect(() => { if (activeTab === "requests") fetchRestockRequests(); }, [activeTab, fetchRestockRequests]);

    // Stats
    const stats = useMemo(() => {
        const totalItems = items.length;
        const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= (i.minStockLevel || 5)).length;
        const outOfStock = items.filter(i => i.quantity === 0).length;
        const totalValue = items.reduce((sum, i) => sum + (i.quantity * (i.costPrice || i.unitPrice || 0)), 0);
        const pendingRequests = restockRequests.filter(r => r.status === "pending").length;
        return { totalItems, lowStock, outOfStock, totalValue, pendingRequests };
    }, [items, restockRequests]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.vendor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
            const matchStock = stockFilter === "all" ||
                (stockFilter === "out_of_stock" && item.quantity === 0) ||
                (stockFilter === "low_stock" && item.quantity > 0 && item.quantity <= (item.minStockLevel || 5)) ||
                (stockFilter === "in_stock" && item.quantity > (item.minStockLevel || 5));
            return matchSearch && matchCategory && matchStock;
        });
    }, [items, searchTerm, categoryFilter, stockFilter]);

    const resetForm = () => {
        setFormVendor(""); setFormName(""); setFormSku(""); setFormCategory("General");
        setFormMinStock("5"); setFormCostPrice(""); setFormSellingPrice("");
        setExistingUnitIds([]); setNewUnitIds([]); setEditingItem(null);
        setDialogTab("details"); setShowAdjustForm(false);
        setAdjustQty(""); setAdjustReason(""); setStockHistory([]);
    };

    const openAddDialog = () => { resetForm(); setIsDialogOpen(true); };

    const openEditDialog = async (item: InventoryItem) => {
        setEditingItem(item);
        setFormName(item.name);
        setFormSku(item.sku || "");
        setFormVendor(item.vendor || (item as any).supplier || "");
        setFormCategory(item.category || "General");
        setFormMinStock((item.minStockLevel || 5).toString());
        setFormCostPrice(item.costPrice?.toString() || "");
        setFormSellingPrice(item.sellingPrice?.toString() || item.unitPrice?.toString() || "");
        setExistingUnitIds(item.unitIds || []);
        setNewUnitIds([]);
        setShowAdjustForm(false);
        setAdjustQty(""); setAdjustReason("");
        setDialogTab("details");
        setIsDialogOpen(true);
        // load history
        if (user?.workshopId) {
            setHistoryLoading(true);
            try {
                const history = await firebaseService.getStockTransactions(user.workshopId, item.id);
                setStockHistory(history);
            } catch (e) { console.error(e); }
            finally { setHistoryLoading(false); }
        }
    };

    const generateUniqueId = (): string => {
        const ts = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(16).substring(2, 6).toUpperCase();
        return `ITEM-${ts}${rnd}`;
    };

    const handleNewQuantityChange = (delta: number) => {
        setNewUnitIds(prev => {
            if (delta > 0) return [...prev, ...Array(delta).fill(null).map(() => generateUniqueId())];
            return prev.slice(0, Math.max(0, prev.length + delta));
        });
    };

    const handleSave = async () => {
        if (!formName.trim() || !formVendor.trim()) { toast.error("Vendor Name and Item Name are required."); return; }
        if (!user?.workshopId) return;
        const emptySlots = newUnitIds.some(uid => uid.trim() === "");
        if (emptySlots) { toast.error("All unit IDs must be filled in."); return; }

        setSaving(true);
        try {
            const allItems = await firebaseService.getInventoryItems(user.workshopId);
            const allOtherIds = new Set<string>();
            allItems.forEach(item => {
                if (item.id === editingItem?.id) return;
                item.unitIds?.forEach(uid => uid && allOtherIds.add(uid.toLowerCase()));
            });
            const globalDups = newUnitIds.filter(id => allOtherIds.has(id.toLowerCase()));
            if (globalDups.length > 0) { toast.error(`Duplicate IDs: ${globalDups.join(", ")}`); return; }
            const isNameDup = allItems.some(i => i.name.toLowerCase() === formName.trim().toLowerCase() && i.id !== editingItem?.id);
            if (isNameDup) { toast.error("An item with this name already exists."); return; }

            const finalUnitIds = [...existingUnitIds, ...newUnitIds.map(id => id.trim())];
            const itemData: any = {
                workshopId: user.workshopId,
                name: formName.trim(),
                category: formCategory,
                quantity: finalUnitIds.length,
                minStockLevel: parseInt(formMinStock) || 5,
                sku: formSku.trim(),
                vendor: formVendor.trim(),
                costPrice: parseFloat(formCostPrice) || 0,
                sellingPrice: parseFloat(formSellingPrice) || 0,
                unitPrice: parseFloat(formSellingPrice) || 0,
                unitIds: finalUnitIds,
            };

            if (editingItem) {
                await firebaseService.updateInventoryItem(editingItem.id, itemData);
                const updatedItem = { ...editingItem, ...itemData };
                setItems(prev => prev.map(i => i.id === editingItem.id ? updatedItem : i));
                // check low stock
                if (itemData.quantity <= itemData.minStockLevel && itemData.quantity > 0) {
                    await firebaseService.sendLowStockNotification(user.workshopId, itemData.name, itemData.quantity, itemData.minStockLevel, editingItem.id);
                }
            } else {
                const newId = await firebaseService.createInventoryItem(itemData);
                setItems(prev => [...prev, { id: newId, ...itemData, createdAt: new Date(), updatedAt: new Date() } as InventoryItem]);
            }
            toast.success(editingItem ? "Item updated." : "Item added.");
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save item.");
        } finally {
            setSaving(false);
        }
    };

    const handleStockAdjust = async () => {
        if (!editingItem || !user?.workshopId) return;
        const qty = parseInt(adjustQty);
        if (!qty || qty <= 0) { toast.error("Enter a valid quantity."); return; }
        if (!adjustReason.trim()) { toast.error("Please enter a reason."); return; }
        if (adjustType === "out" && qty > editingItem.quantity) { toast.error("Cannot remove more than current stock."); return; }

        setAdjusting(true);
        try {
            const newQty = adjustType === "in" ? editingItem.quantity + qty : editingItem.quantity - qty;
            await firebaseService.updateInventoryItem(editingItem.id, { quantity: newQty });
            await firebaseService.addStockTransaction({
                workshopId: user.workshopId,
                itemId: editingItem.id,
                itemName: editingItem.name,
                type: adjustType === "in" ? "stock_in" : "stock_out",
                quantity: qty,
                reason: adjustReason.trim(),
                recordedBy: user.id,
                recordedByName: user.name,
                createdAt: new Date(),
            });

            const updatedItem = { ...editingItem, quantity: newQty };
            setEditingItem(updatedItem);
            setItems(prev => prev.map(i => i.id === editingItem.id ? updatedItem : i));

            // reload history
            const history = await firebaseService.getStockTransactions(user.workshopId, editingItem.id);
            setStockHistory(history);

            if (newQty <= (editingItem.minStockLevel || 5) && newQty > 0) {
                await firebaseService.sendLowStockNotification(user.workshopId, editingItem.name, newQty, editingItem.minStockLevel || 5, editingItem.id);
                toast.warning(`Low stock alert sent — only ${newQty} unit(s) left.`);
            } else if (newQty === 0) {
                await firebaseService.sendLowStockNotification(user.workshopId, editingItem.name, 0, editingItem.minStockLevel || 5, editingItem.id);
                toast.warning("Item is now out of stock. Alert sent.");
            } else {
                toast.success(`Stock ${adjustType === "in" ? "added" : "removed"} successfully.`);
            }

            setShowAdjustForm(false);
            setAdjustQty(""); setAdjustReason("");
        } catch (e) {
            console.error(e);
            toast.error("Failed to adjust stock.");
        } finally {
            setAdjusting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        setDeleting(true);
        try {
            await firebaseService.deleteInventoryItem(deleteItem.id);
            setItems(prev => prev.filter(i => i.id !== deleteItem.id));
            toast.success("Item deleted.");
            setDeleteItem(null);
        } catch (e) {
            toast.error("Failed to delete item.");
        } finally {
            setDeleting(false);
        }
    };

    const handleRestockRequest = async () => {
        if (!restockItem || !user?.workshopId) return;
        const qty = parseInt(restockQty);
        if (!qty || qty <= 0) { toast.error("Enter a valid quantity."); return; }
        if (!restockReason.trim()) { toast.error("Please enter a reason."); return; }
        setSubmittingRestock(true);
        try {
            await firebaseService.createRestockRequest({
                workshopId: user.workshopId,
                itemId: restockItem.id,
                itemName: restockItem.name,
                currentQty: restockItem.quantity,
                requestedQty: qty,
                reason: restockReason.trim(),
                requestedBy: user.id,
                requestedByName: user.name,
                requestedAt: new Date(),
                status: "pending",
            });
            toast.success("Restock request sent for approval.");
            setShowRestockDialog(false);
            setRestockQty(""); setRestockReason("");
        } catch (e) {
            toast.error("Failed to submit restock request.");
        } finally {
            setSubmittingRestock(false);
        }
    };

    const handleApproveRestock = async (req: RestockRequest) => {
        if (!user) return;
        try {
            await firebaseService.approveRestockRequest(req.id, user.id, user.name);
            setRestockRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "approved" } : r));
            await fetchInventory();
            toast.success(`Restock approved — ${req.requestedQty} units of ${req.itemName} added.`);
        } catch (e) {
            toast.error("Failed to approve request.");
        }
    };

    const handleRejectRestock = async () => {
        if (!rejectingRequest || !user || !rejectionReason.trim()) return;
        try {
            await firebaseService.rejectRestockRequest(rejectingRequest.id, user.id, user.name, rejectionReason);
            setRestockRequests(prev => prev.map(r => r.id === rejectingRequest.id ? { ...r, status: "rejected" } : r));
            toast.success("Request rejected.");
            setRejectDialogOpen(false);
            setRejectionReason("");
        } catch (e) {
            toast.error("Failed to reject request.");
        }
    };

    const getStockStatus = (item: InventoryItem) => {
        if (item.quantity === 0) return { label: "Out of Stock", variant: "destructive" as const, row: "bg-red-50/40 dark:bg-red-950/20" };
        if (item.quantity <= (item.minStockLevel || 5)) return { label: "Low Stock", variant: "outline" as const, row: "bg-amber-50/40 dark:bg-amber-950/20", color: "text-amber-600 border-amber-300" };
        return { label: "In Stock", variant: "secondary" as const, row: "" };
    };

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Inventory</h2>
                    <p className="text-sm text-gray-500 mt-1">{items.length} total parts</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => { setRestockItem(null); setShowRestockDialog(true); }} className="border-orange-300 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20">
                        <RefreshCw className="mr-2 h-4 w-4" /> Request Restock
                    </Button>
                    <Button onClick={openAddDialog} style={{ background: "#E87C2B" }}>
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs text-blue-200 font-medium uppercase tracking-wider">Total Parts</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.totalItems}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#7c3a1e,#e87c2b)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs text-orange-200 font-medium uppercase tracking-wider">Low Stock</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.lowStock}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#7c1e1e,#dc2626)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs text-red-200 font-medium uppercase tracking-wider">Out of Stock</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.outOfStock}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#1e5f3a,#16a34a)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs text-green-200 font-medium uppercase tracking-wider">Total Value</p>
                        <p className="text-2xl font-bold text-white mt-1">₦{stats.totalValue.toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="px-8">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="inventory">Stock</TabsTrigger>
                        <TabsTrigger value="requests" className="relative">
                            Restock Requests
                            {stats.pendingRequests > 0 && (
                                <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {stats.pendingRequests}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── INVENTORY TAB ── */}
                    <TabsContent value="inventory" className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search parts…" className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                {(["all", "in_stock", "low_stock", "out_of_stock"] as StockFilter[]).map(f => (
                                    <button key={f} onClick={() => setStockFilter(f)}
                                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            stockFilter === f ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"
                                        )}>
                                        {f === "all" ? "All" : f === "in_stock" ? "In Stock" : f === "low_stock" ? "Low Stock" : "Out of Stock"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="border-y bg-white dark:bg-gray-900 w-full rounded-xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                                        <TableHead className="pl-6">Part Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                        <TableHead className="text-right">Min</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead className="text-right">Selling</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></TableCell></TableRow>
                                    ) : filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3">
                                                    <div className="p-4 bg-gray-100 rounded-2xl text-gray-400"><Inbox className="h-10 w-10 stroke-[1.5]" /></div>
                                                    <p className="text-gray-900 dark:text-gray-100 font-semibold">No items found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredItems.map(item => {
                                        const status = getStockStatus(item);
                                        return (
                                            <TableRow key={item.id} className={cn("transition-colors", status.row)}>
                                                <TableCell className="font-medium pl-6">{item.name}</TableCell>
                                                <TableCell><Badge variant="outline" className="text-xs">{item.category || "General"}</Badge></TableCell>
                                                <TableCell className="text-gray-500 text-sm">{item.vendor || "—"}</TableCell>
                                                <TableCell className="text-gray-500 font-mono text-xs">{item.sku || "—"}</TableCell>
                                                <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                                                <TableCell className="text-right text-gray-400 text-sm">{item.minStockLevel || 5}</TableCell>
                                                <TableCell className="text-right text-sm">₦{(item.costPrice || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-sm">₦{(item.sellingPrice || item.unitPrice || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={status.variant} className={cn("text-xs", status.color)}>
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600"
                                                            onClick={e => { e.stopPropagation(); setRestockItem(item); setShowRestockDialog(true); }}
                                                            title="Request Restock">
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600"
                                                            onClick={e => { e.stopPropagation(); setDeleteItem(item); }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* ── RESTOCK REQUESTS TAB ── */}
                    <TabsContent value="requests">
                        <div className="mb-4">
                            <p className="text-sm text-gray-500">{restockRequests.filter(r => r.status === "pending").length} pending request(s)</p>
                        </div>
                        {restockLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                        ) : restockRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><Package className="h-10 w-10 stroke-[1.5]" /></div>
                                <p className="font-semibold text-gray-700 dark:text-gray-300">No restock requests yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {restockRequests.map(req => (
                                    <div key={req.id} className={cn("border rounded-xl p-4 bg-white dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center gap-4",
                                        req.status === "pending" ? "border-amber-200" : req.status === "approved" ? "border-green-200" : "border-red-200"
                                    )}>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-900 dark:text-white">{req.itemName}</p>
                                                <Badge variant={req.status === "pending" ? "outline" : req.status === "approved" ? "secondary" : "destructive"}
                                                    className={cn("text-xs", req.status === "pending" ? "text-amber-600 border-amber-300" : req.status === "approved" ? "text-green-600 border-green-300" : "")}>
                                                    {req.status === "pending" ? <Clock className="h-3 w-3 mr-1" /> : req.status === "approved" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{req.requestedQty} units</span> requested by <span className="font-medium">{req.requestedByName}</span>
                                            </p>
                                            <p className="text-sm text-gray-400">Current stock: {req.currentQty} · {format(new Date(req.requestedAt), "MMM d, yyyy HH:mm")}</p>
                                            {req.reason && <p className="text-xs text-gray-500 italic">"{req.reason}"</p>}
                                            {req.status === "rejected" && req.rejectionReason && (
                                                <p className="text-xs text-red-500">Rejected: {req.rejectionReason}</p>
                                            )}
                                        </div>
                                        {isAdmin && req.status === "pending" && (
                                            <div className="flex gap-2">
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleApproveRestock(req)}>
                                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                                </Button>
                                                <Button size="sm" variant="outline" className="text-red-500 border-red-300 hover:bg-red-50"
                                                    onClick={() => { setRejectingRequest(req); setRejectDialogOpen(true); }}>
                                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── ADD / EDIT DIALOG ── */}
            <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">{editingItem ? `Edit: ${editingItem.name}` : "New Item"}</DialogTitle>
                    </DialogHeader>

                    <Tabs value={dialogTab} onValueChange={setDialogTab}>
                        <TabsList className="w-full">
                            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                            {editingItem && <TabsTrigger value="stock" className="flex-1">Stock Adjust</TabsTrigger>}
                            {editingItem && <TabsTrigger value="history" className="flex-1">History</TabsTrigger>}
                        </TabsList>

                        {/* Details Tab */}
                        <TabsContent value="details" className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-600">Vendor Name *</Label>
                                <Input placeholder="Enter vendor name" value={formVendor} onChange={e => setFormVendor(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-600">Item Name *</Label>
                                <Input placeholder="Enter item name" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-600">SKU</Label>
                                    <Input placeholder="SKU" value={formSku} onChange={e => setFormSku(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-600">Min Stock Level</Label>
                                    <Input type="number" placeholder="5" value={formMinStock} onChange={e => setFormMinStock(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-600">Category</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator />

                            {/* Unit IDs */}
                            <div className="space-y-4">
                                <Label className="text-sm font-semibold text-gray-600">Stock Management</Label>
                                <div className="grid grid-cols-3 gap-0 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border">
                                    <div className="text-center py-4"><p className="text-xs text-gray-400 font-medium mb-1">Current</p><p className="text-xl font-bold">{existingUnitIds.length}</p></div>
                                    <div className="text-center py-4 border-x"><p className="text-xs text-gray-400 font-medium mb-1">Adding</p><p className="text-xl font-bold text-green-600">+{newUnitIds.length}</p></div>
                                    <div className="text-center py-4"><p className="text-xs text-gray-400 font-medium mb-1">Total</p><p className="text-xl font-bold">{totalQuantity}</p></div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Add New Units</p>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => handleNewQuantityChange(-1)} disabled={newUnitIds.length === 0}
                                            className={cn("h-10 w-10 rounded-xl border-2 flex items-center justify-center",
                                                newUnitIds.length === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-900 text-gray-900 hover:bg-gray-50 cursor-pointer")}>
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <Input type="number" className="h-10 w-20 text-center font-bold text-xl" value={newUnitIds.length}
                                            onChange={e => {
                                                const v = parseInt(e.target.value) || 0;
                                                const diff = v - newUnitIds.length;
                                                if (diff !== 0) handleNewQuantityChange(diff);
                                            }} />
                                        <button type="button" onClick={() => handleNewQuantityChange(1)}
                                            className="h-10 w-10 rounded-xl border-2 border-gray-900 text-gray-900 hover:bg-gray-50 flex items-center justify-center cursor-pointer">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                {newUnitIds.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 max-h-[180px] overflow-y-auto border">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">New Unit IDs</p>
                                        {newUnitIds.map((uid, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                                                <Input value={uid} onChange={e => { const n = [...newUnitIds]; n[i] = e.target.value; setNewUnitIds(n); }} className="h-9 text-xs font-mono bg-white dark:bg-gray-700" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {existingUnitIds.length > 0 && (
                                    <div className="bg-gray-50/50 dark:bg-gray-800/50 rounded-xl p-4 border border-dashed">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Existing Units ({existingUnitIds.length})</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {existingUnitIds.map((uid, i) => <span key={i} className="px-2 py-0.5 bg-gray-200/50 text-gray-600 rounded text-[10px] font-mono">{uid}</span>)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-600">Cost Price (₦)</Label>
                                    <Input type="number" placeholder="0" value={formCostPrice} onChange={e => setFormCostPrice(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-600">Selling Price (₦)</Label>
                                    <Input type="number" placeholder="0" value={formSellingPrice} onChange={e => setFormSellingPrice(e.target.value)} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving} style={{ background: "#E87C2B" }} className="min-w-[120px]">
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Item
                                </Button>
                            </div>
                        </TabsContent>

                        {/* Stock Adjust Tab */}
                        {editingItem && (
                            <TabsContent value="stock" className="space-y-4 pt-4">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center border">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Current Stock</p>
                                    <p className="text-5xl font-bold text-gray-900 dark:text-white">{editingItem.quantity}</p>
                                    <p className="text-xs text-gray-400 mt-1">Min level: {editingItem.minStockLevel || 5}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => { setAdjustType("in"); setShowAdjustForm(true); }}
                                        className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                            adjustType === "in" && showAdjustForm ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-gray-200 hover:border-gray-300")}>
                                        <ArrowUpCircle className="h-8 w-8 text-green-500" />
                                        <span className="text-sm font-semibold text-green-600">Stock In</span>
                                        <span className="text-xs text-gray-400">Add units received</span>
                                    </button>
                                    <button onClick={() => { setAdjustType("out"); setShowAdjustForm(true); }}
                                        className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                            adjustType === "out" && showAdjustForm ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-gray-200 hover:border-gray-300")}>
                                        <ArrowDownCircle className="h-8 w-8 text-red-500" />
                                        <span className="text-sm font-semibold text-red-600">Stock Out</span>
                                        <span className="text-xs text-gray-400">Remove used units</span>
                                    </button>
                                </div>

                                {showAdjustForm && (
                                    <div className={cn("border-2 rounded-xl p-4 space-y-4", adjustType === "in" ? "border-green-200 bg-green-50/30 dark:bg-green-950/20" : "border-red-200 bg-red-50/30 dark:bg-red-950/20")}>
                                        <div className="flex items-center gap-2">
                                            {adjustType === "in" ? <ArrowUpCircle className="h-5 w-5 text-green-500" /> : <ArrowDownCircle className="h-5 w-5 text-red-500" />}
                                            <p className="font-semibold">{adjustType === "in" ? "Add Stock" : "Remove Stock"}</p>
                                            <p className="text-xs text-gray-500">· {format(new Date(), "MMM d, yyyy HH:mm")}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">Quantity</Label>
                                            <Input type="number" placeholder="0" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">Reason *</Label>
                                            <Input placeholder={adjustType === "in" ? "e.g. New delivery from vendor" : "e.g. Used in job #1234"} value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="flex-1" onClick={() => { setShowAdjustForm(false); setAdjustQty(""); setAdjustReason(""); }}>Cancel</Button>
                                            <Button className={cn("flex-1", adjustType === "in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")} onClick={handleStockAdjust} disabled={adjusting}>
                                                {adjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Confirm {adjustType === "in" ? "Stock In" : "Stock Out"}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Button variant="outline" className="w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                                    onClick={() => { setRestockItem(editingItem); setShowRestockDialog(true); }}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Request Restock
                                </Button>
                            </TabsContent>
                        )}

                        {/* History Tab */}
                        {editingItem && (
                            <TabsContent value="history" className="pt-4">
                                {historyLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                                ) : stockHistory.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">No stock movements recorded yet.</div>
                                ) : (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                        {stockHistory.map(tx => (
                                            <div key={tx.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50 dark:bg-gray-800/50">
                                                <div className={cn("mt-0.5 p-1 rounded-full", tx.type === "stock_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                                                    {tx.type === "stock_in" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={cn("text-sm font-bold", tx.type === "stock_in" ? "text-green-600" : "text-red-600")}>
                                                            {tx.type === "stock_in" ? "+" : "-"}{tx.quantity} units
                                                        </span>
                                                        <span className="text-xs text-gray-400 shrink-0">{format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{tx.reason}</p>
                                                    {tx.recordedByName && <p className="text-xs text-gray-400">by {tx.recordedByName}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        )}
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete {deleteItem?.name}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">This will permanently remove this item from inventory. This action cannot be undone.</p>
                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
                            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Restock Request Dialog */}
            <Dialog open={showRestockDialog} onOpenChange={open => { setShowRestockDialog(open); if (!open) { setRestockQty(""); setRestockReason(""); setRestockItem(null); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Request Restock</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Item selector when opened from the tab */}
                        {!restockItem ? (
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Select Part *</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-gray-800 dark:border-gray-700"
                                    defaultValue=""
                                    onChange={e => {
                                        const found = items.find(i => i.id === e.target.value);
                                        if (found) setRestockItem(found);
                                    }}
                                >
                                    <option value="" disabled>Choose a part…</option>
                                    {items.map(i => (
                                        <option key={i.id} value={i.id}>
                                            {i.name} (stock: {i.quantity})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-sm">{restockItem.name}</p>
                                    <p className="text-xs text-amber-600 mt-1">Current stock: {restockItem.quantity} units</p>
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={() => setRestockItem(null)}>Change</Button>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Quantity Needed *</Label>
                            <Input type="number" placeholder="0" value={restockQty} onChange={e => setRestockQty(e.target.value)} min="1" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Reason *</Label>
                            <Input placeholder="e.g. Running low, needed for upcoming jobs" value={restockReason} onChange={e => setRestockReason(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowRestockDialog(false)}>Cancel</Button>
                            <Button className="flex-1" style={{ background: "#E87C2B" }} onClick={handleRestockRequest} disabled={submittingRestock || !restockItem}>
                                {submittingRestock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Request
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={open => { setRejectDialogOpen(open); if (!open) { setRejectionReason(""); setRejectingRequest(null); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reject Restock Request</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-500">Rejecting request for <span className="font-semibold">{rejectingRequest?.itemName}</span> ({rejectingRequest?.requestedQty} units)</p>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Reason for Rejection *</Label>
                            <Input placeholder="Enter reason…" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleRejectRestock} disabled={!rejectionReason.trim()}>
                                Reject
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
