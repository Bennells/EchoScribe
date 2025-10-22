"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Ihr Konto und Ihre Einstellungen
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
          <CardDescription>Ihre Kontoinformationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">E-Mail</label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Konto-Typ</label>
            <p className="text-sm text-muted-foreground">Free Tier (3 Podcasts/Monat)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abo-Verwaltung</CardTitle>
          <CardDescription>Upgrade oder ändern Sie Ihr Abo</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Stripe-Integration wird in Phase 6 implementiert
          </p>
          <Button disabled>Upgrade</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Konto löschen</CardTitle>
          <CardDescription>
            Löschen Sie Ihr Konto und alle zugehörigen Daten permanent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            Konto löschen (wird später implementiert)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
