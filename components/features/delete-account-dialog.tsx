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
        <Button variant="destructive">Konto löschen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>Konto unwiderruflich löschen?</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden.
              Dies wird dauerhaft:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Ihr Konto ({userEmail}) löschen</li>
              <li>Alle hochgeladenen Podcasts löschen</li>
              <li>Alle generierten Artikel löschen</li>
              <li>Ihr aktives Abonnement kündigen (falls vorhanden)</li>
              <li>Alle Ihre Daten permanent entfernen</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="confirm" className="text-sm">
            Geben Sie <strong>DELETE</strong> ein, um zu bestätigen:
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
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gelöscht...
              </>
            ) : (
              "Konto permanent löschen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
