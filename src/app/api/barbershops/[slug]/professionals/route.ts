import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const weekdaySchema = z.number().int().min(0).max(6);

const createSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  serviceIds: z.array(z.string()).default([]),
  weekdays: z.array(weekdaySchema).default([]),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:mm")
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:mm")
    .optional(),
});

export async function GET(
  _request: NextRequest,
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

  const professionals = await prisma.professional.findMany({
    where: { barbershopId: barbershop.id },
    orderBy: { name: "asc" },
    include: {
      schedules: { orderBy: { weekday: "asc" } },
      services: {
        include: { service: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ professionals });
}

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
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, serviceIds, weekdays, startTime, endTime } = parsed.data;

  const professional = await prisma.professional.create({
    data: {
      barbershopId: barbershop.id,
      name,
      services: {
        create: serviceIds.map((serviceId) => ({ serviceId })),
      },
      schedules:
        weekdays.length > 0 && startTime && endTime
          ? {
              create: weekdays.map((weekday) => ({
                weekday,
                startTime,
                endTime,
              })),
            }
          : undefined,
    },
    include: {
      schedules: { orderBy: { weekday: "asc" } },
      services: {
        include: { service: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ professional }, { status: 201 });
}
