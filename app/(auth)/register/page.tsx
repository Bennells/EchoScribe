"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormMessage } from "@/components/ui/form";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      toast.success("Konto erfolgreich erstellt!");
      // Wait a bit for auth state to propagate, then use router.push
      // This allows the AuthContext to update before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Diese E-Mail-Adresse wird bereits verwendet");
      } else if (err.code === "auth/invalid-email") {
        setError("Ungültige E-Mail-Adresse");
      } else if (err.code === "auth/weak-password") {
        setError("Passwort ist zu schwach");
      } else {
        setError("Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
      }
      setLoading(false);
    }
    // Don't set loading to false on success - keep it true during navigation
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Registrieren</CardTitle>
          <CardDescription>
            Erstellen Sie ein Konto, um loszulegen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleSubmit}>
            <FormField>
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </FormField>

            <FormField>
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mindestens 6 Zeichen
              </p>
            </FormField>

            <FormField>
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </FormField>

            {error && <FormMessage>{error}</FormMessage>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird registriert..." : "Registrieren"}
            </Button>
          </Form>

          <div className="mt-4 text-center text-sm">
            Bereits ein Konto?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Jetzt anmelden
            </Link>
          </div>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            Mit der Registrierung stimmen Sie unseren{" "}
            <Link href="/terms" className="underline hover:text-primary">
              AGB
            </Link>{" "}
            und{" "}
            <Link href="/privacy" className="underline hover:text-primary">
              Datenschutzerklärung
            </Link>{" "}
            zu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
