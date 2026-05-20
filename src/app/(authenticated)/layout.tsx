import { Navigation } from '@/components/navigation';
import { ScrollToTop } from '@/components/scroll-to-top';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen w-full flex-col md:flex-row">
      {/* Sidebar for Desktop/iPad Landscape */}
      <aside className="hidden w-64 flex-col border-r bg-white p-6 md:flex">
        <div className="mb-8 flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Dairy News
          </h1>
        </div>
        <Navigation />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <div className="md:hidden">
        <Navigation />
      </div>
      <ScrollToTop />
    </div>
  );
}
