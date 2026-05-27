"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { firebaseService } from "@/services/firebaseService";
import { useAuthStore } from "@/store/authStore";
import { User, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CAR_BRANDS } from "@/constants/carBrands";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Plus, User as UserIcon, Car, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function CustomerDetailPage() {
    const router = useRouter();
    const { id } = useParams();
    const { user: currentUser } = useAuthStore();

    const [customer, setCustomer] = useState<User | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({
        name: "",
        phone: "",
        email: "",
        birthday: "",
    });

    const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
    const [newVehicle, setNewVehicle] = useState({
        make: "",
        model: "",
        year: new Date().getFullYear().toString(),
        licensePlate: "",
        vin: "",
        color: "",
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!id || typeof id !== "string") return;
            try {
                const [customerData, vehiclesData] = await Promise.all([
                    firebaseService.getUser(id),
                    firebaseService.getVehicles(id)
                ]);

                if (customerData) {
                    setCustomer(customerData);
                    setEditData({
                        name: customerData.name || "",
                        phone: customerData.phone || "",
                        email: customerData.email || "",
                        birthday: customerData.birthday || "",
                    });
                }
                setVehicles(vehiclesData);
            } catch (error) {
                console.error("Error fetching customer data:", error);
                toast.error("Failed to load customer details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleUpdateCustomer = async () => {
        if (!id || typeof id !== "string" || !customer) return;
        setIsSaving(true);
        try {
            await firebaseService.updateUser(id, editData);
            setCustomer({ ...customer, ...editData });
            setIsEditModalOpen(false);
            toast.success("Customer updated successfully");
        } catch (error) {
            console.error("Error updating customer:", error);
            toast.error("Failed to update customer");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddVehicle = async () => {
        if (!id || typeof id !== "string" || !currentUser?.workshopId) return;
        if (!newVehicle.make || !newVehicle.model || !newVehicle.licensePlate || !newVehicle.year) {
            toast.error("Please fill in required vehicle fields (Make, Model, Year, License Plate)");
            return;
        }

        setIsSaving(true);
        try {
            const vehicleData: any = {
                userId: id,
                make: newVehicle.make,
                model: newVehicle.model,
                year: parseInt(newVehicle.year) || new Date().getFullYear(),
                licensePlate: newVehicle.licensePlate.toUpperCase(),
                vin: newVehicle.vin ? newVehicle.vin.toUpperCase() : "N/A",
            };

            if (newVehicle.color) {
                vehicleData.color = newVehicle.color;
            }

            const vehicleId = await firebaseService.addVehicle(vehicleData);

            const newlyAddedVehicle: Vehicle = {
                id: vehicleId,
                ...vehicleData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            setVehicles([newlyAddedVehicle, ...vehicles]);
            setIsAddVehicleModalOpen(false);
            setNewVehicle({
                make: "",
                model: "",
                year: new Date().getFullYear().toString(),
                licensePlate: "",
                vin: "",
                color: "",
            });
            toast.success("Vehicle added successfully");
        } catch (error) {
            console.error("Error adding vehicle:", error);
            toast.error("Failed to add vehicle");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="p-6 text-center">
                <h2 className="text-xl font-semibold">Customer not found</h2>
                <Button variant="link" onClick={() => router.push("/customers")}>
                    Back to Customers
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-6 pt-8 pb-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/customers")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Customer ID: {customer.id}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Edit className="mr-2 h-4 w-4" /> Edit Customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Customer Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Full Name</Label>
                                    <Input
                                        id="edit-name"
                                        value={editData.name}
                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Phone Number</Label>
                                    <Input
                                        id="edit-phone"
                                        value={editData.phone}
                                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={editData.email}
                                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-birthday">Birthday</Label>
                                    <Input
                                        id="edit-birthday"
                                        type="date"
                                        value={editData.birthday}
                                        onChange={(e) => setEditData({ ...editData, birthday: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleUpdateCustomer} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Info Sidebar */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5" /> Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p className="font-medium">{customer.phone || "—"}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="font-medium">{customer.email || "—"}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Birthday</p>
                            <p className="font-medium">
                                {customer.birthday ? format(new Date(customer.birthday + "T00:00:00"), "MMMM d") : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Joined</p>
                            <p className="font-medium">
                                {customer.createdAt ? format(new Date(customer.createdAt), "PPP") : "—"}
                            </p>
                        </div>
                        <div className="pt-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Active Customer
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Vehicles Main */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Car className="h-5 w-5" /> Vehicles ({vehicles.length})
                        </CardTitle>
                        <Dialog open={isAddVehicleModalOpen} onOpenChange={setIsAddVehicleModalOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="mr-2 h-4 w-4" /> Add Vehicle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Register New Vehicle</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid gap-4 grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="v-make">Make *</Label>
                                            <SearchableSelect
                                                options={CAR_BRANDS}
                                                value={newVehicle.make}
                                                onValueChange={(value) => setNewVehicle({ ...newVehicle, make: value })}
                                                placeholder="Select or enter make"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="v-model">Model *</Label>
                                            <Input
                                                id="v-model"
                                                placeholder="e.g. Camry"
                                                value={newVehicle.model}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="v-year">Year *</Label>
                                            <Input
                                                id="v-year"
                                                type="number"
                                                value={newVehicle.year}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="v-plate">License Plate *</Label>
                                            <Input
                                                id="v-plate"
                                                placeholder="ABC-123"
                                                value={newVehicle.licensePlate}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="v-vin">VIN (Optional)</Label>
                                        <Input
                                            id="v-vin"
                                            placeholder="VIN"
                                            value={newVehicle.vin}
                                            onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="v-color">Color (Optional)</Label>
                                        <Input
                                            id="v-color"
                                            placeholder="Color"
                                            value={newVehicle.color}
                                            onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddVehicleModalOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddVehicle} disabled={isSaving}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Register Vehicle
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        {vehicles.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Car className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No vehicles registered for this customer yet.</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Vehicle</TableHead>
                                            <TableHead>License Plate</TableHead>
                                            <TableHead>Year</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {vehicles.map((vehicle) => (
                                            <TableRow key={vehicle.id}>
                                                <TableCell>
                                                    <div className="font-medium">{vehicle.make} {vehicle.model}</div>
                                                    {vehicle.color && <div className="text-xs text-muted-foreground">{vehicle.color}</div>}
                                                </TableCell>
                                                <TableCell className="font-mono">{vehicle.licensePlate}</TableCell>
                                                <TableCell>{vehicle.year}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/jobs/new?userId=${id}&vehicleId=${vehicle.id}`)}>
                                                        Create Job
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
