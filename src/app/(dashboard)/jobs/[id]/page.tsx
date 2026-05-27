"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, Vehicle, Job, Invoice, Quote, JobStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    ChevronLeft,
    Clock,
    Wrench,
    DollarSign,
    CheckCircle,
    Activity,
    Calendar,
    User as UserIcon,
    Car,
    FileText,
    AlertCircle,
    History,
    Loader2,
    Search,
    Trash2,
    Plus,
    Minus,
    Package
} from "lucide-react";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartUsed, InventoryItem } from "@/types";

export default function JobDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();

    const [job, setJob] = useState<Job | null>(null);
    const [customer, setCustomer] = useState<User | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [technician, setTechnician] = useState<User | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
    const [availableTechnicians, setAvailableTechnicians] = useState<User[]>([]);
    const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
    const [updatingTeam, setUpdatingTeam] = useState(false);
    const [isEditJobOpen, setIsEditJobOpen] = useState(false);
    const [updatingJob, setUpdatingJob] = useState(false);
    const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [partSearch, setPartSearch] = useState("");
    const [showPartsPicker, setShowPartsPicker] = useState(false);
    const [generatingQuote, setGeneratingQuote] = useState(false);

    const [editForm, setEditForm] = useState({
        description: "",
        serviceCharge: 0,
        issues: [] as string[],
        vehicleId: "",
        partsUsed: [] as (PartUsed & { maxQty?: number })[],
        assignedTechnicianIds: [] as string[]
    });

    const ISSUE_OPTIONS = [
        'Servicing',
        'Mechanical',
        'Electrical',
        'Hydraulic',
        'Software / Sensors',
        'Wear & Tear',
        'Accidental Damage',
        'Fluid Leak',
        'Noise / Vibration',
        'Overheating',
        'Performance Loss',
        'Others',
    ];

    useEffect(() => {
        const fetchJobData = async () => {
            if (!currentUser?.workshopId || !id) return;
            try {
                const jobData = await firebaseService.getJob(id as string);
                if (jobData) {
                    setJob(jobData);
                    setSelectedTechIds(jobData.assignedTechnicianIds || (jobData.assignedTechnicianId ? [jobData.assignedTechnicianId] : []));
                    setEditForm({
                        description: jobData.description || "",
                        serviceCharge: jobData.serviceCharge || 0,
                        issues: jobData.issues || [],
                        vehicleId: jobData.vehicleId || "",
                        partsUsed: jobData.partsUsed || [],
                        assignedTechnicianIds: jobData.assignedTechnicianIds || (jobData.assignedTechnicianId ? [jobData.assignedTechnicianId] : [])
                    });

                    const [custData, vehData, invData, quoteData, techsData, custVehs, inventory] = await Promise.all([
                        firebaseService.getUser(jobData.userId),
                        firebaseService.getVehicle(jobData.vehicleId),
                        firebaseService.getInvoices(undefined, currentUser.workshopId).then(list => list.filter(inv => inv.jobId === id)),
                        firebaseService.getQuotes(currentUser.workshopId).then(list => list.filter(q => q.jobId === id)),
                        firebaseService.getUsersByRole('technician', currentUser.workshopId),
                        firebaseService.getVehicles(jobData.userId),
                        firebaseService.getInventoryItems(currentUser.workshopId)
                    ]);

                    setCustomer(custData);
                    setVehicle(vehData);
                    setInvoices(invData);
                    setQuotes(quoteData);
                    setAvailableTechnicians(techsData);
                    setCustomerVehicles(custVehs);
                    setInventoryItems(inventory);

                    if (jobData.assignedTechnicianId) {
                        const techData = await firebaseService.getUser(jobData.assignedTechnicianId);
                        setTechnician(techData);
                    }

                }
            } catch (error) {
                console.error("Error fetching job details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchJobData();
    }, [currentUser, id]);

    const getStatusVariant = (status: JobStatus) => {
        switch (status) {
            case "completed": return "bg-green-50 text-green-700 border-green-100";
            case "repairing": return "bg-blue-50 text-blue-700 border-blue-100";
            case "diagnosed": return "bg-orange-50 text-orange-700 border-orange-100";
            case "received": return "bg-gray-50 text-gray-700 border-gray-100";
            case "cancelled": return "bg-gray-100 text-gray-400 border-gray-200 line-through";
            default: return "bg-gray-50 text-gray-600";
        }
    };

    const allStatuses: JobStatus[] = ['received', 'diagnosed', 'repairing', 'completed', 'cancelled'];

    const statusLabels: Record<JobStatus, string> = {
        received: 'Received',
        diagnosed: 'Diagnosed',
        repairing: 'Repairing',
        completed: 'Completed',
        cancelled: 'Cancelled',
    };

    const handleStatusUpdate = async (newStatus: JobStatus) => {
        if (!job || !currentUser || newStatus === job.status) return;

        setUpdatingStatus(true);
        try {
            const historyEntry = {
                fromStatus: job.status,
                toStatus: newStatus,
                changedAt: new Date(),
                changedByName: currentUser.name || currentUser.email || 'Staff',
                changedBy: currentUser.id,
            };

            const updateData: Record<string, unknown> = {
                status: newStatus,
                statusHistory: [...(job.statusHistory || []), historyEntry],
            };

            if (newStatus === 'completed') {
                updateData.completedAt = new Date();
            }

            await firebaseService.updateJobStatus(job.id, newStatus, currentUser.name || 'System');

            setJob({
                ...job,
                status: newStatus,
                statusHistory: [...(job.statusHistory || []), historyEntry],
                ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
            });

            setIsStatusOpen(false);
            toast.success(`Job status updated to ${newStatus}`);
        } catch (error) {
            console.error('Error updating job status:', error);
            toast.error('Failed to update job status.');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleUpdateTeam = async () => {
        if (!job || !currentUser) return;
        setUpdatingTeam(true);
        try {
            const selectedTechs = availableTechnicians.filter(t => selectedTechIds.includes(t.id));
            const techNames = selectedTechs.map(t => t.name || t.email);

            const updateData: Partial<Job> = {
                assignedTechnicianIds: selectedTechIds,
                technicianNames: techNames,
                assignedTechnicianId: selectedTechIds[0] || undefined,
                technicianName: techNames[0] || undefined,
            };

            await firebaseService.updateJob(job.id, updateData);

            setJob({
                ...job,
                ...updateData
            });

            setIsManageTeamOpen(false);
            toast.success('Technician team updated successfully.');
        } catch (error) {
            console.error('Error updating team:', error);
            toast.error('Failed to update team.');
        } finally {
            setUpdatingTeam(false);
        }
    };

    const toggleTech = (id: string) => {
        setSelectedTechIds(prev =>
            prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
        );
    };

    const handleUpdateJobDetails = async () => {
        if (!job || !currentUser) return;
        setUpdatingJob(true);
        try {
            const technicianNames = editForm.assignedTechnicianIds.map(id => {
                const tech = availableTechnicians.find(t => t.id === id);
                return tech?.name || 'Assigned Staff';
            });

            const updateData: Partial<Job> = {
                description: editForm.description,
                serviceCharge: editForm.serviceCharge,
                issues: editForm.issues,
                vehicleId: editForm.vehicleId,
                partsUsed: editForm.partsUsed.map(({ maxQty, ...rest }) => rest),
                assignedTechnicianIds: editForm.assignedTechnicianIds,
                technicianNames,
                assignedTechnicianId: editForm.assignedTechnicianIds[0] || undefined,
                updatedAt: new Date(),
                type: editForm.issues.includes('Servicing')
                    ? (editForm.issues.length === 1 ? 'service' : 'service_and_repair')
                    : 'repair',
            };

            await firebaseService.updateJob(job.id, updateData);

            if (updateData.vehicleId !== job.vehicleId) {
                const newVeh = await firebaseService.getVehicle(updateData.vehicleId!);
                setVehicle(newVeh);
            }

            setJob({
                ...job,
                ...updateData
            });
            setSelectedTechIds(editForm.assignedTechnicianIds);

            setIsEditJobOpen(false);
            toast.success('Job details updated successfully.');
        } catch (error) {
            console.error('Error updating job:', error);
            toast.error('Failed to update job details.');
        } finally {
            setUpdatingJob(false);
        }
    };

    const handleGenerateQuote = async () => {
        if (!job || !currentUser?.workshopId) return;

        setGeneratingQuote(true);
        try {
            const labourCost = job.serviceCharge || 0;
            const partsUsed = job.partsUsed || [];
            const partsCost = partsUsed.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
            const totalAmount = labourCost + partsCost;

            const quoteItems = [
                {
                    id: 'labour-001',
                    description: 'SERVICE LABOUR/CHARGE',
                    quantity: 1,
                    unitPrice: labourCost,
                    total: labourCost,
                    isAdditionalWork: false,
                    addedAt: new Date(),
                },
                ...partsUsed.map((p, i) => ({
                    id: `part-${i + 1}`,
                    description: p.partName,
                    quantity: p.quantity,
                    unitPrice: p.unitPrice,
                    total: p.quantity * p.unitPrice,
                    isAdditionalWork: false,
                    addedAt: new Date(),
                })),
            ];

            const quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> = {
                workshopId: currentUser.workshopId,
                jobId: job.id,
                userId: job.userId,
                customerName: customer?.name || "Unknown",
                customerEmail: customer?.email,
                customerPhone: customer?.phone,
                items: quoteItems,
                subtotal: totalAmount,
                vatRate: 0,
                vat: 0,
                discount: 0,
                total: totalAmount,
                status: 'pending_approval',
                history: [{
                    action: 'create',
                    description: 'Manual quote generation from Job details',
                    userId: currentUser.id,
                    userName: currentUser.name,
                    timestamp: new Date()
                }]
            };

            const quoteId = await firebaseService.createQuote(quoteData);

            const currentStatus = (job.status || '').toLowerCase().trim();
            if (currentStatus === 'received') {
                try {
                    await firebaseService.updateJobStatus(job.id, 'diagnosed', currentUser.name || 'System');
                    setJob(prev => prev ? {
                        ...prev,
                        status: 'diagnosed',
                        statusHistory: [{
                            fromStatus: 'received' as JobStatus,
                            toStatus: 'diagnosed' as JobStatus,
                            changedAt: new Date(),
                            changedBy: currentUser.id,
                            changedByName: currentUser.name || "System"
                        }, ...(prev.statusHistory || [])]
                    } : null);
                } catch (statusErr) {
                    console.error('Error updating job status to diagnosed:', statusErr);
                    toast.error('Quote created but failed to update job status.');
                }
            }

            const newQuotes = await firebaseService.getQuotes(currentUser.workshopId);
            setQuotes(newQuotes.filter(q => q.jobId === job.id));

            toast.success('Quote generated successfully!');
        } catch (error) {
            console.error('Error generating quote:', error);
            toast.error('Failed to generate quote.');
        } finally {
            setGeneratingQuote(false);
        }
    };

    const toggleIssue = (issue: string) => {
        setEditForm(prev => ({
            ...prev,
            issues: prev.issues.includes(issue)
                ? prev.issues.filter(i => i !== issue)
                : [...prev.issues, issue]
        }));
    };

    const toggleTechInEditForm = (techId: string) => {
        setEditForm(prev => ({
            ...prev,
            assignedTechnicianIds: prev.assignedTechnicianIds.includes(techId)
                ? prev.assignedTechnicianIds.filter(id => id !== techId)
                : [...prev.assignedTechnicianIds, techId]
        }));
    };

    const filteredInventory = useMemo(() => {
        const alreadyAdded = new Set(editForm.partsUsed.map(p => p.partId));
        return inventoryItems
            .filter(item => item.quantity > 0)
            .filter(item => !alreadyAdded.has(item.id))
            .filter(item =>
                item.name.toLowerCase().includes(partSearch.toLowerCase()) ||
                item.category?.toLowerCase().includes(partSearch.toLowerCase())
            );
    }, [inventoryItems, partSearch, editForm.partsUsed]);

    const addPart = (item: InventoryItem) => {
        if (item.quantity <= 0) {
            toast.error(`"${item.name}" is out of stock.`);
            return;
        }

        setEditForm(prev => {
            const existing = prev.partsUsed.find(p => p.partId === item.id);
            if (existing && existing.quantity >= item.quantity) {
                toast.error(`Cannot add more "${item.name}". Max stock reached.`);
                return prev;
            }

            return {
                ...prev,
                partsUsed: existing
                    ? prev.partsUsed.map(p => p.partId === item.id ? { ...p, quantity: p.quantity + 1 } : p)
                    : [
                        ...prev.partsUsed,
                        {
                            partId: item.id,
                            partName: item.name,
                            quantity: 1,
                            unitPrice: item.sellingPrice || item.unitPrice,
                            maxQty: item.quantity,
                        }
                    ]
            };
        });
        setPartSearch("");
        setShowPartsPicker(false);
    };

    const updatePartQty = (partId: string, delta: number) => {
        setEditForm(prev => ({
            ...prev,
            partsUsed: prev.partsUsed.map(p => {
                if (p.partId !== partId) return p;
                const newQty = Math.max(1, Math.min(p.maxQty || 999, p.quantity + delta));
                if (delta > 0 && p.maxQty && p.quantity >= p.maxQty) {
                    toast.error(`Max available stock reached for ${p.partName}`);
                    return p;
                }
                return { ...p, quantity: newQty };
            })
        }));
    };

    const removePart = (partId: string) => {
        setEditForm(prev => ({
            ...prev,
            partsUsed: prev.partsUsed.filter(p => p.partId !== partId)
        }));
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Job Record Not Found</h3>
                <p className="text-gray-500 mt-1">The job request you are looking for might have been removed.</p>
                <Button variant="ghost" className="mt-6 font-semibold" onClick={() => router.push("/jobs")}>
                    <ChevronLeft className="h-4 w-4 mr-2" /> Back to Job List
                </Button>
            </div>
        );
    }

    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

    const partsCost = (job.partsUsed || []).reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
    const estimatedTotal = (job.serviceCharge || 0) + partsCost;

    const totalCost = invoices.length > 0 ? totalInvoiced : estimatedTotal;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl h-12 w-12 bg-white shadow-sm border border-gray-100 hover:bg-gray-50"
                        onClick={() => router.push("/jobs")}
                    >
                        <ChevronLeft className="h-6 w-6 text-gray-900" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-black tracking-tight text-gray-900 capitalize">
                                {job.type.replace('_', ' ')} Application
                            </h1>
                            <Badge className={cn("border px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg", getStatusVariant(job.status))}>
                                {job.status}
                            </Badge>
                        </div>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            Job ID: <span className="text-gray-900 font-mono tracking-normal ml-1">#{job.id.slice(0, 12).toUpperCase()}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-xl font-bold border-gray-200" onClick={() => setIsEditJobOpen(true)}>
                        Edit Job
                    </Button>

                    {quotes.length === 0 && (
                        <Button
                            className="rounded-xl bg-gray-900 hover:bg-black font-bold text-white shadow-md transition-all active:scale-95"
                            onClick={handleGenerateQuote}
                            disabled={generatingQuote}
                        >
                            {generatingQuote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                            Generate Quote
                        </Button>
                    )}

                    <Button variant="outline" className="rounded-xl font-bold border-gray-200">
                        Print Job Card
                    </Button>

                    <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl bg-gray-900 hover:bg-black font-bold shadow-md">
                                Update Status
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm rounded-3xl border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black">Update Job Status</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 py-4">
                                {allStatuses.map((status) => (
                                    <button
                                        key={status}
                                        disabled={updatingStatus || status === job.status}
                                        onClick={() => handleStatusUpdate(status)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all font-bold text-sm",
                                            status === job.status
                                                ? "bg-gray-900 text-white cursor-default"
                                                : "bg-gray-50 hover:bg-gray-100 text-gray-900 cursor-pointer"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-3 w-3 rounded-full",
                                                status === 'received' && "bg-gray-400",
                                                status === 'diagnosed' && "bg-orange-400",
                                                status === 'repairing' && "bg-blue-400",
                                                status === 'completed' && "bg-green-400",
                                                status === 'cancelled' && "bg-red-400",
                                            )} />
                                            <span>{statusLabels[status]}</span>
                                        </div>
                                        {status === job.status && (
                                            <Badge className="bg-white/20 text-white border-none text-[8px] uppercase">Current</Badge>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {updatingStatus && (
                                <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Updating status...
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Core Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Customer & Vehicle Info */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[2.5rem]">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-50 px-10 py-8">
                            <CardTitle className="text-sm font-black text-gray-400 uppercase tracking-widest">Client & Vehicle Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                                        <p className="text-lg font-bold text-gray-900">{customer?.name || "Direct Customer"}</p>
                                        <p className="text-sm text-gray-500 font-medium">{customer?.phone || "No phone provided"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issue Reported</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {job.issues && job.issues.length > 0 ? (
                                                job.issues.map((iss, idx) => (
                                                    <Badge key={idx} variant="outline" className="bg-gray-50/50 border-gray-100 text-gray-600 font-bold text-[10px] uppercase">
                                                        {iss}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">No specific issues selected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assigned Vehicle</p>
                                        {vehicle ? (
                                            <>
                                                <p className="text-lg font-bold text-gray-900">{vehicle.make} {vehicle.model}</p>
                                                <p className="text-sm text-gray-500 font-medium uppercase tracking-widest">Plate: {vehicle.licensePlate}</p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">VIN: {vehicle.vin}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm text-gray-400">Loading vehicle info...</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Job Timeline</p>
                                        <p className="text-sm font-bold text-gray-900">Received: {format(job.createdAt || new Date(), "PPP")}</p>
                                        {job.completedAt && (
                                            <p className="text-sm font-bold text-green-600 mt-1">Completed: {format(job.completedAt, "PPP")}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-10" />

                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detailed Technician Notes</p>
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 italic text-gray-600 leading-relaxed">
                                    {job.description || "No detailed description provided for this job request."}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Parts Used */}
                    {job.partsUsed && job.partsUsed.length > 0 && (
                        <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden mb-8">
                            <CardHeader className="px-10 py-8 border-b border-gray-50 bg-gray-50/50">
                                <CardTitle className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
                                    <Package className="h-4 w-4" /> Parts Used
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-10">
                                <div className="space-y-4">
                                    {job.partsUsed.map((part, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{part.partName}</p>
                                                <p className="text-[10px] text-gray-400 font-bold">{part.quantity} unit{part.quantity > 1 ? 's' : ''} at ₦{part.unitPrice.toLocaleString()} each</p>
                                            </div>
                                            <p className="text-sm font-black text-gray-900">₦{(part.unitPrice * part.quantity).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Job History / Timeline */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[2.5rem]">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-50 px-10 py-8">
                            <CardTitle className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
                                <History className="h-4 w-4" /> Activity Log
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-10">
                            <div className="space-y-8">
                                {job.statusHistory && job.statusHistory.length > 0 ? (
                                    job.statusHistory.map((entry, idx) => (
                                        <div key={idx} className="flex gap-6 relative">
                                            {idx !== job.statusHistory!.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-[-32px] w-px bg-gray-100" />
                                            )}
                                            <div className="h-10 w-10 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center z-10">
                                                <div className="h-2 w-2 rounded-full bg-gray-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-bold text-gray-900">
                                                        Status changed from <span className="text-gray-400 line-through mx-1">{entry.fromStatus}</span> to <span className="text-blue-600">{entry.toStatus}</span>
                                                    </p>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{format(entry.changedAt || new Date(), "MMM d, HH:mm")}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 font-medium mt-1">Processed by {entry.changedByName || "System"}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center py-10 text-gray-400 italic text-sm">
                                        No status history available for this job.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Financials & Technicians */}
                <div className="space-y-8">
                    {/* Financial Summary */}
                    <Card className="border-none shadow-lg bg-gray-900 text-white rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="p-10 pb-4">
                            <CardTitle className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 pt-0 space-y-8">
                            <div>
                                <h3 className="text-4xl font-black tracking-tighter">₦{totalCost.toLocaleString()}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Total Cost</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center col-span-2">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Service Charge</p>
                                    <p className="text-xl font-black text-blue-400">₦{(job.serviceCharge || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Cost</p>
                                    <p className="text-lg font-black text-green-400">₦{totalCost.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Paid</p>
                                    <p className="text-lg font-black text-white">₦{totalPaid.toLocaleString()}</p>
                                </div>
                            </div>

                            <Separator className="bg-white/10" />

                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Linked Documents</p>
                                {quotes.length > 0 && (
                                    <div className="space-y-3">
                                        {quotes.map(q => (
                                            <Button
                                                key={q.id}
                                                variant="secondary"
                                                className="w-full justify-between bg-white text-gray-900 hover:bg-gray-50 rounded-xl"
                                                onClick={() => router.push(`/finance/quotes/${q.id}`)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-4 w-4 text-blue-500" />
                                                    <span className="font-bold">Quote #{q.id.slice(-6).toUpperCase()}</span>
                                                </div>
                                                <Badge className="bg-gray-100 text-gray-600 border-none text-[8px] uppercase">{q.status}</Badge>
                                            </Button>
                                        ))}
                                    </div>
                                )}
                                {invoices.length > 0 && (
                                    <div className="space-y-3">
                                        {invoices.map(inv => (
                                            <Button
                                                key={inv.id}
                                                variant="secondary"
                                                className="w-full justify-between bg-white text-gray-900 hover:bg-gray-50 rounded-xl"
                                                onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <DollarSign className="h-4 w-4 text-green-500" />
                                                    <span className="font-bold">Invoice #{inv.id.slice(-6).toUpperCase()}</span>
                                                </div>
                                                <Badge className="bg-gray-100 text-gray-600 border-none text-[8px] uppercase">{inv.paymentStatus}</Badge>
                                            </Button>
                                        ))}
                                    </div>
                                )}
                                {quotes.length === 0 && invoices.length === 0 && (
                                    <p className="text-xs text-gray-500 italic">No financial documents linked.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team Assigned */}
                    <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Personnel Assigned</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-6">
                            <div className="space-y-4">
                                {(job.assignedTechnicianIds?.length || 0) > 0 ? (
                                    job.assignedTechnicianIds!.map((techId, idx) => (
                                        <div key={techId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 shadow-sm border border-white">
                                                    <AvatarFallback className="bg-gray-900 text-white font-black text-xs">
                                                        {job.technicianNames?.[idx]?.charAt(0) || "T"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{job.technicianNames?.[idx] || 'Assigned Staff'}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Expert Technician</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : job.assignedTechnicianId ? (
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 shadow-sm border border-white">
                                                <AvatarFallback className="bg-gray-900 text-white font-black text-xs">
                                                    {technician?.name?.charAt(0) || "T"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{technician?.name || 'Assigned Staff'}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Technician</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                                            <AlertCircle className="h-6 w-6 text-orange-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">Unassigned</p>
                                        <p className="text-xs text-gray-500 mt-1">Ready for staff allocation.</p>
                                    </div>
                                )}
                            </div>
                            <Dialog open={isManageTeamOpen} onOpenChange={setIsManageTeamOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 font-bold border-none shadow-none">
                                        Manage Team
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black">Assign Technicians</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-6">
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                            {availableTechnicians.length === 0 ? (
                                                <p className="text-sm text-gray-500 text-center py-4 italic">No technicians found.</p>
                                            ) : (
                                                availableTechnicians.map((tech) => (
                                                    <div
                                                        key={tech.id}
                                                        onClick={() => toggleTech(tech.id)}
                                                        className={cn(
                                                            "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                            selectedTechIds.includes(tech.id)
                                                                ? "bg-blue-50 border-blue-200"
                                                                : "bg-gray-50 border-transparent hover:bg-gray-100"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                                <AvatarFallback className="bg-gray-900 text-white font-black text-xs">
                                                                    {tech.name?.charAt(0) || "T"}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900">{tech.name}</p>
                                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Technician</p>
                                                            </div>
                                                        </div>
                                                        <div className={cn(
                                                            "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all",
                                                            selectedTechIds.includes(tech.id)
                                                                ? "bg-blue-600 border-blue-600"
                                                                : "border-gray-200"
                                                        )}>
                                                            {selectedTechIds.includes(tech.id) && <CheckCircle className="h-4 w-4 text-white" />}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="pt-4 flex gap-3">
                                            <Button variant="ghost" onClick={() => setIsManageTeamOpen(false)} className="flex-1 rounded-xl font-bold">
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleUpdateTeam}
                                                disabled={updatingTeam}
                                                className="flex-1 rounded-xl bg-gray-900 hover:bg-black font-bold text-white shadow-lg"
                                            >
                                                {updatingTeam ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                Update Team
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Job Details Dialog */}
            <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
                <DialogContent className="max-w-2xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="text-2xl font-black">Edit Job Details</DialogTitle>
                    </DialogHeader>
                    <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vehicle</Label>
                                <Select
                                    value={editForm.vehicleId}
                                    onValueChange={(val) => setEditForm(prev => ({ ...prev, vehicleId: val }))}
                                >
                                    <SelectTrigger className="rounded-2xl border-gray-200 h-12 font-bold bg-gray-50/50 w-full">
                                        <SelectValue placeholder="Select vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customerVehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.make} {v.model} ({v.licensePlate})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Service Charge (₦)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₦</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={editForm.serviceCharge}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, serviceCharge: parseFloat(e.target.value) || 0 }))}
                                        className="rounded-2xl border-gray-200 h-12 font-bold pl-9 bg-gray-50/50 focus:bg-white transition-colors w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Assign Technicians</Label>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                {availableTechnicians.map((tech) => (
                                    <div
                                        key={tech.id}
                                        onClick={() => toggleTechInEditForm(tech.id)}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border-2",
                                            editForm.assignedTechnicianIds.includes(tech.id)
                                                ? "bg-blue-50 border-blue-200"
                                                : "bg-gray-50 border-transparent hover:bg-gray-100"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                                                <AvatarFallback className="bg-gray-900 text-white font-black text-[10px]">
                                                    {tech.name?.charAt(0) || "T"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <p className="text-sm font-bold text-gray-900">{tech.name}</p>
                                        </div>
                                        {editForm.assignedTechnicianIds.includes(tech.id) && <CheckCircle className="h-4 w-4 text-blue-600" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Issue Categories</Label>
                            <div className="flex flex-wrap gap-2">
                                {ISSUE_OPTIONS.map((option) => (
                                    <Badge
                                        key={option}
                                        variant={editForm.issues.includes(option) ? "default" : "outline"}
                                        className={cn(
                                            "cursor-pointer px-4 py-2 text-xs font-bold transition-all rounded-xl border-2",
                                            editForm.issues.includes(option)
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
                                        )}
                                        onClick={() => toggleIssue(option)}
                                    >
                                        {option}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Parts Used</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl font-bold border-gray-200 text-[10px] uppercase h-8"
                                    onClick={() => setShowPartsPicker(!showPartsPicker)}
                                >
                                    <Plus className="mr-1 h-3 w-3" /> Add Part
                                </Button>
                            </div>

                            {showPartsPicker && (
                                <div className="p-4 bg-gray-100 rounded-2xl space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search inventory..."
                                            className="pl-9 bg-white rounded-xl h-10 border-none shadow-sm"
                                            value={partSearch}
                                            onChange={(e) => setPartSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {filteredInventory.map(item => (
                                            <div
                                                key={item.id}
                                                className="bg-white p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => addPart(item)}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900">{item.name}</p>
                                                    <p className="text-[8px] text-gray-400 font-black uppercase">{item.category} · {item.quantity} in stock</p>
                                                </div>
                                                <p className="text-xs font-black text-gray-900">₦{(item.sellingPrice || 0).toLocaleString()}</p>
                                            </div>

                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {editForm.partsUsed.map((part) => (
                                    <div key={part.partId} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-900">{part.partName}</p>
                                            <p className="text-[10px] text-gray-400 font-bold">₦{part.unitPrice.toLocaleString()} each</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full"
                                                    onClick={() => updatePartQty(part.partId, -1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="text-xs font-black w-4 text-center">{part.quantity}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full"
                                                    onClick={() => updatePartQty(part.partId, 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <p className="text-xs font-black w-20 text-right">₦{(part.unitPrice * part.quantity).toLocaleString()}</p>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-red-400 hover:text-red-500 hover:bg-red-50"
                                                onClick={() => removePart(part.partId)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Technician Description / Notes</Label>
                            <Textarea
                                placeholder="Describe the findings or work needed..."
                                value={editForm.description}
                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                className="rounded-2xl border-gray-200 min-h-[150px] font-medium resize-none focus:ring-2 focus:ring-gray-900/5 bg-gray-50/50 focus:bg-white transition-colors p-4"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4 mt-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsEditJobOpen(false)}
                            className="flex-1 rounded-2xl font-bold h-12 hover:bg-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateJobDetails}
                            disabled={updatingJob}
                            className="flex-1 rounded-2xl bg-gray-900 hover:bg-black font-bold h-12 shadow-xl shadow-gray-200"
                        >
                            {updatingJob ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

