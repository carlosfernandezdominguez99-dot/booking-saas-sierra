import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Selector "de quién es esta agenda" (Fase 9.2): un icono/pestaña por el
 * propio gerente ("Tú") y otro por cada empleado, para moverse entre
 * "mi horario" y el de cada uno sin tener que ir a Empleados cada vez.
 * Solo lo ve el propietario (los empleados con login propio ya solo ven
 * el suyo, sin necesidad de elegir).
 */
export function EmployeeAgendaTabs({
  employees,
  activeEmployeeId,
  managerHref,
  basePathForEmployee,
}: {
  employees: { id: string; name: string }[];
  /** `null` = el gerente es la pestaña activa. */
  activeEmployeeId: string | null;
  managerHref: string;
  basePathForEmployee: (employeeId: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={managerHref}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
          activeEmployeeId === null ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
        )}
      >
        Tú
      </Link>
      {employees.map((employee) => (
        <Link
          key={employee.id}
          href={basePathForEmployee(employee.id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeEmployeeId === employee.id ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
          )}
        >
          {employee.name}
        </Link>
      ))}
    </div>
  );
}
