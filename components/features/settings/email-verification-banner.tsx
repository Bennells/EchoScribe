"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase/config";
import { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { updateUserEmail } from "@/app/actions/updateUserEmail";
import toast from "react-hot-toast";

interface EmailVerificationBannerProps {
  userId: string;
  onVerificationComplete?: () => void;
}

export function EmailVerificationBanner({
  userId,
  onVerificationComplete,
}: EmailVerificationBannerProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasVerificationEmail, setHasVerificationEmail] = useState(false);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);

      // Check if user has a pending email verification
      // This happens when verifyBeforeUpdateEmail was called
      if (currentUser && !currentUser.emailVerified) {
        // Store the current state to check for email changes
        const currentEmail = currentUser.email;

        // Check periodically if email was updated
        const checkInterval = setInterval(async () => {
          await currentUser.reload();
          const updatedUser = auth.currentUser;

          if (updatedUser && updatedUser.email !== currentEmail) {
            setHasVerificationEmail(true);
            clearInterval(checkInterval);
          }
        }, 3000); // Check every 3 seconds

        return () => clearInterval(checkInterval);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCompleteVerification = async () => {
    if (!user) return;

    setIsVerifying(true);

    try {
      // Reload user to get latest email verification status
      await user.reload();
      const updatedUser = auth.currentUser;

      if (!updatedUser) {
        throw new Error("Benutzer nicht gefunden");
      }

      if (!updatedUser.emailVerified) {
        toast.error("Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse");
        setIsVerifying(false);
        return;
      }

      // Get fresh ID token
      const idToken = await updatedUser.getIdToken(true);
      const newEmail = updatedUser.email;

      if (!newEmail) {
        throw new Error("Keine E-Mail-Adresse gefunden");
      }

      // Update Firestore and Stripe
      const result = await updateUserEmail(userId, newEmail, idToken);

      if (!result.success) {
        throw new Error(result.error || "Fehler beim Aktualisieren der E-Mail-Adresse");
      }

      toast.success("E-Mail-Adresse erfolgreich geändert!");
      setHasVerificationEmail(false);
      onVerificationComplete?.();
    } catch (error: any) {
      console.error("Failed to complete email verification:", error);
      toast.error(error.message || "Fehler beim Abschließen der E-Mail-Änderung");
    } finally {
      setIsVerifying(false);
    }
  };

  // Don't show banner if dismissed or no verification email is pending
  if (isDismissed || !hasVerificationEmail || !user) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-blue-900">
                E-Mail-Bestätigung ausstehend
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Sie haben eine Bestätigungs-E-Mail erhalten. Bitte bestätigen Sie Ihre neue
                E-Mail-Adresse, um die Änderung abzuschließen.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompleteVerification}
              disabled={isVerifying}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird überprüft...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Änderung abschließen
                </>
              )}
            </Button>
            <p className="text-xs text-blue-600">
              Klicken Sie hier, nachdem Sie die E-Mail bestätigt haben
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
