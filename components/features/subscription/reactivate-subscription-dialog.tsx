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
        <Button variant="default" className="bg-green-600 hover:bg-green-700">
          Reactivate Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <DialogTitle>Reactivate Subscription?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Do you want to reverse the cancellation of your <strong>{tierLabels[currentTier] || currentTier}</strong> subscription?
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p className="font-medium">What happens after reactivation:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Your subscription will continue normally beyond {formattedDate}
                </li>
                <li>Automatic renewal will be reactivated</li>
                <li>You will keep all premium features without interruption</li>
                <li>Billing will continue as usual on the next billing date</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              You can cancel your subscription again at any time.
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
            variant="default"
            onClick={handleReactivate}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivating...
              </>
            ) : (
              "Reactivate Subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
