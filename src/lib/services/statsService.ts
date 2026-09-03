import type { createClient } from "@/lib/supabase/server";
import { listBookingsWithDetails, type BookingWithDetails } from "@/lib/services/bookingService";
import { listCustomers } from "@/lib/services/customersService";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reservas que cuentan como "ingreso" a efectos de estadísticas: las
 * confirmadas (ingreso previsto) y las completadas (ingreso ya cobrado). Las
 * pendientes todavía no están confirmadas por el negocio y las
 * canceladas/no-presentado no generan ingreso.
 */
const REVENUE_STATUSES = new Set(["confirmed", "completed"]);

/** Nombre de día (en inglés, tal como lo da `Intl`) → índice 0=domingo..6=sábado, igual que `day_of_week` en Postgres. */
const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const WEEKDAY_LABELS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export interface ServiceStat {
  serviceId: string;
  serviceName: string;
  bookingsCount: number;
  revenueCents: number;
}

export interface ServiceRecurrenceStat {
  serviceId: string;
  serviceName: string;
  /** Promedio de días entre visitas consecutivas de un mismo cliente para este servicio. */
  avgDaysBetweenVisits: number;
  /** Nº de intervalos (pares de visitas consecutivas) usados para calcular el promedio. */
  sampleSize: number;
}

export interface CustomerVisitsStat {
  customerId: string;
  customerName: string;
  customerPhone: string;
  visitsCount: number;
  revenueCents: number;
}

export interface CustomerFrequencyStat {
  customerId: string;
  customerName: string;
  customerPhone: string;
  avgDaysBetweenVisits: number;
  visitsCount: number;
}

export interface WeekdayStat {
  weekday: number;
  label: string;
  bookingsCount: number;
}

export interface BusinessStats {
  totalCustomers: number;
  totalBookings: number;
  cancelledBookings: number;
  cancellationRatePct: number;
  totalRevenueCents: number;
  averageTicketCents: number;
  topServices: ServiceStat[];
  serviceRecurrence: ServiceRecurrenceStat[];
  topCustomersByVisits: CustomerVisitsStat[];
  mostFrequentCustomers: CustomerFrequencyStat[];
  bookingsByWeekday: WeekdayStat[];
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.abs(new Date(bIso).getTime() - new Date(aIso).getTime()) / (1000 * 60 * 60 * 24);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calcula las estadísticas del negocio agregando en memoria sobre todas sus
 * reservas y clientes (Fase 4): sin funciones SQL nuevas ni dependencias
 * externas, igual que el resto de servicios del panel. Para un negocio
 * pequeño (peluquería, academia, etc.) el volumen de filas es manejable; si
 * en el futuro hiciera falta paginar, este es el sitio a revisar primero.
 */
export async function getBusinessStats(client: TypedClient, businessId: string, timezone: string): Promise<BusinessStats> {
  const [bookings, customers] = await Promise.all([
    listBookingsWithDetails(client, { businessId }),
    listCustomers(client, businessId),
  ]);

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled");
  const revenueBookings = bookings.filter((b) => REVENUE_STATUSES.has(b.status));

  const totalRevenueCents = revenueBookings.reduce((sum, b) => sum + b.priceCents, 0);
  const averageTicketCents = revenueBookings.length > 0 ? Math.round(totalRevenueCents / revenueBookings.length) : 0;

  const totalWithStatus = activeBookings.length + cancelledBookings.length;
  const cancellationRatePct = totalWithStatus > 0 ? (cancelledBookings.length / totalWithStatus) * 100 : 0;

  // --- Servicios más consumidos ---
  const serviceMap = new Map<string, ServiceStat>();
  for (const b of activeBookings) {
    const existing = serviceMap.get(b.serviceId);
    const revenue = REVENUE_STATUSES.has(b.status) ? b.priceCents : 0;
    if (existing) {
      existing.bookingsCount += 1;
      existing.revenueCents += revenue;
    } else {
      serviceMap.set(b.serviceId, {
        serviceId: b.serviceId,
        serviceName: b.serviceName,
        bookingsCount: 1,
        revenueCents: revenue,
      });
    }
  }
  const topServices = [...serviceMap.values()].sort((a, b) => b.bookingsCount - a.bookingsCount).slice(0, 10);

  // --- Recurrencia por servicio: cada cuánto vuelve un cliente a por el mismo servicio ---
  const byCustomerService = new Map<string, BookingWithDetails[]>();
  for (const b of activeBookings) {
    const key = `${b.customerId}::${b.serviceId}`;
    const existing = byCustomerService.get(key);
    if (existing) existing.push(b);
    else byCustomerService.set(key, [b]);
  }
  const gapsByService = new Map<string, { serviceName: string; gaps: number[] }>();
  for (const group of byCustomerService.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].startTime, sorted[i].startTime));
    const serviceId = sorted[0].serviceId;
    const existing = gapsByService.get(serviceId);
    if (existing) existing.gaps.push(...gaps);
    else gapsByService.set(serviceId, { serviceName: sorted[0].serviceName, gaps });
  }
  const serviceRecurrence: ServiceRecurrenceStat[] = [...gapsByService.entries()]
    .map(([serviceId, { serviceName, gaps }]) => ({
      serviceId,
      serviceName,
      avgDaysBetweenVisits: Math.round(average(gaps) * 10) / 10,
      sampleSize: gaps.length,
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize);

  // --- Clientes por nº de visitas y por frecuencia de vuelta ---
  const byCustomer = new Map<string, BookingWithDetails[]>();
  for (const b of activeBookings) {
    const existing = byCustomer.get(b.customerId);
    if (existing) existing.push(b);
    else byCustomer.set(b.customerId, [b]);
  }

  const topCustomersByVisits: CustomerVisitsStat[] = [...byCustomer.values()]
    .map((group) => ({
      customerId: group[0].customerId,
      customerName: group[0].customerName,
      customerPhone: group[0].customerPhone,
      visitsCount: group.length,
      revenueCents: group.filter((b) => REVENUE_STATUSES.has(b.status)).reduce((sum, b) => sum + b.priceCents, 0),
    }))
    .sort((a, b) => b.visitsCount - a.visitsCount)
    .slice(0, 10);

  const mostFrequentCustomers: CustomerFrequencyStat[] = [...byCustomer.values()]
    .filter((group) => group.length >= 2)
    .map((group) => {
      const sorted = [...group].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].startTime, sorted[i].startTime));
      return {
        customerId: sorted[0].customerId,
        customerName: sorted[0].customerName,
        customerPhone: sorted[0].customerPhone,
        avgDaysBetweenVisits: Math.round(average(gaps) * 10) / 10,
        visitsCount: sorted.length,
      };
    })
    .sort((a, b) => a.avgDaysBetweenVisits - b.avgDaysBetweenVisits)
    .slice(0, 10);

  // --- Distribución por día de la semana (en la zona horaria del negocio) ---
  const weekdayCounts = new Array(7).fill(0) as number[];
  for (const b of activeBookings) {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(
      new Date(b.startTime),
    );
    const idx = WEEKDAY_NAME_TO_INDEX[name];
    if (idx !== undefined) weekdayCounts[idx] += 1;
  }
  const bookingsByWeekday: WeekdayStat[] = weekdayCounts.map((count, idx) => ({
    weekday: idx,
    label: WEEKDAY_LABELS_ES[idx],
    bookingsCount: count,
  }));

  return {
    totalCustomers: customers.length,
    totalBookings: activeBookings.length,
    cancelledBookings: cancelledBookings.length,
    cancellationRatePct: Math.round(cancellationRatePct * 10) / 10,
    totalRevenueCents,
    averageTicketCents,
    topServices,
    serviceRecurrence,
    topCustomersByVisits,
    mostFrequentCustomers,
    bookingsByWeekday,
  };
}
