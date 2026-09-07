import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";

const querySchema = z.object({
  professionalId: z.string().min(1, "professionalId é obrigatório"),
  serviceId: z.string().min(1, "serviceId é obrigatório"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD"),
});

export async function GET(
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

  const searchParams = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    professionalId: searchParams.get("professionalId"),
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { professionalId, serviceId, date } = parsed.data;

  // Checagem de segurança multi-tenant: o profissional e o serviço
  // precisam de fato pertencer a ESTA barbearia, não só existir no banco.
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

  const slots = await getAvailableSlots({
    professionalId,
    serviceId,
    date: new Date(`${date}T00:00:00`),
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });
}
