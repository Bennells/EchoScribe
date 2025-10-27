"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./config";
import { signIn, signUp, signOut, resetPassword } from "./auth";
import { createUserDocument } from "./users";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const userCredential = await signIn(email, password);
    // Get the ID token and store it in httpOnly cookie
    const token = await userCredential.user.getIdToken();

    console.log("Setting auth token cookie...");
    const response = await fetch("/api/auth/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to set cookie:", error);
      throw new Error("Failed to set authentication cookie");
    }

    console.log("Auth token cookie set successfully");
  };

  const handleSignUp = async (email: string, password: string) => {
    console.log("[AuthContext] Starting sign up process", { email });
    const userCredential = await signUp(email, password);
    console.log("[AuthContext] User created in Firebase Auth", { uid: userCredential.user.uid });

    // Create user document in Firestore after successful registration
    try {
      await createUserDocument(userCredential.user.uid, email);
      console.log("[AuthContext] User document created in Firestore");
    } catch (error: any) {
      console.error("[AuthContext] Failed to create user document:", error);
      // Don't fail the signup if user document creation fails
      // The user can still authenticate, but may need to recreate the document
      throw new Error("Benutzer erstellt, aber Fehler beim Speichern der Benutzerdaten: " + error.message);
    }

    // Get the ID token and store it in httpOnly cookie
    const token = await userCredential.user.getIdToken();
    console.log("[AuthContext] Setting auth token cookie...");
    await fetch("/api/auth/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    console.log("[AuthContext] Sign up process completed successfully");
  };

  const handleSignOut = async () => {
    await signOut();
    // Clear the httpOnly cookie
    await fetch("/api/auth/clear-token", {
      method: "POST",
    });
  };

  const handleResetPassword = async (email: string) => {
    await resetPassword(email);
  };

  const value = {
    user,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
