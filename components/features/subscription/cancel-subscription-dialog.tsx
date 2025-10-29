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
import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelSubscriptionDialogProps {
  currentTier: string;
  periodEndDate: Date;
  onConfirm: () => Promise<void>;
}

export function CancelSubscriptionDialog({
  currentTier,
  periodEndDate,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
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
        <Button variant="outline" className="text-destructive hover:text-destructive">
          Abo kündigen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <DialogTitle>Abonnement kündigen?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Möchten Sie Ihr <strong>{tierLabels[currentTier] || currentTier}</strong>-Abonnement wirklich kündigen?
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p className="font-medium">Was passiert nach der Kündigung:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Ihr Abonnement bleibt bis <strong>{formattedDate}</strong> aktiv
                </li>
                <li>Sie können alle Features bis zum Ende der Laufzeit nutzen</li>
                <li>
                  Nach dem {formattedDate} wird Ihr Konto auf den kostenlosen Plan herabgestuft
                </li>
                <li>Sie können die Kündigung jederzeit rückgängig machen</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Sie können jederzeit wieder upgraden, wenn Sie es sich anders überlegen.
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
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gekündigt...
              </>
            ) : (
              "Abo kündigen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
