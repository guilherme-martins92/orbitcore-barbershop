import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  createAppointmentWithRetry,
  SlotUnavailableError,
  OutsideWorkingHoursError,
} from "../lib/appointments";

function getNextWeekday(weekday: number): Date {
  const today = new Date();
  const result = new Date(today);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function main() {
  const barbershop = await prisma.barbershop.findUniqueOrThrow({
    where: { slug: "barbearia-do-ze" },
  });

  const professional = await prisma.professional.findFirstOrThrow({
    where: { barbershopId: barbershop.id, name: "João Barbeiro" },
  });

  const service = await prisma.service.findFirstOrThrow({
    where: { barbershopId: barbershop.id, name: "Corte de cabelo" },
  });

  // Dois clientes diferentes disputando o mesmo horário
  const clientA = await prisma.client.create({
    data: {
      barbershopId: barbershop.id,
      name: "Cliente A (mais rápido?)",
      phone: "11911111111",
    },
  });

  const clientB = await prisma.client.create({
    data: {
      barbershopId: barbershop.id,
      name: "Cliente B (mais rápido?)",
      phone: "11922222222",
    },
  });

  // Um horário que sabemos estar livre (11:00, fora do bloqueio das 10:00-10:30)
  const nextMonday = getNextWeekday(1);
  const targetStart = new Date(nextMonday);
  targetStart.setHours(11, 0, 0, 0);

  console.log(`Disputando o horário: ${targetStart.toLocaleString("pt-BR")}\n`);
  console.log("Disparando as duas tentativas ao mesmo tempo...\n");

  // Promise.allSettled dispara as duas chamadas em paralelo e espera as duas
  // terminarem, sem que uma rejeição derrube a outra.
  const [resultA, resultB] = await Promise.allSettled([
    createAppointmentWithRetry({
      barbershopId: barbershop.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: clientA.id,
      startTime: targetStart,
    }),
    createAppointmentWithRetry({
      barbershopId: barbershop.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: clientB.id,
      startTime: targetStart,
    }),
  ]);

  function describeResult(
    label: string,
    result: PromiseSettledResult<unknown>,
  ) {
    if (result.status === "fulfilled") {
      console.log(`${label}: SUCESSO — agendamento criado.`);
    } else {
      const error = result.reason;
      if (error instanceof SlotUnavailableError) {
        console.log(
          `${label}: BLOQUEADO — horário já ocupado (SlotUnavailableError).`,
        );
      } else if (error instanceof OutsideWorkingHoursError) {
        console.log(
          `${label}: BLOQUEADO — fora do expediente (OutsideWorkingHoursError).`,
        );
      } else {
        console.log(`${label}: ERRO INESPERADO —`, error);
      }
    }
  }

  describeResult("Cliente A", resultA);
  describeResult("Cliente B", resultB);

  // Confirmação final: deve existir exatamente 1 agendamento nesse horário
  const appointmentsAtSlot = await prisma.appointment.findMany({
    where: {
      professionalId: professional.id,
      startTime: targetStart,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });

  console.log(
    `\nTotal de agendamentos confirmados nesse horário: ${appointmentsAtSlot.length} (esperado: 1)`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
