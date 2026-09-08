import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBarbershopOwnerApi } from "@/lib/require-owner";

const updateSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; appointmentId: string }> },
) {
  const { slug, appointmentId } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, barbershopId: barbershop.id },
  });
  if (!appointment) {
    return NextResponse.json(
      { error: "Agendamento não encontrado nesta barbearia." },
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

  // Estados finais não voltam atrás por essa rota (evita reabrir um
  // agendamento já concluído ou cancelado por engano)
  const finalStates = ["COMPLETED", "CANCELLED", "NO_SHOW"];
  if (finalStates.includes(appointment.status)) {
    return NextResponse.json(
      { error: "Este agendamento já está em um estado final." },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ appointment: updated });
}
