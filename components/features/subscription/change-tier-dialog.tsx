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
import { ArrowRight, Loader2, TrendingUp, TrendingDown } from "lucide-react";

type Tier = "starter" | "professional" | "business";

interface ChangeTierDialogProps {
  currentTier: Tier;
  newTier: Tier;
  onConfirm: () => Promise<void>;
  children: React.ReactNode; // The button/trigger element
}

const tierInfo: Record<Tier, { label: string; price: string; quota: number }> = {
  starter: { label: "Starter", price: "€9,99", quota: 15 },
  professional: { label: "Professional", price: "€24,99", quota: 60 },
  business: { label: "Business", price: "€49,99", quota: 150 },
};

export function ChangeTierDialog({
  currentTier,
  newTier,
  onConfirm,
  children,
}: ChangeTierDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
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

  const currentInfo = tierInfo[currentTier];
  const newInfo = tierInfo[newTier];

  // Determine if it's an upgrade or downgrade
  const isUpgrade = newInfo.quota > currentInfo.quota;
  const Icon = isUpgrade ? TrendingUp : TrendingDown;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className={`h-6 w-6 ${isUpgrade ? 'text-green-500' : 'text-orange-500'}`} />
            <DialogTitle>
              {isUpgrade ? 'Plan upgraden' : 'Plan ändern'}?
            </DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-4">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Aktuell</div>
                <div className="font-semibold text-lg">{currentInfo.label}</div>
                <div className="text-sm text-muted-foreground">{currentInfo.price}/Monat</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Neu</div>
                <div className="font-semibold text-lg text-primary">{newInfo.label}</div>
                <div className="text-sm text-muted-foreground">{newInfo.price}/Monat</div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p className="font-medium">
                {isUpgrade ? 'Was passiert beim Upgrade:' : 'Was passiert bei der Änderung:'}
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ihr Plan wird sofort geändert</li>
                <li>
                  Neue monatliche Quota: <strong>{newInfo.quota} Podcasts</strong>
                </li>
                <li>
                  {isUpgrade
                    ? 'Sie werden anteilig für den restlichen Monat belastet'
                    : 'Sie erhalten eine anteilige Gutschrift für den restlichen Monat'
                  }
                </li>
                <li>
                  Ab dem nächsten Abrechnungszyklus: <strong>{newInfo.price}/Monat</strong>
                </li>
              </ul>
            </div>

            {!isUpgrade && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                ⚠️ Hinweis: Bei einem Downgrade wird Ihre monatliche Quota reduziert.
              </p>
            )}
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
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird geändert...
              </>
            ) : (
              `${isUpgrade ? 'Upgraden' : 'Ändern'} auf ${newInfo.label}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
