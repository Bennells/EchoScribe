"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getQuotaInfo } from "@/lib/firebase/quota";
import { getActiveSubscription } from "@/lib/firebase/subscription";
import toast from "react-hot-toast";
import { Database, AlertCircle, CreditCard, Sparkles } from "lucide-react";
import { DeleteAccountDialog } from "@/components/features/delete-account-dialog";
import { CancelSubscriptionDialog } from "@/components/features/subscription/cancel-subscription-dialog";
import { ReactivateSubscriptionDialog } from "@/components/features/subscription/reactivate-subscription-dialog";
import { ChangeEmailDialog } from "@/components/features/settings/change-email-dialog";
import { EmailVerificationBanner } from "@/components/features/settings/email-verification-banner";
import { useRouter } from "next/navigation";
import type { Subscription } from "@/types/subscription";
import { LAUNCH_SPECIAL_MODE, TIER_LIMITS } from "@/lib/constants/pricing";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();
      loadSubscription();
    }
  }, [user]);

  const loadQuotaInfo = async () => {
    if (!user) return;
    try {
      const info = await getQuotaInfo(user.uid);
      setQuotaInfo(info);
    } catch (error) {
      console.error("Error loading quota info:", error);
    }
  };

  const loadSubscription = async () => {
    if (!user) return;
    try {
      const sub = await getActiveSubscription(user.uid);
      setSubscription(sub);
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Error creating checkout session");
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Error upgrading. Please try again.");
    } finally{
      setLoading(false);
    }
  };

  const isPro = quotaInfo?.isPro;
  const subscriptionStatus = quotaInfo?.subscriptionStatus;

  // Helper functions for date calculations and pricing
  const calculateDaysUntil = (date: Date): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriceForTier = (tier: string): string => {
    switch (tier) {
      case "starter":
        return "€9,99";
      case "professional":
        return "€24,99";
      case "business":
        return "€49,99";
      default:
        return "€0,00";
    }
  };

  const formatRenewalDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error canceling subscription");
      }

      toast.success("Subscription successfully canceled");

      // Reload subscription to get updated status
      await loadSubscription();
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      toast.error(error.message || "Error canceling subscription. Please try again.");
      throw error; // Re-throw to keep dialog loading state
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setReactivateLoading(true);
    try {
      const response = await fetch("/api/stripe/reactivate-subscription", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error reactivating subscription");
      }

      toast.success("Subscription successfully reactivated");

      // Reload subscription to get updated status
      await loadSubscription();
    } catch (error: any) {
      console.error("Reactivate subscription error:", error);
      toast.error(error.message || "Error reactivating subscription. Please try again.");
      throw error; // Re-throw to keep dialog loading state
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Öffnen des Abrechnungsportals");
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Portal error:", error);
      toast.error(error.message || "Fehler beim Öffnen des Abrechnungsportals. Bitte versuchen Sie es erneut.");
      setPortalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      toast.loading("Deleting account...", { id: "delete-account" });

      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error deleting account");
      }

      toast.success("Account successfully deleted", { id: "delete-account" });

      // Sign out and redirect to homepage
      await signOut();
      router.push("/");
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error(
        error.message || "Error deleting account. Please try again.",
        { id: "delete-account" }
      );
      throw error; // Re-throw to keep dialog loading state
    }
  };

  const handleEmailChanged = async () => {
    // Reload quota and subscription info after email change
    await loadQuotaInfo();
    await loadSubscription();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and settings
        </p>
      </div>

      {user && (
        <EmailVerificationBanner
          userId={user.uid}
          onVerificationComplete={handleEmailChanged}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">E-Mail</label>
              {user && (
                <ChangeEmailDialog
                  currentEmail={user.email || ""}
                  userId={user.uid}
                  onEmailChanged={handleEmailChanged}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Account Type</label>
            <p className="text-sm text-muted-foreground">
              {quotaInfo?.tier === "free" && `Free Tier (${TIER_LIMITS.free} minutes per month)`}
              {quotaInfo?.tier === "starter" && "Starter (240 minutes per month)"}
              {quotaInfo?.tier === "professional" && "Professional (600 minutes per month)"}
              {quotaInfo?.tier === "business" && "Business (2000 minutes per month)"}
              {!quotaInfo?.tier && `Free Tier (${TIER_LIMITS.free} minutes per month)`}
            </p>
            {LAUNCH_SPECIAL_MODE && (quotaInfo?.tier === "free" || !quotaInfo?.tier) && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold rounded-full">
                <Sparkles className="h-3 w-3" />
                Launch Special: 200 minutes free!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy & GDPR</CardTitle>
          <CardDescription>
            View and export your stored data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            According to GDPR Art. 15, you have the right to access all your
            stored data. You can view and export your data at any time.
          </p>
          <Button variant="outline" asChild>
            <a href="/dashboard/settings/my-data">
              <Database className="mr-2 h-4 w-4" />
              Show My Data
            </a>
          </Button>
        </CardContent>
      </Card>

      {!LAUNCH_SPECIAL_MODE && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>
              {quotaInfo?.tier && quotaInfo.tier !== "free"
                ? "Manage your active subscription"
                : "Choose a plan and start with more podcast analyses"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!quotaInfo?.tier || quotaInfo.tier === "free" ? (
              <>
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Choose from our different plans:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Starter: 15 podcasts per month (€9.99)</li>
                    <li>Professional: 60 podcasts per month (€24.99)</li>
                    <li>Business: 150 podcasts per month (€49.99)</li>
                  </ul>
                </div>
                <Button asChild>
                  <a href="/dashboard/pricing">
                    View Plans & Upgrade
                  </a>
                </Button>
              </>
            ) : (
            <>
              {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd ? (
                <div className="mb-4 p-4 bg-muted/50 border-l-4 border-l-primary rounded-md">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Your subscription has been canceled
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Your access remains active until{" "}
                        <span className="font-medium text-foreground">
                          {formatRenewalDate(new Date(subscription.currentPeriodEnd.seconds * 1000))}
                        </span>
                        {(() => {
                          const daysLeft = calculateDaysUntil(new Date(subscription.currentPeriodEnd.seconds * 1000));
                          if (daysLeft > 0) {
                            return ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining)`;
                          }
                          return "";
                        })()}
                        . After that, you will be downgraded to the free plan.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    You have an active subscription. Thank you for your support!
                  </p>
                  {subscription?.currentPeriodEnd && quotaInfo?.tier && (
                    <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            Next Renewal
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {getPriceForTier(quotaInfo.tier)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatRenewalDate(new Date(subscription.currentPeriodEnd.seconds * 1000))}
                          {(() => {
                            const daysUntil = calculateDaysUntil(new Date(subscription.currentPeriodEnd.seconds * 1000));
                            if (daysUntil > 0) {
                              return ` (in ${daysUntil} ${daysUntil === 1 ? "day" : "days"})`;
                            } else if (daysUntil === 0) {
                              return " (today)";
                            }
                            return "";
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-3">
                {subscription?.cancelAtPeriodEnd ? (
                  <ReactivateSubscriptionDialog
                    currentTier={quotaInfo.tier}
                    periodEndDate={new Date(subscription.currentPeriodEnd.seconds * 1000)}
                    onConfirm={handleReactivateSubscription}
                  />
                ) : (
                  <CancelSubscriptionDialog
                    currentTier={quotaInfo.tier}
                    periodEndDate={subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd.seconds * 1000) : new Date()}
                    onConfirm={handleCancelSubscription}
                  />
                )}
                <Button variant="outline" asChild>
                  <a href="/dashboard/pricing">
                    View Other Plans
                  </a>
                </Button>
              </div>
            </>
          )}
          </CardContent>
        </Card>
      )}

      {/* Payment Method & Invoices - only for paid subscriptions */}
      {!LAUNCH_SPECIAL_MODE && quotaInfo?.tier && quotaInfo.tier !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Details & Invoices</CardTitle>
            <CardDescription>
              Manage your payment method and access your invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              In the Stripe customer portal you can:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Update your payment method</li>
              <li>View and download invoice history</li>
              <li>Change your billing address</li>
              <li>Manage payment details</li>
            </ul>
            <Button
              onClick={handleOpenBillingPortal}
              disabled={portalLoading}
              className="w-full sm:w-auto"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {portalLoading ? "Opening..." : "Open Billing Portal"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog
            userEmail={user?.email || ""}
            onConfirm={handleDeleteAccount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
