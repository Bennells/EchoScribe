"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { checkQuota, getQuotaInfo, incrementQuota } from "@/lib/firebase/quota";
import { createPodcast, getUserPodcasts, deletePodcast, subscribeToUserPodcasts } from "@/lib/firebase/podcasts";
import { UploadZone } from "@/components/features/podcast-upload/upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import toast from "react-hot-toast";
import { Trash2, FileAudio, Clock, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Podcast } from "@/types/podcast";

export default function PodcastsPage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();

      // Subscribe to real-time podcast updates
      const unsubscribe = subscribeToUserPodcasts(user.uid, (podcasts) => {
        setPodcasts(podcasts);
        setLoading(false);
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }
  }, [user]);

  const loadPodcasts = async () => {
    if (!user) return;
    try {
      const data = await getUserPodcasts(user.uid);
      setPodcasts(data);
    } catch (error) {
      console.error("Error loading podcasts:", error);
      toast.error("Fehler beim Laden der Podcasts");
    } finally {
      setLoading(false);
    }
  };

  const loadQuotaInfo = async () => {
    if (!user) return;
    try {
      const info = await getQuotaInfo(user.uid);
      setQuotaInfo(info);
    } catch (error) {
      console.error("Error loading quota:", error);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    try {
      // Check quota
      const hasQuota = await checkQuota(user.uid);
      if (!hasQuota) {
        toast.error("Quota erreicht. Bitte upgraden Sie Ihr Abo oder warten Sie bis zum nächsten Monat.");
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      // Start upload to Storage
      const { uploadTask, storagePath } = await createPodcast(
        user.uid,
        selectedFile,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      // Wait for upload to complete
      await uploadTask;

      // Quota will be incremented by Cloud Function after successful processing
      toast.success("Podcast erfolgreich hochgeladen! Verarbeitung läuft...");
      setSelectedFile(null);
      setUploadProgress(0);

      // Quota info will be updated by Cloud Function
      // Reload it to show the latest status
      setTimeout(() => loadQuotaInfo(), 2000); // Wait a bit for Function to update
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Fehler beim Hochladen: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (podcast: Podcast) => {
    if (!confirm(`Podcast "${podcast.fileName}" wirklich löschen?`)) return;

    try {
      await deletePodcast(podcast.id, podcast.storagePath);
      toast.success("Podcast gelöscht");
      // Podcasts will update via real-time listener
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "uploaded":
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Hochgeladen</span>
          </div>
        );
      case "processing":
      case "queued":
        return (
          <div className="flex items-center gap-1 text-yellow-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Wird verarbeitet</span>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Fertig</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Fehler</span>
          </div>
        );
      default:
        return <span className="text-sm text-muted-foreground">{status}</span>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Podcasts</h1>
        <p className="text-muted-foreground mt-2">
          Laden Sie Ihre Podcasts hoch und lassen Sie sie in Blog-Artikel umwandeln
        </p>
      </div>

      {/* Quota Info */}
      {quotaInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ihre Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {quotaInfo.used} von {quotaInfo.monthly} Podcasts verwendet
              </span>
              <span className="text-sm font-medium">
                {quotaInfo.remaining} übrig
              </span>
            </div>
            <Progress value={(quotaInfo.used / quotaInfo.monthly) * 100} />
            <p className="text-xs text-muted-foreground mt-2">
              Nächstes Reset: {quotaInfo.resetAt.toLocaleDateString("de-DE")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Neuen Podcast hochladen</CardTitle>
          <CardDescription>
            Unterstützte Formate: MP3, WAV, M4A, OGG (max. 500 MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadZone onFileSelect={handleFileSelect} disabled={uploading} />

          {selectedFile && !uploading && (
            <Button onClick={handleUpload} className="w-full">
              Jetzt hochladen
            </Button>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Wird hochgeladen...</span>
                <span>{uploadProgress.toFixed(0)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Podcasts List */}
      <Card>
        <CardHeader>
          <CardTitle>Ihre Podcasts</CardTitle>
          <CardDescription>
            {podcasts.length} Podcast{podcasts.length !== 1 ? "s" : ""} hochgeladen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Lädt...</p>
          ) : podcasts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Noch keine Podcasts hochgeladen
            </p>
          ) : (
            <div className="space-y-3">
              {podcasts.map((podcast) => (
                <div
                  key={podcast.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileAudio className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{podcast.fileName}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {(podcast.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <span>
                          {podcast.uploadedAt.toDate().toLocaleDateString("de-DE")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(podcast.status)}
                    {podcast.status === "completed" && podcast.articleId && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <Link href={`/dashboard/articles/${podcast.articleId}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Artikel
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(podcast)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
