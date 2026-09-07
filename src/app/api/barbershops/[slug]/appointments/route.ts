import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createAppointmentWithRetry,
  SlotUnavailableError,
  OutsideWorkingHoursError,
} from "@/lib/appointments";

const bodySchema = z.object({
  professionalId: z.string().min(1),
  serviceId: z.string().min(1),
  startTime: z
    .string()
    .datetime({ message: "startTime deve ser uma data ISO válida" }),
  client: z.object({
    name: z.string().min(2, "Nome muito curto"),
    phone: z.string().min(8, "Telefone inválido"),
    email: z.string().email().optional(),
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const barbershop = await prisma.barbershop.findUnique({ where: { slug } });
  if (!barbershop) {
    return NextResponse.json(
      { error: "Barbearia não encontrada." },
      { status: 404 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { professionalId, serviceId, startTime, client } = parsed.data;

  // Mesma checagem de segurança multi-tenant da rota de disponibilidade
  const [professional, service] = await Promise.all([
    prisma.professional.findFirst({
      where: { id: professionalId, barbershopId: barbershop.id },
    }),
    prisma.service.findFirst({
      where: { id: serviceId, barbershopId: barbershop.id },
    }),
  ]);

  if (!professional || !service) {
    return NextResponse.json(
      { error: "Profissional ou serviço não encontrado nesta barbearia." },
      { status: 404 },
    );
  }

  // Cria o cliente se for a primeira vez dele nessa barbearia,
  // ou reaproveita o registro existente (mesmo telefone)
  const clientRecord = await prisma.client.upsert({
    where: {
      barbershopId_phone: { barbershopId: barbershop.id, phone: client.phone },
    },
    update: { name: client.name, email: client.email },
    create: {
      barbershopId: barbershop.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
    },
  });

  try {
    const appointment = await createAppointmentWithRetry({
      barbershopId: barbershop.id,
      professionalId,
      serviceId,
      clientId: clientRecord.id,
      startTime: new Date(startTime),
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OutsideWorkingHoursError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Erro inesperado ao criar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar agendamento." },
      { status: 500 },
    );
  }
}
