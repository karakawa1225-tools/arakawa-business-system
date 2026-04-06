import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50/80">
      <Sidebar />
      <div className="pl-60">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
