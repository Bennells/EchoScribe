"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface PaymentMethodInfo {
  hasPaymentMethod: boolean;
  paymentMethod: {
    id: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
    sepaDebit?: {
      last4: string;
      country: string;
    };
  } | null;
}

function PaymentMethodFormContent() {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Fehler beim Validieren der Zahlungsmethode");
        setIsSubmitting(false);
        return;
      }

      const { error: confirmError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/settings?payment_method_updated=true`,
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Fehler beim Aktualisieren der Zahlungsmethode");
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("Payment method update error:", error);
      setError("Ein unerwarteter Fehler ist aufgetreten");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={!stripe || isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird aktualisiert...
          </>
        ) : (
          "Zahlungsmethode aktualisieren"
        )}
      </Button>
    </form>
  );
}

export function PaymentMethodManager() {
  const [paymentMethodInfo, setPaymentMethodInfo] = useState<PaymentMethodInfo | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  useEffect(() => {
    loadPaymentMethod();
  }, []);

  const loadPaymentMethod = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/stripe/get-payment-method");
      if (response.ok) {
        const data = await response.json();
        setPaymentMethodInfo(data);
      }
    } catch (error) {
      console.error("Error loading payment method:", error);
      toast.error("Fehler beim Laden der Zahlungsmethode");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateClick = async () => {
    setShowUpdateForm(true);
    try {
      const response = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Erstellen des Setup-Intents");
      }

      const { clientSecret } = await response.json();
      setClientSecret(clientSecret);
    } catch (error) {
      console.error("Error creating setup intent:", error);
      toast.error("Fehler beim Vorbereiten des Zahlungsformulars");
      setShowUpdateForm(false);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  const isCardExpiringSoon = (expMonth: number, expYear: number) => {
    const now = new Date();
    const expiry = new Date(expYear, expMonth - 1);
    const monthsUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsUntilExpiry < 3; // Warning if expiring within 3 months
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zahlungsmethode</CardTitle>
          <CardDescription>Verwalten Sie Ihre Zahlungsinformationen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Wird geladen...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zahlungsmethode</CardTitle>
        <CardDescription>Verwalten Sie Ihre Zahlungsinformationen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethodInfo?.hasPaymentMethod && paymentMethodInfo.paymentMethod ? (
          <div className="space-y-4">
            {/* Current Payment Method Display */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {paymentMethodInfo.paymentMethod.card && (
                  <>
                    {getCardBrandIcon(paymentMethodInfo.paymentMethod.card.brand)}
                    <div>
                      <div className="font-medium capitalize">
                        {paymentMethodInfo.paymentMethod.card.brand} •••• {paymentMethodInfo.paymentMethod.card.last4}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Gültig bis {paymentMethodInfo.paymentMethod.card.expMonth.toString().padStart(2, '0')}/{paymentMethodInfo.paymentMethod.card.expYear}
                      </div>
                      {isCardExpiringSoon(
                        paymentMethodInfo.paymentMethod.card.expMonth,
                        paymentMethodInfo.paymentMethod.card.expYear
                      ) && (
                        <div className="flex items-center gap-1 text-sm text-amber-600 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Läuft bald ab</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {paymentMethodInfo.paymentMethod.sepaDebit && (
                  <>
                    <CreditCard className="h-5 w-5" />
                    <div>
                      <div className="font-medium">
                        SEPA Lastschrift •••• {paymentMethodInfo.paymentMethod.sepaDebit.last4}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {paymentMethodInfo.paymentMethod.sepaDebit.country}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {!showUpdateForm && (
              <Button onClick={handleUpdateClick} variant="outline" className="w-full">
                Zahlungsmethode ändern
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sie haben noch keine Zahlungsmethode hinterlegt.
            </p>
            {!showUpdateForm && (
              <Button onClick={handleUpdateClick} className="w-full">
                Zahlungsmethode hinzufügen
              </Button>
            )}
          </div>
        )}

        {/* Update Form */}
        {showUpdateForm && clientSecret && (
          <div className="space-y-4 pt-4 border-t">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                },
                locale: "de",
              }}
            >
              <PaymentMethodFormContent />
            </Elements>
            <Button
              onClick={() => setShowUpdateForm(false)}
              variant="ghost"
              className="w-full"
              type="button"
            >
              Abbrechen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
