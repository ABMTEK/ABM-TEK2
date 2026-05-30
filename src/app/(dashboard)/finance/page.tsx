"use client";

import { useEffect, useState, useMemo } from "react";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Invoice, Quote, Job } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import {
    Wallet,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Filter,
    ArrowUpRight,
    Calendar,
    Search,
    FileText,
    Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

export default function FinanceDashboard() {
    const { user } = useAuthStore();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<"invoices" | "quotes">("invoices");
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
    });

    useEffect(() => {
        const fetchFinanceData = async () => {
            const isSuperAdmin = user?.role === "super_admin";
            if (!user?.workshopId && !isSuperAdmin) {
                setLoading(false);
                return;
            }
            try {
                const workshopIdToFetch = isSuperAdmin && !user.workshopId ? undefined : user.workshopId;
                const [invoiceData, quoteData, jobsData] = await Promise.all([
                    firebaseService.getInvoices(undefined, workshopIdToFetch),
                    firebaseService.getQuotes(workshopIdToFetch),
                    firebaseService.getJobs(undefined, workshopIdToFetch)
                ]);

                console.log(`[FinanceDashboard] Fetched ${invoiceData.length} invoices, ${quoteData.length} quotes, ${jobsData.length} jobs.`);
                setInvoices(invoiceData);
                setQuotes(quoteData);
                setJobs(jobsData);

            } catch (error) {
                console.error("Error fetching finance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFinanceData();
    }, [user]);

    const stats = useMemo(() => {
        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        const isInRange = (date: Date | any) => {
            if (!date) return false;
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return false;
            return isWithinInterval(d, { start, end });
        };

        const periodInvoices = invoices.filter(inv => isInRange(inv.createdAt));

        const approvedInvoices = periodInvoices.filter(inv =>
            inv.status === 'approved' ||
            inv.invoiceStatus === 'approved' ||
            inv.invoiceStatus === 'settled'
        );
        const invoiced = approvedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        const paid = invoices.reduce((acc, inv) => {
            if (!inv.paymentHistory || !Array.isArray(inv.paymentHistory)) return acc;

            return acc + inv.paymentHistory.reduce((pSum, p) => {
                const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                if (pDate && isInRange(pDate)) {
                    return pSum + (p.amount || 0);
                }
                return pSum;
            }, 0);
        }, 0);

        const outstanding = invoiced - paid;

        const pendingQuotes = quotes.filter(q => q.status === 'pending_approval').length;
        const draftInvoices = invoices.filter(inv => inv.status === 'draft').length;

        const filteredInvoices = periodInvoices.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        const filteredQuotes = quotes.filter(q => isInRange(q.createdAt))
            .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        return { invoiced, paid, outstanding, pendingQuotes, draftInvoices, filteredInvoices, filteredQuotes };
    }, [invoices, quotes, jobs, dateRange]);

    const getStatusStyles = (status: string, invoiceStatus?: string) => {
        const s = status?.toLowerCase();
        const is = invoiceStatus?.toLowerCase();

        if (s === 'paid' || s === 'settled')
            return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
        if (s === 'pending' || s === 'partially_paid')
            return "bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/40";
        if (s === 'failed' || s === 'void' || s === 'rejected')
            return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
        if (s === 'draft')
            return "bg-[#999999]/20 text-[#999999] border-[#999999]/40";

        if (s === 'approved' || is === 'settled')
            return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";

        return "bg-gray-100 text-gray-800 border-gray-200";
    };

    const [search, setSearch] = useState("");

    const collectionRate = stats.invoiced > 0 ? Math.round((stats.paid / stats.invoiced) * 100) : 0;

    if (loading) return <PageLoader message="Loading finance records..." />;

    return (
        <div className="space-y-8 pt-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Finance</h2>
                    <p className="text-gray-500">Overview of workshop's financial performance.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex bg-white/50 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-100">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-transparent border-none text-xs font-bold text-gray-600 pl-9 pr-3 h-9 focus:ring-0"
                                />
                            </div>
                            <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-transparent border-none text-xs font-bold text-gray-600 pl-9 pr-3 h-9 focus:ring-0"
                                />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDateRange({
                                start: format(subDays(new Date(), 365), "yyyy-MM-dd"),
                                end: format(new Date(), "yyyy-MM-dd")
                            })}
                            className="rounded-xl h-9 font-bold text-xs"
                        >
                            Last Year
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDateRange({
                                start: "2020-01-01",
                                end: format(new Date(), "yyyy-MM-dd")
                            })}
                            className="rounded-xl h-9 font-bold text-xs text-gray-400 hover:text-gray-900"
                        >
                            Reset
                        </Button>
                    </div>
                    <Button asChild className="rounded-xl shadow-lg shadow-blue-500/20">
                        <Link href="/finance/invoices/new">Create Invoice</Link>
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                {[
                    { label: "Total Invoiced", value: `₦${stats.invoiced.toLocaleString()}`, from: "#1e3a5f", to: "#2563eb" },
                    { label: "Total Collected", value: `₦${stats.paid.toLocaleString()}`, from: "#1e5f3a", to: "#16a34a" },
                    { label: "Outstanding", value: `₦${stats.outstanding.toLocaleString()}`, from: "#7c3a1e", to: "#E87C2B" },
                    { label: "Collection Rate", value: `${collectionRate}%`, from: "#3a1e5f", to: "#7c3aeb" },
                ].map((s, i) => (
                    <Card key={i} className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg,${s.from},${s.to})` }}>
                        <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</p>
                            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                {[
                    { label: "Total Invoices", value: invoices.length, icon: <FileText className="h-4 w-4" /> },
                    { label: "Pending Payment", value: invoices.filter(i => i.paymentStatus === "pending").length, icon: <Clock className="h-4 w-4" /> },
                    { label: "Pending Quotes", value: stats.pendingQuotes, icon: <AlertCircle className="h-4 w-4" /> },
                    { label: "Draft Invoices", value: stats.draftInvoices, icon: <Wallet className="h-4 w-4" /> },
                ].map((s, i) => (
                    <Card key={i} className="bg-white dark:bg-gray-900 border shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
                            </div>
                            <div className="text-gray-300 dark:text-gray-600">{s.icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs & Table */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-8">
                    <div className="flex items-center gap-4 border-b w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab("invoices")}
                        className={cn(
                            "pb-2 text-sm font-medium transition-colors border-b-2",
                            activeTab === "invoices"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Recent Invoices
                    </button>
                    <button
                        onClick={() => setActiveTab("quotes")}
                        className={cn(
                            "pb-2 text-sm font-medium transition-colors border-b-2",
                            activeTab === "quotes"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Recent Quotes
                    </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input placeholder="Search customer…" className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <Button asChild style={{ background: "#E87C2B" }} size="sm">
                            <Link href="/finance/invoices/new">+ New Invoice</Link>
                        </Button>
                    </div>
                </div>

                <div className="bg-white border-y shadow-sm overflow-hidden w-full">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead className="pl-8">{activeTab === "invoices" ? "Invoice ID" : "Quote ID"}</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>{activeTab === "invoices" ? "Payment Status" : "Status"}</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeTab === "invoices" ? (
                                stats.filteredInvoices.filter(i => !search || i.customerName?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No invoices found</TableCell></TableRow>
                                ) : (
                                    stats.filteredInvoices.filter(i => !search || i.customerName?.toLowerCase().includes(search.toLowerCase())).slice(0, 20).map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium text-gray-900 pl-8">{inv.id}</TableCell>
                                            <TableCell>{inv.customerName || "N/A"}</TableCell>
                                            <TableCell>{inv.createdAt ? format(inv.createdAt, 'MMM d, yyyy') : 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm", getStatusStyles(inv.paymentStatus || 'pending'))}
                                                >
                                                    {(inv.paymentStatus || 'pending').replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">₦{inv.total.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/finance/invoices/${inv.id}`}>
                                                        View <ArrowUpRight className="ml-1 h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )
                            ) : (
                                stats.filteredQuotes.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No quotes found for this period</TableCell></TableRow>
                                ) : (
                                    stats.filteredQuotes.slice(0, 10).map((quote) => (
                                        <TableRow key={quote.id}>
                                            <TableCell className="font-medium text-gray-900 pl-8">{quote.id}</TableCell>
                                            <TableCell>{quote.customerName || "N/A"}</TableCell>
                                            <TableCell>{quote.createdAt ? format(quote.createdAt, 'MMM d, yyyy') : 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm", getStatusStyles(quote.status))}
                                                >
                                                    {quote.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">₦{quote.total.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/finance/quotes/${quote.id}`}>
                                                        View <ArrowUpRight className="ml-1 h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )
                            )}
                        </TableBody>
                    </Table>
                </div>
                {(activeTab === "invoices" ? invoices.length : quotes.length) > 5 && (
                    <div className="flex justify-end px-8">
                        <Button variant="ghost" className="text-gray-900 font-semibold" asChild>
                            <Link href={activeTab === "invoices" ? "/finance/invoices" : "/finance/quotes"}>View all {activeTab}</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
