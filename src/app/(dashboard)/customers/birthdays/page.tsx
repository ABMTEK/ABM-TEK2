"use client";

import { useEffect, useState } from "react";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cake } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default function BirthdayCustomersPage() {
    const { user } = useAuthStore();
    const [birthdayCustomers, setBirthdayCustomers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCustomers = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const allUsers = await firebaseService.getUsersByWorkshop(user.workshopId);
                const customers = allUsers.filter(u => u.role === "customer");

                const today = new Date();
                const todayMD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                const todaysBirthdays = customers.filter(c => {
                    if (!c.birthday) return false;
                    const parts = c.birthday.split("-");
                    if (parts.length < 3) return false;
                    return `${parts[1]}-${parts[2]}` === todayMD;
                });

                setBirthdayCustomers(todaysBirthdays);
            } catch (error) {
                console.error("Error fetching customers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6 pt-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/customers">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Cake className="h-7 w-7 text-pink-500" />
                        Today&apos;s Birthdays
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {birthdayCustomers.length} customer{birthdayCustomers.length !== 1 ? "s" : ""} celebrating today — {format(new Date(), "MMMM d, yyyy")}
                    </p>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Birthday</TableHead>
                                <TableHead className="text-right pr-8">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {birthdayCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                                        <Cake className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                        <p className="text-lg font-semibold text-gray-900">No birthdays today</p>
                                        <p className="text-sm text-gray-500">Check back tomorrow!</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                birthdayCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">{customer.name || "—"}</TableCell>
                                        <TableCell>{customer.phone || "—"}</TableCell>
                                        <TableCell className="text-gray-500">{customer.email || "—"}</TableCell>
                                        <TableCell className="text-gray-500">
                                            {customer.birthday
                                                ? format(new Date(customer.birthday), "MMMM d, yyyy")
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge
                                                variant="outline"
                                                className="bg-pink-50 text-pink-700 border-pink-200"
                                            >
                                                🎂 Birthday
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
