import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBarbershopOwnerApi } from "@/lib/require-owner";

const weekdaySchema = z.number().int().min(0).max(6);

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  active: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
  weekdays: z.array(weekdaySchema).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; professionalId: string }> },
) {
  const { slug, professionalId } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, barbershopId: barbershop.id },
  });
  if (!professional) {
    return NextResponse.json(
      { error: "Profissional não encontrado nesta barbearia." },
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

  const { name, active, serviceIds, weekdays, startTime, endTime } =
    parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || active !== undefined) {
      await tx.professional.update({
        where: { id: professional.id },
        data: { name, active },
      });
    }

    if (serviceIds !== undefined) {
      await tx.professionalService.deleteMany({
        where: { professionalId: professional.id },
      });
      if (serviceIds.length > 0) {
        await tx.professionalService.createMany({
          data: serviceIds.map((serviceId) => ({
            professionalId: professional.id,
            serviceId,
          })),
        });
      }
    }

    if (weekdays !== undefined && startTime && endTime) {
      await tx.professionalSchedule.deleteMany({
        where: { professionalId: professional.id },
      });
      if (weekdays.length > 0) {
        await tx.professionalSchedule.createMany({
          data: weekdays.map((weekday) => ({
            professionalId: professional.id,
            weekday,
            startTime,
            endTime,
          })),
        });
      }
    }

    return tx.professional.findUniqueOrThrow({
      where: { id: professional.id },
      include: {
        schedules: { orderBy: { weekday: "asc" } },
        services: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
    });
  });

  return NextResponse.json({ professional: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; professionalId: string }> },
) {
  const { slug, professionalId } = await params;

  const { barbershop, error } = await requireBarbershopOwnerApi(slug);
  if (error) return error;

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, barbershopId: barbershop.id },
  });
  if (!professional) {
    return NextResponse.json(
      { error: "Profissional não encontrado nesta barbearia." },
      { status: 404 },
    );
  }

  const updated = await prisma.professional.update({
    where: { id: professional.id },
    data: { active: false },
  });

  return NextResponse.json({ professional: updated });
}
