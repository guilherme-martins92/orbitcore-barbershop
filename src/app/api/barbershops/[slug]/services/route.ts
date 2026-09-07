import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive("Duração deve ser positiva"),
  priceCents: z.number().int().nonnegative("Preço não pode ser negativo"),
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

  const services = await prisma.service.findMany({
    where: { barbershopId: barbershop.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
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

  const service = await prisma.service.create({
    data: {
      barbershopId: barbershop.id,
      ...parsed.data,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
