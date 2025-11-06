"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { getArticle } from "@/lib/firebase/articles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Code, Eye, Tag, Calendar, RefreshCw } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Article } from "@/types/article";
import { HTMLCodeBlock } from "@/components/HTMLCodeBlock";
import { CharacterCounter } from "@/components/ui/character-counter";
import { regenerateArticleField, type RegenerateField } from "@/app/actions/regenerate";
import { getAuth } from "firebase/auth";

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<RegenerateField | null>(null);

  useEffect(() => {
    if (user && params.id) {
      loadArticle();
    }
  }, [user, params.id]);

  const loadArticle = async () => {
    if (!params.id || typeof params.id !== "string") return;

    try {
      const data = await getArticle(params.id);
      if (!data) {
        toast.error("Artikel nicht gefunden");
        router.push("/dashboard/articles");
        return;
      }

      // Check if user owns this article
      if (data.userId !== user?.uid) {
        toast.error("Keine Berechtigung");
        router.push("/dashboard/articles");
        return;
      }

      setArticle(data);
    } catch (error) {
      console.error("Error loading article:", error);
      toast.error("Fehler beim Laden des Artikels");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} in Zwischenablage kopiert`);
  };

  const handleRegenerate = async (field: RegenerateField) => {
    if (!article || !user || !params.id) return;

    setRegenerating(field);
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();

    if (!idToken) {
      toast.error("Authentifizierung fehlgeschlagen");
      setRegenerating(null);
      return;
    }

    try {
      const result = await regenerateArticleField(
        params.id as string,
        field,
        idToken
      );

      if (result.success) {
        toast.success(`${field === "title" ? "Titel" : field === "metaDescription" ? "Meta Description" : field === "keywords" ? "Keywords" : "Slug"} neu generiert`);

        // Update local state with new value
        setArticle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [field]: result.data,
          };
        });

        // Reload to get fresh data from Firestore
        await loadArticle();
      } else {
        toast.error(result.error || "Fehler beim Neu-Generieren");
      }
    } catch (error) {
      console.error("Error regenerating:", error);
      toast.error("Fehler beim Neu-Generieren");
    } finally {
      setRegenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/articles">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Link>
          </Button>
        </div>
        <p className="text-center py-12 text-muted-foreground">Lädt...</p>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard/articles">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {article.createdAt.toDate().toLocaleDateString("de-DE", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1">
            <Tag className="h-4 w-4" />
            {article.keywords.length} Keywords
          </span>
        </div>
      </div>

      {/* Meta Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO Metadaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SEO Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">SEO Titel</label>
              <CharacterCounter
                current={article.title.length}
                optimal={{ min: 50, max: 60 }}
              />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-sm">
                {article.title}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(article.title, "Titel")}
                disabled={regenerating !== null}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRegenerate("title")}
                disabled={regenerating !== null}
              >
                {regenerating === "title" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="text-sm font-medium mb-2 block">URL Slug</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-sm">
                {article.slug}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(article.slug, "Slug")}
                disabled={regenerating !== null}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRegenerate("slug")}
                disabled={regenerating !== null}
              >
                {regenerating === "slug" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Meta Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Meta Description</label>
              <CharacterCounter
                current={article.metaDescription.length}
                optimal={{ min: 150, max: 160 }}
              />
            </div>
            <div className="flex items-start gap-2">
              <p className="flex-1 p-3 bg-muted rounded text-sm">
                {article.metaDescription}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(article.metaDescription, "Meta Description")
                  }
                  disabled={regenerating !== null}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerate("metaDescription")}
                  disabled={regenerating !== null}
                >
                  {regenerating === "metaDescription" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Keywords</label>
              <div className="flex items-center gap-2">
                <CharacterCounter
                  current={article.keywords.length}
                  optimal={{ min: 5, max: 8 }}
                  label="Keywords"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(article.keywords.join(", "), "Keywords")
                  }
                  disabled={regenerating !== null}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Alle kopieren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerate("keywords")}
                  disabled={regenerating !== null}
                >
                  {regenerating === "keywords" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {article.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Artikel-Inhalt</CardTitle>
          <CardDescription>
            Markdown und HTML Ansicht des generierten Artikels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="inline-flex sticky top-0 z-10 bg-background border-b mb-4">
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Vorschau</span>
              </TabsTrigger>
              <TabsTrigger value="markdown" className="gap-2">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">Markdown</span>
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-2">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">HTML</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="min-h-[400px]">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() =>
                    copyToClipboard(article.contentHTML, "HTML")
                  }
                >
                  <Copy className="h-4 w-4 mr-2" />
                  HTML kopieren
                </Button>
                <div
                  className="prose prose-base max-w-full p-6 border rounded-lg overflow-x-auto prose-headings:font-bold prose-h1:text-3xl prose-h1:mb-4 prose-h2:text-2xl prose-h2:mb-3 prose-h3:text-xl prose-h3:mb-2 prose-p:mb-4 prose-p:leading-relaxed prose-ul:my-4 prose-ol:my-4 prose-li:mb-2"
                  dangerouslySetInnerHTML={{ __html: article.contentHTML }}
                />
              </div>
            </TabsContent>

            <TabsContent value="markdown" className="min-h-[400px]">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() =>
                    copyToClipboard(article.contentMarkdown, "Markdown")
                  }
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopieren
                </Button>
                <pre className="p-6 bg-muted rounded-lg overflow-x-auto text-sm whitespace-pre-wrap break-words">
                  <code className="break-words">{article.contentMarkdown}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="html" className="min-h-[400px]">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() =>
                    copyToClipboard(article.contentHTML, "HTML")
                  }
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopieren
                </Button>
                <HTMLCodeBlock code={article.contentHTML} showLineNumbers={false} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Schema.org & OpenGraph */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schema.org Markup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(article.schemaOrgMarkup, null, 2),
                    "Schema.org"
                  )
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs">
                <code>{JSON.stringify(article.schemaOrgMarkup, null, 2)}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenGraph Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(article.openGraphTags, null, 2),
                    "OpenGraph"
                  )
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs">
                <code>{JSON.stringify(article.openGraphTags, null, 2)}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
