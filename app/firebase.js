import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2nBRjYxAu9cjFIGpf1NoFsObS7ZhIV6g",
  authDomain: "tandkv9-ct.firebaseapp.com",
  projectId: "tandkv9-ct",
  storageBucket: "tandkv9-ct.firebasestorage.app",
  messagingSenderId: "10740620306",
  appId: "1:10740620306:web:3ba92c258cb8bf24d24ccb",
  measurementId: "G-QSXLX7K0YJ"
};

// Kiểm tra để không khởi tạo Firebase nhiều lần gây sập app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);