"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/features/auth/protected-route";
import toast from "react-hot-toast";
import { Home, FileAudio, FileText, Settings, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Erfolgreich abgemeldet");
    } catch (error) {
      toast.error("Fehler beim Abmelden");
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Podcasts", href: "/dashboard/podcasts", icon: FileAudio },
    { name: "Artikel", href: "/dashboard/articles", icon: FileText },
    { name: "Einstellungen", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-muted/10">
          <div className="flex h-full flex-col">
            {/* Logo/Brand */}
            <div className="flex h-16 items-center border-b px-6">
              <Link href="/dashboard" className="text-xl font-bold">
                EchoScribe
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Section */}
            <div className="border-t p-4">
              <div className="mb-3 text-sm">
                <p className="font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Free Tier</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="h-full p-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
