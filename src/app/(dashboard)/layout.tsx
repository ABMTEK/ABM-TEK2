"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import {
    LayoutDashboard,
    Package,
    FileText,
    ShoppingBag,
    Settings,
    LogOut,
    Menu,
    Users,
    Wallet,
    Wrench,
    BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageLoader } from "@/components/ui/page-loader";


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout, initialized } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted && initialized && !loading && !user) {
            router.push("/login/");
        }
    }, [user, loading, router, isMounted, initialized]);

    if (!isMounted) return null;

    if (!initialized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <PageLoader message="Initializing session..." />
            </div>
        );
    }

    if (!user && !loading) return null;


    const navItems = [
        { href: "/", label: "Overview", icon: LayoutDashboard },
        { href: "/jobs", label: "Jobs", icon: Wrench },
        { href: "/customers", label: "Customers", icon: Users },
        { href: "/finance", label: "Finance", icon: Wallet },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/inventory", label: "Inventory", icon: Package },
        { href: "/marketplace/orders", label: "Marketplace Orders", icon: ShoppingBag },
        { href: "/settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-[#F0F2F5] dark:bg-[#0E0E0E] overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 flex-col md:flex no-print" style={{ background: '#1A1A1A' }}>
                <SidebarContent
                    user={user}
                    pathname={pathname}
                    navItems={navItems}
                    onLogout={() => {
                        logout();
                        router.push("/login/");
                    }}
                />
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Mobile Header */}
                <header className="flex h-16 items-center justify-between border-b bg-[#1A1A1A] px-4 md:hidden no-print">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-white text-xs" style={{ background: '#E87C2B' }}>
                                {user?.name?.charAt(0) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-bold truncate max-w-[120px] text-white">{user?.name}</span>
                    </div>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-72 border-none" style={{ background: '#1A1A1A' }}>
                            <SheetHeader className="sr-only">
                                <SheetTitle>Navigation Menu</SheetTitle>
                            </SheetHeader>
                            <SidebarContent
                                user={user}
                                pathname={pathname}
                                navItems={navItems}
                                onLogout={() => {
                                    logout();
                                    router.push("/login/");
                                }}
                            />
                        </SheetContent>
                    </Sheet>
                </header>

                <main className="flex-1 overflow-y-auto dark:bg-[#0E0E0E]">
                    {children}
                </main>
            </div>
        </div>
    );
}

function SidebarContent({ user, pathname, navItems, onLogout }: any) {
    return (
        <div className="flex flex-col h-full" style={{ background: '#1A1A1A' }}>
            {/* Logo + User */}
            <div className="p-6 pb-4 flex flex-col items-center">
                <Image
                    src="/logo.png"
                    alt="ABM-TEK"
                    width={112}
                    height={112}
                    className="mb-5"
                    style={{ height: '7rem', width: 'auto' }}
                />
                <div className="flex items-center gap-3 w-full">
                    <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback className="text-white text-xs font-bold" style={{ background: '#E87C2B' }}>
                            {user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-white truncate">{user?.name || "User"}</span>
                        <span className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>{user?.role || "Staff"}</span>
                    </div>
                </div>
            </div>

            <Separator style={{ background: 'rgba(255,255,255,0.1)' }} />

            <nav className="flex-1 space-y-0.5 p-4 overflow-y-auto">
                {navItems.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                isActive
                                    ? "text-white shadow-sm"
                                    : "hover:bg-white/10 hover:text-white"
                            )}
                            style={
                                isActive
                                    ? { background: '#E87C2B', color: '#fff' }
                                    : { color: 'rgba(255,255,255,0.6)' }
                            }
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Button
                    variant="ghost"
                    className="w-full justify-start hover:bg-white/10"
                    style={{ color: '#ff6b6b' }}
                    onClick={onLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
