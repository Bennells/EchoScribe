"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { updateUserEmail } from "@/app/actions/updateUserEmail";
import toast from "react-hot-toast";

interface ChangeEmailDialogProps {
  currentEmail: string;
  userId: string;
  onEmailChanged?: () => void;
}

export function ChangeEmailDialog({
  currentEmail,
  userId,
  onEmailChanged,
}: ChangeEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "verification">("input");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const handleClose = () => {
    setOpen(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep("input");
      setNewEmail("");
      setPassword("");
      setErrors({});
    }, 200);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setErrors((prev) => ({ ...prev, email: "E-Mail-Adresse ist erforderlich" }));
      return false;
    }
    if (!emailRegex.test(email)) {
      setErrors((prev) => ({ ...prev, email: "Ungültige E-Mail-Adresse" }));
      return false;
    }
    if (email.toLowerCase() === currentEmail.toLowerCase()) {
      setErrors((prev) => ({
        ...prev,
        email: "Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden",
      }));
      return false;
    }
    setErrors((prev) => ({ ...prev, email: undefined }));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    if (!validateEmail(newEmail)) {
      return;
    }

    if (!password) {
      setErrors({ password: "Passwort ist erforderlich" });
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error("Kein authentifizierter Benutzer gefunden");
      }

      // Step 1: Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      try {
        await reauthenticateWithCredential(user, credential);
      } catch (error: any) {
        console.error("Re-authentication failed:", error);
        if (error.code === "auth/wrong-password") {
          setErrors({ password: "Falsches Passwort" });
        } else if (error.code === "auth/too-many-requests") {
          setErrors({ general: "Zu viele Versuche. Bitte versuchen Sie es später erneut." });
        } else {
          setErrors({ general: "Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut." });
        }
        setLoading(false);
        return;
      }

      // Step 2: Send verification email and update Firebase Auth email
      try {
        await verifyBeforeUpdateEmail(user, newEmail);
      } catch (error: any) {
        console.error("Email verification failed:", error);
        if (error.code === "auth/email-already-in-use") {
          setErrors({ email: "Diese E-Mail-Adresse wird bereits verwendet" });
        } else if (error.code === "auth/invalid-email") {
          setErrors({ email: "Ungültige E-Mail-Adresse" });
        } else if (error.code === "auth/requires-recent-login") {
          setErrors({ general: "Bitte melden Sie sich erneut an und versuchen Sie es erneut." });
        } else {
          setErrors({ general: "Fehler beim Senden der Bestätigungs-E-Mail. Bitte versuchen Sie es erneut." });
        }
        setLoading(false);
        return;
      }

      // Step 3: Show verification step
      setStep("verification");
      setLoading(false);
      toast.success("Bestätigungs-E-Mail wurde gesendet!");
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setErrors({ general: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut." });
      setLoading(false);
    }
  };

  const handleVerificationComplete = async () => {
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Kein authentifizierter Benutzer gefunden");
      }

      // Get fresh ID token
      const idToken = await user.getIdToken(true);

      // Step 4: Update Firestore and Stripe
      const result = await updateUserEmail(userId, newEmail, idToken);

      if (!result.success) {
        throw new Error(result.error || "Fehler beim Aktualisieren der E-Mail-Adresse");
      }

      toast.success("E-Mail-Adresse erfolgreich geändert!");
      handleClose();
      onEmailChanged?.();
    } catch (error: any) {
      console.error("Failed to complete email change:", error);
      toast.error(error.message || "Fehler beim Abschließen der E-Mail-Änderung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-2" />
          E-Mail ändern
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <DialogTitle>E-Mail-Adresse ändern</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {step === "input" ? (
              "Geben Sie Ihre neue E-Mail-Adresse und Ihr aktuelles Passwort ein, um fortzufahren."
            ) : (
              "Bestätigen Sie Ihre neue E-Mail-Adresse, um den Vorgang abzuschließen."
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Aktuelle E-Mail-Adresse</Label>
              <Input
                id="current-email"
                type="email"
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">Neue E-Mail-Adresse</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="ihre.neue@email.com"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (errors.email) {
                    validateEmail(e.target.value);
                  }
                }}
                onBlur={() => validateEmail(newEmail)}
                disabled={loading}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Aktuelles Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                disabled={loading}
                className={errors.password ? "border-red-500" : ""}
              />
              {errors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Zur Sicherheit müssen Sie Ihr Passwort bestätigen
              </p>
            </div>

            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.general}
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-600">
                <strong>Wichtig:</strong> Sie erhalten eine Bestätigungs-E-Mail an Ihre neue
                Adresse. Ihre E-Mail-Adresse wird erst nach der Bestätigung geändert.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  "Bestätigungs-E-Mail senden"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Bestätigungs-E-Mail gesendet</h3>
                <p className="text-sm text-muted-foreground">
                  Wir haben eine Bestätigungs-E-Mail an <strong>{newEmail}</strong> gesendet.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 w-full text-left">
                <p className="text-sm text-amber-800 space-y-2">
                  <strong>Nächste Schritte:</strong>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Öffnen Sie Ihr E-Mail-Postfach</li>
                    <li>Klicken Sie auf den Bestätigungslink in der E-Mail</li>
                    <li>Kehren Sie hierher zurück und klicken Sie auf &ldquo;Änderung abschließen&rdquo;</li>
                  </ol>
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Keine E-Mail erhalten? Überprüfen Sie Ihren Spam-Ordner.
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Später fortfahren
              </Button>
              <Button
                onClick={handleVerificationComplete}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird abgeschlossen...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Änderung abschließen
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
