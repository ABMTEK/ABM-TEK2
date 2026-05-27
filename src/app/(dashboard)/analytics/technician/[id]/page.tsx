"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, Job, Vehicle } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    ChevronLeft,
    Clock,
    Wrench,
    DollarSign,
    CheckCircle,
    Activity,
    FilterX,
    Calendar
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

export default function TechnicianDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuthStore();

    const [jobs, setJobs] = useState<Job[]>([]);
    const [technician, setTechnician] = useState<User | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
    });
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.workshopId || !id) return;
            try {
                const [jobsData, usersData, invoicesData] = await Promise.all([
                    firebaseService.getJobs(undefined, user.workshopId),
                    firebaseService.getUsersByWorkshop(user.workshopId),
                    firebaseService.getInvoices(undefined, user.workshopId)
                ]);

                const tech = usersData.find(u => u.id === id);
                setTechnician(tech || null);
                setJobs(jobsData);
                setInvoices(invoicesData);
            } catch (error) {
                console.error("Error fetching technician details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, id]);

    const filteredJobs = useMemo(() => {
        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        return jobs.filter(job => {
            const isTechAssigned = (job.assignedTechnicianIds?.includes(id as string)) || (job.assignedTechnicianId === id);
            if (!isTechAssigned) return false;

            const createdAt = job.createdAt ? new Date(job.createdAt) : new Date();
            const completedAt = job.completedAt ? new Date(job.completedAt) : null;

            const createdMatch = isWithinInterval(createdAt, { start, end });

            const completedMatch = completedAt && isWithinInterval(completedAt, { start, end });

            const jobInvoices = invoices.filter(inv => inv.jobId === job.id);
            const paymentMatch = jobInvoices.some(inv =>
                inv.paymentHistory?.some((p: any) => {
                    const pDate = p.date ? new Date(p.date) : null;
                    return pDate && isWithinInterval(pDate, { start, end });
                })
            );

            const typeMatch = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.type);

            return (createdMatch || completedMatch || paymentMatch) && typeMatch;
        });
    }, [jobs, id, dateRange, selectedJobTypes, invoices]);

    const stats = useMemo(() => {
        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        const completedJobs = filteredJobs.filter(j => {
            const cDate = j.completedAt ? new Date(j.completedAt) : null;
            return j.status === 'completed' && cDate && isWithinInterval(cDate, { start, end });
        });

        if (completedJobs.length === 0) {
            filteredJobs.forEach(j => {
                if (j.status === 'completed' && j.createdAt && isWithinInterval(new Date(j.createdAt), { start, end })) {
                    completedJobs.push(j);
                }
            });
        }

        const totalRevenue = filteredJobs.reduce((sum, job) => {
            const jobInvoices = invoices.filter(inv => inv.jobId === job.id);
            const techIds = job.assignedTechnicianIds || (job.assignedTechnicianId ? [job.assignedTechnicianId] : []);

            const jobRevenue = jobInvoices.reduce((invSum, inv) => {
                if (!inv.paymentHistory) return invSum;
                return invSum + inv.paymentHistory.reduce((pSum: number, p: any) => {
                    const pDate = p.date ? new Date(p.date) : null;
                    if (pDate && isWithinInterval(pDate, { start, end })) {
                        return pSum + ((p.amount || 0) / (techIds.length || 1));
                    }
                    return pSum;
                }, 0);
            }, 0);

            return sum + jobRevenue;
        }, 0);

        return {
            totalJobs: completedJobs.length,
            totalRevenue,
            activeJobs: filteredJobs.filter(j => j.status !== 'completed').length
        };
    }, [filteredJobs, invoices, dateRange, id]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!technician) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500">Technician not found.</p>
                <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" /> Back to Analytics
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl h-12 w-12 bg-white shadow-sm border-none hover:bg-gray-50"
                        onClick={() => router.back()}
                    >
                        <ChevronLeft className="h-6 w-6 text-gray-900" />
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-4 border-white shadow-sm">
                            <AvatarFallback className="bg-gray-100 text-gray-900 font-semibold text-2xl">
                                {technician.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{technician.name}</h1>
                            <p className="text-gray-500 font-medium">Technician Performance Hub</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white/50 p-2 rounded-[1.5rem] backdrop-blur-sm self-start">
                    <div className="flex items-center gap-4 px-3 border-r border-gray-200">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest pl-1">Start Date</Label>
                            <Input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="h-9 w-36 border-none bg-transparent font-semibold text-gray-900 p-1 focus-visible:ring-0"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest pl-1">End Date</Label>
                            <Input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="h-9 w-36 border-none bg-transparent font-semibold text-gray-900 p-1 focus-visible:ring-0"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white flex flex-col items-center justify-center text-center space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-2">
                        <DollarSign className="h-6 w-6 text-gray-900" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Revenue Share</p>
                    <p className="text-3xl font-bold text-gray-900">₦{stats.totalRevenue.toLocaleString()}</p>
                </Card>

                <Card className="p-6 border-none shadow-sm bg-white flex flex-col items-center justify-center text-center space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center mb-2">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed Jobs</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalJobs}</p>
                </Card>

                <Card className="p-6 border-none shadow-sm bg-white flex flex-col items-center justify-center text-center space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-2">
                        <Activity className="h-6 w-6 text-orange-600" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Progress</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.activeJobs}</p>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-400" /> Job History
                    </h2>
                    <p className="text-sm font-medium text-gray-400">{filteredJobs.length} total assignments</p>
                </div>

                <Card className="bg-white border-none shadow-sm p-0 overflow-hidden rounded-[2rem]">
                    {filteredJobs.length === 0 ? (
                        <div className="py-20 text-center">
                            <FilterX className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-medium">No results for this selection.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/30">
                                        <th className="p-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Details</th>
                                        <th className="p-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
                                        <th className="p-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                        <th className="p-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredJobs.sort((a, b) => {
                                        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                                        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                                        return dateB - dateA;
                                    }).map((job) => {
                                        const jobInvoices = invoices.filter(inv => inv.jobId === job.id);
                                        const techIds = job.assignedTechnicianIds || (job.assignedTechnicianId ? [job.assignedTechnicianId] : []);
                                        const start = startOfDay(new Date(dateRange.start));
                                        const end = endOfDay(new Date(dateRange.end));

                                        const revenue = jobInvoices.reduce((sum, inv) => {
                                            if (!inv.paymentHistory) return sum;
                                            return sum + inv.paymentHistory.reduce((pSum: number, p: any) => {
                                                const pDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : null;
                                                if (pDate && isWithinInterval(pDate, { start, end })) {
                                                    return pSum + ((p.amount || 0) / (techIds.length || 1));
                                                }
                                                return pSum;
                                            }, 0);
                                        }, 0);

                                        return (
                                            <tr key={job.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="p-8">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-bold text-gray-900">#{job.id.slice(0, 8)}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-3 w-3 text-gray-300" />
                                                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">
                                                                {format(job.createdAt || new Date(), "PPP")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <Badge className="bg-gray-100 text-gray-600 border-none font-semibold text-[10px] uppercase px-3 py-1">
                                                        {job.type?.replace('_', ' ') || 'REPAIR'}
                                                    </Badge>
                                                </td>
                                                <td className="p-8">
                                                    <Badge className={cn("border-none font-semibold text-[10px] uppercase px-3 py-1",
                                                        job.status === 'completed' ? "bg-green-50 text-green-700" :
                                                            job.status === 'repairing' ? "bg-blue-50 text-blue-700" :
                                                                "bg-orange-50 text-orange-700")}>
                                                        {job.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-8 text-right">
                                                    <span className="text-base font-bold text-gray-900">₦{revenue.toLocaleString()}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
