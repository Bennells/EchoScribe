import { Suspense } from 'react';
import NotAuthorizedContent from './NotAuthorizedContent';

export default function NotAuthorizedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <NotAuthorizedContent />
    </Suspense>
  );
}
