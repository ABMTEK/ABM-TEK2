"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Invoice } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Plus, Inbox, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

type StatusTab = "all" | "paid" | "pending" | "draft" | "overdue";

function getDisplayStatus(inv: Invoice): { label: string; style: string } {
    const ps = inv.paymentStatus?.toLowerCase();
    const s = inv.status?.toLowerCase();
    const is = inv.invoiceStatus?.toLowerCase();

    if (ps === 'paid' || is === 'settled') return { label: "Paid", style: "bg-green-100 text-green-700 border-green-200" };
    if (ps === 'partially_paid') return { label: "Partial", style: "bg-blue-100 text-blue-700 border-blue-200" };
    if (s === 'draft') return { label: "Draft", style: "bg-gray-100 text-gray-600 border-gray-200" };
    if (ps === 'pending' || ps === 'unpaid') return { label: "Pending", style: "bg-amber-100 text-amber-700 border-amber-200" };
    if (ps === 'failed' || s === 'void') return { label: "Void", style: "bg-red-100 text-red-700 border-red-200" };
    return { label: ps || s || "Pending", style: "bg-amber-100 text-amber-700 border-amber-200" };
}

export default function InvoicesPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<StatusTab>("all");
    const searchParams = useSearchParams();

    useEffect(() => {
        const paymentParam = searchParams.get("payment");
        const statusParam = searchParams.get("status");
        if (paymentParam === "pending") setActiveTab("pending");
        else if (statusParam === "draft") setActiveTab("draft");
        else if (statusParam === "paid") setActiveTab("paid");
    }, [searchParams]);

    useEffect(() => {
        const fetch = async () => {
            if (!user?.workshopId) { setLoading(false); return; }
            try {
                const data = await firebaseService.getInvoices(undefined, user.workshopId);
                // sort newest first client-side
                data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                setInvoices(data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [user]);

    const counts = useMemo(() => ({
        all: invoices.length,
        paid: invoices.filter(i => i.paymentStatus === 'paid' || i.invoiceStatus === 'settled').length,
        pending: invoices.filter(i => i.paymentStatus === 'pending' && i.status !== 'draft').length,
        draft: invoices.filter(i => i.status === 'draft').length,
        overdue: invoices.filter(i => i.paymentStatus === 'pending' && i.dueDate && new Date(i.dueDate) < new Date()).length,
    }), [invoices]);

    const filtered = useMemo(() => {
        return invoices.filter(inv => {
            const matchSearch = !search ||
                inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
                inv.id?.toLowerCase().includes(search.toLowerCase());
            const matchTab =
                activeTab === "all" ||
                (activeTab === "paid" && (inv.paymentStatus === 'paid' || inv.invoiceStatus === 'settled')) ||
                (activeTab === "pending" && inv.paymentStatus === 'pending' && inv.status !== 'draft') ||
                (activeTab === "draft" && inv.status === 'draft') ||
                (activeTab === "overdue" && inv.paymentStatus === 'pending' && inv.dueDate && new Date(inv.dueDate) < new Date());
            return matchSearch && matchTab;
        });
    }, [invoices, search, activeTab]);

    if (loading) return <PageLoader message="Loading invoices..." />;

    const TABS: { key: StatusTab; label: string }[] = [
        { key: "all", label: "All" },
        { key: "paid", label: "Paid" },
        { key: "pending", label: "Pending" },
        { key: "draft", label: "Draft" },
        { key: "overdue", label: "Overdue" },
    ];

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
                    <p className="text-sm text-gray-500 mt-1">{invoices.length} total invoices</p>
                </div>
                <Button asChild style={{ background: "#E87C2B" }}>
                    <Link href="/finance/invoices/new"><Plus className="mr-2 h-4 w-4" /> Create Invoice</Link>
                </Button>
            </div>

            {/* Filters */}
            <div className="px-8 flex flex-col sm:flex-row gap-3">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search customer or invoice ID…" className="pl-9 w-72" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={cn("px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                                activeTab === tab.key ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"
                            )}>
                            {tab.label}
                            <span className="ml-1.5 text-[10px] text-gray-400">{counts[tab.key]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border-y bg-white dark:bg-gray-900 shadow-sm w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                            <TableHead className="pl-8">Invoice #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Car</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="text-right pr-8">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><Inbox className="h-10 w-10 stroke-[1.5]" /></div>
                                        <p className="font-semibold text-gray-900 dark:text-white">No invoices found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filtered.map(inv => {
                            const { label, style } = getDisplayStatus(inv);
                            return (
                                <TableRow key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => router.push(`/finance/invoices/${inv.id}`)}>
                                    <TableCell className="font-mono text-sm font-bold pl-8 text-gray-900 dark:text-white">
                                        {inv.zohoInvoiceNumber || inv.id?.slice(0, 12)}
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{inv.customerName || "—"}</p>
                                        {inv.customerEmail && <p className="text-xs text-gray-400">{inv.customerEmail}</p>}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{(inv as any).carBrand || "—"}</TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {inv.createdAt ? format(new Date(inv.createdAt), "MMM d, yyyy") : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5", style)}>
                                            {label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-gray-900 dark:text-white">
                                        ₦{(inv.total || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className={cn("text-right font-semibold", (inv.amountPaid || 0) < (inv.total || 0) ? "text-amber-600" : "text-green-600")}>
                                        ₦{((inv.total || 0) - (inv.amountPaid || 0)).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); router.push(`/finance/invoices/${inv.id}`); }}>
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-gray-400 text-center">{filtered.length} of {invoices.length} invoices shown</p>
        </div>
    );
}
