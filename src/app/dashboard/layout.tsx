import { requireBusinessContext } from "@/lib/services/authContext";
import { signOutAction } from "@/lib/services/authActions";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { business } = await requireBusinessContext();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar businessName={business.name} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-ink-100 bg-white px-4 md:px-8">
          <p className="text-sm font-medium text-ink-900 md:hidden">{business.name}</p>
          <div className="hidden md:block" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
