"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const accepted = localStorage.getItem("cookies-accepted");
    if (!accepted) {
      setShow(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookies-accepted", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="mx-auto max-w-3xl p-6 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Cookie-Hinweis</h3>
            <p className="text-sm text-muted-foreground">
              Wir verwenden ausschließlich technisch notwendige Cookies für die Authentifizierung.
              Diese sind für die Funktion der Website erforderlich. Weitere Informationen finden
              Sie in unserer{" "}
              <Link href="/privacy" className="underline hover:text-primary">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={acceptCookies}>Verstanden</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
