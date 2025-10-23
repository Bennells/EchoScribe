"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getQuotaInfo } from "@/lib/firebase/quota";
import { getPodcastStats, getUserPodcasts } from "@/lib/firebase/podcasts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileAudio, FileText, TrendingUp, Upload } from "lucide-react";
import type { Podcast } from "@/types/podcast";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ thisMonth: 0, total: 0, completed: 0 });
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [recentPodcasts, setRecentPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [podcastStats, quota, podcasts] = await Promise.all([
        getPodcastStats(user.uid),
        getQuotaInfo(user.uid),
        getUserPodcasts(user.uid),
      ]);

      setStats(podcastStats);
      setQuotaInfo(quota);
      setRecentPodcasts(podcasts.slice(0, 5)); // Last 5
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Willkommen zurück, {user?.email?.split("@")[0]}!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Podcasts hochgeladen
            </CardTitle>
            <FileAudio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.thisMonth}
            </div>
            <p className="text-xs text-muted-foreground">
              Diesen Monat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Artikel generiert
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.completed}
            </div>
            <p className="text-xs text-muted-foreground">
              Gesamt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Quota-Verbrauch
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading || !quotaInfo
                ? "..."
                : quotaInfo.isPro
                ? "Unbegrenzt"
                : `${quotaInfo.used} / ${quotaInfo.total}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {quotaInfo?.isPro ? "Pro" : "Free Tier"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellstart</CardTitle>
          <CardDescription>
            Laden Sie Ihren ersten Podcast hoch und lassen Sie ihn in einen Blog-Artikel umwandeln
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/dashboard/podcasts">
              <Upload className="mr-2 h-5 w-5" />
              Podcast hochladen
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Aktivität</CardTitle>
          <CardDescription>
            Ihre zuletzt hochgeladenen Podcasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Lädt...</p>
          ) : recentPodcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Noch keine Podcasts hochgeladen
            </p>
          ) : (
            <div className="space-y-2">
              {recentPodcasts.map((podcast) => (
                <div
                  key={podcast.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{podcast.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {podcast.uploadedAt.toDate().toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      podcast.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : podcast.status === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {podcast.status === "completed"
                      ? "Fertig"
                      : podcast.status === "error"
                      ? "Fehler"
                      : "In Arbeit"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
