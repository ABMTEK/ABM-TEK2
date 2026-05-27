"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Job } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Inbox, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

export default function JobsPage() {
    const nextRouter = useRouter();
    const { user } = useAuthStore();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [customers, setCustomers] = useState<Record<string, any>>({});
    const [vehicles, setVehicles] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const statusFilter = searchParams.get("status");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    useEffect(() => {
        const fetchJobs = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
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

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "completed": return "bg-[#30D158]/20 text-[#30D158] border-[#30D158]/40";
            case "repairing": return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
            case "diagnosed": return "bg-[#007AFF]/20 text-[#007AFF] border-[#007AFF]/40";
            case "received": return "bg-[#FFA500]/20 text-[#FFA500] border-[#FFA500]/40";
            case "cancelled": return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
            default: return "bg-gray-100 text-gray-600 border-gray-200";
        }
    };

    if (loading) return <PageLoader message="Loading jobs..." />;

    const displayedJobs = (() => {
        let result = jobs;

        if (fromDate && toDate) {
            const start = startOfDay(new Date(fromDate));
            const end = endOfDay(new Date(toDate));
            result = result.filter(j => {
                const jobDate = j.createdAt || new Date();
                return isWithinInterval(jobDate, { start, end });
            });
        }

        if (statusFilter === "pending") return result.filter(j => j.status === "received" || j.status === "diagnosed");
        if (statusFilter === "active") return result.filter(j => j.status === "repairing");
        if (statusFilter === "completed") return result.filter(j => j.status === "completed");
        return result;
    })();

    return (
        <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Jobs</h2>
                    <p className="text-gray-500">Track and manage all workshop service requests.</p>
                </div>
                <Button asChild>
                    <Link href="/jobs/new">
                        <Plus className="mr-2 h-4 w-4" /> New Job
                    </Link>
                </Button>
            </div>

            <div className="bg-white border-y shadow-sm overflow-hidden w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="pl-8">Customer / Vehicle</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedJobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400">
                                            <Inbox className="h-10 w-10 stroke-[1.5]" />
                                        </div>
                                        <div className="max-w-xs mx-auto">
                                            <p className="text-lg font-semibold text-gray-900">
                                                {statusFilter ? `No ${statusFilter} jobs` : "No jobs yet"}
                                            </p>
                                            <p className="text-sm text-gray-500 mb-4">
                                                {statusFilter
                                                    ? <Link href="/jobs" className="text-gray-900 font-semibold hover:underline">View all jobs</Link>
                                                    : "Start by creating your first service request."
                                                }
                                            </p>
                                            {!statusFilter && (
                                                <Button asChild>
                                                    <Link href="/jobs/new">Create New Job</Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedJobs.map((job) => (
                                <TableRow key={job.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => nextRouter.push(`/jobs/${job.id}`)}>
                                    <TableCell className="pl-8">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 truncate max-w-[250px]">
                                                {customers[job.userId]?.name || "Walk-in Customer"}
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium uppercase tracking-tight">
                                                {vehicles[job.vehicleId]
                                                    ? `${vehicles[job.vehicleId].make} ${vehicles[job.vehicleId].model} (${vehicles[job.vehicleId].licensePlate})`
                                                    : "No Vehicle Info"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="capitalize font-medium text-gray-700">
                                            {job.type.replace('_', ' ')}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize px-2 py-0.5 font-bold text-[10px] uppercase tracking-widest border", getStatusStyles(job.status))}>
                                            {job.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-gray-600 text-sm">
                                        {job.createdAt ? format(job.createdAt, "MMM d, HH:mm") : "N/A"}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/jobs/${job.id}`}>
                                                Details <ArrowRight className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
