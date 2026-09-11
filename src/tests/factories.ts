import { prisma } from "@/lib/prisma";

export async function createTestBarbershop() {
  const owner = await prisma.user.create({
    data: {
      email: `owner-${Date.now()}-${Math.random()}@test.com`,
      name: "Dono Teste",
      role: "OWNER",
    },
  });

  const barbershop = await prisma.barbershop.create({
    data: {
      name: "Barbearia Teste",
      slug: `barbearia-teste-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ownerId: owner.id,
    },
  });

  return { owner, barbershop };
}

export async function createTestProfessional(
  barbershopId: string,
  opts?: { weekdays?: number[]; startTime?: string; endTime?: string },
) {
  const weekdays = opts?.weekdays ?? [1, 2, 3, 4, 5];
  const startTime = opts?.startTime ?? "09:00";
  const endTime = opts?.endTime ?? "18:00";

  return prisma.professional.create({
    data: {
      barbershopId,
      name: "Profissional Teste",
      schedules: {
        create: weekdays.map((weekday) => ({ weekday, startTime, endTime })),
      },
    },
  });
}

export async function createTestService(
  barbershopId: string,
  opts?: { durationMinutes?: number; priceCents?: number },
) {
  return prisma.service.create({
    data: {
      barbershopId,
      name: "Serviço Teste",
      durationMinutes: opts?.durationMinutes ?? 30,
      priceCents: opts?.priceCents ?? 4000,
    },
  });
}

export async function createTestClient(
  barbershopId: string,
  phone = "11900000000",
) {
  return prisma.client.create({
    data: { barbershopId, name: "Cliente Teste", phone },
  });
}

/** Retorna a próxima data (a partir de hoje) que cai no dia da semana pedido. */
export function getNextWeekday(weekday: number): Date {
  const today = new Date();
  const result = new Date(today);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
