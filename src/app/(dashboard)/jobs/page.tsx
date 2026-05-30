"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Job } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInDays, startOfDay, endOfDay, isWithinInterval, startOfMonth } from "date-fns";
import { Plus, Inbox, Search, Wrench, Clock, CheckCircle2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

const STATUS_TABS = [
    { key: "all", label: "All Jobs" },
    { key: "received", label: "Received" },
    { key: "diagnosed", label: "Diagnosed" },
    { key: "repairing", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
];

const JOB_TYPES = ["all", "service", "repair", "complaint", "tow", "service_and_repair"];

function JobsPage() {
    const nextRouter = useRouter();
    const { user } = useAuthStore();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [customers, setCustomers] = useState<Record<string, any>>({});
    const [vehicles, setVehicles] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusTab, setStatusTab] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const searchParams = useSearchParams();
    const statusFilter = searchParams.get("status");

    useEffect(() => {
        if (statusFilter === "pending") setStatusTab("received");
        else if (statusFilter === "active") setStatusTab("repairing");
        else if (statusFilter === "completed") setStatusTab("completed");
    }, [statusFilter]);

    useEffect(() => {
        const fetchJobs = async () => {
            if (!user?.workshopId) { setLoading(false); return; }
            try {
                const [jobsData, usersData] = await Promise.all([
                    firebaseService.getJobs(undefined, user.workshopId),
                    firebaseService.getUsersByWorkshop(user.workshopId)
                ]);
                setJobs(jobsData);
                const customerMap: Record<string, any> = {};
                usersData.forEach(u => { customerMap[u.id] = u; });
                setCustomers(customerMap);
                const uniqueUserIds = Array.from(new Set(jobsData.map(j => j.userId).filter(Boolean)));
                const vehicleRecords: Record<string, any> = {};
                await Promise.all(uniqueUserIds.map(async (uid) => {
                    const vehs = await firebaseService.getVehicles(uid);
                    vehs.forEach(v => { vehicleRecords[v.id] = v; });
                }));
                setVehicles(vehicleRecords);
            } catch (error) {
                console.error("Error fetching jobs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, [user]);

    const stats = useMemo(() => {
        const now = new Date();
        const monthStart = startOfMonth(now);
        return {
            total: jobs.length,
            active: jobs.filter(j => j.status === "repairing").length,
            pending: jobs.filter(j => j.status === "received" || j.status === "diagnosed").length,
            completedMonth: jobs.filter(j => j.status === "completed" && j.completedAt && new Date(j.completedAt) >= monthStart).length,
        };
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            const customer = customers[job.userId];
            const vehicle = vehicles[job.vehicleId];
            const matchSearch = !search ||
                customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
                vehicle?.licensePlate?.toLowerCase().includes(search.toLowerCase()) ||
                vehicle?.make?.toLowerCase().includes(search.toLowerCase()) ||
                job.description?.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusTab === "all" || job.status === statusTab;
            const matchType = typeFilter === "all" || job.type === typeFilter;
            return matchSearch && matchStatus && matchType;
        });
    }, [jobs, customers, vehicles, search, statusTab, typeFilter]);

    const getStatusStyles = (status: string) => {
        switch (status?.toLowerCase()) {
            case "completed": return { badge: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> };
            case "repairing": return { badge: "bg-blue-100 text-blue-700 border-blue-200", icon: <Wrench className="h-3 w-3" /> };
            case "diagnosed": return { badge: "bg-purple-100 text-purple-700 border-purple-200", icon: <AlertCircle className="h-3 w-3" /> };
            case "received": return { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> };
            case "cancelled": return { badge: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="h-3 w-3" /> };
            default: return { badge: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
        }
    };

    const getDaysOpen = (job: Job) => {
        if (job.status === "completed" || job.status === "cancelled") return null;
        const days = differenceInDays(new Date(), new Date(job.createdAt));
        return days;
    };

    if (loading) return <PageLoader message="Loading jobs..." />;

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Jobs</h2>
                    <p className="text-sm text-gray-500 mt-1">Track and manage all workshop service requests</p>
                </div>
                <Button asChild style={{ background: "#E87C2B" }}>
                    <Link href="/jobs/new"><Plus className="mr-2 h-4 w-4" /> New Job</Link>
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                {[
                    { label: "Total Jobs", value: stats.total, from: "#1e3a5f", to: "#2563eb" },
                    { label: "In Progress", value: stats.active, from: "#1e3a6f", to: "#0284c7" },
                    { label: "Pending", value: stats.pending, from: "#7c3a1e", to: "#E87C2B" },
                    { label: "Completed This Month", value: stats.completedMonth, from: "#1e5f3a", to: "#16a34a" },
                ].map((s, i) => (
                    <Card key={i} className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg,${s.from},${s.to})` }}>
                        <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</p>
                            <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="px-8 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Search customer, plate, description…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Job Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {JOB_TYPES.map(t => (
                                <SelectItem key={t} value={t}>
                                    {t === "all" ? "All Types" : t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Status Tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
                    {STATUS_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setStatusTab(tab.key)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                                statusTab === tab.key
                                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                                    : "text-gray-500 hover:text-gray-700"
                            )}>
                            {tab.label}
                            <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                                statusTab === tab.key ? "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300" : "text-gray-400"
                            )}>
                                {tab.key === "all" ? jobs.length : jobs.filter(j => j.status === tab.key).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border-y bg-white dark:bg-gray-900 w-full shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                            <TableHead className="pl-8">Customer / Vehicle</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Technician</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Days Open</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right pr-8">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredJobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400">
                                            <Inbox className="h-10 w-10 stroke-[1.5]" />
                                        </div>
                                        <p className="font-semibold text-gray-900 dark:text-white">No jobs found</p>
                                        <Button asChild style={{ background: "#E87C2B" }}>
                                            <Link href="/jobs/new">Create New Job</Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredJobs.map(job => {
                            const { badge, icon } = getStatusStyles(job.status);
                            const daysOpen = getDaysOpen(job);
                            const vehicle = vehicles[job.vehicleId];
                            return (
                                <TableRow key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group" onClick={() => nextRouter.push(`/jobs/${job.id}`)}>
                                    <TableCell className="pl-8">
                                        <p className="font-semibold text-gray-900 dark:text-white">{customers[job.userId]?.name || "Walk-in"}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.licensePlate}` : "No vehicle"}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm capitalize text-gray-700 dark:text-gray-300 font-medium">{job.type.replace("_", " ")}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {job.technicianNames?.[0] || job.technicianName || <span className="text-gray-400 italic">Unassigned</span>}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit px-2 py-0.5", badge)}>
                                            {icon}{job.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {daysOpen !== null ? (
                                            <span className={cn("text-sm font-bold", daysOpen > 7 ? "text-red-500" : daysOpen > 3 ? "text-amber-500" : "text-gray-500")}>
                                                {daysOpen}d
                                            </span>
                                        ) : <span className="text-gray-400">—</span>}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{job.createdAt ? format(new Date(job.createdAt), "MMM d, HH:mm") : "—"}</TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            View <ArrowRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <p className="text-xs text-gray-400 text-center">{filteredJobs.length} of {jobs.length} jobs shown</p>
        </div>
    );
}

export default function JobsPageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>}>
            <JobsPage />
        </Suspense>
    );
}
