"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Shield, User, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";

const SYSTEM_ROLES = ["admin", "technician", "storekeeper", "accountant", "service_advisor"];

const PERMISSIONS = [
    { key: "canViewDashboard", label: "View Dashboard", description: "Access the home dashboard" },
    { key: "canManageJobs", label: "Manage Jobs", description: "Create, update, and delete jobs" },
    { key: "canViewCustomers", label: "View Customers", description: "View customer list and details" },
    { key: "canManageCustomers", label: "Manage Customers", description: "Create, update, and delete customers" },
    { key: "canViewInventory", label: "View Inventory", description: "View items in inventory" },
    { key: "canManageInventory", label: "Manage Inventory", description: "Add, update, and delete inventory items" },
    { key: "canViewFinance", label: "View Finance", description: "View financial reports and invoices" },
    { key: "canManageFinance", label: "Manage Finance", description: "Create and update invoices, payments" },
    { key: "canInviteStaff", label: "Invite Staff", description: "Send invitations to new staff members" },
    { key: "canManageStaff", label: "Manage Staff", description: "Update and remove existing staff" },
    { key: "canManageSettings", label: "Manage Settings", description: "Update workshop settings" },
    { key: "canViewReports", label: "View Reports", description: "Access workshop performance reports" },
];

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
    canViewDashboard: false,
    canManageJobs: false,
    canViewCustomers: false,
    canManageCustomers: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewFinance: false,
    canManageFinance: false,
    canInviteStaff: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewReports: false,
};

const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
    admin: { canViewDashboard: true, canManageJobs: true, canViewInventory: true, canManageInventory: true, canViewFinance: true, canManageFinance: true, canInviteStaff: true, canManageStaff: true, canManageSettings: true, canViewReports: true },
    technician: { canViewDashboard: true, canManageJobs: true, canViewInventory: true },
    storekeeper: { canViewDashboard: true, canViewInventory: true, canManageInventory: true },
    accountant: { canViewDashboard: true, canViewInventory: true, canViewFinance: true, canManageFinance: true, canViewReports: true },
    service_advisor: { canViewDashboard: true, canManageJobs: true, canViewInventory: true, canViewFinance: true, canViewReports: true },
};

export default function AccessControlPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Record<string, any>>({});
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<string[]>(SYSTEM_ROLES);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [newRolePermissions, setNewRolePermissions] = useState<Record<string, boolean>>(DEFAULT_PERMISSIONS);

    const [deleteRole, setDeleteRole] = useState<string | null>(null);

    useEffect(() => {
        fetchPermissions();
    }, [user?.workshopId]);

    const fetchPermissions = async () => {
        if (!user?.workshopId) {
            setLoading(false);
            return;
        }
        try {
            const perms = await firebaseService.getWorkshopPermissions(user.workshopId);
            setPermissions(perms || {});
            const customRoles = Object.keys(perms || {});
            const allRoles = Array.from(new Set([...SYSTEM_ROLES, ...customRoles]))
                .filter(role => role !== "customer" && role !== "vendor");
            setAvailableRoles(allRoles);
        } catch (error) {
            console.error("Error fetching permissions:", error);
            toast.error("Failed to load permissions");
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePermission = async (role: string, permissionKey: string, value: boolean) => {
        if (!user?.workshopId) return;
        const updatedRolePermissions = { ...(permissions[role] || {}), [permissionKey]: value };
        setPermissions({ ...permissions, [role]: updatedRolePermissions });
        setSaving(true);
        try {
            await firebaseService.updateWorkshopPermissions(user.workshopId, role, updatedRolePermissions);
        } catch (error) {
            toast.error("Failed to save permission change");
            fetchPermissions();
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRole = async () => {
        if (!user?.workshopId) return;
        if (!newRoleName.trim()) {
            toast.error("Role name cannot be empty");
            return;
        }
        const roleKey = newRoleName.toLowerCase().trim().replace(/\s+/g, "_");
        if (availableRoles.includes(roleKey)) {
            toast.error("Role already exists");
            return;
        }
        setSaving(true);
        try {
            await firebaseService.updateWorkshopPermissions(user.workshopId, roleKey, newRolePermissions as any);
            setNewRoleName("");
            setNewRolePermissions(DEFAULT_PERMISSIONS);
            setShowCreateModal(false);
            await fetchPermissions();
            toast.success(`Role "${newRoleName}" created.`);
        } catch (error) {
            toast.error("Failed to create role");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!user?.workshopId || !deleteRole) return;
        setSaving(true);
        try {
            await firebaseService.deleteWorkshopRole(user.workshopId, deleteRole);
            setDeleteRole(null);
            await fetchPermissions();
            toast.success("Role deleted");
        } catch (error) {
            toast.error("Failed to delete role");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageLoader message="Loading permissions..." />;

    return (
        <div className="pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between px-8 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight">Access Control</h2>
                </div>
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New Role
                </Button>
            </div>

            {/* Info */}
            <div className="mx-8 mb-6 p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Configure permissions for each role. System roles cannot be deleted.</p>
            </div>

            {/* Role Cards */}
            <div className="border-t border-gray-100">
                {availableRoles.map((role) => {
                    const isSystem = SYSTEM_ROLES.includes(role);
                    const isOpen = selectedRole === role;
                    return (
                        <div key={role} className="border-b border-gray-100 bg-white">
                            <button
                                className="w-full flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors text-left"
                                onClick={() => setSelectedRole(isOpen ? null : role)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                        {isSystem ? <Shield className="h-4 w-4 text-gray-600" /> : <User className="h-4 w-4 text-gray-600" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm capitalize">{role.replace("_", " ")}</p>
                                        {!isSystem && <p className="text-[10px] text-gray-400">Custom Role</p>}
                                    </div>
                                </div>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </button>

                            {isOpen && (
                                <div className="px-8 pb-6 pt-2 border-t border-gray-50 space-y-4">
                                    {PERMISSIONS.map((perm) => {
                                        const savedValue = permissions[role]?.[perm.key];
                                        const defaultValue = DEFAULT_ROLE_PERMISSIONS[role]?.[perm.key] || false;
                                        const isEnabled = savedValue !== undefined ? savedValue : defaultValue;
                                        return (
                                            <div key={perm.key} className="flex items-center justify-between">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-medium">{perm.label}</p>
                                                    <p className="text-xs text-gray-400">{perm.description}</p>
                                                </div>
                                                <Switch
                                                    checked={isEnabled}
                                                    onCheckedChange={(val: boolean) => handleTogglePermission(role, perm.key, val)}
                                                    disabled={saving}
                                                />
                                            </div>
                                        );
                                    })}
                                    {!isSystem && (
                                        <Button
                                            variant="outline"
                                            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 mt-4"
                                            onClick={() => setDeleteRole(role)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Role
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create Role Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Create New Role</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 overflow-y-auto flex-1">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input placeholder="e.g. Supervisor" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
                        </div>
                        <Label className="text-sm font-semibold">Permissions</Label>
                        {PERMISSIONS.map((perm) => (
                            <div key={perm.key} className="flex items-center justify-between">
                                <div className="flex-1 pr-4">
                                    <p className="text-sm font-medium">{perm.label}</p>
                                    <p className="text-xs text-gray-400">{perm.description}</p>
                                </div>
                                <Switch
                                    checked={!!newRolePermissions[perm.key]}
                                    onCheckedChange={(val: boolean) => setNewRolePermissions(prev => ({ ...prev, [perm.key]: val }))}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateRole} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Role Confirmation */}
            <Dialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">
                        Are you sure you want to delete the &quot;{deleteRole}&quot; role? This cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteRole(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteRole} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
