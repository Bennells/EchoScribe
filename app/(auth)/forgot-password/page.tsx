"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormMessage } from "@/components/ui/form";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
      toast.success("E-Mail zum Zurücksetzen des Passworts wurde gesendet!");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("Kein Konto mit dieser E-Mail-Adresse gefunden");
      } else if (err.code === "auth/invalid-email") {
        setError("Ungültige E-Mail-Adresse");
      } else {
        setError("Fehler beim Senden der E-Mail. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Passwort zurücksetzen</CardTitle>
          <CardDescription>
            Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum
            Zurücksetzen Ihres Passworts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
                Wir haben Ihnen eine E-Mail mit Anweisungen zum Zurücksetzen Ihres
                Passworts gesendet. Bitte überprüfen Sie Ihr Postfach.
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Zurück zur Anmeldung</Link>
              </Button>
            </div>
          ) : (
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

              {error && <FormMessage>{error}</FormMessage>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Wird gesendet..." : "Link zum Zurücksetzen senden"}
              </Button>

              <div className="mt-4 text-center text-sm">
                <Link href="/login" className="text-primary hover:underline">
                  Zurück zur Anmeldung
                </Link>
              </div>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
