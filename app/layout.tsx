import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { Toaster } from "react-hot-toast";
import { Footer } from "@/components/footer";
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
  return (
    <html lang="de">
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">
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
