import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyDF8LCeU78__yuC2PJ-4wlwgsu6ypWmTpM",
    authDomain: "abmtek-wms.firebaseapp.com",
    projectId: "abmtek-wms",
    storageBucket: "abmtek-wms.firebasestorage.app",
    messagingSenderId: "377439900182",
    appId: "1:377439900182:web:7209c334955fd71236db37",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
