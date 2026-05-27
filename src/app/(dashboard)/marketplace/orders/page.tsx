"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { Order } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

const TABS = ["All Orders", "Pending Action", "Ready for Payout", "Paid"] as const;

export default function MarketplaceOrdersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [vendors, setVendors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>("All Orders");

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const [ordersData, vendorsData] = await Promise.all([
                    firebaseService.getOrders(undefined, user.role === 'vendor' ? user.id : undefined),
                    firebaseService.getUsersByWorkshop(user.workshopId || "")
                ]);

                const vendorMap: Record<string, string> = {};
                vendorsData.forEach(v => {
                    if (v.role === 'vendor') vendorMap[v.id] = v.name || v.businessDetails?.businessName || v.email;
                });

                setOrders(ordersData);
                setVendors(vendorMap);
            } catch (error) {
                console.error("Error fetching marketplace data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const getFilteredOrders = () => {
        switch (activeTab) {
            case "Pending Action":
                return orders.filter(o => o.status === "pending" || o.status === "confirmed");
            case "Ready for Payout":
                return orders.filter(o => o.status === "delivered" && (!o.payoutStatus || o.payoutStatus === "pending"));
            case "Paid":
                return orders.filter(o => o.payoutStatus === "paid");
            default:
                return orders;
        }
    };

    const filteredOrders = getFilteredOrders();

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "delivered": return "bg-[#30D158]/20 text-[#30D158] border-[#30D158]/40";
            case "shipped": return "bg-[#007AFF]/20 text-[#007AFF] border-[#007AFF]/40";
            case "shipment_verified": return "bg-purple-100 text-purple-700 border-purple-300";
            case "confirmed": return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
            case "pending": return "bg-[#FFA500]/20 text-[#FFA500] border-[#FFA500]/40";
            case "cancelled": return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
            default: return "bg-gray-100 text-gray-600 border-gray-200";
        }
    };

    if (loading) return <PageLoader message="Loading orders..." />;

    return (
        <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between px-8">
                <h2 className="text-3xl font-bold tracking-tight">Marketplace Orders</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 px-8 border-b border-gray-100">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                            activeTab === tab
                                ? "border-gray-900 text-gray-900 font-semibold"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="border-y bg-white w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="pl-8">Order</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                            <TableHead className="text-right pr-8">Payout</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400">
                                            <Inbox className="h-10 w-10 stroke-[1.5]" />
                                        </div>
                                        <p className="text-gray-900 font-semibold">No orders found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map((order) => {
                                const firstItem = order.products[0];
                                const otherCount = order.products.length - 1;
                                const displayName = firstItem
                                    ? (otherCount > 0 ? `${firstItem.productName} +${otherCount} more` : firstItem.productName)
                                    : "Unknown";

                                return (
                                    <TableRow
                                        key={order.id}
                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/marketplace/orders/${order.id}`)}
                                    >
                                        <TableCell className="pl-8">
                                            <div>
                                                <p className="font-medium text-sm">{displayName}</p>
                                                <p className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {order.createdAt
                                                ? format(order.createdAt, "MMM d, HH:mm")
                                                : "N/A"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm">{order.customerName || "Guest"}</span>
                                                <span className="text-xs text-gray-400">{order.customerEmail}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ₦{order.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge
                                                variant="outline"
                                                className={cn("capitalize px-2 py-1 font-bold text-[10px] uppercase tracking-widest border shadow-sm", getStatusStyles(order.status))}
                                            >
                                                {order.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            {order.payoutStatus === "paid" ? (
                                                <Badge className="bg-green-500 text-white border-none text-[10px] font-bold uppercase">Paid</Badge>
                                            ) : (
                                                <span className="text-xs text-gray-400">{order.payoutStatus || "Pending"}</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            }))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
