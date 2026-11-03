import { Button } from '@/components/ui';
import { logout } from './actions';
import { NavLinks } from './nav-links';

/**
 * Shell for every logged-in page. It reads no request data (cookies are read by the pages,
 * inside Suspense), so Next.js can prerender it and show it instantly while data streams in.
 */
export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-100 p-4 md:w-56 md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0">
        <div className="px-3 py-2 font-semibold">OTP Gateway</div>
        <NavLinks />
        <form action={logout} className="md:mt-auto">
          <Button type="submit" variant="secondary" className="w-full">
            Log out
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
