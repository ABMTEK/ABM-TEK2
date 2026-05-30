"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { User, Job, Invoice, Vehicle, RestockRequest } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign,
    CheckCircle,
    TrendingUp,
    Calendar,
    FilterX,
    BarChart3,
    Clock,
    FileText,
    Package,
    Wallet,
    Clock3,
    FileEdit,
    Layers,
    Timer,
    Zap,
    ShieldCheck
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
    });
    const [selectedTechId, setSelectedTechId] = useState<string>("all");
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const isSuperAdmin = user?.role === "super_admin";
            if (!user?.workshopId && !isSuperAdmin) {
                setLoading(false);
                return;
            }
            try {
                const workshopIdToFetch = isSuperAdmin && !user.workshopId ? undefined : user.workshopId;

                const [jobsData, invoicesData, inventoryData, usersData, restockData] = await Promise.all([
                    firebaseService.getJobs(undefined, workshopIdToFetch),
                    firebaseService.getInvoices(undefined, workshopIdToFetch),
                    firebaseService.getInventoryItems(workshopIdToFetch),
                    firebaseService.getUsersByWorkshop(workshopIdToFetch),
                    workshopIdToFetch ? firebaseService.getRestockRequests(workshopIdToFetch, 'pending') : Promise.resolve([]),
                ]);

                const vehiclesPromises = usersData.map(u => firebaseService.getVehicles(u.id));
                const vehiclesDataNested = await Promise.all(vehiclesPromises);
                const flattenedVehicles = vehiclesDataNested.flat();

                setJobs(jobsData);
                setRestockRequests(restockData);
                setInvoices(invoicesData);
                setInventory(inventoryData);
                setAllUsers(usersData);
                setTechnicians(usersData.filter(u => u.role === 'technician'));
                setVehicles(flattenedVehicles);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            const jobDate = job.createdAt || new Date();
            const start = startOfDay(new Date(dateRange.start));
            const end = endOfDay(new Date(dateRange.end));
            const dateMatch = isWithinInterval(jobDate, { start, end });
            const techMatch = selectedTechId === "all" ||
                (job.assignedTechnicianIds?.includes(selectedTechId)) ||
                (job.assignedTechnicianId === selectedTechId);
            const typeMatch = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.type);

            return dateMatch && techMatch && typeMatch;
        });
    }, [jobs, dateRange, selectedTechId, selectedJobTypes]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const invDate = inv.createdAt || new Date();
            const start = startOfDay(new Date(dateRange.start));
            const end = endOfDay(new Date(dateRange.end));
            const dateMatch = isWithinInterval(invDate, { start, end });

            return dateMatch;
        });
    }, [invoices, dateRange]);

    const filteredCoreStats = useMemo(() => {
        const totalPaid = invoices.reduce((acc, inv) => {
            if (!inv.paymentHistory || !Array.isArray(inv.paymentHistory)) return acc;

            const start = startOfDay(new Date(dateRange.start));
            const end = endOfDay(new Date(dateRange.end));

            const periodPayments = inv.paymentHistory.reduce((sum, p) => {
                const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                if (pDate && isWithinInterval(pDate, { start, end })) {
                    return sum + (p.amount || 0);
                }
                return sum;
            }, 0);

            return acc + periodPayments;
        }, 0);

        const approvedInvoices = filteredInvoices.filter(inv =>
            inv.status === 'approved' ||
            inv.invoiceStatus === 'approved' ||
            inv.invoiceStatus === 'settled'
        );
        const totalInvoiced = approvedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const outstanding = totalInvoiced - totalPaid;
        const pendingCount = filteredInvoices.filter(inv => inv.paymentStatus !== 'paid').length;
        const lowStockCount = inventory.filter(item => item.quantity <= item.minStockLevel).length;

        const pendingJobs = filteredJobs.filter(j => j.status === 'received' || j.status === 'diagnosed').length;
        const activeJobs = filteredJobs.filter(j => j.status === 'repairing').length;
        const completedJobsCount = filteredJobs.filter(j => j.status === 'completed').length;

        const pendingRestockCount = restockRequests.length;
        return { totalPaid, outstanding, pendingCount, lowStockCount, pendingJobs, activeJobs, completedJobsCount, pendingRestockCount };
    }, [filteredInvoices, invoices, inventory, filteredJobs, dateRange, restockRequests]);

    const getCustomerName = (userId: string) => {
        const u = allUsers.find(u => u.id === userId);
        return u?.name || `Customer ${userId.slice(0, 5)}`;
    };

    const getVehicleInfo = (vehicleId: string) => {
        const v = vehicles.find(v => v.id === vehicleId);
        return v ? `${v.make} ${v.model}` : "Unknown Vehicle";
    };

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "completed": return "bg-[#30D158]/20 text-[#30D158] border-[#30D158]/40";
            case "repairing": return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
            case "diagnosed": return "bg-[#007AFF]/20 text-[#007AFF] border-[#007AFF]/40";
            case "received": return "bg-[#FFA500]/20 text-[#FFA500] border-[#FFA500]/40";
            case "cancelled": return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const resetFilters = () => {
        setDateRange({
            start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
            end: format(new Date(), "yyyy-MM-dd"),
        });
        setSelectedTechId("all");
        setSelectedJobTypes([]);
    };

    if (loading) return <PageLoader message="Loading workshop stats..." />;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Overview
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">
                        {format(new Date(), "EEEE, MMMM d, yyyy")}
                    </p>
                </div>
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#2E2E2E] bg-white dark:bg-[#1C1C1C] text-gray-600 dark:text-gray-300 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    <FilterX className="h-4 w-4" /> Reset Filters
                </button>
            </div>

            {/* Global Filter Bar */}
            <div className="bg-white/70 dark:bg-[#1C1C1C]/90 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-[#2E2E2E] flex flex-wrap lg:flex-nowrap items-end gap-6 mx-0">
                <div className="flex-1 min-w-[200px] space-y-2">
                    <Label className="text-xs font-medium text-gray-400 uppercase tracking-widest pl-1">Start Date</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="bg-gray-50/50 border-none rounded-2xl pl-10 h-11 focus-visible:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex-1 min-w-[200px] space-y-2">
                    <Label className="text-xs font-medium text-gray-400 uppercase tracking-widest pl-1">End Date</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="bg-gray-50/50 border-none rounded-2xl pl-10 h-11 focus-visible:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex-1 min-w-[200px] space-y-2">
                    <Label className="text-xs font-medium text-gray-400 uppercase tracking-widest pl-1">Technician</Label>
                    <Select onValueChange={setSelectedTechId} value={selectedTechId}>
                        <SelectTrigger className="bg-gray-50/50 border-none rounded-2xl h-11 focus:ring-blue-500">
                            <SelectValue placeholder="All Technicians" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                            <SelectItem value="all">All Technicians</SelectItem>
                            {technicians.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[200px] space-y-2">
                    <Label className="text-xs font-medium text-gray-400 uppercase tracking-widest pl-1">Job Type</Label>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full bg-gray-50/50 border-none rounded-2xl h-11 justify-between px-3 font-normal hover:bg-gray-100">
                                <span className="truncate">
                                    {selectedJobTypes.length === 0 ? "All Types" :
                                        selectedJobTypes.length === 1 ? selectedJobTypes[0].replace('_', ' ') :
                                            `${selectedJobTypes.length} Types selected`}
                                </span>
                                <FilterX className="h-4 w-4 opacity-50" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black">Select Job Types</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                {['service', 'repair', 'tow', 'complaint', 'service_and_repair'].map((type) => (
                                    <div key={type} className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setSelectedJobTypes(prev =>
                                                    prev.includes(type)
                                                        ? prev.filter(t => t !== type)
                                                        : [...prev, type]
                                                );
                                            }}
                                            className={cn(
                                                "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                selectedJobTypes.includes(type)
                                                    ? "bg-gray-900 border-gray-900 text-white"
                                                    : "bg-white border-gray-200"
                                            )}
                                        >
                                            {selectedJobTypes.includes(type) && <CheckCircle className="h-4 w-4" />}
                                        </button>
                                        <Label className="text-sm capitalize cursor-pointer" onClick={() => {
                                            setSelectedJobTypes(prev =>
                                                prev.includes(type)
                                                    ? prev.filter(t => t !== type)
                                                    : [...prev, type]
                                            );
                                        }}>
                                            {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <div className="px-8 flex justify-end gap-3 mt-4">
                                <Button
                                    variant="ghost"
                                    className="rounded-xl font-bold"
                                    onClick={() => setSelectedJobTypes([])}
                                >
                                    Reset
                                </Button>
                                <DialogTrigger asChild>
                                    <Button className="rounded-xl bg-gray-900 font-bold px-8">Done</Button>
                                </DialogTrigger>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Core Summary Cards - Financials & Inventory */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {[
                    { label: "Total Paid", value: `₦${filteredCoreStats.totalPaid.toLocaleString()}`, from: "#16A34A", to: "#15803d" },
                    { label: "Outstanding", value: `₦${filteredCoreStats.outstanding.toLocaleString()}`, from: "#E87C2B", to: "#c96a1f" },
                    { label: "Pending Invoices", value: filteredCoreStats.pendingCount, from: "#2563eb", to: "#1d4ed8", href: "/finance/invoices?payment=pending" },
                    { label: "Low Stock", value: filteredCoreStats.lowStockCount, from: "#DC2626", to: "#b91c1c", href: "/inventory" },
                    { label: "Restock Requests", value: filteredCoreStats.pendingRestockCount, from: "#7c3a1e", to: "#E87C2B", href: "/inventory?tab=requests" },
                ].map((stat, i) => (
                    <Card
                        key={i}
                        className={cn(
                            "border-none shadow-md overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all",
                            stat.href && "cursor-pointer"
                        )}
                        style={{ background: `linear-gradient(135deg, ${stat.from}, ${stat.to})` }}
                        onClick={() => stat.href && router.push(stat.href)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{stat.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white leading-none">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Job Statistics Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {[
                    { label: "Pending Jobs", value: filteredCoreStats.pendingJobs, from: "#d97706", to: "#b45309", href: `/jobs?status=pending&from=${dateRange.start}&to=${dateRange.end}` },
                    { label: "Active Jobs", value: filteredCoreStats.activeJobs, from: "#0284c7", to: "#0369a1", href: `/jobs?status=active&from=${dateRange.start}&to=${dateRange.end}` },
                    { label: "Completed Jobs", value: filteredCoreStats.completedJobsCount, from: "#059669", to: "#047857", href: `/jobs?status=completed&from=${dateRange.start}&to=${dateRange.end}` },
                ].map((stat, i) => (
                    <Card
                        key={i}
                        className="border-none shadow-md overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                        style={{ background: `linear-gradient(135deg, ${stat.from}, ${stat.to})` }}
                        onClick={() => router.push(stat.href)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{stat.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white leading-none">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Separator className="bg-gray-100" />

            {/* Recent Jobs Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Recent Activity
                    </h3>
                    <Link
                        href="/analytics"
                        className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-sm flex items-center gap-2 hover:bg-black transition-colors shadow-md"
                    >
                        View Detailed Analytics
                    </Link>
                </div>

                <div className="bg-white dark:bg-[#161616] overflow-hidden rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-[#1C1C1C]/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer / Vehicle</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Job Type</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Technician</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-[#2E2E2E]">
                                {filteredJobs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-16 text-center text-gray-400 font-bold">
                                            No recent jobs found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredJobs.slice(0, 10).map((job) => (
                                        <tr
                                            key={job.id}
                                            className="hover:bg-gray-50/50 dark:hover:bg-[#222222]/60 transition-colors group cursor-pointer"
                                            onClick={() => router.push(`/jobs/${job.id}`)}
                                        >
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{getCustomerName(job.userId)}</p>
                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight mt-0.5">{getVehicleInfo(job.vehicleId)}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <Badge className="bg-blue-50 text-blue-700 border-none rounded-lg font-bold text-[10px] uppercase tracking-widest px-3 py-1">
                                                    {job.type.replaceAll('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 shadow-sm border border-white">
                                                        <AvatarFallback className="bg-gray-100 text-gray-900 text-[10px] font-bold">
                                                            {job.technicianNames?.[0]?.charAt(0) || <Clock className="h-3 w-3" />}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-semibold text-gray-700">{job.technicianNames?.[0] || 'Unassigned'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <Badge
                                                    variant="outline"
                                                    className={cn("rounded-lg font-bold text-[10px] uppercase tracking-widest px-3 py-1 border shadow-sm",
                                                        getStatusStyles(job.status))}>
                                                    {job.status}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-sm font-medium text-gray-500">{format(job.createdAt || new Date(), "MMM d, yyyy")}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredJobs.length > 10 && (
                        <div className="bg-gray-50/30 p-4 text-center border-t border-gray-50">
                            <Link href="/jobs" className="text-sm font-black text-gray-900 uppercase tracking-widest hover:underline">
                                View All Jobs
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

