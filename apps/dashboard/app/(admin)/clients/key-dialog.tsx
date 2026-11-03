'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/** Shows a new API key once. After closing, it can't be shown again (only its hash is stored). */
export function KeyDialog({
  apiKey,
  label,
  onClose,
}: {
  apiKey: string;
  label?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New API key{label ? ` for ${label}` : ''}</h2>
        <p className="mt-1 text-sm text-amber-700">
          Copy it now. It will not be shown again; the server only keeps a hash of it.
        </p>
        <code className="mt-4 block break-all rounded-md bg-zinc-100 p-3 font-mono text-sm">
          {apiKey}
        </code>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onClose}>I have saved it</Button>
        </div>
      </div>
    </div>
  );
}
