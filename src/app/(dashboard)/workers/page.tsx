"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { StaffInvitation, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, Loader2, Trash2, Inbox, CheckCircle, Clock, Users, Wrench, Shield, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import { format } from "date-fns";

const ROLES = ["technician", "service_advisor", "storekeeper", "accountant", "admin"];

const ROLE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    admin: { color: "#E87C2B", bg: "#E87C2B20", label: "Admin" },
    technician: { color: "#2563eb", bg: "#2563eb20", label: "Technician" },
    storekeeper: { color: "#16a34a", bg: "#16a34a20", label: "Storekeeper" },
    accountant: { color: "#7c3aeb", bg: "#7c3aeb20", label: "Accountant" },
    service_advisor: { color: "#0284c7", bg: "#0284c720", label: "Service Advisor" },
    vendor: { color: "#dc2626", bg: "#dc262620", label: "Vendor" },
};

type Tab = "active" | "pending" | "vendors";

export default function WorkersPage() {
    const { user } = useAuthStore();
    const [activeStaff, setActiveStaff] = useState<User[]>([]);
    const [vendors, setVendors] = useState<User[]>([]);
    const [invites, setInvites] = useState<StaffInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("active");
    const [search, setSearch] = useState("");

    // Invite form
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [invitePhone, setInvitePhone] = useState("");
    const [inviteRole, setInviteRole] = useState("technician");
    const [submitting, setSubmitting] = useState(false);

    // Delete
    const [deleteTarget, setDeleteTarget] = useState<User | StaffInvitation | null>(null);
    const [deleteType, setDeleteType] = useState<"user" | "invite">("user");
    const [deleting, setDeleting] = useState(false);

    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    const load = async () => {
        if (!user?.workshopId) { setLoading(false); return; }
        setLoading(true);
        try {
            const [invitesData, usersData] = await Promise.all([
                firebaseService.getStaffInvitations(user.workshopId),
                firebaseService.getUsersByWorkshop(user.workshopId),
            ]);
            setInvites(invitesData);
            setActiveStaff(usersData.filter(u => u.role !== "customer" && u.role !== "vendor"));
            setVendors(usersData.filter(u => u.role === "vendor"));
        } catch (e) {
            toast.error("Failed to load workers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.workshopId]);

    const stats = useMemo(() => {
        const byRole: Record<string, number> = {};
        activeStaff.forEach(s => { byRole[s.role] = (byRole[s.role] || 0) + 1; });
        return { total: activeStaff.length, byRole, pending: invites.length };
    }, [activeStaff, invites]);

    const filteredStaff = activeStaff.filter(s =>
        !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.role?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredVendors = vendors.filter(v =>
        !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleInvite = async () => {
        if (!user?.workshopId) return;
        if (!inviteName.trim() || !inviteEmail.trim()) { toast.error("Name and email are required."); return; }
        if (!inviteEmail.includes("@")) { toast.error("Enter a valid email address."); return; }
        setSubmitting(true);
        try {
            const { invitationCode } = await firebaseService.createStaffInvitation(
                inviteEmail, inviteName, inviteRole, user.id, user.workshopId, invitePhone || undefined
            );
            toast.success(`Invite sent! Code: ${invitationCode}`);
            setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteRole("technician");
            setShowInviteDialog(false);
            await load();
        } catch (e: any) {
            toast.error(e.message || "Failed to create invite.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            if (deleteType === "user") {
                await firebaseService.deleteUser(deleteTarget.id);
                toast.success("Worker removed.");
            } else {
                await firebaseService.cancelStaffInvitation(deleteTarget.id);
                toast.success("Invitation cancelled.");
            }
            setDeleteTarget(null);
            await load();
        } catch (e: any) {
            toast.error(e.message || "Failed to remove.");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <PageLoader message="Loading workers..." />;

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Workers</h2>
                    <p className="text-sm text-gray-500 mt-1">{stats.total} active staff members</p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setShowInviteDialog(true)} style={{ background: "#E87C2B" }}>
                        <Plus className="mr-2 h-4 w-4" /> Invite Worker
                    </Button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>Total Staff</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#1e3a5f,#0284c7)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>Technicians</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.byRole["technician"] || 0}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#7c3a1e,#E87C2B)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>Pending Invites</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.pending}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg,#3a1e5f,#7c3aeb)" }}>
                    <CardContent className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>Vendors</p>
                        <p className="text-3xl font-bold text-white mt-1">{vendors.length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search + Tabs */}
            <div className="px-8 space-y-3">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search workers…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                    {[
                        { key: "active", label: `Staff (${activeStaff.length})` },
                        { key: "pending", label: `Pending (${invites.length})` },
                        { key: "vendors", label: `Vendors (${vendors.length})` },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key as Tab)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                                tab === t.key ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"
                            )}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Active Staff */}
            {tab === "active" && (
                <div className="border-y bg-white dark:bg-gray-900 shadow-sm">
                    {filteredStaff.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><Inbox className="h-10 w-10 stroke-[1.5]" /></div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">No staff members found</p>
                            {isAdmin && <Button onClick={() => setShowInviteDialog(true)} style={{ background: "#E87C2B" }}>Invite First Worker</Button>}
                        </div>
                    ) : filteredStaff.map(staff => {
                        const rc = ROLE_CONFIG[staff.role] || { color: "#666", bg: "#66666620", label: staff.role };
                        return (
                            <div key={staff.id} className="flex items-center gap-4 px-8 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: rc.color }}>
                                    {staff.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">{staff.name}</p>
                                        {staff.id === user?.id && <Badge variant="outline" className="text-[9px]">You</Badge>}
                                    </div>
                                    <p className="text-xs text-gray-400 truncate">{staff.email}</p>
                                    {staff.phone && <p className="text-xs text-gray-400">{staff.phone}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="text-[10px] font-bold" style={{ background: rc.bg, color: rc.color, border: "none" }}>
                                        {rc.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
                                    {isAdmin && staff.id !== user?.id && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setDeleteTarget(staff); setDeleteType("user"); }}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pending Invites */}
            {tab === "pending" && (
                <div className="border-y bg-white dark:bg-gray-900 shadow-sm">
                    {invites.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><Clock className="h-10 w-10 stroke-[1.5]" /></div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">No pending invitations</p>
                        </div>
                    ) : invites.map(invite => {
                        const rc = ROLE_CONFIG[invite.role] || { color: "#666", bg: "#66666620", label: invite.role };
                        return (
                            <div key={invite.id} className="flex items-center gap-4 px-8 py-4 border-b border-gray-50 dark:border-gray-800">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gray-300 dark:bg-gray-700">
                                    {invite.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white">{invite.name}</p>
                                    <p className="text-xs text-gray-400">{invite.email}</p>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">Code: <span className="font-bold text-gray-600 dark:text-gray-300">{invite.invitationCode}</span></p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="text-[10px] font-bold" style={{ background: rc.bg, color: rc.color, border: "none" }}>{rc.label}</Badge>
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                                        <Clock className="h-2.5 w-2.5 mr-1" />Pending
                                    </Badge>
                                    {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setDeleteTarget(invite); setDeleteType("invite"); }}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Vendors */}
            {tab === "vendors" && (
                <div className="border-y bg-white dark:bg-gray-900 shadow-sm">
                    {filteredVendors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400"><UserCheck className="h-10 w-10 stroke-[1.5]" /></div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">No vendors yet</p>
                        </div>
                    ) : filteredVendors.map(vendor => (
                        <div key={vendor.id} className="flex items-center gap-4 px-8 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 transition-colors">
                            <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {vendor.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white">{vendor.name}</p>
                                <p className="text-xs text-gray-400">{vendor.email}</p>
                            </div>
                            <Badge className={cn("text-[10px] font-bold border-none",
                                vendor.vendorStatus === "active" ? "bg-green-50 text-green-700" :
                                vendor.vendorStatus === "pending_approval" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                            )}>
                                {vendor.vendorStatus === "active" ? "Active" : vendor.vendorStatus === "pending_approval" ? "Pending Approval" : vendor.vendorStatus || "Unknown"}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}

            {/* Invite Dialog */}
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invite New Worker</DialogTitle>
                        <DialogDescription>They will receive an invitation code to join the workshop.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input placeholder="e.g. Ahmed Musa" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Email Address *</Label>
                            <Input type="email" placeholder="ahmed@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone (optional)</Label>
                            <Input placeholder="+234 000 000 0000" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ROLES.map(r => (
                                        <SelectItem key={r} value={r}>
                                            {ROLE_CONFIG[r]?.label || r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                        <Button onClick={handleInvite} disabled={submitting} style={{ background: "#E87C2B" }}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Invite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{deleteType === "user" ? "Remove Worker" : "Cancel Invitation"}</DialogTitle>
                        <DialogDescription>
                            {deleteType === "user"
                                ? `Remove ${(deleteTarget as User)?.name} from the workshop? This cannot be undone.`
                                : `Cancel the invitation for ${(deleteTarget as StaffInvitation)?.name}?`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {deleteType === "user" ? "Remove" : "Cancel Invite"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
