'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function EnvironmentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show banner in test environment, not in production or development
    const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;
    setIsVisible(environment === 'test');
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black shadow-md"
      role="banner"
      aria-label="Test environment warning"
    >
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-2 font-semibold">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm sm:text-base">
          TESTUMGEBUNG - Keine Produktionsdaten verwenden
        </span>
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
  );
}
