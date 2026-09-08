import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBarbershopOwnerApi } from "@/lib/require-owner";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; serviceId: string }> },
) {
  const { slug, serviceId } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, barbershopId: barbershop.id },
  });
  if (!service) {
    return NextResponse.json(
      { error: "Serviço não encontrado nesta barbearia." },
      { status: 404 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: parsed.data,
  });

  return NextResponse.json({ service: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; serviceId: string }> },
) {
  const { slug, serviceId } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, barbershopId: barbershop.id },
  });
  if (!service) {
    return NextResponse.json(
      { error: "Serviço não encontrado nesta barbearia." },
      { status: 404 },
    );
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: { active: false },
  });

  return NextResponse.json({ service: updated });
}
