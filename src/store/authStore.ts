import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { firebaseService } from '@/services/firebaseService';

interface AuthState {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    initialized: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    setUser: (user: User | null) => void;
    setFirebaseUser: (user: FirebaseUser | null) => void;
    setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            firebaseUser: null,
            loading: false,
            initialized: false,

            login: async (email: string, password: string) => {
                set({ loading: true });
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    const firebaseUser = userCredential.user;

                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const data = firebaseService.sanitizeUser(userDoc.data());
                        const userData: User = {
                            ...data,
                            id: userDoc.id,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            updatedAt: data.updatedAt?.toDate() || new Date(),
                        } as User;
                        set({ user: userData, firebaseUser, loading: false });
                    } else {
                        throw new Error('User data not found');
                    }
                } catch (error: any) {
                    set({ loading: false });
                    throw error;
                }
            },

            logout: async () => {
                try {
                    await signOut(auth);
                    set({ user: null, firebaseUser: null });
                } catch (error: any) {
                    throw error;
                }
            },

            resetPassword: async (email: string) => {
                try {
                    await sendPasswordResetEmail(auth, email);
                } catch (error: any) {
                    throw error;
                }
            },

            setUser: (user: User | null) => set({ user }),
            setFirebaseUser: (user: FirebaseUser | null) => set({ firebaseUser: user }),
            setInitialized: (initialized: boolean) => set({ initialized }),
        }),

        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
            }),
        }
    )
);
