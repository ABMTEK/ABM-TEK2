"use client";

import { useEffect, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";
import { firebaseService } from "@/services/firebaseService";
import { User } from "@/types";

export function AuthProvider({ children }: { children: ReactNode }) {
    const { setUser, setFirebaseUser, setInitialized } = useAuthStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setFirebaseUser(firebaseUser);

                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const data = firebaseService.sanitizeUser(userDoc.data());
                        const userData: User = {
                            ...data,
                            id: userDoc.id,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            updatedAt: data.updatedAt?.toDate() || new Date(),
                        } as User;

                        if (!userData.workshopId && Array.isArray(userData.connectedWorkshopIds) && userData.connectedWorkshopIds.length > 0) {
                            userData.workshopId = userData.connectedWorkshopIds[0];
                        }

                        setUser(userData);
                    }
                } catch (error) {
                    console.error("Error refreshing user in AuthProvider:", error);
                }
            } else {
                setFirebaseUser(null);
                setUser(null);
            }
            setInitialized(true);
        });

        return () => unsubscribe();
    }, [setUser, setFirebaseUser, setInitialized]);

    return <>{children}</>;
}
