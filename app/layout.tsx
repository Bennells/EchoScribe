import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { Toaster } from "react-hot-toast";
import { Footer } from "@/components/footer";
import { EnvironmentBanner } from "@/components/environment-banner";
import { createMetadata } from "@/lib/metadata";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = createMetadata({
  title: "EchoScribe - Podcast zu Blog-Artikel",
  description: "Wandeln Sie Podcasts automatisch in SEO-optimierte Blog-Artikel um",
  path: "/",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isTestEnvironment = process.env.NEXT_PUBLIC_ENVIRONMENT === 'test';

  return (
    <html lang="de">
      <body className={inter.className}>
        <EnvironmentBanner />
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div
              className="flex-1"
              style={{ paddingTop: isTestEnvironment ? '2.5rem' : '0' }}
            >
              {children}
            </div>
            <Footer />
          </div>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
