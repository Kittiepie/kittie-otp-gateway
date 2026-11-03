import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Card } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">OTP Gateway</h1>
        <p className="mb-5 text-sm text-zinc-500">Admin dashboard</p>
        {/* searchParams are request data, so they're read inside a Suspense boundary. */}
        <Suspense fallback={<div className="h-48" />}>
          <LoginFormWithParams searchParams={searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next, expired } = await searchParams;
  return <LoginForm next={typeof next === 'string' ? next : undefined} expired={expired === '1'} />;
}
