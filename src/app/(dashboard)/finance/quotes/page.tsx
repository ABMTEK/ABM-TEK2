"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { Quote } from "@/types";
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
import { Plus, Inbox, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

export default function QuotesPage() {
    const { user } = useAuthStore();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuotes = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const data = await firebaseService.getQuotes(user.workshopId);
                setQuotes(data);
            } catch (error) {
                console.error("Error fetching quotes:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchQuotes();
    }, [user]);

    const getStatusStyles = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'converted') return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/40";
        if (s === 'pending_approval') return "bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/40";
        if (s === 'rejected' || s === 'cancelled') return "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40";
        if (s === 'draft') return "bg-[#999999]/20 text-[#999999] border-[#999999]/40";
        return "bg-gray-100 text-gray-800 border-gray-200";
    };

    if (loading) return <PageLoader message="Loading quotes..." />;

    return (
        <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quotes</h2>
                    <p className="text-gray-500">Manage workshop service quotes and approvals.</p>
                </div>
            </div>

            <div className="border-y bg-white shadow-sm overflow-hidden w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[150px] pl-8">Quote ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400">
                                            <Inbox className="h-10 w-10 stroke-[1.5]" />
                                        </div>
                                        <p className="text-gray-900 font-semibold">No quotes found for this workshop.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            quotes.map((quote) => (
                                <TableRow key={quote.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium text-gray-900 pl-8">
                                        <Link href={`/finance/quotes/${quote.id}`}>{quote.id.slice(0, 12)}...</Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{quote.customerName || "N/A"}</span>
                                            <span className="text-xs text-gray-500">{quote.customerEmail}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {quote.createdAt
                                            ? format(quote.createdAt, "MMM d, yyyy")
                                            : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                                                getStatusStyles(quote.status)
                                            )}
                                        >
                                            {quote.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        ₦{quote.total.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button variant="ghost" size="sm" asChild className="-mr-3">
                                            <Link href={`/finance/quotes/${quote.id}`}>
                                                Details <ArrowRight className="ml-2 h-3 w-3" />
                                            </Link>
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
