"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";
import type { Database, EmployeeInviteStatus } from "@/types/database.types";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  inviteEmployeeAction,
  revokeInviteAction,
  setEmployeeServicesAction,
  updateEmployeeAction,
} from "@/app/dashboard/empleados/actions";

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export interface EmployeeInviteLite {
  id: string;
  employeeId: string;
  email: string;
  status: EmployeeInviteStatus;
}

const INVITE_STATUS_LABEL: Record<EmployeeInviteStatus, { label: string; className: string }> = {
  pending: { label: "Invitación enviada", className: "bg-amber-50 text-amber-700" },
  accepted: { label: "Ya tiene acceso", className: "bg-emerald-50 text-emerald-700" },
  revoked: { label: "Invitación revocada", className: "bg-ink-100 text-ink-500" },
};

/**
 * Alta/edición/baja de empleados, qué servicios hace cada uno, e invitar
 * (o reinvitar) a que tengan su propio acceso. Se usa solo en
 * `/dashboard/empleados` — el enlace a "Horario" de cada uno lleva a su
 * propia página (reutiliza `HoursEditor`, igual que `/dashboard/horarios`).
 */
export function EmployeesManager({
  initialEmployees,
  services,
  employeeServiceIds,
  invites,
}: {
  initialEmployees: EmployeeRow[];
  services: Pick<ServiceRow, "id" | "name">[];
  /** employeeId -> ids de los servicios que hace */
  employeeServiceIds: Record<string, string[]>;
  invites: EmployeeInviteLite[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [serviceIdsByEmployee, setServiceIdsByEmployee] = useState(employeeServiceIds);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteDraftByEmployee, setInviteDraftByEmployee] = useState<Record<string, string>>({});

  const latestInviteByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeInviteLite>();
    for (const invite of invites) {
      // `invites` llega ordenada por fecha de creación descendente desde
      // el servidor, así que la primera que se vea por empleado ya es la
      // más reciente.
      if (!map.has(invite.employeeId)) map.set(invite.employeeId, invite);
    }
    return map;
  }, [invites]);

  function handleAdd() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createEmployeeAction(trimmed);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo crear el empleado.");
        return;
      }
      setEmployees((prev) => [...prev, result.data!]);
      setName("");
    });
  }

  function handleToggleActive(employee: EmployeeRow) {
    setError(null);
    const nextActive = !employee.active;
    setEmployees((prev) => prev.map((e) => (e.id === employee.id ? { ...e, active: nextActive } : e)));

    startTransition(async () => {
      const result = await updateEmployeeAction(employee.id, { active: nextActive });
      if (result.error) {
        setError(result.error);
        setEmployees((prev) => prev.map((e) => (e.id === employee.id ? { ...e, active: !nextActive } : e)));
      }
    });
  }

  function handleDelete(employeeId: string) {
    setError(null);
    const previous = employees;
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId));

    startTransition(async () => {
      const result = await deleteEmployeeAction(employeeId);
      if (result.error) {
        setError(result.error);
        setEmployees(previous);
      }
    });
  }

  function handleToggleService(employeeId: string, serviceId: string) {
    setError(null);
    const current = serviceIdsByEmployee[employeeId] ?? [];
    const next = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    setServiceIdsByEmployee((prev) => ({ ...prev, [employeeId]: next }));

    startTransition(async () => {
      const result = await setEmployeeServicesAction(employeeId, next);
      if (result.error) {
        setError(result.error);
        setServiceIdsByEmployee((prev) => ({ ...prev, [employeeId]: current }));
      }
    });
  }

  function handleInvite(employeeId: string) {
    setError(null);
    const email = (inviteDraftByEmployee[employeeId] ?? "").trim();
    if (!email) return;

    startTransition(async () => {
      const result = await inviteEmployeeAction(employeeId, email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInviteDraftByEmployee((prev) => ({ ...prev, [employeeId]: "" }));
    });
  }

  function handleRevokeInvite(inviteId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      {employees.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
          {employees.map((employee) => {
            const isExpanded = expandedId === employee.id;
            const assignedServiceIds = serviceIdsByEmployee[employee.id] ?? [];
            const invite = latestInviteByEmployee.get(employee.id);

            return (
              <li key={employee.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : employee.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">
                      {employee.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{employee.name}</p>
                      <p className="text-xs text-ink-400">
                        {assignedServiceIds.length === 0
                          ? "Sin servicios asignados"
                          : `${assignedServiceIds.length} servicio${assignedServiceIds.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {invite && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          INVITE_STATUS_LABEL[invite.status].className,
                        )}
                      >
                        {INVITE_STATUS_LABEL[invite.status].label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(employee)}
                      disabled={isPending}
                      className={
                        employee.active
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500"
                      }
                    >
                      {employee.active ? "Activo" : "Oculto"}
                    </button>
                    <Link href={`/dashboard/empleados/${employee.id}/horario`}>
                      <Button type="button" variant="ghost" size="sm">
                        Horario
                      </Button>
                    </Link>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                        Servicios que realiza
                      </p>
                      {services.length === 0 ? (
                        <p className="text-sm text-ink-400">Todavía no has creado ningún servicio.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {services.map((service) => {
                            const checked = assignedServiceIds.includes(service.id);
                            return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => handleToggleService(employee.id, service.id)}
                                disabled={isPending}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                  checked
                                    ? "border-brand-300 bg-brand-50 text-brand-700"
                                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                                )}
                              >
                                {checked ? "✓ " : ""}
                                {service.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                        Acceso propio
                      </p>
                      {invite?.status === "accepted" ? (
                        <p className="text-sm text-ink-500">
                          {employee.name} ya puede iniciar sesión y gestionar su propia agenda.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="email"
                            placeholder="email@ejemplo.com"
                            value={inviteDraftByEmployee[employee.id] ?? (invite?.status === "pending" ? invite.email : "")}
                            onChange={(e) =>
                              setInviteDraftByEmployee((prev) => ({ ...prev, [employee.id]: e.target.value }))
                            }
                            className="max-w-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            loading={isPending}
                            onClick={() => handleInvite(employee.id)}
                          >
                            {invite?.status === "pending" ? "Reenviar invitación" : "Invitar"}
                          </Button>
                          {invite?.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={isPending}
                              className="text-xs font-medium text-ink-400 hover:text-red-600"
                            >
                              Revocar
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-ink-100 pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(employee.id)}
                      >
                        Eliminar empleado
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-ink-200 p-4">
        <p className="mb-3 text-sm font-medium text-ink-700">Añadir empleado</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="employee-name">Nombre</Label>
            <Input
              id="employee-name"
              placeholder="Ej. María García"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5"
            loading={isPending}
            disabled={!name.trim()}
            onClick={handleAdd}
          >
            Añadir empleado
          </Button>
        </div>
      </div>
    </div>
  );
}
