import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export class SlotUnavailableError extends Error {
  constructor(message = "Este horário não está mais disponível.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export class OutsideWorkingHoursError extends Error {
  constructor(message = "Horário fora do expediente do profissional.") {
    super(message);
    this.name = "OutsideWorkingHoursError";
  }
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

interface CreateAppointmentParams {
  barbershopId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startTime: Date;
}

/**
 * Cria um agendamento revalidando a disponibilidade dentro de uma transação
 * SERIALIZABLE — se dois clientes tentarem marcar o mesmo horário ao mesmo
 * tempo, o Postgres garante que só uma das duas transações vai vencer; a
 * outra recebe um erro de serialização e deve ser re-tentada (ver
 * `createAppointmentWithRetry` abaixo).
 */
export async function createAppointment(params: CreateAppointmentParams) {
  const { barbershopId, professionalId, serviceId, clientId, startTime } = params;

  return prisma.$transaction(
    async (tx) => {
      const service = await tx.service.findUniqueOrThrow({
        where: { id: serviceId },
      });

      const endTime = new Date(
        startTime.getTime() + service.durationMinutes * 60 * 1000
      );

      // 1. O horário pedido está dentro do expediente do profissional?
      const weekday = startTime.getDay();
      const schedules = await tx.professionalSchedule.findMany({
        where: { professionalId, weekday },
      });

      const startTimeStr = formatTime(startTime);
      const endTimeStr = formatTime(endTime);

      const withinSchedule = schedules.some(
        (s) => startTimeStr >= s.startTime && endTimeStr <= s.endTime
      );

      if (!withinSchedule) {
        throw new OutsideWorkingHoursError();
      }

      // 2. Existe alguma folga do profissional conflitando?
      const conflictingTimeOff = await tx.professionalTimeOff.findFirst({
        where: {
          professionalId,
          startDateTime: { lt: endTime },
          endDateTime: { gt: startTime },
        },
      });

      if (conflictingTimeOff) {
        throw new SlotUnavailableError();
      }

      // 3. Existe outro agendamento conflitando? (a checagem mais crítica)
      const conflictingAppointment = await tx.appointment.findFirst({
        where: {
          professionalId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (conflictingAppointment) {
        throw new SlotUnavailableError();
      }

      // 4. Livre de verdade — cria o agendamento
      return tx.appointment.create({
        data: {
          barbershopId,
          professionalId,
          serviceId,
          clientId,
          startTime,
          endTime,
          status: "PENDING",
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

/**
 * Wrapper que re-tenta a criação do agendamento algumas vezes caso a
 * transação seja abortada por conflito de serialização (código 40001 do
 * Postgres). Isso só acontece sob concorrência real — dois clientes
 * disputando o mesmo horário no mesmíssimo instante.
 */
export async function createAppointmentWithRetry(
  params: CreateAppointmentParams,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createAppointment(params);
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"; // Prisma mapeia o 40001 do Postgres pra esse código

      const isLastAttempt = attempt === maxRetries;

      if (!isSerializationFailure || isLastAttempt) {
        throw error;
      }
      // Tenta de novo — o horário pode ainda estar livre, só houve disputa
    }
  }

  throw new Error("Não foi possível concluir o agendamento. Tente novamente.");
}
