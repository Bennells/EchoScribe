"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getUserArticles } from "@/lib/firebase/articles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, ExternalLink, Calendar } from "lucide-react";
import type { Article } from "@/types/article";

export default function ArticlesPage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadArticles();
    }
  }, [user]);

  const loadArticles = async () => {
    if (!user) return;
    try {
      const data = await getUserArticles(user.uid);
      setArticles(data);
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Artikel</h1>
        <p className="text-muted-foreground mt-2">
          Ihre generierten Blog-Artikel aus Podcasts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ihre Artikel</CardTitle>
          <CardDescription>
            {articles.length} Artikel{articles.length !== 1 ? "" : ""} generiert
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Lädt...</p>
          ) : articles.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Noch keine Artikel generiert
              </p>
              <Button asChild>
                <Link href="/dashboard/podcasts">
                  Podcast hochladen
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {article.metaDescription}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {article.createdAt.toDate().toLocaleDateString("de-DE", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        <span>
                          {article.keywords.length} Keywords
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="ml-3"
                  >
                    <Link href={`/dashboard/articles/${article.id}`}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Anzeigen
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
