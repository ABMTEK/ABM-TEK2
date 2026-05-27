"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Plus } from "lucide-react";
import { format } from "date-fns";

export default function CustomersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [customers, setCustomers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchCustomers = async () => {
            if (!user?.workshopId) {
                setLoading(false);
                return;
            }
            try {
                const allUsers = await firebaseService.getUsersByWorkshop(user.workshopId);
                const customerUsers = allUsers.filter(u => u.role === "customer");
                setCustomers(customerUsers);
            } catch (error) {
                console.error("Error fetching customers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, [user]);

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    const todaysBirthdayCount = (() => {
        const today = new Date();
        const todayMD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        return customers.filter(c => {
            if (!c.birthday) return false;
            const parts = c.birthday.split("-");
            if (parts.length < 3) return false;
            return `${parts[1]}-${parts[2]}` === todayMD;
        }).length;
    })();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {customers.length} customer{customers.length !== 1 ? "s" : ""} registered
                    </p>
                </div>
                <Button asChild>
                    <Link href="/customers/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Customer
                    </Link>
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-md px-8">
                <Search className="absolute left-11 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search by name, phone, or email..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 px-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customers.length}</div>
                    </CardContent>
                </Card>
                <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push("/customers/birthdays")}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Today&apos;s Birthdays</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{todaysBirthdayCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Customers Table */}
            <div className="border-y bg-white w-full">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="pl-8">Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Birthday</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right pr-8">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    {search ? "No customers match your search" : "No customers found"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow key={customer.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/customers/${customer.id}`)}>
                                    <TableCell className="font-medium pl-8">
                                        <Link href={`/customers/${customer.id}`} className="hover:underline">
                                            {customer.name || "—"}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{customer.phone || "—"}</TableCell>
                                    <TableCell className="text-gray-500">{customer.email || "—"}</TableCell>
                                    <TableCell className="text-gray-500">
                                        {customer.birthday
                                            ? format(new Date(customer.birthday + "T00:00:00"), "MMM d")
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-gray-500">
                                        {customer.createdAt
                                            ? format(new Date(customer.createdAt), "MMM d, yyyy")
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Badge
                                            variant="outline"
                                            className="bg-green-50 text-green-700 border-green-200"
                                        >
                                            Active
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
