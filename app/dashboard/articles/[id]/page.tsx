"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { getArticle } from "@/lib/firebase/articles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Code, Eye, Tag, Calendar, Share2, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Article } from "@/types/article";
import { HTMLCodeBlock } from "@/components/HTMLCodeBlock";
import { CharacterCounter } from "@/components/ui/character-counter";

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

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
        toast.error("Article not found");
        router.push("/dashboard/articles");
        return;
      }

      // Check if user owns this article
      if (data.userId !== user?.uid) {
        toast.error("Not authorized");
        router.push("/dashboard/articles");
        return;
      }

      setArticle(data);
    } catch (error) {
      console.error("Error loading article:", error);
      toast.error("Error loading article");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/articles">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <p className="text-center py-12 text-muted-foreground">Loading...</p>
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
            {article.createdAt.toDate().toLocaleDateString("en-US", {
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
          <CardTitle className="text-base">SEO Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SEO Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">SEO Title</label>
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
                onClick={() => copyToClipboard(article.title, "Title")}
              >
                <Copy className="h-4 w-4" />
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
              >
                <Copy className="h-4 w-4" />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(article.metaDescription, "Meta Description")
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
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
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All
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
          <CardTitle>Article Content</CardTitle>
          <CardDescription>
            Markdown and HTML view of the generated article
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="inline-flex sticky top-0 z-10 bg-background border-b mb-4">
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
              <TabsTrigger value="markdown" className="gap-2">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">Markdown</span>
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-2">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">HTML</span>
              </TabsTrigger>
              {article.socialMedia && (
                <TabsTrigger value="social" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Social Media</span>
                </TabsTrigger>
              )}
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
                  Copy HTML
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
                  Copy
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
                  Copy
                </Button>
                <HTMLCodeBlock code={article.contentHTML} showLineNumbers={false} />
              </div>
            </TabsContent>

            {article.socialMedia && (
              <TabsContent value="social" className="min-h-[400px]">
                <div className="space-y-6">
                  {/* LinkedIn */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.linkedin, "LinkedIn Post")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                      {article.socialMedia.linkedin}
                    </p>
                  </div>

                  {/* Twitter/X Thread */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Twitter/X Thread
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.twitter.join("\n\n---\n\n"), "Twitter Thread")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {article.socialMedia.twitter.map((tweet, idx) => (
                        <div key={idx} className="bg-muted p-3 rounded relative">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <span className="text-xs text-muted-foreground font-medium">Tweet {idx + 1}</span>
                              <p className="text-sm mt-1 whitespace-pre-wrap">{tweet}</p>
                              <p className="text-xs text-muted-foreground mt-2">{tweet.length}/280 characters</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(tweet, `Tweet ${idx + 1}`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        Instagram
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.instagram, "Instagram Caption")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                      {article.socialMedia.instagram}
                    </p>
                  </div>

                  {/* Facebook */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Facebook
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.facebook, "Facebook Post")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                      {article.socialMedia.facebook}
                    </p>
                  </div>

                  {/* TikTok/YouTube Shorts */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                        </svg>
                        TikTok / YouTube Shorts
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.tiktok, "TikTok Script")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                      {article.socialMedia.tiktok}
                    </p>
                  </div>

                  {/* Newsletter */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                        Newsletter Teaser
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(article.socialMedia!.newsletter, "Newsletter Teaser")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                      {article.socialMedia.newsletter}
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}

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
