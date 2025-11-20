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
      setErrors((prev) => ({ ...prev, email: "Email address is required" }));
      return false;
    }
    if (!emailRegex.test(email)) {
      setErrors((prev) => ({ ...prev, email: "Invalid email address" }));
      return false;
    }
    if (email.toLowerCase() === currentEmail.toLowerCase()) {
      setErrors((prev) => ({
        ...prev,
        email: "New email address must be different from current",
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
      setErrors({ password: "Password is required" });
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error("No authenticated user found");
      }

      // Step 1: Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      try {
        await reauthenticateWithCredential(user, credential);
      } catch (error: any) {
        console.error("Re-authentication failed:", error);
        if (error.code === "auth/wrong-password") {
          setErrors({ password: "Incorrect password" });
        } else if (error.code === "auth/too-many-requests") {
          setErrors({ general: "Too many attempts. Please try again later." });
        } else {
          setErrors({ general: "Authentication failed. Please try again." });
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
          setErrors({ email: "This email address is already in use" });
        } else if (error.code === "auth/invalid-email") {
          setErrors({ email: "Invalid email address" });
        } else if (error.code === "auth/requires-recent-login") {
          setErrors({ general: "Please sign in again and try again." });
        } else {
          setErrors({ general: "Error sending verification email. Please try again." });
        }
        setLoading(false);
        return;
      }

      // Step 3: Show verification step
      setStep("verification");
      setLoading(false);
      toast.success("Verification email sent!");
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setErrors({ general: "An unexpected error occurred. Please try again." });
      setLoading(false);
    }
  };

  const handleVerificationComplete = async () => {
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found");
      }

      // Get fresh ID token
      const idToken = await user.getIdToken(true);

      // Step 4: Update Firestore and Stripe
      const result = await updateUserEmail(userId, newEmail, idToken);

      if (!result.success) {
        throw new Error(result.error || "Error updating email address");
      }

      toast.success("Email address successfully changed!");
      handleClose();
      onEmailChanged?.();
    } catch (error: any) {
      console.error("Failed to complete email change:", error);
      toast.error(error.message || "Error completing email change");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-2" />
          Change Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <DialogTitle>Change Email Address</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {step === "input" ? (
              "Enter your new email address and current password to proceed."
            ) : (
              "Verify your new email address to complete the process."
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email Address</Label>
              <Input
                id="current-email"
                type="email"
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="your.new@email.com"
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
              <Label htmlFor="password">Current Password</Label>
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
                For security, you must confirm your password
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
                <strong>Important:</strong> You will receive a verification email at your new
                address. Your email address will only be changed after verification.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Verification Email"
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
                <h3 className="font-semibold text-lg">Verification Email Sent</h3>
                <p className="text-sm text-muted-foreground">
                  We have sent a verification email to <strong>{newEmail}</strong>.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 w-full text-left">
                <p className="text-sm text-amber-800 space-y-2">
                  <strong>Next Steps:</strong>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Open your email inbox</li>
                    <li>Click on the verification link in the email</li>
                    <li>Return here and click &ldquo;Complete Change&rdquo;</li>
                  </ol>
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive an email? Check your spam folder.
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
                Continue Later
              </Button>
              <Button
                onClick={handleVerificationComplete}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Change
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
