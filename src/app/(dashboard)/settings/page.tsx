"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { firebaseService } from "@/services/firebaseService";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    User, Lock, Trash2, LogOut, ChevronRight, Shield, Users,
    FileText, Loader2, Settings, Moon, Bell, Building2,
    Wrench, Percent, Wallet, Edit3, Check, X, Phone, Mail,
} from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const { isDark, toggle: toggleTheme } = useThemeStore();
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Workshop settings
    const [workshop, setWorkshop] = useState<any>(null);
    const [editingVat, setEditingVat] = useState(false);
    const [vatValue, setVatValue] = useState("");
    const [savingVat, setSavingVat] = useState(false);

    // Staff overview
    const [staffStats, setStaffStats] = useState<{ total: number; byRole: Record<string, number> }>({ total: 0, byRole: {} });

    // Notification prefs (stored in user doc)
    const [emailNotif, setEmailNotif] = useState(user?.emailNotificationsEnabled ?? true);
    const [pushNotif, setPushNotif] = useState(user?.pushNotificationsEnabled ?? true);

    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    useEffect(() => {
        const load = async () => {
            if (!user?.workshopId) return;
            try {
                const [ws, usersData] = await Promise.all([
                    firebaseService.getWorkshop(user.workshopId),
                    firebaseService.getUsersByWorkshop(user.workshopId),
                ]);
                setWorkshop(ws);
                setVatValue(ws?.settings?.vatRate?.toString() || "7.5");
                const byRole: Record<string, number> = {};
                usersData.filter(u => u.role !== "customer").forEach(u => {
                    byRole[u.role] = (byRole[u.role] || 0) + 1;
                });
                setStaffStats({ total: usersData.filter(u => u.role !== "customer").length, byRole });
            } catch (e) { console.error(e); }
        };
        load();
    }, [user?.workshopId]);

    const handleLogout = async () => {
        try { await logout(); router.replace("/login"); }
        catch (e) { toast.error("Failed to log out"); }
    };

    const handleResetPassword = async () => {
        if (!user?.email) return;
        setProcessing(true);
        try {
            await firebaseService.sendPasswordResetEmail(user.email);
            toast.success(`Password reset email sent to ${user.email}`);
        } catch (e: any) {
            toast.error(e.message || "Failed to send reset email");
        } finally { setProcessing(false); }
    };

    const handleSaveVat = async () => {
        if (!user?.workshopId) return;
        const val = parseFloat(vatValue);
        if (isNaN(val) || val < 0 || val > 100) { toast.error("Enter a valid VAT rate (0–100)"); return; }
        setSavingVat(true);
        try {
            await firebaseService.updateUser(user.id, {}); // placeholder — update via workshop doc
            // Update workshop settings via direct Firestore update
            const { doc, updateDoc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            await updateDoc(doc(db, "workshops", user.workshopId), {
                "settings.vatRate": val,
            });
            setWorkshop((prev: any) => ({ ...prev, settings: { ...prev?.settings, vatRate: val } }));
            setEditingVat(false);
            toast.success("VAT rate updated.");
        } catch (e) { toast.error("Failed to update VAT rate."); }
        finally { setSavingVat(false); }
    };

    const handleNotifToggle = async (type: "email" | "push", value: boolean) => {
        if (!user) return;
        if (type === "email") setEmailNotif(value);
        else setPushNotif(value);
        try {
            await firebaseService.updateUser(user.id, {
                emailNotificationsEnabled: type === "email" ? value : emailNotif,
                pushNotificationsEnabled: type === "push" ? value : pushNotif,
            });
        } catch (e) { toast.error("Failed to update notification settings."); }
    };

    const ROLE_COLORS: Record<string, string> = {
        admin: "#E87C2B", technician: "#2563eb", storekeeper: "#16a34a",
        accountant: "#7c3aeb", service_advisor: "#0284c7", vendor: "#dc2626",
    };

    return (
        <div className="pt-8 pb-16 max-w-2xl mx-auto">

            {/* Header */}
            <div className="px-8 mb-8">
                <h2 className="text-3xl font-bold tracking-tight dark:text-white">Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Manage your account, workshop, and preferences</p>
            </div>

            {/* ── Account ── */}
            <Section title="Account">
                {/* Profile */}
                <div className="flex items-center gap-4 px-8 py-5 border-b border-gray-100 dark:border-[#2E2E2E]">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0" style={{ background: "#E87C2B" }}>
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold truncate dark:text-white">{user?.name || "User"}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: ROLE_COLORS[user?.role || ""] + "20", color: ROLE_COLORS[user?.role || ""] }}>
                            {user?.role?.replace("_", " ") || "Staff"}
                        </Badge>
                    </div>
                </div>

                <SettingsRow icon={<Lock className="h-4 w-4 text-gray-600 dark:text-gray-400" />} label="Reset Password" desc="Send password reset link to your email" onClick={handleResetPassword} loading={processing} />
                <SettingsRow icon={<Trash2 className="h-4 w-4 text-red-500" />} label="Delete Account" desc="Permanently remove your account" labelClass="text-red-600" onClick={() => setShowDeleteDialog(true)} />
                <button className="w-full flex items-center justify-center gap-2 px-8 py-4 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors" onClick={() => setShowLogoutDialog(true)}>
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-bold text-red-500">Log Out</span>
                </button>
            </Section>

            {/* ── Workshop ── */}
            {user?.workshopId && (
                <Section title="Workshop">
                    <div className="px-8 py-5 border-b border-gray-100 dark:border-[#2E2E2E]">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold dark:text-white">{workshop?.name || "ABMTEK Workshop"}</p>
                                    <p className="text-xs text-gray-400 font-mono">{user.workshopId}</p>
                                </div>
                            </div>
                            <Badge variant="outline" className={workshop?.subscriptionStatus === "active" ? "text-green-600 border-green-200 bg-green-50" : "text-gray-500"}>
                                {workshop?.subscriptionPlan || "Spark"} · {workshop?.subscriptionStatus || "active"}
                            </Badge>
                        </div>
                    </div>

                    {/* VAT Rate */}
                    {isAdmin && (
                        <div className="px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E] flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                                <Percent className="h-4 w-4 text-purple-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold dark:text-white">VAT Rate</p>
                                {editingVat ? (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Input type="number" value={vatValue} onChange={e => setVatValue(e.target.value)} className="h-8 w-24 text-sm" min="0" max="100" step="0.5" />
                                        <span className="text-sm text-gray-500">%</span>
                                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" onClick={handleSaveVat} disabled={savingVat}>
                                            {savingVat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingVat(false); setVatValue(workshop?.settings?.vatRate?.toString() || "7.5"); }}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">{workshop?.settings?.vatRate ?? 7.5}% applied to invoices</p>
                                )}
                            </div>
                            {!editingVat && (
                                <button onClick={() => setEditingVat(true)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <Edit3 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E] flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center shrink-0">
                            <Wallet className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold dark:text-white">Currency</p>
                            <p className="text-xs text-gray-400">{workshop?.settings?.currency || "NGN"} — Nigerian Naira (₦)</p>
                        </div>
                    </div>
                </Section>
            )}

            {/* ── Staff Overview (admin only) ── */}
            {isAdmin && staffStats.total > 0 && (
                <Section title="Staff Overview">
                    <div className="px-8 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">{staffStats.total} active staff members</p>
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/settings/staff")}>
                                Manage <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(staffStats.byRole).map(([role, count]) => (
                                <div key={role} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold" style={{ background: ROLE_COLORS[role] || "#666" }}>
                                    {role.replace("_", " ")} · {count}
                                </div>
                            ))}
                        </div>
                    </div>
                </Section>
            )}

            {/* ── Team & Access (admin only) ── */}
            {isAdmin && (
                <Section title="Team & Access">
                    <SettingsRow icon={<Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />} label="Staff Management" desc="Manage invites, roles, and vendors" onClick={() => router.push("/settings/staff")} />
                    <SettingsRow icon={<Shield className="h-4 w-4 text-gray-600 dark:text-gray-400" />} label="Access Control" desc="Configure detailed role permissions" onClick={() => router.push("/settings/access-control")} />
                </Section>
            )}

            {/* ── Notifications ── */}
            <Section title="Notifications">
                <div className="flex items-center gap-4 px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E]">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold dark:text-white">Email Notifications</p>
                        <p className="text-xs text-gray-400">Job updates, invoices, and alerts via email</p>
                    </div>
                    <Switch checked={emailNotif} onCheckedChange={v => handleNotifToggle("email", v)} />
                </div>
                <div className="flex items-center gap-4 px-8 py-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                        <Bell className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold dark:text-white">Push Notifications</p>
                        <p className="text-xs text-gray-400">Real-time alerts on your mobile device</p>
                    </div>
                    <Switch checked={pushNotif} onCheckedChange={v => handleNotifToggle("push", v)} />
                </div>
            </Section>

            {/* ── Appearance ── */}
            <Section title="Appearance">
                <div className="flex items-center gap-4 px-8 py-4">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold dark:text-white">Dark Mode</p>
                        <p className="text-xs text-gray-400">Switch to a darker colour scheme</p>
                    </div>
                    <Switch checked={isDark} onCheckedChange={toggleTheme} />
                </div>
            </Section>

            {/* ── Super Admin ── */}
            {user?.role === "super_admin" && (
                <Section title="Administration">
                    <SettingsRow icon={<Settings className="h-4 w-4 text-gray-600" />} label="Manage Workshops" desc="Manage workshops and subscriptions" onClick={() => router.push("/settings/workshops")} />
                </Section>
            )}

            {/* ── Legal ── */}
            <Section title="Legal">
                <SettingsRow icon={<FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />} label="Privacy Policy" desc="How we handle your data" onClick={() => router.push("/settings/privacy-policy")} />
            </Section>

            {/* App version */}
            <p className="text-center text-xs text-gray-300 dark:text-gray-600 mt-8">ABM-TEK Admin v2.0 · {user?.workshopId || "No workshop"}</p>

            {/* Dialogs */}
            <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Log Out</DialogTitle>
                        <DialogDescription>Are you sure you want to log out?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleLogout}>Log Out</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Account</DialogTitle>
                        <DialogDescription>This action permanently removes all your data and cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => { toast.error("Account deletion is handled through support. Please contact us."); setShowDeleteDialog(false); }}>Request Deletion</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-8">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-8 mb-3">{title}</p>
            <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
                {children}
            </div>
        </div>
    );
}

function SettingsRow({ icon, label, desc, onClick, loading, labelClass }: {
    icon: React.ReactNode; label: string; desc: string;
    onClick?: () => void; loading?: boolean; labelClass?: string;
}) {
    return (
        <button className="w-full flex items-center gap-4 px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E] hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors text-left last:border-b-0" onClick={onClick} disabled={loading}>
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-600" /> : icon}
            </div>
            <div className="flex-1">
                <p className={`text-sm font-semibold dark:text-white ${labelClass || ""}`}>{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
    );
}
