"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { StaffInvitation, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Loader2, Trash2, Inbox, CheckCircle, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";

const SYSTEM_ROLES = ["service_advisor", "technician", "storekeeper", "accountant", "admin", "vendor"];

export default function StaffManagementPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [invites, setInvites] = useState<StaffInvitation[]>([]);
    const [activeStaff, setActiveStaff] = useState<User[]>([]);
    const [activeVendors, setActiveVendors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"active" | "vendors" | "pending">("active");

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("technician");
    const [submitting, setSubmitting] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<User | StaffInvitation | null>(null);
    const [deleteType, setDeleteType] = useState<"user" | "invite">("user");
    const [deleting, setDeleting] = useState(false);

    const [selectedVendor, setSelectedVendor] = useState<User | null>(null);
    const [vendorProcessing, setVendorProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.workshopId]);

    const loadData = async () => {
        if (!user?.workshopId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [invitesData, usersData] = await Promise.all([
                firebaseService.getStaffInvitations(user.workshopId),
                firebaseService.getUsersByWorkshop(user.workshopId),
            ]);
            setInvites(invitesData);
            setActiveStaff(usersData.filter(u => u.role !== "customer" && u.role !== "vendor"));
            setActiveVendors(usersData.filter(u => u.role === "vendor"));
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Failed to load staff data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvite = async () => {
        if (!user?.workshopId) return;
        if (!name || !email) {
            toast.error("Name and email are required.");
            return;
        }
        if (!email.includes("@")) {
            toast.error("Enter a valid email address.");
            return;
        }

        setSubmitting(true);
        try {
            const { invitationCode } = await firebaseService.createStaffInvitation(
                email, name, role, user.id, user.workshopId, phone || undefined
            );
            toast.success(`Invite created! Code: ${invitationCode}`);
            setName("");
            setEmail("");
            setPhone("");
            setShowInviteModal(false);
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to create invite.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            if (deleteType === "user") {
                await firebaseService.deleteUser(deleteTarget.id);
                toast.success("User removed successfully");
            } else {
                await firebaseService.cancelStaffInvitation(deleteTarget.id);
                toast.success("Invitation cancelled");
            }
            setDeleteTarget(null);
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to remove");
        } finally {
            setDeleting(false);
        }
    };

    const handleApproveVendor = async () => {
        if (!selectedVendor) return;
        setVendorProcessing(true);
        try {
            await firebaseService.approveVendor(selectedVendor.id);
            toast.success("Vendor approved successfully");
            setSelectedVendor(null);
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to approve vendor");
        } finally {
            setVendorProcessing(false);
        }
    };

    const handleRejectVendor = async () => {
        if (!selectedVendor) return;
        setVendorProcessing(true);
        try {
            await firebaseService.rejectVendor(selectedVendor.id);
            toast.success("Vendor application declined");
            setSelectedVendor(null);
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to decline vendor");
        } finally {
            setVendorProcessing(false);
        }
    };

    const handleRemoveVendor = async () => {
        if (!selectedVendor) return;
        setVendorProcessing(true);
        try {
            await firebaseService.deleteUser(selectedVendor.id);
            toast.success("Vendor removed");
            setSelectedVendor(null);
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to remove vendor");
        } finally {
            setVendorProcessing(false);
        }
    };

    const TABS = [
        { key: "active", label: `Staff (${activeStaff.length})` },
        { key: "vendors", label: `Vendors (${activeVendors.length})` },
        { key: "pending", label: `Pending (${invites.length})` },
    ] as const;

    if (loading) return <PageLoader message="Loading staff..." />;

    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    return (
        <div className="pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between px-8 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight">Staff Management</h2>
                </div>
                {isAdmin && (
                    <Button size="sm" onClick={() => setShowInviteModal(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Invite
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-8 border-b border-gray-100">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className={cn(
                            "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                            activeTab === tab.key
                                ? "border-gray-900 text-gray-900 font-semibold"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="border-b border-gray-100 bg-white">
                {activeTab === "active" && (
                    activeStaff.length === 0 ? (
                        <EmptyState message="No active staff members found." />
                    ) : (
                        activeStaff.map((staff) => (
                            <div key={staff.id} className="flex items-center gap-4 px-8 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {staff.name?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{staff.name}</p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {(staff.role || "Unknown").replace("_", " ")} • {staff.email}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-green-50 text-green-700 border-none text-[10px] font-semibold">Active</Badge>
                                    {isAdmin && staff.id !== user?.id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setDeleteTarget(staff); setDeleteType("user"); }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )
                )}

                {activeTab === "vendors" && (
                    activeVendors.length === 0 ? (
                        <EmptyState message="No active vendors found." />
                    ) : (
                        activeVendors.map((vendor) => (
                            <button
                                key={vendor.id}
                                className="w-full flex items-center gap-4 px-8 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-left"
                                onClick={() => setSelectedVendor(vendor)}
                            >
                                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {vendor.name?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{vendor.name || "Unnamed Vendor"}</p>
                                    <p className="text-xs text-gray-400 truncate">{vendor.email}</p>
                                </div>
                                <Badge
                                    className={cn("text-[10px] font-semibold border-none",
                                        vendor.vendorStatus === "active" ? "bg-green-50 text-green-700" :
                                            vendor.vendorStatus === "pending_approval" ? "bg-amber-50 text-amber-700" :
                                                vendor.vendorStatus === "rejected" ? "bg-red-50 text-red-600" :
                                                    "bg-gray-100 text-gray-500"
                                    )}
                                >
                                    {vendor.vendorStatus === "active" ? "Active" :
                                        vendor.vendorStatus === "pending_approval" ? "Pending Approval" :
                                            vendor.vendorStatus === "rejected" ? "Rejected" : "Incomplete"}
                                </Badge>
                            </button>
                        ))
                    )
                )}

                {activeTab === "pending" && (
                    invites.length === 0 ? (
                        <EmptyState message="No invitations sent yet." />
                    ) : (
                        invites.map((invite) => (
                            <div key={invite.id} className="flex items-center gap-4 px-8 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {(invite.name || invite.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{invite.name || invite.email}</p>
                                    <p className="text-xs text-gray-400 truncate capitalize">Role: {invite.role.replace("_", " ")}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <Badge
                                            className={cn("text-[10px] font-semibold border-none",
                                                invite.used ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"
                                            )}
                                        >
                                            {invite.used ? "Used" : "Pending"}
                                        </Badge>
                                        <p className="text-xs font-semibold mt-1 font-mono">{invite.invitationCode}</p>
                                    </div>
                                    {!invite.used && isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setDeleteTarget(invite as any); setDeleteType("invite"); }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>

            {/* Invite Modal */}
            <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invite New Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Email Address *</Label>
                            <Input placeholder="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number (Optional)</Label>
                            <Input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Role</Label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SYSTEM_ROLES.map((r) => (
                                        <SelectItem key={r} value={r} className="capitalize">
                                            {r.replace("_", " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateInvite} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Invite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{deleteType === "user" ? "Remove User" : "Cancel Invitation"}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">
                        {deleteType === "user"
                            ? `Are you sure you want to remove ${(deleteTarget as User)?.name}? This cannot be undone.`
                            : `Are you sure you want to cancel the invitation for ${(deleteTarget as any)?.name || (deleteTarget as any)?.email}?`
                        }
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {deleteType === "user" ? "Remove" : "Cancel Invitation"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Vendor Details Dialog */}
            <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle>Vendor Application</DialogTitle>
                        <DialogDescription className="sr-only">Review vendor application details</DialogDescription>
                    </DialogHeader>

                    {selectedVendor && (
                        <>
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                                {/* Status Banner */}
                                <div className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl",
                                    selectedVendor.vendorStatus === "active" ? "bg-green-50" : "bg-amber-50"
                                )}>
                                    {selectedVendor.vendorStatus === "active" ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <Clock className="h-5 w-5 text-amber-600" />
                                    )}
                                    <span className={cn(
                                        "font-bold text-sm uppercase tracking-wider",
                                        selectedVendor.vendorStatus === "active" ? "text-green-700" : "text-amber-700"
                                    )}>
                                        Status: {selectedVendor.vendorStatus?.replace("_", " ")}
                                    </span>
                                </div>

                                {/* Business Details */}
                                <div className="border border-gray-100 rounded-xl p-4">
                                    <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-gray-100">Business Details</h4>
                                    <DetailRow label="Business Name" value={selectedVendor.businessDetails?.businessName} />
                                    <DetailRow label="RC Number" value={selectedVendor.businessDetails?.rcNumber} />
                                    <DetailRow label="Address" value={selectedVendor.businessDetails?.address} />
                                    <DetailRow label="Location" value={[selectedVendor.businessDetails?.city, selectedVendor.businessDetails?.state, selectedVendor.businessDetails?.country].filter(Boolean).join(", ")} />
                                </div>

                                {/* Contact Person */}
                                <div className="border border-gray-100 rounded-xl p-4">
                                    <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-gray-100">Contact Person</h4>
                                    <DetailRow label="Full Name" value={selectedVendor.name} />
                                    <DetailRow label="Role" value={selectedVendor.businessDetails?.contactRole} />
                                    <DetailRow label="Email" value={selectedVendor.email} />
                                    <DetailRow label="Phone" value={selectedVendor.phone} />
                                    <DetailRow label="NIN" value={selectedVendor.businessDetails?.nin} />
                                </div>

                                {/* Bank Details */}
                                <div className="border border-gray-100 rounded-xl p-4">
                                    <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-gray-100">Bank Details</h4>
                                    <DetailRow label="Bank Name" value={selectedVendor.businessDetails?.bankName} />
                                    <DetailRow label="Account Number" value={selectedVendor.businessDetails?.accountNumber} />
                                    <DetailRow label="Account Name" value={selectedVendor.businessDetails?.accountName} />
                                </div>

                                {/* Documents */}
                                <div className="border border-gray-100 rounded-xl p-4">
                                    <h4 className="font-semibold text-sm mb-3 pb-2 border-b border-gray-100">Documents</h4>
                                    {selectedVendor.documents?.ninImage && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-400 mb-2">NIN Image</p>
                                            <img src={selectedVendor.documents.ninImage} alt="NIN" className="w-full h-48 object-contain bg-gray-50 rounded-lg" />
                                        </div>
                                    )}
                                    {selectedVendor.documents?.certificateOfIncorporation && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-400 mb-2">Certificate of Incorporation</p>
                                            <img src={selectedVendor.documents.certificateOfIncorporation} alt="Certificate" className="w-full h-48 object-contain bg-gray-50 rounded-lg" />
                                        </div>
                                    )}
                                    {selectedVendor.documents?.proofOfAddress && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-400 mb-2">Proof of Address</p>
                                            <img src={selectedVendor.documents.proofOfAddress} alt="Proof of Address" className="w-full h-48 object-contain bg-gray-50 rounded-lg" />
                                        </div>
                                    )}
                                    {(!selectedVendor.documents || Object.keys(selectedVendor.documents).length === 0) && (
                                        <p className="text-sm text-gray-400">No documents uploaded.</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t border-gray-100 px-6 py-4 space-y-3">
                                {selectedVendor.vendorStatus !== "active" && (
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={handleRejectVendor}
                                            disabled={vendorProcessing}
                                        >
                                            {vendorProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Decline
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={handleApproveVendor}
                                            disabled={vendorProcessing}
                                        >
                                            {vendorProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Approve
                                        </Button>
                                    </div>
                                )}
                                <button
                                    className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-colors"
                                    onClick={handleRemoveVendor}
                                    disabled={vendorProcessing}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="text-sm font-semibold">Remove User</span>
                                </button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
    return (
        <div className="flex justify-between items-start py-1.5">
            <span className="text-xs text-gray-400 flex-1">{label}</span>
            <span className="text-sm font-medium text-right flex-1">{value || "N/A"}</span>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gray-100 rounded-2xl text-gray-400 mb-3">
                <Inbox className="h-10 w-10 stroke-[1.5]" />
            </div>
            <p className="text-gray-500 font-medium text-sm">{message}</p>
        </div>
    );
}
