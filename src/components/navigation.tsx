'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Inbox, BookOpen, Library, EyeOff } from 'lucide-react';

const navItems = [
  { name: 'Triage', href: '/', icon: Inbox },
  { name: 'Read Later', href: '/read-later', icon: BookOpen },
  { name: 'NotebookLM', href: '/notebook-queue', icon: Library },
  { name: 'Ignored (AI)', href: '/ignore', icon: EyeOff },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-4 pb-safe pt-2 md:relative md:border-t-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
      <div className="flex justify-around md:flex-col md:space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center space-y-1 p-2 transition-colors md:flex-row md:space-x-4 md:space-y-0 md:rounded-lg md:px-4 md:py-3',
                isActive
                  ? 'text-blue-600 md:bg-blue-50 md:text-blue-700'
                  : 'text-slate-500 hover:text-slate-900 md:hover:bg-slate-100'
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium md:text-base">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
