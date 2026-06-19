// context/AuthContext.js
"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role,
          branch: userData.branch,
        });
      } else {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          role: "employee",
          branch: "Slemany",
        });
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: "employee",
          branch: "Slemany",
        });
      }
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userData.role,
              branch: userData.branch,
            });
          } else {
            await setDoc(doc(db, "users", firebaseUser.uid), {
              role: "employee",
              branch: "Slemany",
            });
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: "employee",
              branch: "Slemany",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "employee",
            branch: "Slemany",
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
