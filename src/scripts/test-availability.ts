import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getAvailableSlots } from "../lib/availability";

function getNextWeekday(weekday: number): Date {
  const today = new Date();
  const result = new Date(today);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function main() {
  const barbershop = await prisma.barbershop.findUnique({
    where: { slug: "barbearia-do-ze" },
  });

  if (!barbershop) {
    throw new Error(
      "Barbearia de teste não encontrada. Rode `npx prisma db seed` primeiro.",
    );
  }

  // 1. Profissional de teste
  const professional = await prisma.professional.create({
    data: {
      barbershopId: barbershop.id,
      name: "João Barbeiro",
    },
  });

  // 2. Horário de trabalho: segunda a sexta, 09:00-18:00
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.professionalSchedule.create({
      data: {
        professionalId: professional.id,
        weekday,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
  }

  // 3. Serviço de teste: corte, 30 minutos
  const service = await prisma.service.create({
    data: {
      barbershopId: barbershop.id,
      name: "Corte de cabelo",
      durationMinutes: 30,
      priceCents: 4000,
    },
  });

  // 4. Cliente de teste
  const client = await prisma.client.create({
    data: {
      barbershopId: barbershop.id,
      name: "Cliente Teste",
      phone: "11999999999",
    },
  });

  // 5. Um agendamento já existente, próxima segunda-feira, 10:00-10:30
  const nextMonday = getNextWeekday(1);
  const existingStart = new Date(nextMonday);
  existingStart.setHours(10, 0, 0, 0);
  const existingEnd = new Date(nextMonday);
  existingEnd.setHours(10, 30, 0, 0);

  await prisma.appointment.create({
    data: {
      barbershopId: barbershop.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: client.id,
      startTime: existingStart,
      endTime: existingEnd,
      status: "CONFIRMED",
    },
  });

  console.log(`Profissional criado: ${professional.name} (${professional.id})`);
  console.log(`Testando disponibilidade em: ${nextMonday.toDateString()}\n`);

  // 6. Rodar a função de disponibilidade
  const slots = await getAvailableSlots({
    professionalId: professional.id,
    date: nextMonday,
    serviceId: service.id,
  });

  console.log("Horários livres encontrados:");
  for (const slot of slots) {
    console.log(
      `  ${slot.start.toLocaleTimeString("pt-BR")} - ${slot.end.toLocaleTimeString("pt-BR")}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
