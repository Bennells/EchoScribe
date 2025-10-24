"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";

interface ProcessingStatusProps {
  processingStartedAt?: Timestamp;
  fileSize: number; // in bytes
}

export function ProcessingStatus({ processingStartedAt, fileSize }: ProcessingStatusProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Calculate estimated duration based on file size
  // Assumption: ~0.3 minutes (18 seconds) per 10 MB (based on real-world data)
  const fileSizeMB = fileSize / 1024 / 1024;
  const estimatedMinutes = Math.max(2, Math.ceil((fileSizeMB / 10) * 0.3));
  const estimatedSeconds = estimatedMinutes * 60;

  useEffect(() => {
    if (!processingStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    // Calculate initial elapsed time
    const startTime = processingStartedAt.toDate().getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    // Update immediately
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [processingStartedAt]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage (cap at 95% until actually complete)
  const progressPercent = Math.min(95, (elapsedSeconds / estimatedSeconds) * 100);

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
      <div className="flex flex-col gap-1 min-w-[140px]">
        <span className="text-sm text-yellow-600 font-medium">
          Wird verarbeitet...
        </span>
        {processingStartedAt ? (
          <>
            <span className="text-xs text-muted-foreground">
              {formatTime(elapsedSeconds)} / ~{estimatedMinutes} Min
            </span>
            <Progress value={progressPercent} className="h-1" />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Startet in Kürze...
          </span>
        )}
      </div>
    </div>
  );
}
