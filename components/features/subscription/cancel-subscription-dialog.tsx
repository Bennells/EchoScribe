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

  const formattedDate = periodEndDate.toLocaleDateString("en-US", {
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
          Cancel Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <DialogTitle>Cancel Subscription?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Are you sure you want to cancel your <strong>{tierLabels[currentTier] || currentTier}</strong> subscription?
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p className="font-medium">What happens after cancellation:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Your subscription remains active until <strong>{formattedDate}</strong>
                </li>
                <li>You can use all features until the end of the period</li>
                <li>
                  After {formattedDate}, your account will be downgraded to the free plan
                </li>
                <li>You can reverse the cancellation at any time</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              You can upgrade again anytime if you change your mind.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling...
              </>
            ) : (
              "Cancel Subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
