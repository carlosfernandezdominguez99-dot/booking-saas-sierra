import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { signOutAction } from "@/lib/services/authActions";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { EmployeeScopeSwitcher } from "@/components/dashboard/EmployeeScopeSwitcher";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, business, role, employeeId, employeeName } = await requireBusinessContext();

  // Fase 10: el selector de círculos de arriba solo lo ve el propietario,
  // y solo si tiene algún empleado — un empleado con acceso propio ya solo
  // ve lo suyo (RLS), así que no hace falta ni consultar al resto.
  const { scope, employees } = await getDashboardScope(supabase, business, role, employeeId);
  const activeKey = scope.kind === "all" ? "all" : scope.kind === "manager" ? "manager" : scope.employeeId;

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar businessName={business.name} role={role} employeeName={employeeName} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-ink-100 bg-white px-4 md:px-8">
          <div className="md:hidden">
            <p className="text-sm font-medium text-ink-900">{business.name}</p>
            {role === "staff" && employeeName && (
              <p className="text-xs font-medium text-brand-600">Como {employeeName}</p>
            )}
          </div>
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

        {role === "owner" && employees.length > 0 && (
          <div className="border-b border-ink-100 bg-white px-4 py-3 md:px-8">
            <EmployeeScopeSwitcher
              employees={employees.map((e) => ({ id: e.id, name: e.name, photoUrl: e.photo_url }))}
              managerName={business.manager_display_name ?? business.name}
              managerPhotoUrl={business.manager_photo_url}
              activeKey={activeKey}
            />
          </div>
        )}

        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>

      <BottomNav role={role} />
    </div>
  );
}
