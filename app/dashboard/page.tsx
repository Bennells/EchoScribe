"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getQuotaInfo } from "@/lib/firebase/quota";
import { getPodcastStats, getUserPodcasts } from "@/lib/firebase/podcasts";
import { ProcessingStatus } from "@/components/features/podcast-upload/processing-status";
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
          Welcome back, {user?.email?.split("@")[0]}!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Podcasts Uploaded
            </CardTitle>
            <FileAudio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.thisMonth}
            </div>
            <p className="text-xs text-muted-foreground">
              This Month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Articles Generated
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.completed}
            </div>
            <p className="text-xs text-muted-foreground">
              Total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Upload your first podcast and convert it into a blog article
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/dashboard/podcasts">
              <Upload className="mr-2 h-5 w-5" />
              Upload Podcast
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your recently uploaded podcasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : recentPodcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No podcasts uploaded yet
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
                      {podcast.uploadedAt.toDate().toLocaleDateString("en-US", {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  {podcast.status === "completed" ? (
                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                      Complete
                    </span>
                  ) : podcast.status === "error" ? (
                    <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                      Error
                    </span>
                  ) : (podcast.status === "processing" || podcast.status === "queued") ? (
                    <div className="scale-75 origin-right">
                      <ProcessingStatus
                        processingStartedAt={podcast.processingStartedAt}
                        fileSize={podcast.fileSize}
                      />
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                      In Progress
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
