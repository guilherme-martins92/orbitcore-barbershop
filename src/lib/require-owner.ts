import { redirect, notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Uso em Server Components (páginas de admin): garante que o usuário
 * logado é o dono desta barbearia. Redireciona pro login ou 404 se não for.
 */
export async function requireBarbershopOwnerPage(slug: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${slug}/services`);
  }

  const barbershop = await prisma.barbershop.findUnique({ where: { slug } });
  if (!barbershop) {
    notFound();
  }

  if (barbershop.ownerId !== session.user.id) {
    redirect("/login");
  }

  return { barbershop, session };
}

/**
 * Uso em Route Handlers (API): mesma checagem, mas devolvendo uma
 * NextResponse de erro em vez de redirecionar.
 *
 * Uso típico no início de cada handler:
 *   const { barbershop, error } = await requireBarbershopOwnerApi(slug);
 *   if (error) return error;
 */
export async function requireBarbershopOwnerApi(slug: string) {
  const session = await auth();
  if (!session?.user) {
    return {
      barbershop: null,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    } as const;
  }

  const barbershop = await prisma.barbershop.findUnique({ where: { slug } });
  if (!barbershop) {
    return {
      barbershop: null,
      error: NextResponse.json(
        { error: "Barbearia não encontrada." },
        { status: 404 },
      ),
    } as const;
  }

  if (barbershop.ownerId !== session.user.id) {
    return {
      barbershop: null,
      error: NextResponse.json(
        { error: "Você não tem permissão para gerenciar esta barbearia." },
        { status: 403 },
      ),
    } as const;
  }

  return { barbershop, error: null } as const;
}
