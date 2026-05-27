"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Package, User, MapPin, Mail, Phone, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";

export default function OrderDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const loadOrder = async () => {
            if (typeof id !== "string") return;
            try {
                const data = await firebaseService.getOrder(id);
                setOrder(data);
            } catch (error) {
                console.error("Error loading order:", error);
                toast.error("Failed to load order details");
            } finally {
                setLoading(false);
            }
        };
        loadOrder();
    }, [id]);

    const handleUpdateStatus = async (status: Order["status"]) => {
        if (!order) return;
        setProcessing(true);
        try {
            await firebaseService.updateOrderStatus(order.id, status);
            setOrder({ ...order, status });
            toast.success(`Order marked as ${status.replace('_', ' ')}`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update order status");
        } finally {
            setProcessing(false);
        }
    };

    const handleProcessPayout = async () => {
        if (!order) return;
        setProcessing(true);
        try {
            await firebaseService.updateOrderPayoutStatus(order.id, "paid", "Payout processed manually by admin");
            setOrder({ ...order, payoutStatus: "paid" });
            toast.success("Payout marked as paid");
        } catch (error) {
            console.error("Error processing payout:", error);
            toast.error("Failed to process payout");
        } finally {
            setProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
            case "shipped": return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" };
            case "shipment_verified": return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
            case "delivered": return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
            case "cancelled": return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
            default: return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
        }
    };

    const renderActionButtons = () => {
        if (!order) return null;

        if (order.status === "pending") {
            return (
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleUpdateStatus("cancelled")}
                        disabled={processing}
                    >
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reject Order
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => handleUpdateStatus("confirmed")}
                        disabled={processing}
                    >
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Accept Order
                    </Button>
                </div>
            );
        }

        if (order.status === "shipped") {
            return (
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleUpdateStatus("confirmed")}
                        disabled={processing}
                    >
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Decline Shipment
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => handleUpdateStatus("shipment_verified")}
                        disabled={processing}
                    >
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Accept Shipment
                    </Button>
                </div>
            );
        }

        if (order.status === "shipment_verified") {
            return (
                <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleUpdateStatus("delivered")}
                    disabled={processing}
                >
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mark as Delivered
                </Button>
            );
        }

        if (order.status === "delivered" && (!order.payoutStatus || order.payoutStatus !== "paid")) {
            return (
                <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handleProcessPayout}
                    disabled={processing}
                >
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Process Payout
                </Button>
            );
        }

        return null;
    };

    if (loading) return <PageLoader message="Loading order details..." />;
    if (!order) return <div className="p-8 text-center text-gray-500">Order not found</div>;

    const statusStyle = getStatusColor(order.status);
    const payoutStatusStyle = order.payoutStatus === "paid"
        ? { bg: "bg-green-50", text: "text-green-700" }
        : { bg: "bg-amber-50", text: "text-amber-700" };

    return (
        <div className="space-y-6 max-w-3xl mx-auto pt-8 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 px-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/marketplace/orders")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Review Order</h2>
                    <p className="text-sm text-gray-400 font-mono">#{order.id.slice(0, 12)}</p>
                </div>
            </div>

            {/* Status & Payout */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Order Status</p>
                            <Badge
                                variant="outline"
                                className={cn("px-3 py-1 font-bold text-xs uppercase tracking-wider border", statusStyle.bg, statusStyle.text, statusStyle.border)}
                            >
                                {order.status.replace('_', ' ')}
                            </Badge>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Payout Status</p>
                            <Badge
                                variant="outline"
                                className={cn("px-3 py-1 font-bold text-xs uppercase tracking-wider border", payoutStatusStyle.bg, payoutStatusStyle.text)}
                            >
                                {(order.payoutStatus || "pending")}
                            </Badge>
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-4">
                        Placed on {format(order.createdAt, "MMM dd, yyyy 'at' HH:mm")}
                    </p>
                </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{order.customerName || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{order.customerEmail || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{order.customerPhone || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{order.shippingAddress || "N/A"}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Items */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Items ({order.products.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {order.products.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                            <div className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.image ? (
                                    <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="h-6 w-6 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.productName}</p>
                                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                {item.vendorId && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">Vendor: {item.vendorId.slice(0, 8)}</p>
                                )}
                            </div>
                            <p className="font-semibold text-sm">₦{item.price.toLocaleString()}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Total</span>
                        <span className="text-2xl font-bold">₦{order.total.toLocaleString()}</span>
                    </div>
                    {order.deliveryMethod && (
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-gray-500 text-sm">Delivery Method</span>
                            <span className="text-sm font-medium capitalize">{order.deliveryMethod}</span>
                        </div>
                    )}
                    {order.monnifyPaymentDetails && (
                        <>
                            <Separator className="my-3" />
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Payment Details</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Bank</span>
                                    <span className="font-medium">{order.monnifyPaymentDetails.bankName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Account</span>
                                    <span className="font-mono font-medium">{order.monnifyPaymentDetails.accountNumber}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Reference</span>
                                    <span className="font-mono text-xs">{order.monnifyPaymentDetails.reference}</span>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            {renderActionButtons() && (
                <Card>
                    <CardContent className="pt-6">
                        {renderActionButtons()}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
