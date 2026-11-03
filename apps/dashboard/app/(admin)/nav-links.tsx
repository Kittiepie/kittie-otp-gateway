'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/clients', label: 'Clients' },
  { href: '/logs', label: 'Logs' },
  { href: '/test-send', label: 'Test send' },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {links.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
