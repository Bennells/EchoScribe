'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function NotAuthorizedPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <ShieldAlert className="h-12 w-12 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Zugriff verweigert
          </h1>
          <p className="text-gray-600">
            Ihre E-Mail-Adresse ist nicht für diese Testumgebung berechtigt.
          </p>
        </div>

        {email && (
          <div className="rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-600">Ihre E-Mail-Adresse:</p>
            <p className="font-mono text-sm font-medium text-gray-900">
              {email}
            </p>
          </div>
        )}

        <div className="space-y-3 pt-4">
          <p className="text-sm text-gray-600">
            Bitte kontaktieren Sie den Administrator, um Zugang zu dieser
            Testumgebung zu erhalten.
          </p>

          <div className="flex flex-col gap-2">
            <Button asChild variant="default" className="w-full">
              <Link href="/login">Zurück zum Login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Zur Startseite</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs text-yellow-800">
            <strong>Hinweis:</strong> Dies ist eine Testumgebung. Für den
            Zugang zur Produktionsumgebung kontaktieren Sie bitte{' '}
            <a
              href="mailto:info@bennells.com"
              className="underline hover:text-yellow-900"
            >
              info@bennells.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
