"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
    Printer,
    CheckCircle,
    ArrowLeft,
    Pencil,
    Send,
    XCircle,
    FileText,
    History
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function QuoteDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApproveModal, setShowApproveModal] = useState(false);

    useEffect(() => {
        const fetchQuote = async () => {
            if (typeof id !== "string") return;
            try {
                const data = await firebaseService.getQuote(id);
                setQuote(data);
            } catch (error) {
                console.error("Error fetching quote:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchQuote();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    const handleSendForApproval = async () => {
        if (!quote || !user) return;
        try {
            await firebaseService.updateQuote(quote.id, {
                status: 'pending_approval',
                sentAt: new Date()
            });
            const updated = await firebaseService.getQuote(quote.id);
            setQuote(updated);
            toast.success("Quote sent for approval");
        } catch (error) {
            console.error("Error sending quote for approval:", error);
            toast.error("Failed to send quote for approval");
        }
    };

    const handleApproveAndConvert = async () => {
        if (!quote || !user) return;
        try {
            const invoiceId = await firebaseService.convertQuoteToInvoice(quote.id, user.id, user.name);
            toast.success("Quote approved and converted to invoice");
            setShowApproveModal(false);
            router.push(`/finance/invoices/${invoiceId}`);
        } catch (error) {
            console.error("Error approving quote:", error);
            toast.error("Failed to approve quote");
        }
    };

    const handleReject = async () => {
        if (!quote || !user) return;
        try {
            await firebaseService.updateQuote(quote.id, {
                status: 'rejected',
                history: [
                    ...(quote.history || []),
                    {
                        action: 'reject',
                        description: 'Quote rejected by admin override',
                        userId: user.id,
                        userName: user.name,
                        timestamp: new Date()
                    }
                ]
            } as any);
            const updated = await firebaseService.getQuote(quote.id);
            setQuote(updated);
            toast.success("Quote rejected");
        } catch (error) {
            console.error("Error rejecting quote:", error);
            toast.error("Failed to reject quote");
        }
    };

    if (loading) return <PageLoader message="Loading quote details..." />;
    if (!quote) return <div className="p-8">Quote not found</div>;

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'converted') return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
        if (s === 'pending_approval') return "bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/40";
        if (s === 'rejected' || s === 'cancelled') return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
        if (s === 'draft') return "bg-[#999999]/20 text-[#999999] border-[#999999]/40";
        return "bg-gray-100 text-gray-800 border-gray-200";
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12 pt-8">
            <div className="flex items-center gap-4 no-print">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quotes
                </Button>
            </div>

            <Card className="shadow-lg border-none print:shadow-none">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-8 border-b">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">QUOTE</h1>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                                    getStatusStyles(quote.status)
                                )}>
                                {quote.status.toUpperCase().replace('_', ' ')}
                            </Badge>
                        </div>
                        <p className="text-sm text-gray-500 font-mono">#{quote.id}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="font-bold text-xl text-gray-900">ABM Motors</h2>
                        <p className="text-sm text-gray-500">Workshop Financial Document</p>
                    </div>
                </CardHeader>

                <CardContent className="pt-8 space-y-10">
                    {/* Information Grid */}
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Customer Details</h3>
                                <p className="text-lg font-semibold text-gray-900">{quote.customerName || "Walk-in Customer"}</p>
                                <div className="mt-1 space-y-0.5">
                                    <p className="text-sm text-gray-600">{quote.customerEmail}</p>
                                    <p className="text-sm text-gray-600">{quote.customerPhone}</p>
                                    {quote.customerAddress && <p className="text-sm text-gray-600 mt-2">{quote.customerAddress}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col items-end">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 text-right">Quote Details</h3>
                                <div className="space-y-2 w-full max-w-[200px]">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Created:</span>
                                        <span className="font-medium">{quote.createdAt ? format(quote.createdAt, 'MMM d, yyyy') : 'N/A'}</span>
                                    </div>
                                    {quote.sentAt && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Sent:</span>
                                            <span className="font-medium">{format(quote.sentAt, 'MMM d, yyyy')}</span>
                                        </div>
                                    )}
                                    {quote.convertedToInvoiceId && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Invoice:</span>
                                            <span className="font-medium text-blue-600">#{quote.convertedToInvoiceId.slice(-4)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Line Items</h3>
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="py-4 px-6 text-left font-semibold text-gray-700">Description</th>
                                        <th className="py-4 px-6 text-center font-semibold text-gray-700 w-24">Quantity</th>
                                        <th className="py-4 px-6 text-right font-semibold text-gray-700 w-32">Unit Price</th>
                                        <th className="py-4 px-6 text-right font-semibold text-gray-700 w-32">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {quote.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-gray-800">
                                                {item.description}
                                                {item.isAdditionalWork && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] uppercase py-0 px-1 border-orange-200 text-orange-700 bg-orange-50">Additional</Badge>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center text-gray-600">{item.quantity}</td>
                                            <td className="py-4 px-6 text-right text-gray-600">₦{item.unitPrice.toLocaleString()}</td>
                                            <td className="py-4 px-6 text-right font-medium text-gray-900">₦{item.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex justify-end pr-6">
                        <div className="w-80 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="text-gray-900 font-medium">₦{quote.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">VAT ({quote.vatRate}%)</span>
                                    <span className="text-gray-900 font-medium">₦{quote.vat.toLocaleString()}</span>
                                </div>
                                {quote.discount > 0 && (
                                    <div className="flex justify-between text-sm text-green-600 font-medium">
                                        <span>Discount</span>
                                        <span>-₦{quote.discount.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <Separator className="bg-gray-200" />
                            <div className="flex justify-between items-center py-2">
                                <span className="text-lg font-bold text-gray-900">Total</span>
                                <span className="text-2xl font-bold text-gray-900">₦{quote.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>

                {/* Footer / History placeholder */}
                {quote.history && quote.history.length > 0 && (
                    <CardFooter className="bg-gray-50/50 border-t items-start flex-col py-6 space-y-4 no-print">
                        <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-widest">
                            <History className="h-3.5 w-3.5" />
                            Activity History
                        </div>
                        <div className="space-y-3 w-full">
                            {quote.history.map((log, idx) => (
                                <div key={idx} className="flex gap-4 text-sm">
                                    <div className="w-32 text-gray-400 text-xs mt-0.5">
                                        {log.timestamp ? format(log.timestamp, 'MMM d, HH:mm') : 'N/A'}
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-semibold text-gray-700">{log.userName}</span>
                                        <span className="text-gray-600 mx-2">{log.description}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardFooter>
                )}
            </Card>

            {/* Action Buttons Below Card */}
            <div className="flex flex-wrap gap-3 no-print">
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                {quote.status === "draft" && (
                    <>
                        <Button variant="outline" asChild>
                            <Link href={`/finance/quotes/${quote.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                        <Button onClick={handleSendForApproval}>
                            <Send className="mr-2 h-4 w-4" /> Send for Approval
                        </Button>
                    </>
                )}
                {quote.status === "pending_approval" && (
                    <>
                        <Button variant="outline" asChild>
                            <Link href={`/finance/quotes/${quote.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                        <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleReject}>
                            <XCircle className="mr-2 h-4 w-4" /> Reject
                        </Button>
                        <Button className="bg-black hover:bg-gray-800 text-white" onClick={() => setShowApproveModal(true)}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Approve & Convert (Manual)
                        </Button>
                    </>
                )}
                {quote.status === "converted" && quote.convertedToInvoiceId && (
                    <Button variant="outline" asChild>
                        <Link href={`/finance/invoices/${quote.convertedToInvoiceId}`}>
                            <FileText className="mr-2 h-4 w-4" /> View Invoice
                        </Link>
                    </Button>
                )}
            </div>

            <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Manual Approval</DialogTitle>
                        <DialogDescription asChild>
                            <div className="pt-4 space-y-3 text-sm text-muted-foreground">
                                <p>
                                    This customer has <strong>not yet approved</strong> this quote via the app.
                                </p>
                                <p>
                                    By proceeding, you are confirming that you have received verbal or offline approval from the customer and wish to generate an invoice on their behalf.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                            Cancel
                        </Button>
                        <Button className="bg-black text-white hover:bg-gray-800" onClick={handleApproveAndConvert}>
                            Confirm Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .Card { border: none !important; box-shadow: none !important; }
                    main { padding: 0 !important; }
                }
            `}</style>
        </div>
    );
}
