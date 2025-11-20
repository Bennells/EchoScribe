"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap } from "lucide-react";
import type { User } from "@/types/user";

export function UsageIndicator() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data() as User);
      }
    });

    return () => unsubscribe();
  }, [user]);

  if (!userData || !userData.quota) return null;

  const { used, monthly, resetAt } = userData.quota;
  const percentage = (used / monthly) * 100;

  // Calculate days until reset
  // Handle case where resetAt might be undefined
  let daysUntilReset = 0;
  if (resetAt) {
    const resetDate = resetAt.toDate();
    const now = new Date();
    daysUntilReset = Math.ceil(
      (resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Determine color based on usage
  let progressColor = "bg-green-500";
  let badgeVariant: "default" | "secondary" | "destructive" = "default";

  if (percentage >= 90) {
    progressColor = "bg-red-500";
    badgeVariant = "destructive";
  } else if (percentage >= 70) {
    progressColor = "bg-yellow-500";
    badgeVariant = "secondary";
  }

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Usage Progress */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {used} / {monthly} minutes used
                </span>
              </div>
              <Badge variant={badgeVariant} className="text-xs">
                {Math.round(percentage)}%
              </Badge>
            </div>
            <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
          </div>

          {/* Reset Timer */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Resets in{" "}
              <span className="font-medium text-foreground">
                {daysUntilReset} {daysUntilReset === 1 ? "day" : "days"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
