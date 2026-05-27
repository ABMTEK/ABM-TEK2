"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Invoice } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

export default function InvoicesPage() {
    const { user } = useAuthStore();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const paymentFilter = searchParams.get("payment");

    useEffect(() => {
        const fetchInvoices = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const data = await firebaseService.getInvoices(undefined, user.workshopId);
                setInvoices(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, [user]);

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();

        if (s === 'paid' || s === 'settled')
            return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
        if (s === 'pending' || s === 'partially_paid')
            return "bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/40";
        if (s === 'failed' || s === 'void' || s === 'rejected')
            return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
        if (s === 'draft')
            return "bg-[#999999]/20 text-[#999999] border-[#999999]/40";

        return "bg-gray-100 text-gray-800 border-gray-200";
    };

    if (loading) return <PageLoader message="Loading invoices..." />;

    const displayedInvoices = paymentFilter === "pending"
        ? invoices.filter(inv => inv.paymentStatus !== "paid")
        : invoices;

    return (
        <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
                    <p className="text-gray-500">View and manage your workshop invoices and payments.</p>
                </div>
                <Button asChild>
                    <Link href="/finance/invoices/new">
                        <Plus className="mr-2 h-4 w-4" /> Create Invoice
                    </Link>
                </Button>
            </div>

            <div className="border-y bg-white shadow-sm overflow-hidden w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[150px] pl-8">Invoice ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400">
                                            <Inbox className="h-10 w-10 stroke-[1.5]" />
                                        </div>
                                        <p className="text-gray-900 font-semibold">{paymentFilter === "pending" ? "No pending invoices found." : "No invoices found."}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedInvoices.map((invoice) => (
                                <TableRow key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium text-gray-900 pl-8">
                                        <Link href={`/finance/invoices/${invoice.id}`}>{invoice.id}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{invoice.customerName || "N/A"}</span>
                                            <span className="text-xs text-gray-500">{invoice.customerEmail}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {invoice.createdAt
                                            ? format(invoice.createdAt, "MMM d, yyyy")
                                            : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                                                getStatusStyles(invoice.paymentStatus || 'pending')
                                            )}
                                        >
                                            {(invoice.paymentStatus || 'pending').replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-gray-900">
                                        ₦{invoice.total.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button variant="ghost" size="sm" asChild className="-mr-3">
                                            <Link href={`/finance/invoices/${invoice.id}`}>View Details</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
