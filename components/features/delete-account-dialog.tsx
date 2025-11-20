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
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteAccountDialogProps {
  userEmail: string;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountDialog({
  userEmail,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmationValid = confirmationText === "DELETE";

  const handleDelete = async () => {
    if (!isConfirmationValid) return;

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>Permanently Delete Account?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              This action <strong>cannot be undone</strong>.
              This will permanently:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Delete your account ({userEmail})</li>
              <li>Delete all uploaded podcasts</li>
              <li>Delete all generated articles</li>
              <li>Cancel your active subscription (if any)</li>
              <li>Remove all your data permanently</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="confirm" className="text-sm">
            Type <strong>DELETE</strong> to confirm:
          </Label>
          <Input
            id="confirm"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="DELETE"
            className="mt-2"
            disabled={loading}
          />
        </div>
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
            onClick={handleDelete}
            disabled={!isConfirmationValid || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Permanently Delete Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
