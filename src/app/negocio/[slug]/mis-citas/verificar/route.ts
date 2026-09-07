import { NextRequest, NextResponse } from "next/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { setCustomerToken } from "@/lib/services/customerSession";

/**
 * Enlace mágico del email de acceso al portal (`sendCustomerAccessEmail` /
 * `sendWaitlistJoinConfirmationEmail`): `?token=` es directamente el token
 * de `customer_access_tokens`. Aquí solo se guarda en la cookie de sesión
 * de este negocio y se redirige al panel — no se valida contra la base de
 * datos en este paso (si el token fuera inválido o hubiera caducado, el
 * panel simplemente volverá a mostrar el formulario de acceso, así que no
 * hace falta duplicar esa comprobación aquí).
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const token = request.nextUrl.searchParams.get("token");
  const redirectTo = new URL(`/negocio/${params.slug}/mis-citas`, request.url);

  const result = await getPublicBusinessBySlug(params.slug);
  if (!result || !token) {
    redirectTo.searchParams.set("error", "enlace_invalido");
    return NextResponse.redirect(redirectTo);
  }

  await setCustomerToken(result.business.id, token);
  return NextResponse.redirect(redirectTo);
}
