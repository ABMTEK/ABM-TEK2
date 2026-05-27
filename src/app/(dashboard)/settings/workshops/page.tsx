"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2, Inbox, Calendar, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";

export default function WorkshopManagementPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [adminEmails, setAdminEmails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPlan, setNewPlan] = useState("basic");
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [creating, setCreating] = useState(false);

    const [selectedWorkshop, setSelectedWorkshop] = useState<any>(null);
    const [editStatus, setEditStatus] = useState("");
    const [editExpiry, setEditExpiry] = useState("");
    const [detailAdminEmail, setDetailAdminEmail] = useState("");
    const [saving, setSaving] = useState(false);

    const [deleteWorkshop, setDeleteWorkshop] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadWorkshops();
    }, []);

    const loadWorkshops = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getWorkshops();
            setWorkshops(data);

            const emailsMap: Record<string, string> = {};
            for (const workshop of data) {
                try {
                    const admins = await firebaseService.getUsersByRole("admin", workshop.id);
                    if (admins && admins.length > 0) {
                        emailsMap[workshop.id] = admins[0].email;
                    }
                } catch (error) {
                }
            }
            setAdminEmails(emailsMap);
        } catch (error) {
            toast.error("Failed to load workshops");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkshop = async () => {
        if (!newName.trim()) {
            toast.error("Workshop name is required");
            return;
        }
        if (adminEmail && !adminEmail.includes("@")) {
            toast.error("Invalid admin email");
            return;
        }

        setCreating(true);
        try {
            const workshopId = await firebaseService.createWorkshop({
                name: newName.trim(),
                subscriptionPlan: newPlan,
            });

            let msg = "Workshop created successfully.";

            if (adminName && adminEmail && user?.id) {
                try {
                    const { invitationCode } = await firebaseService.createStaffInvitation(
                        adminEmail.trim(), adminName.trim(), "admin", user.id, workshopId
                    );
                    msg += ` Admin invite code: ${invitationCode}`;
                } catch (inviteError: any) {
                    msg += ` (Warning: Failed to generate admin invite: ${inviteError.message})`;
                }
            }

            toast.success(msg);
            setNewName("");
            setNewPlan("basic");
            setAdminName("");
            setAdminEmail("");
            setShowCreateModal(false);
            await loadWorkshops();
        } catch (error) {
            toast.error("Failed to create workshop");
        } finally {
            setCreating(false);
        }
    };

    const openWorkshopDetails = async (workshop: any) => {
        setSelectedWorkshop(workshop);
        setEditStatus(workshop.subscriptionStatus || "active");

        const expiryDate = workshop.subscriptionExpiry?.toDate
            ? workshop.subscriptionExpiry.toDate()
            : workshop.subscriptionExpiry
                ? new Date(workshop.subscriptionExpiry)
                : new Date();
        setEditExpiry(expiryDate.toISOString().split("T")[0]);

        try {
            const admins = await firebaseService.getUsersByRole("admin", workshop.id);
            setDetailAdminEmail(admins?.[0]?.email || "");
        } catch {
            setDetailAdminEmail("");
        }
    };

    const handleUpdateSubscription = async () => {
        if (!selectedWorkshop) return;
        setSaving(true);
        try {
            await firebaseService.updateWorkshopSubscription(
                selectedWorkshop.id,
                editStatus,
                new Date(editExpiry)
            );
            toast.success("Workshop updated successfully");
            setSelectedWorkshop(null);
            await loadWorkshops();
        } catch (error) {
            toast.error("Failed to update workshop");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteWorkshop = async () => {
        if (!deleteWorkshop) return;
        setDeleting(true);
        try {
            await firebaseService.deleteWorkshop(deleteWorkshop.id);
            toast.success("Workshop deleted");
            setDeleteWorkshop(null);
            await loadWorkshops();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete workshop");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <PageLoader message="Loading workshops..." />;

    return (
        <div className="pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between px-8 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight">Manage Workshops</h2>
                </div>
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Workshop
                </Button>
            </div>

            {/* Workshop List */}
            {workshops.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 bg-gray-100 rounded-2xl text-gray-400 mb-3">
                        <Inbox className="h-10 w-10 stroke-[1.5]" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm">No workshops found.</p>
                </div>
            ) : (
                <div className="px-8 space-y-4">
                    {workshops.map((ws) => {
                        const expiryDate = ws.subscriptionExpiry?.toDate
                            ? ws.subscriptionExpiry.toDate()
                            : ws.subscriptionExpiry
                                ? new Date(ws.subscriptionExpiry)
                                : null;
                        const isExpired = expiryDate ? expiryDate < new Date() : false;

                        return (
                            <button
                                key={ws.id}
                                className="w-full text-left bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
                                onClick={() => openWorkshopDetails(ws)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-base">{ws.name}</h3>
                                    <Badge
                                        className={cn("text-[10px] font-bold uppercase tracking-wider border-none",
                                            ws.subscriptionStatus === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                                        )}
                                    >
                                        {ws.subscriptionStatus}
                                    </Badge>
                                </div>

                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 text-xs">ID</span>
                                        <span className="text-gray-500 text-xs font-mono">{ws.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 text-xs">Plan</span>
                                        <span className="font-medium text-xs capitalize">{ws.subscriptionPlan}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 text-xs">Expiry</span>
                                        <span className={cn("font-medium text-xs", isExpired && "text-red-500")}>
                                            {expiryDate?.toLocaleDateString() || "N/A"}
                                        </span>
                                    </div>
                                    {adminEmails[ws.id] && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 text-xs">Admin</span>
                                            <span className="font-medium text-xs">{adminEmails[ws.id]}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteWorkshop(ws);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Create Workshop Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Workshop</DialogTitle>
                        <DialogDescription className="sr-only">Create a new workshop</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Workshop Name *</Label>
                            <Input placeholder="e.g. Allen's Auto Fix" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Subscription Plan</Label>
                            <div className="flex gap-2">
                                {["basic", "premium", "enterprise"].map((plan) => (
                                    <button
                                        key={plan}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors",
                                            newPlan === plan
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                        )}
                                        onClick={() => setNewPlan(plan)}
                                    >
                                        {plan}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-4">
                            <p className="font-semibold text-sm">First Administrator (Optional)</p>
                            <p className="text-xs text-gray-400 mb-3">Generate an invite code immediately for the owner.</p>
                            <div className="space-y-3">
                                <Input placeholder="Admin Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                                <Input placeholder="Admin Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateWorkshop} disabled={creating}>
                            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Workshop
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Workshop Details / Edit Modal */}
            <Dialog open={!!selectedWorkshop} onOpenChange={() => setSelectedWorkshop(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedWorkshop?.name}</DialogTitle>
                        <DialogDescription className="sr-only">Workshop details and subscription settings</DialogDescription>
                    </DialogHeader>

                    {selectedWorkshop && (
                        <div className="space-y-5 py-2">
                            {/* Info Card */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Workshop ID</p>
                                    <p className="text-sm font-medium font-mono mt-0.5">{selectedWorkshop.id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Current Plan</p>
                                    <p className="text-sm font-semibold capitalize mt-0.5">{selectedWorkshop.subscriptionPlan}</p>
                                </div>
                                {detailAdminEmail && (
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Admin Email</p>
                                        <p className="text-sm font-medium mt-0.5">{detailAdminEmail}</p>
                                    </div>
                                )}
                            </div>

                            {/* Subscription Settings */}
                            <div>
                                <h4 className="font-semibold text-sm mb-3">Subscription Settings</h4>
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Status</Label>
                                        <div className="flex gap-2">
                                            {["active", "inactive", "trial"].map((s) => (
                                                <button
                                                    key={s}
                                                    className={cn(
                                                        "px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors",
                                                        editStatus === s
                                                            ? "bg-gray-900 text-white border-gray-900"
                                                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                                                    )}
                                                    onClick={() => setEditStatus(s)}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs">Expiry Date</Label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                type="date"
                                                value={editExpiry}
                                                onChange={(e) => setEditExpiry(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedWorkshop(null)}>Cancel</Button>
                        <Button onClick={handleUpdateSubscription} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Update Subscription
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteWorkshop} onOpenChange={() => setDeleteWorkshop(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Workshop</DialogTitle>
                        <DialogDescription className="sr-only">Confirm workshop deletion</DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">
                        Are you sure you want to delete &quot;{deleteWorkshop?.name}&quot;? This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteWorkshop(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteWorkshop} disabled={deleting}>
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
