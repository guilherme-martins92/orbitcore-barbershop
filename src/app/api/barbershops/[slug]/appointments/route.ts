import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createAppointmentWithRetry,
  SlotUnavailableError,
  OutsideWorkingHoursError,
} from "@/lib/appointments";
import { requireBarbershopOwnerApi } from "@/lib/require-owner";

// ---------------------------------------------------------------
// GET — lista os agendamentos de um dia (só o dono da barbearia)
// ---------------------------------------------------------------

const listQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const parsed = listQuerySchema.safeParse({
    date: request.nextUrl.searchParams.get("date"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dayStart = new Date(`${parsed.data.date}T00:00:00`);
  const dayEnd = new Date(`${parsed.data.date}T23:59:59.999`);

  const appointments = await prisma.appointment.findMany({
    where: {
      barbershopId: barbershop.id,
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
    include: {
      professional: { select: { id: true, name: true } },
      service: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          priceCents: true,
        },
      },
      client: { select: { id: true, name: true, phone: true } },
    },
  });

  return NextResponse.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      status: a.status,
      professionalName: a.professional.name,
      serviceName: a.service.name,
      priceCents: a.service.priceCents,
      clientName: a.client.name,
      clientPhone: a.client.phone,
    })),
  });
}

// ---------------------------------------------------------------
// POST — cria um agendamento (rota pública, usada pela tela do cliente)
// ---------------------------------------------------------------

const createBodySchema = z.object({
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
  const parsed = createBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { professionalId, serviceId, startTime, client } = parsed.data;

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
