"use client";

import { useEffect, useState, useMemo } from "react";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, Job, Vehicle } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    CheckCircle,
    TrendingUp,
    Calendar,
    FilterX,
    BarChart3,
    Clock,
    Package,
    Wallet,
    Layers,
    Car,
    Wrench,
    DollarSign
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageLoader } from "@/components/ui/page-loader";

export default function AnalyticsPage() {
    const { user } = useAuthStore();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [technicians, setTechnicians] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
    });
    const [selectedTechId, setSelectedTechId] = useState<string>("all");
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [showAllTechnicians, setShowAllTechnicians] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const [jobsData, usersData, invoicesData, inventoryData] = await Promise.all([
                    firebaseService.getJobs(undefined, user.workshopId),
                    firebaseService.getUsersByWorkshop(user.workshopId),
                    firebaseService.getInvoices(undefined, user.workshopId),
                    firebaseService.getInventoryItems(user.workshopId)
                ]);

                const vehiclesPromises = usersData.map(u => firebaseService.getVehicles(u.id));
                const vehiclesDataNested = await Promise.all(vehiclesPromises);
                const flattenedVehicles = vehiclesDataNested.flat();

                setJobs(jobsData);
                setTechnicians(usersData.filter(u => u.role === 'technician'));
                setAllUsers(usersData);
                setInvoices(invoicesData);
                setInventory(inventoryData);
                setVehicles(flattenedVehicles);
            } catch (error) {
                console.error("Error fetching analytics data:", error);
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

    const analyticsStats = useMemo(() => {
        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        const totalRevenue = invoices.reduce((acc: number, inv: any) => {
            if (!inv.paymentHistory || !Array.isArray(inv.paymentHistory)) return acc;

            const periodPayments = inv.paymentHistory.reduce((sum: number, p: any) => {
                const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                if (pDate && isWithinInterval(pDate, { start, end })) {
                    if (inv.jobId) {
                        const job = jobs.find(j => j.id === inv.jobId);
                        if (job) {
                            const techMatch = selectedTechId === "all" ||
                                (job.assignedTechnicianIds?.includes(selectedTechId)) ||
                                (job.assignedTechnicianId === selectedTechId);
                            const typeMatch = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.type);
                            if (techMatch && typeMatch) {
                                return sum + (p.amount || 0);
                            }
                        }
                        return sum;
                    }
                    return sum + (p.amount || 0);
                }
                return sum;
            }, 0);

            return acc + periodPayments;
        }, 0);

        const techMetrics: Record<string, { name: string, jobs: number, revenue: number, totalAssigned: number }> = {};

        technicians.forEach(t => {
            techMetrics[t.id] = { name: t.name, jobs: 0, revenue: 0, totalAssigned: 0 };
        });

        jobs.forEach(job => {
            const techIds = job.assignedTechnicianIds || (job.assignedTechnicianId ? [job.assignedTechnicianId] : []);
            const jobInvoices = invoices.filter(inv => inv.jobId === job.id);

            const jobRevenueInPeriod = jobInvoices.reduce((sum: number, inv: any) => {
                if (!inv.paymentHistory) return sum;
                return sum + inv.paymentHistory.reduce((pSum: number, p: any) => {
                    const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                    if (pDate && isWithinInterval(pDate, { start, end })) {
                        return pSum + (p.amount || 0);
                    }
                    return pSum;
                }, 0);
            }, 0);

            const completedAt = job.completedAt ? (job.completedAt instanceof Date ? job.completedAt : new Date(job.completedAt)) : null;
            const completedInPeriod = job.status === 'completed' && completedAt && isWithinInterval(completedAt, { start, end });

            const fallbackCompleted = job.status === 'completed' && !completedAt && job.createdAt && isWithinInterval(new Date(job.createdAt), { start, end });

            techIds.forEach((id) => {
                if (!techMetrics[id]) {
                    const techUser = allUsers.find(u => u.id === id);
                    techMetrics[id] = { name: techUser?.name || `Tech ${id.slice(0, 4)}`, jobs: 0, revenue: 0, totalAssigned: 0 };
                }

                techMetrics[id].totalAssigned += 1;

                if (completedInPeriod || fallbackCompleted) {
                    techMetrics[id].jobs += 1;
                }

                if (jobRevenueInPeriod > 0) {
                    techMetrics[id].revenue += (jobRevenueInPeriod / (techIds.length || 1));
                }
            });
        });

        const issueUsage: Record<string, { issue: string, count: number, revenue: number }> = {};

        filteredJobs.forEach(job => {
            const issues = job.issues && job.issues.length > 0 ? job.issues : ['General / Other'];
            issues.forEach(issue => {
                if (!issueUsage[issue]) {
                    issueUsage[issue] = { issue, count: 0, revenue: 0 };
                }
                issueUsage[issue].count += 1;
            });
        });

        jobs.forEach(job => {
            const jobInvoices = invoices.filter(inv => inv.jobId === job.id);
            const jobRevenueInPeriod = jobInvoices.reduce((sum: number, inv: any) => {
                if (!inv.paymentHistory) return sum;
                return sum + inv.paymentHistory.reduce((pSum: number, p: any) => {
                    const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                    if (pDate && isWithinInterval(pDate, { start, end })) {
                        return pSum + (p.amount || 0);
                    }
                    return pSum;
                }, 0);
            }, 0);

            if (jobRevenueInPeriod > 0) {
                const issues = job.issues && job.issues.length > 0 ? job.issues : ['General / Other'];
                issues.forEach(issue => {
                    if (!issueUsage[issue]) {
                        issueUsage[issue] = { issue, count: 0, revenue: 0 };
                    }
                    issueUsage[issue].revenue += jobRevenueInPeriod;
                });
            }
        });

        const brandUsage: Record<string, { brand: string, count: number }> = {};
        filteredJobs.forEach(job => {
            if (!job.vehicleId) return;
            const vehicle = vehicles.find(v => v.id === job.vehicleId);
            if (!vehicle?.make) return;

            const brand = vehicle.make.toUpperCase();
            if (!brandUsage[brand]) {
                brandUsage[brand] = { brand: vehicle.make, count: 0 };
            }
            brandUsage[brand].count += 1;
        });

        const partUsage: Record<string, { name: string, quantity: number, revenue: number }> = {};
        invoices.forEach((inv: any) => {
            const invDate = inv.createdAt || (inv.date ? (inv.date instanceof Date ? inv.date : new Date(inv.date)) : new Date());
            if (!isWithinInterval(invDate, { start, end })) return;

            if (inv.jobId) {
                const job = jobs.find(j => j.id === inv.jobId);
                if (job) {
                    const techMatch = selectedTechId === "all" ||
                        (job.assignedTechnicianIds?.includes(selectedTechId)) ||
                        (job.assignedTechnicianId === selectedTechId);
                    const typeMatch = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.type);
                    if (!techMatch || !typeMatch) return;
                }
            }

            inv.items?.forEach((item: any) => {
                if (!item.description) return;
                const partName = item.description.toUpperCase();
                if (partName.includes('LABOUR') || partName === 'SERVICE') return;

                if (!partUsage[partName]) {
                    partUsage[partName] = { name: item.description, quantity: 0, revenue: 0 };
                }
                partUsage[partName].quantity += (item.quantity || 0);
                partUsage[partName].revenue += (item.total || 0);
            });
        });

        const topSellingParts = Object.values(partUsage).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
        const topRevenueParts = Object.values(partUsage).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const totalStockValue = inventory.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);

        const topIssuesByVolume = Object.values(issueUsage).sort((a, b) => b.count - a.count).slice(0, 5);
        const topIssuesByRevenue = Object.values(issueUsage).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const topBrands = Object.values(brandUsage).sort((a, b) => b.count - a.count).slice(0, 5);

        const leaderboard = Object.entries(techMetrics)
            .map(([id, data]) => ({
                id,
                ...data,
                completionRate: data.totalAssigned > 0 ? (data.jobs / data.totalAssigned) * 100 : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);

        const completedJobs = filteredJobs.filter(j => j.status === 'completed');

        return {
            totalRevenue,
            completedCount: completedJobs.length,
            targetPercentage: jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0,
            leaderboard,
            topSellingParts,
            topRevenueParts,
            totalStockValue,
            topIssuesByVolume,
            topIssuesByRevenue,
            topBrands
        };
    }, [filteredJobs, jobs, invoices, inventory, vehicles, dateRange, selectedTechId, selectedJobTypes, technicians, allUsers]);

    const resetFilters = () => {
        setDateRange({
            start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
            end: format(new Date(), "yyyy-MM-dd"),
        });
        setSelectedTechId("all");
        setSelectedJobTypes([]);
    };

    if (loading) return <PageLoader message="Loading analytics..." />;

    return (
        <div className="space-y-8 pb-20 px-8 pt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        Technician Analytics
                    </h2>
                    <p className="text-lg text-gray-500 font-medium whitespace-nowrap">
                        Track performance and workshop productivity
                    </p>
                </div>
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <FilterX className="h-4 w-4" /> Reset Filters
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-wrap lg:flex-nowrap items-end gap-6">
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
                                        <Label className="text-sm font-bold capitalize cursor-pointer" onClick={() => {
                                            setSelectedJobTypes(prev =>
                                                prev.includes(type)
                                                    ? prev.filter(t => t !== type)
                                                    : [...prev, type]
                                            );
                                        }}>
                                            {type.replace('_', ' ')}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-white border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900 leading-none">₦{analyticsStats.totalRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Completed Jobs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900 leading-none">{analyticsStats.completedCount}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Inventory Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900 leading-none">₦{analyticsStats.totalStockValue.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Service & Brand Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Most Requested Issues */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                        Most Requested
                    </h3>
                    <Card className="bg-white border-none shadow-sm flex flex-col gap-3 p-6">
                        {analyticsStats.topIssuesByVolume.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 font-medium text-sm">No issue data available.</p>
                        ) : (
                            analyticsStats.topIssuesByVolume.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                                    <span className="font-semibold text-gray-700 capitalize text-sm">{item.issue}</span>
                                    <Badge className="bg-gray-100 text-gray-700 border-none font-semibold text-[10px]">{item.count} Jobs</Badge>
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                {/* Issues by Revenue */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                        Top Revenue Jobs
                    </h3>
                    <Card className="bg-white border-none shadow-sm flex flex-col gap-3 p-6">
                        {analyticsStats.topIssuesByRevenue.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 font-medium text-sm">No revenue data available.</p>
                        ) : (
                            analyticsStats.topIssuesByRevenue.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                                    <span className="font-semibold text-gray-700 capitalize text-sm">{item.issue}</span>
                                    <span className="font-semibold text-gray-900 text-xs">₦{item.revenue.toLocaleString()}</span>
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                {/* Brand Frequency */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                        Most Repaired Brands
                    </h3>
                    <Card className="bg-white border-none shadow-sm flex flex-col gap-3 p-6">
                        {analyticsStats.topBrands.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 font-medium text-sm">No vehicle data available.</p>
                        ) : (
                            analyticsStats.topBrands.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                                    <span className="font-semibold text-gray-700 text-sm uppercase">{item.brand}</span>
                                    <Badge className="bg-blue-50 text-blue-700 border-none font-semibold text-[10px]">{item.count} Repairs</Badge>
                                </div>
                            ))
                        )}
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                        Top Selling Parts
                    </h3>
                    <Card className="bg-white border-none shadow-sm flex flex-col gap-4 p-6">
                        {analyticsStats.topSellingParts.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 font-medium">No part sales recorded.</p>
                        ) : (
                            analyticsStats.topSellingParts.map((part, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl hover:bg-gray-100 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-900 leading-tight">{part.name}</p>
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Quantity: {part.quantity}</p>
                                    </div>
                                    {/* Rank removed */}
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                        Top Revenue Parts
                    </h3>
                    <Card className="bg-white border-none shadow-sm flex flex-col gap-4 p-6">
                        {analyticsStats.topRevenueParts.length === 0 ? (
                            <p className="py-8 text-center text-gray-400 font-medium">No revenue from parts recorded.</p>
                        ) : (
                            analyticsStats.topRevenueParts.map((part, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl hover:bg-gray-100 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-900 leading-tight">{part.name}</p>
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Revenue: ₦{part.revenue.toLocaleString()}</p>
                                    </div>
                                    {/* Rank removed */}
                                </div>
                            ))
                        )}
                    </Card>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 px-2 flex items-center gap-3">
                    Performance Stats
                </h3>
                <div className="grid gap-4">
                    {analyticsStats.leaderboard.length === 0 ? (
                        <Card className="bg-white border-none shadow-sm p-16 text-center">
                            <p className="text-gray-400 font-medium text-lg">No performance data found.</p>
                            <p className="text-sm text-gray-300 mt-1">Adjust your filters to see results.</p>
                        </Card>
                    ) : (
                        analyticsStats.leaderboard
                            .slice(0, showAllTechnicians ? undefined : 3)
                            .map((tech) => (
                                <Link
                                    key={tech.id}
                                    href={`/analytics/technician/${tech.id}`}
                                    className="block"
                                >
                                    <Card className="bg-white border-none shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col md:flex-row items-center gap-8 cursor-pointer group">
                                        <div className="flex items-center gap-5 min-w-[240px]">
                                            <div className="relative">
                                                <Avatar className="h-16 w-16 border-4 border-white shadow-sm">
                                                    <AvatarFallback className="bg-gray-100 text-gray-900 font-semibold text-2xl">
                                                        {tech.name.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-xl leading-tight">{tech.name}</p>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-tight mt-0.5">Verified Technician</p>
                                            </div>
                                        </div>

                                        {/* Completion rate removed */}

                                        <div className="flex items-center justify-around md:justify-center gap-12 min-w-[200px]">
                                            <div className="text-center">
                                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Revenue</p>
                                                <p className="text-xl font-semibold text-gray-900">₦{Math.round(tech.revenue).toLocaleString()}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Completed Jobs</p>
                                                <p className="text-xl font-semibold text-gray-900">{tech.jobs}</p>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            ))
                    )}
                </div>

                {analyticsStats.leaderboard.length > 3 && (
                    <div className="flex justify-center pt-8">
                        <Button
                            variant="ghost"
                            className="text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-8 rounded-xl transition-all"
                            onClick={() => setShowAllTechnicians(!showAllTechnicians)}
                        >
                            {showAllTechnicians ? "Show Less" : "View All Technicians"}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
