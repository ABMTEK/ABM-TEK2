"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { firebaseService } from "@/services/firebaseService";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  User,
  Lock,
  Trash2,
  LogOut,
  ChevronRight,
  Shield,
  Users,
  FileText,
  Loader2,
  Settings,
  Moon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to log out");
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setProcessing(true);
    try {
      await firebaseService.sendPasswordResetEmail(user.email);
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setProcessing(false);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="pt-8 pb-16">
      {/* Header */}
      <div className="px-8 mb-8">
        <h2 className="text-3xl font-bold tracking-tight dark:text-white">Settings</h2>
      </div>

      {/* Account Section */}
      <div className="relative">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
          Account
        </p>

        <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
          {/* Profile Card */}
          <div className="flex items-center gap-4 px-8 py-5 border-b border-gray-100 dark:border-[#2E2E2E]">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#252525] flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-semibold text-gray-500">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate dark:text-white">{user?.name || "User"}</p>
              <p className="text-sm text-gray-500 truncate">{user?.email || "No email"}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
                {user?.role ? user.role.replace("_", " ") : "Staff"}
              </Badge>
            </div>
          </div>

          {/* Reset Password */}
          <button
            className="w-full flex items-center gap-4 px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E] hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors text-left"
            onClick={handleResetPassword}
            disabled={processing}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              ) : (
                <Lock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-white">Reset Password</p>
              <p className="text-xs text-gray-400">Send password reset email</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>

          {/* Delete Account */}
          <button
            className="w-full flex items-center gap-4 px-8 py-4 border-b border-gray-100 hover:bg-red-50/50 transition-colors text-left"
            onClick={() => setShowDeleteDialog(true)}
          >
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Trash2 className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600">Delete Account</p>
              <p className="text-xs text-gray-400">Permanently remove your account</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>

          {/* Log Out */}
          <button
            className="w-full flex items-center justify-center gap-2 px-8 py-4 hover:bg-red-50/50 transition-colors"
            onClick={() => setShowLogoutDialog(true)}
          >
            <LogOut className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-500">Log Out</span>
          </button>
        </div>
      </div>

      {/* Team & Access - Admin Only */}
      {isAdmin && (
        <div className="mt-10">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
            Team & Access
          </p>

          <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
            <button
              className="w-full flex items-center gap-4 px-8 py-4 border-b border-gray-100 dark:border-[#2E2E2E] hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors text-left"
              onClick={() => router.push("/settings/staff")}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">Staff Management</p>
                <p className="text-xs text-gray-400">Manage invites, roles, and vendors</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>

            <button
              className="w-full flex items-center gap-4 px-8 py-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => router.push("/settings/access-control")}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                <Shield className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">Access Control</p>
                <p className="text-xs text-gray-400">Configure detailed permissions</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        </div>
      )}

      {/* Super Admin */}
      {user?.role === "super_admin" && (
        <div className="mt-10">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
            Administration
          </p>

          <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
            <button
              className="w-full flex items-center gap-4 px-8 py-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => router.push("/settings/workshops")}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                <Settings className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">Manage Workshops</p>
                <p className="text-xs text-gray-400">Manage workshops and subscriptions</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="mt-10">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
          Appearance
        </p>

        <div className="border-y border-gray-100 bg-white dark:bg-[#161616] dark:border-[#2E2E2E]">
          <div className="flex items-center gap-4 px-8 py-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-400">Switch to a darker colour scheme</p>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="mt-10">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
          Legal
        </p>

        <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
          <button
            className="w-full flex items-center gap-4 px-8 py-4 hover:bg-gray-50 transition-colors text-left"
            onClick={() => router.push("/settings/privacy-policy")}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
              <FileText className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-white">Privacy Policy</p>
              <p className="text-xs text-gray-400">How we handle your data</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Workshop Info */}
      <div className="mt-10">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest px-8 mb-4">
          Workshop
        </p>

        <div className="border-y border-gray-100 dark:border-[#2E2E2E] bg-white dark:bg-[#161616]">
          <div className="flex items-center gap-4 px-8 py-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-white">Workshop ID</p>
              <p className="text-xs text-gray-400 font-mono">{user?.workshopId || "Not connected"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action involves deleting all your data permanently and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast.error("Account deletion is handled through support. Please contact us.");
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
