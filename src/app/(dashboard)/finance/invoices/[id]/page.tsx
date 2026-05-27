"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Invoice } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Printer, CheckCircle, ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { cn, numberToWords } from "@/lib/utils";
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

export default function InvoiceDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState("Transfer");

    useEffect(() => {
        const fetchInvoice = async () => {
            if (typeof id !== "string") return;
            try {
                const data = await firebaseService.getInvoice(id);
                setInvoice(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoice();
    }, [id]);

    const getStatusStyles = (status: string, invoiceStatus?: string) => {
        const s = status?.toLowerCase();
        const is = invoiceStatus?.toLowerCase();

        if (s === 'approved' || s === 'settled' || is === 'settled')
            return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
        if (s === 'pending' || s === 'pending_approval' || is === 'pending_approval')
            return "bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/40";
        if (s === 'void' || s === 'rejected' || s === 'cancelled' || is === 'void')
            return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
        if (s === 'draft')
            return "bg-[#999999]/20 text-[#999999] border-[#999999]/40";

        return "bg-gray-100 text-gray-800 border-gray-200";
    };

    if (loading) return <PageLoader message="Loading invoice..." />;
    if (!invoice) return <div>Invoice not found</div>;

    const handlePrint = () => {
        window.print();
    };

    const handleApprove = async () => {
        if (!invoice || !user) return;
        try {
            const isOverride = invoice.status !== "draft";
            await firebaseService.approveInvoice(invoice.id, user.id, undefined, isOverride);
            const updated = await firebaseService.getInvoice(invoice.id);
            setInvoice(updated);
            setShowApproveModal(false);
            toast.success(isOverride ? "Invoice approved offline" : "Invoice approved");
        } catch (error) {
            console.error("Error approving invoice:", error);
            toast.error("Failed to approve invoice");
        }
    };



    const handleRecordPayment = async () => {
        if (!invoice || !user || paymentAmount <= 0) return;
        try {
            const newPaymentHistory = [
                ...(invoice.paymentHistory || []),
                {
                    amount: paymentAmount,
                    date: new Date(),
                    method: paymentMethod,
                    recordedBy: user.id,
                    recordedByName: user.name
                }
            ];
            const newAmountPaid = (invoice.amountPaid || 0) + paymentAmount;
            const newPaymentStatus = newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';

            await firebaseService.updateInvoice(invoice.id, {
                amountPaid: newAmountPaid,
                paymentStatus: newPaymentStatus,
                paymentHistory: newPaymentHistory
            });

            const updated = await firebaseService.getInvoice(invoice.id);
            setInvoice(updated);
            setPaymentAmount(0);
        } catch (error) {
            console.error("Error recording payment:", error);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12 pt-8">
            <div className="flex items-center justify-between no-print">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/finance/invoices/${invoice.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    {(invoice.status === "draft" || invoice.invoiceStatus === "pending_approval") && (
                        <Button onClick={() => invoice.status !== "draft" ? setShowApproveModal(true) : handleApprove()}>
                            <CheckCircle className="mr-2 h-4 w-4" /> {invoice.status !== "draft" ? "Approve (Manual Override)" : "Approve Invoice"}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Manual Approval</DialogTitle>
                        <DialogDescription asChild>
                            <div className="pt-4 space-y-3 text-sm text-muted-foreground">
                                <p>
                                    This customer has <strong>not yet approved</strong> this invoice via the app.
                                </p>
                                <p>
                                    By proceeding, you are confirming that you have received verbal or offline approval from the customer and wish to finalize this invoice on their behalf.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                            Cancel
                        </Button>
                        <Button className="bg-black text-white hover:bg-gray-800" onClick={handleApprove}>
                            Confirm Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="shadow-lg border-none print:shadow-none">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-8 border-b">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm no-print",
                                    getStatusStyles(invoice.status, invoice.invoiceStatus)
                                )}>
                                {invoice.paymentStatus?.toUpperCase() || 'PENDING'}
                            </Badge>
                        </div>
                        <p className="text-sm text-gray-500 font-mono">#{invoice.id}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://res.cloudinary.com/dyg7neetr/image/upload/v1772036824/ABM_BLACK_g6i4dm.png"
                            alt="ABM TEK Logo"
                            className="h-16 w-auto mb-2"
                        />
                    </div>
                </CardHeader>

                <CardContent className="pt-8 space-y-10">
                    {/* Information Grid */}
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bill To</h3>
                                <p className="text-lg font-semibold text-gray-900">{invoice.customerName || "Walk-in Customer"}</p>
                                <div className="mt-1 space-y-0.5">
                                    <p className="text-sm text-gray-600">{invoice.customerEmail}</p>
                                    <p className="text-sm text-gray-600">{invoice.customerPhone}</p>
                                    {invoice.customerAddress && <p className="text-sm text-gray-600 mt-2">{invoice.customerAddress}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col items-end text-right">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Invoice Details</h3>
                                <div className="space-y-2 w-full max-w-[200px]">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Issued:</span>
                                        <span className="font-medium">{invoice.createdAt ? format(invoice.createdAt, 'MMM d, yyyy') : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Due Date:</span>
                                        <span className="font-medium text-orange-600">{invoice.dueDate ? format(invoice.dueDate, 'MMM d, yyyy') : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm no-print">
                                        <span className="text-gray-500">Payment:</span>
                                        <Badge variant="outline" className={cn(
                                            "capitalize text-[10px] font-bold px-2 py-0.5 border shadow-sm",
                                            invoice.paymentStatus === 'paid' ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"
                                        )}>
                                            {invoice.paymentStatus?.replace('_', ' ') || 'Pending'}
                                        </Badge>
                                    </div>
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
                                    {invoice.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-gray-800">{item.description}</td>
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
                    <div className="grid grid-cols-2 pt-4">
                        <div className="border rounded-lg p-4 bg-gray-50/50 h-fit no-print">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Record Payment</h3>
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs">Amount</Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₦</span>
                                        <Input
                                            type="number"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                            className="pl-7 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                                <Button
                                    className="w-full h-9 text-sm"
                                    disabled={paymentAmount <= 0}
                                    onClick={handleRecordPayment}
                                >
                                    Add Payment
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end pr-6">
                            <div className="w-64 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900 font-medium">₦{invoice.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">VAT</span>
                                        <span className="text-gray-900 font-medium">₦{invoice.vat.toLocaleString()}</span>
                                    </div>
                                    {invoice.discount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 font-medium">
                                            <span>Discount</span>
                                            <span>-₦{invoice.discount.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                                <Separator className="bg-gray-200" />
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total</span>
                                    <span className="text-2xl font-bold text-gray-900">₦{invoice.total.toLocaleString()}</span>
                                </div>
                                {invoice.amountPaid !== undefined && invoice.amountPaid > 0 && (
                                    <div className="pt-2 space-y-2">
                                        <div className="flex justify-between text-sm font-medium text-green-600">
                                            <span>Amount Paid</span>
                                            <span>₦{invoice.amountPaid.toLocaleString()}</span>
                                        </div>
                                        <Separator className="bg-gray-200" />
                                        <div className="flex justify-between text-lg font-bold text-orange-600">
                                            <span>Balance Due</span>
                                            <span>₦{(invoice.total - (invoice.amountPaid || 0)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-6 border-t mt-6">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Amount in Words</h4>
                                    <p className="text-sm font-medium text-gray-700">
                                        {numberToWords(invoice.total)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-gray-100" />

                    <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400 font-medium">Bank:</span>
                                    <span className="font-bold text-gray-900">MONIEPOINT MFB</span>
                                </div>
                                <span className="text-gray-300">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400 font-medium">Acc No:</span>
                                    <span className="font-black text-gray-900 tracking-wider">5071154448</span>
                                </div>
                                <span className="text-gray-300">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400 font-medium">Name:</span>
                                    <span className="font-bold text-gray-900 uppercase">ABDULLATEEF BABA MUSTAPHA</span>
                                </div>
                            </div>
                            <span className="text-xs text-gray-400">Thank you for your business!</span>
                        </div>
                    </div>

                    {/* Payment History */}
                    {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
                        <div className="pt-4 no-print">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Payment History</h3>
                            <div className="space-y-3">
                                {invoice.paymentHistory.map((payment, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-green-100 p-2 rounded-full">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">₦{payment.amount.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">{payment.method} • {payment.date ? format(payment.date, 'MMM d, yyyy') : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-gray-400">Recorded By</p>
                                            <p className="text-xs text-gray-600">{payment.recordedByName || 'Staff'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; font-size: 11px !important; }
                    nav, header, aside, footer { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    [class*="shadow"] { box-shadow: none !important; }
                    [class*="Card"] { border: none !important; box-shadow: none !important; margin: 0 !important; }
                    table { font-size: 11px !important; }
                    th, td { padding: 0.35rem 0.5rem !important; }
                    .space-y-10 > * + * { margin-top: 1.5rem !important; }
                    .gap-12 { gap: 2rem !important; }
                    .pt-8 { padding-top: 1rem !important; }
                    .p-8 { padding: 0 !important; }
                    img { max-height: 50px !important; }
                    @page {
                      margin: 0.5cm;
                      size: A4;
                    }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </div>
    );
}
