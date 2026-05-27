"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CAR_BRANDS } from "@/constants/carBrands";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewCustomerPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [birthday, setBirthday] = useState("");

    const [vehicle, setVehicle] = useState({
        make: "",
        model: "",
        year: new Date().getFullYear().toString(),
        licensePlate: "",
        vin: "",
        color: "",
    });

    const handleSubmit = async () => {
        if (!name || !phone) {
            toast.error("Please enter customer name and phone number");
            return;
        }
        if (!user?.workshopId) return;

        setIsSubmitting(true);
        try {
            const customerId = await firebaseService.createCustomer({
                name,
                phone,
                email: email || undefined,
                birthday: birthday || undefined,
                workshopId: user.workshopId,
            });

            if (vehicle.make && vehicle.model && vehicle.licensePlate) {
                const vehicleData: any = {
                    userId: customerId,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: parseInt(vehicle.year) || new Date().getFullYear(),
                    licensePlate: vehicle.licensePlate.toUpperCase(),
                    vin: vehicle.vin ? vehicle.vin.toUpperCase() : "N/A",
                };
                if (vehicle.color) {
                    vehicleData.color = vehicle.color;
                }
                await firebaseService.addVehicle(vehicleData);
            }

            toast.success("Customer created successfully");
            router.push("/customers");
        } catch (error) {
            console.error("Error creating customer:", error);
            toast.error("Failed to create customer. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto p-6 pt-8 pb-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">New Customer</h2>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="Customer name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number *</Label>
                                <Input
                                    id="phone"
                                    placeholder="Phone number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Optional)</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthday">Birthday (Optional)</Label>
                                <Input
                                    id="birthday"
                                    type="date"
                                    value={birthday}
                                    onChange={(e) => setBirthday(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Vehicle Details (Optional)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="make">Make *</Label>
                                <SearchableSelect
                                    options={CAR_BRANDS}
                                    value={vehicle.make}
                                    onValueChange={(value) => setVehicle({ ...vehicle, make: value })}
                                    placeholder="Select or enter make"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="model">Model *</Label>
                                <Input
                                    id="model"
                                    placeholder="e.g. Camry"
                                    value={vehicle.model}
                                    onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="year">Year *</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    placeholder="Year"
                                    value={vehicle.year}
                                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="licensePlate">License Plate *</Label>
                                <Input
                                    id="licensePlate"
                                    placeholder="ABC-123"
                                    value={vehicle.licensePlate}
                                    onChange={(e) => setVehicle({ ...vehicle, licensePlate: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color">Color (Optional)</Label>
                                <Input
                                    id="color"
                                    placeholder="Color"
                                    value={vehicle.color}
                                    onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vin">VIN (Optional)</Label>
                            <Input
                                id="vin"
                                placeholder="Vehicle Identification Number"
                                value={vehicle.vin}
                                onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value.toUpperCase() })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Customer
                </Button>
            </div>
        </div>
    );
}
