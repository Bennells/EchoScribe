"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { checkQuota, getQuotaInfo, incrementQuota } from "@/lib/firebase/quota";
import { createPodcast, getUserPodcasts, deletePodcast, subscribeToUserPodcasts } from "@/lib/firebase/podcasts";
import { UploadZone } from "@/components/features/podcast-upload/upload-zone";
import { ProcessingStatus } from "@/components/features/podcast-upload/processing-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import toast from "react-hot-toast";
import { Trash2, FileAudio, Clock, CheckCircle, AlertCircle, ExternalLink, X, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import type { Podcast } from "@/types/podcast";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { getAudioDurations } from "@/lib/audio/get-duration";

interface FileWithDuration {
  file: File;
  duration: number; // in minutes
}

export default function PodcastsPage() {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<FileWithDuration[]>([]);
  const [loadingDurations, setLoadingDurations] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [showDurationInfo, setShowDurationInfo] = useState(false);

  useEffect(() => {
    if (user) {
      // Subscribe to real-time podcast updates
      const unsubscribePodcasts = subscribeToUserPodcasts(user.uid, (newPodcasts) => {
        // Check for quota_exceeded podcasts (newly added)
        const quotaExceededPodcasts = newPodcasts.filter(p => p.status === "quota_exceeded");

        // Find newly quota_exceeded podcasts (not in previous state)
        const previousQuotaExceeded = podcasts.filter(p => p.status === "quota_exceeded").map(p => p.id);
        const newQuotaExceeded = quotaExceededPodcasts.filter(p => !previousQuotaExceeded.includes(p.id));

        // Show toast for new quota_exceeded podcasts
        newQuotaExceeded.forEach(podcast => {
          toast.error(
            `Upload rejected: ${podcast.fileName}\n${podcast.errorMessage || 'Quota exceeded'}`,
            { duration: 10000 }
          );
        });

        setPodcasts(newPodcasts);
        setLoading(false);
      });

      // Subscribe to real-time quota updates
      const userRef = doc(db, "users", user.uid);
      const unsubscribeQuota = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          // All tiers have limited quotas now
          const total = userData.quota.monthly;
          const remaining = userData.quota.monthly - userData.quota.used;

          setQuotaInfo({
            used: userData.quota.used,
            total: total,
            remaining: remaining,
            hasQuota: userData.quota.used < userData.quota.monthly,
            isPro: false, // Deprecated: no unlimited tier
            tier: userData.tier || "free",
            subscriptionStatus: userData.subscriptionStatus,
          });
        }
      }, (error) => {
        console.error("Error subscribing to quota updates:", error);
      });

      // Cleanup subscriptions on unmount
      return () => {
        unsubscribePodcasts();
        unsubscribeQuota();
      };
    }
  }, [user, podcasts]);

  const loadPodcasts = async () => {
    if (!user) return;
    try {
      const data = await getUserPodcasts(user.uid);
      setPodcasts(data);
    } catch (error) {
      console.error("Error loading podcasts:", error);
      toast.error("Error loading podcasts");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (files: File[]) => {
    try {
      setLoadingDurations(true);
      // Extract audio durations using browser Audio API
      const durations = await getAudioDurations(files);
      const filesWithDurations = files.map((file, index) => ({
        file,
        duration: durations[index] || 0
      }));
      setSelectedFiles(prev => [...prev, ...filesWithDurations]);
    } catch (error) {
      console.error("Error extracting audio durations:", error);
      toast.error("Error extracting audio duration");
      // Add files with 0 duration on error
      const filesWithZeroDuration = files.map(file => ({ file, duration: 0 }));
      setSelectedFiles(prev => [...prev, ...filesWithZeroDuration]);
    } finally {
      setLoadingDurations(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    // Prevent multiple simultaneous uploads
    if (uploading) return;

    try {
      // Refresh quota from server before upload to get latest state
      const currentQuotaInfo = await getQuotaInfo(user.uid);
      const pendingMinutes = podcasts
        .filter(p => p.status === "uploaded" || p.status === "queued" || p.status === "processing")
        .reduce((sum, p) => sum + (p.duration || 0), 0);

      // Check if user has enough quota for all uploads
      const totalRequiredMinutes = selectedFiles.reduce((sum, f) => sum + f.duration, 0);
      const totalRequired = currentQuotaInfo.used + pendingMinutes + totalRequiredMinutes;

      if (totalRequired > currentQuotaInfo.total) {
        const available = Math.max(0, currentQuotaInfo.total - currentQuotaInfo.used - pendingMinutes);
        toast.error(
          `Not enough minutes available!\n` +
          `Required: ${totalRequiredMinutes.toFixed(1)} min.\n` +
          `Available: ${available.toFixed(1)} min.\n\n` +
          `Note: Final quota check occurs after upload.`,
          { duration: 8000 }
        );
        return;
      }

      setUploading(true);

      // Show initial upload started message
      toast.success(
        `Upload started for ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}...\n` +
        `Quota will be checked after upload.`,
        { duration: 4000 }
      );

      let successCount = 0;
      let errorCount = 0;

      // Upload files sequentially to avoid overwhelming the system
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, duration } = selectedFiles[i];

        try {
          // Calculate overall progress
          const baseProgress = (i / selectedFiles.length) * 100;
          const fileProgressWeight = 100 / selectedFiles.length;

          // Start upload to Storage with duration
          const { uploadTask } = await createPodcast(
            user.uid,
            file,
            duration,
            (fileProgress) => {
              const totalProgress = baseProgress + (fileProgress * fileProgressWeight / 100);
              setUploadProgress(totalProgress);
            }
          );

          // Wait for upload to complete
          await uploadTask;
          successCount++;

        } catch (error: any) {
          console.error(`Upload error for ${file.name}:`, error);
          errorCount++;
        }
      }

      // Show summary message with quota verification note
      if (errorCount === 0) {
        toast.success(
          `${successCount} Podcast${successCount !== 1 ? 's' : ''} successfully uploaded!\n` +
          `Processing... Quota is being checked and file analyzed.`,
          { duration: 6000 }
        );
      } else if (successCount > 0) {
        toast.success(
          `${successCount} of ${selectedFiles.length} Podcasts uploaded. ${errorCount} failed.\n` +
          `Processing for successful uploads.`,
          { duration: 6000 }
        );
      } else {
        toast.error(`All ${errorCount} uploads failed.`);
      }

      // Reset upload state to allow immediate re-upload
      setSelectedFiles([]);
      setUploadProgress(0);
      setUploading(false);

      // Quota will be incremented by Cloud Function after processing completes
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Upload error: " + error.message);
      setUploading(false);
    }
  };

  const handleDelete = async (podcast: Podcast) => {
    if (!confirm(`Really delete podcast "${podcast.fileName}"?`)) return;

    try {
      await deletePodcast(podcast.id, podcast.storagePath);
      toast.success("Podcast deleted");
      // Podcasts will update via real-time listener
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Error deleting");
    }
  };

  const getStatusBadge = (podcast: Podcast) => {
    const { status, processingStartedAt, fileSize } = podcast;

    switch (status) {
      case "uploaded":
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Uploaded</span>
          </div>
        );
      case "processing":
      case "queued":
        return (
          <ProcessingStatus
            processingStartedAt={processingStartedAt}
            fileSize={fileSize}
          />
        );
      case "completed":
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Complete</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error</span>
          </div>
        );
      case "quota_exceeded":
        return (
          <div className="flex items-center gap-1 text-orange-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Quota Exceeded</span>
          </div>
        );
      default:
        return <span className="text-sm text-muted-foreground">{status}</span>;
    }
  };

  // Filter quota_exceeded podcasts for alert
  const quotaExceededPodcasts = podcasts.filter(p => p.status === "quota_exceeded");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Podcasts</h1>
        <p className="text-muted-foreground mt-2">
          Upload your podcasts and convert them into blog articles
        </p>
      </div>

      {/* Quota Exceeded Alert */}
      {quotaExceededPodcasts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {quotaExceededPodcasts.length} Upload{quotaExceededPodcasts.length > 1 ? 's' : ''} failed
          </AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Your quota was not sufficient for all files. The following uploads were rejected:
            </p>
            <ul className="list-disc list-inside space-y-1">
              {quotaExceededPodcasts.map(p => (
                <li key={p.id} className="text-sm">
                  <span className="font-medium">{p.fileName}</span>
                  {p.duration && ` (${p.duration} min)`}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              These files were not saved and do not count towards your quota.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New Podcast</CardTitle>
          <CardDescription>
            Supported formats: MP3, WAV, M4A, OGG (max. 500 MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900">Important Note on Quota Verification</AlertTitle>
            <AlertDescription className="text-blue-800">
              The exact length of your audio file is only verified by the server <strong>after upload</strong>.
              If the actual length exceeds your available quota, the file will be automatically deleted
              and <strong>not processed</strong>. The duration displayed before upload is only an estimate.
            </AlertDescription>
          </Alert>

          {/* Duration Validation Info Banner */}
          <Card className="border-blue-200 bg-blue-50/50">
            <div className="p-4">
              <button
                onClick={() => setShowDurationInfo(!showDurationInfo)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    How is duration calculated?
                  </span>
                </div>
                {showDurationInfo ? (
                  <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
              </button>

              {showDurationInfo && (
                <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-900 space-y-2">
                  <p>
                    The displayed duration is an estimate from your browser.
                    After upload, our server validates the actual length for fair billing.
                  </p>
                  <p className="text-xs text-blue-700">
                    <strong>Why do we validate duration?</strong>
                    <br />
                    • Fair and accurate quota management
                    <br />
                    • Protection against manipulation
                    <br />
                    • VBR-encoded files may have small variations (usually &lt;5%)
                  </p>
                </div>
              )}
            </div>
          </Card>

          <UploadZone
            onFileSelect={handleFileSelect}
            disabled={uploading || loadingDurations}
            selectedFiles={selectedFiles.map(f => f.file)}
            onClearFile={(index) => {
              if (index !== undefined) {
                setSelectedFiles(prev => prev.filter((_, i) => i !== index));
              } else {
                setSelectedFiles([]);
              }
            }}
          />

          {loadingDurations && (
            <div className="text-center text-sm text-muted-foreground">
              Loading audio duration...
            </div>
          )}

          {selectedFiles.length > 0 && !uploading && !loadingDurations && (() => {
            // Calculate if user has enough quota for selected files
            const totalRequiredMinutes = selectedFiles.reduce((sum, f) => sum + f.duration, 0);
            const pendingMinutes = podcasts
              .filter(p => p.status === "uploaded" || p.status === "queued" || p.status === "processing")
              .reduce((sum, p) => sum + (p.duration || 0), 0);

            const available = quotaInfo ? Math.max(0, quotaInfo.total - quotaInfo.used - pendingMinutes) : 0;
            const hasEnoughQuota = quotaInfo && (quotaInfo.used + pendingMinutes + totalRequiredMinutes) <= quotaInfo.total;

            return (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  ({totalRequiredMinutes.toFixed(1)} min.)
                </div>
                {!hasEnoughQuota && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Not enough minutes! Required: {totalRequiredMinutes.toFixed(1)} min., Available: {available.toFixed(1)} min.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={handleUpload}
                  className="w-full"
                  disabled={!hasEnoughQuota}
                >
                  {selectedFiles.length === 1 ? 'Upload now' : `Upload ${selectedFiles.length} files`}
                </Button>
              </div>
            );
          })()}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
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
          <CardTitle>Your Podcasts</CardTitle>
          <CardDescription>
            {podcasts.length} Podcast{podcasts.length !== 1 ? "s" : ""} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : podcasts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No podcasts uploaded yet
            </p>
          ) : (
            <div className="space-y-3">
              {podcasts.map((podcast) => (
                <div
                  key={podcast.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    podcast.status === "quota_exceeded"
                      ? "border-red-300 bg-red-50/50"
                      : ""
                  }`}
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
                          {podcast.uploadedAt.toDate().toLocaleDateString("en-US", {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(podcast)}
                    {podcast.status === "completed" && podcast.articleId && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <Link href={`/dashboard/articles/${podcast.articleId}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Article
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
