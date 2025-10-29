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
import { CheckCircle2, Loader2 } from "lucide-react";

interface ReactivateSubscriptionDialogProps {
  currentTier: string;
  periodEndDate: Date;
  onConfirm: () => Promise<void>;
}

export function ReactivateSubscriptionDialog({
  currentTier,
  periodEndDate,
  onConfirm,
}: ReactivateSubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReactivate = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = periodEndDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const tierLabels: Record<string, string> = {
    starter: "Starter",
    professional: "Professional",
    business: "Business",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-green-600 hover:bg-green-700">
          Kündigung rückgängig machen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <DialogTitle>Abonnement reaktivieren?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Möchten Sie die Kündigung Ihres <strong>{tierLabels[currentTier] || currentTier}</strong>-Abonnements rückgängig machen?
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p className="font-medium">Was passiert nach der Reaktivierung:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Ihr Abonnement läuft normal weiter über den {formattedDate} hinaus
                </li>
                <li>Die automatische Verlängerung wird wieder aktiviert</li>
                <li>Sie behalten alle Premium-Features ohne Unterbrechung</li>
                <li>Die Abrechnung erfolgt wie gewohnt zum nächsten Stichtag</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Sie können Ihr Abonnement jederzeit wieder kündigen.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            variant="default"
            onClick={handleReactivate}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird reaktiviert...
              </>
            ) : (
              "Abo reaktivieren"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
