'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button, Card } from '@/components/ui';

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="max-w-lg">
      <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
      <p className="mb-4 text-sm text-zinc-600">
        The dashboard could not load data from the API. Check that the api is running, then try
        again.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </Card>
  );
}
