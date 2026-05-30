"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, Job, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Users, Cake, Car, Wrench, Inbox } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { PageLoader } from "@/components/ui/page-loader";
import { cn } from "@/lib/utils";

export default function CustomersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [customers, setCustomers] = useState<User[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "birthday">("all");

    useEffect(() => {
        const fetch = async () => {
            if (!user?.workshopId) { setLoading(false); return; }
            try {
                const [allUsers, jobsData] = await Promise.all([
                    firebaseService.getUsersByWorkshop(user.workshopId),
                    firebaseService.getJobs(undefined, user.workshopId),
                ]);
                const customerUsers = allUsers.filter(u => u.role === "customer");
                setCustomers(customerUsers);
                setJobs(jobsData);

                const vehiclePromises = customerUsers.map(c => firebaseService.getVehicles(c.id));
                const allVehicles = (await Promise.all(vehiclePromises)).flat();
                setVehicles(allVehicles);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [user]);

    const today = new Date();
    const todayMD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const enriched = useMemo(() => {
        return customers.map(c => {
            const customerJobs = jobs.filter(j => j.userId === c.id);
            const customerVehicles = vehicles.filter(v => v.userId === c.id);
            const lastJob = customerJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const daysSinceVisit = lastJob ? differenceInDays(new Date(), new Date(lastJob.createdAt)) : null;
            const isBirthday = c.birthday ? (() => {
                const parts = c.birthday.split("-");
                return parts.length >= 3 && `${parts[1]}-${parts[2]}` === todayMD;
            })() : false;
            return { ...c, jobCount: customerJobs.length, vehicleCount: customerVehicles.length, daysSinceVisit, isBirthday, lastJob };
        });
    }, [customers, jobs, vehicles, todayMD]);

    const birthdayCount = enriched.filter(c => c.isBirthday).length;
    const activeCount = enriched.filter(c => c.daysSinceVisit !== null && c.daysSinceVisit <= 30).length;

    const filtered = useMemo(() => {
        return enriched.filter(c => {
            const matchSearch = !search ||
                c.name?.toLowerCase().includes(search.toLowerCase()) ||
                c.phone?.toLowerCase().includes(search.toLowerCase()) ||
                c.email?.toLowerCase().includes(search.toLowerCase());
            const matchFilter = filter === "all" ||
                (filter === "active" && c.daysSinceVisit !== null && c.daysSinceVisit <= 30) ||
                (filter === "birthday" && c.isBirthday);
            return matchSearch && matchFilter;
        });
    }, [enriched, search, filter]);

    if (loading) return <PageLoader message="Loading customers..." />;

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
                    <p className="text-sm text-gray-500 mt-1">{customers.length} registered customers</p>
                </div>
                <Button asChild style={{ background: "#E87C2B" }}>
                    <Link href="/customers/new"><Plus className="mr-2 h-4 w-4" /> Add Customer</Link>
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                {[
                    { label: "Total Customers", value: customers.length, icon: <Users className="h-5 w-5" />, from: "#1e3a5f", to: "#2563eb" },
                    { label: "Active This Month", value: activeCount, icon: <Wrench className="h-5 w-5" />, from: "#1e5f3a", to: "#16a34a" },
                    { label: "Total Vehicles", value: vehicles.length, icon: <Car className="h-5 w-5" />, from: "#7c3a1e", to: "#E87C2B" },
                    { label: "Birthdays Today", value: birthdayCount, icon: <Cake className="h-5 w-5" />, from: "#5f1e5f", to: "#9333ea" },
                ].map((s, i) => (
                    <Card key={i} className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg,${s.from},${s.to})` }}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</p>
                                <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
                            </div>
                            <div style={{ color: "rgba(255,255,255,0.4)" }}>{s.icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="px-8 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search name, phone, email…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    {[
                        { key: "all", label: "All" },
                        { key: "active", label: "Active (30d)" },
                        { key: "birthday", label: `🎂 Today (${birthdayCount})` },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key as any)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                                filter === f.key ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border-y bg-white dark:bg-gray-900 w-full shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                            <TableHead className="pl-8">Customer</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="text-center">Vehicles</TableHead>
                            <TableHead className="text-center">Total Jobs</TableHead>
                            <TableHead>Last Visit</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right pr-8">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><Inbox className="h-10 w-10 stroke-[1.5]" /></div>
                                        <p className="font-semibold text-gray-900 dark:text-white">No customers found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filtered.map(c => (
                            <TableRow key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors" onClick={() => router.push(`/customers/${c.id}`)}>
                                <TableCell className="pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "#E87C2B" }}>
                                            {c.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                {c.name || "—"}
                                                {c.isBirthday && <span title="Birthday today!">🎂</span>}
                                            </p>
                                            <p className="text-xs text-gray-400">{c.email || "No email"}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">{c.phone || "—"}</TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                                        <Car className="h-3.5 w-3.5 text-gray-400" />{c.vehicleCount}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                                        <Wrench className="h-3.5 w-3.5 text-gray-400" />{c.jobCount}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {c.daysSinceVisit !== null ? (
                                        <span className={cn("text-sm", c.daysSinceVisit <= 7 ? "text-green-600 font-medium" : c.daysSinceVisit <= 30 ? "text-amber-600" : "text-gray-400")}>
                                            {c.daysSinceVisit === 0 ? "Today" : `${c.daysSinceVisit}d ago`}
                                        </span>
                                    ) : <span className="text-gray-400 text-sm">Never</span>}
                                </TableCell>
                                <TableCell className="text-sm text-gray-500">
                                    {c.createdAt ? format(new Date(c.createdAt), "MMM d, yyyy") : "—"}
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <Badge variant="outline" className={cn("text-xs",
                                        c.daysSinceVisit !== null && c.daysSinceVisit <= 30
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-gray-50 text-gray-500 border-gray-200"
                                    )}>
                                        {c.daysSinceVisit !== null && c.daysSinceVisit <= 30 ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-gray-400 text-center px-8">{filtered.length} of {customers.length} customers shown</p>
        </div>
    );
}
