import { prisma } from "@/lib/prisma";

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Converte uma string "HH:mm" num Date real, usando o dia base fornecido.
 */
function parseTimeToDate(baseDate: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Junta intervalos que se sobrepõem ou se tocam em um só.
 * Ex: [09:00-10:00] + [09:30-11:00] => [09:00-11:00]
 */
function mergeIntervals(intervals: TimeRange[]): TimeRange[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Subtrai uma lista de intervalos "ocupados" de um intervalo "base",
 * retornando os pedaços livres que sobraram.
 */
function subtractIntervals(base: TimeRange, busy: TimeRange[]): TimeRange[] {
  let free: TimeRange[] = [base];

  for (const b of busy) {
    const next: TimeRange[] = [];

    for (const f of free) {
      const noOverlap = b.end <= f.start || b.start >= f.end;
      if (noOverlap) {
        next.push(f);
        continue;
      }

      // Sobrou pedaço antes do bloco ocupado
      if (b.start > f.start) {
        next.push({ start: f.start, end: b.start });
      }
      // Sobrou pedaço depois do bloco ocupado
      if (b.end < f.end) {
        next.push({ start: b.end, end: f.end });
      }
    }

    free = next;
  }

  return free;
}

/**
 * Calcula os intervalos de horário livres de um profissional em um dia
 * específico, considerando a duração do serviço escolhido.
 *
 * @param professionalId ID do profissional
 * @param date Qualquer horário do dia desejado (só a parte da data é usada)
 * @param serviceId ID do serviço (define a duração mínima do slot)
 */
export async function getAvailableSlots(params: {
  professionalId: string;
  date: Date;
  serviceId: string;
}): Promise<TimeRange[]> {
  const { professionalId, date, serviceId } = params;

  const service = await prisma.service.findUniqueOrThrow({
    where: { id: serviceId },
  });

  const weekday = date.getDay(); // 0 = domingo ... 6 = sábado

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [schedules, timeOffs, appointments] = await Promise.all([
    prisma.professionalSchedule.findMany({
      where: { professionalId, weekday },
    }),
    prisma.professionalTimeOff.findMany({
      where: {
        professionalId,
        startDateTime: { lt: dayEnd },
        endDateTime: { gt: dayStart },
      },
    }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    }),
  ]);

  // Profissional não trabalha nesse dia da semana
  if (schedules.length === 0) return [];

  const busy: TimeRange[] = [
    ...timeOffs.map((t) => ({ start: t.startDateTime, end: t.endDateTime })),
    ...appointments.map((a) => ({ start: a.startTime, end: a.endTime })),
  ];
  const mergedBusy = mergeIntervals(busy);

  const durationMs = service.durationMinutes * 60 * 1000;
  const availableSlots: TimeRange[] = [];

  // Um profissional pode ter mais de um turno no mesmo dia (ex: manhã e tarde)
  for (const schedule of schedules) {
    const workStart = parseTimeToDate(date, schedule.startTime);
    const workEnd = parseTimeToDate(date, schedule.endTime);

    const freeGaps = subtractIntervals(
      { start: workStart, end: workEnd },
      mergedBusy,
    );

    for (const gap of freeGaps) {
      const gapDurationMs = gap.end.getTime() - gap.start.getTime();
      if (gapDurationMs >= durationMs) {
        availableSlots.push(gap);
      }
    }
  }

  return availableSlots;
}
