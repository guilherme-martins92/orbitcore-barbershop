import { describe, it, expect } from "vitest";
import { getAvailableSlots } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import {
  createTestBarbershop,
  createTestProfessional,
  createTestService,
  createTestClient,
  getNextWeekday,
} from "@/tests/factories";

describe("getAvailableSlots", () => {
  it("retorna vazio se o profissional não trabalha nesse dia da semana", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1], // só segunda
    });
    const service = await createTestService(barbershop.id);

    const sunday = getNextWeekday(0);

    const slots = await getAvailableSlots({
      professionalId: professional.id,
      serviceId: service.id,
      date: sunday,
    });

    expect(slots).toEqual([]);
  });

  it("retorna o expediente inteiro livre quando não há agendamentos", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
      startTime: "09:00",
      endTime: "18:00",
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 30,
    });

    const monday = getNextWeekday(1);

    const slots = await getAvailableSlots({
      professionalId: professional.id,
      serviceId: service.id,
      date: monday,
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].start.getHours()).toBe(9);
    expect(slots[0].end.getHours()).toBe(18);
  });

  it("desconta um agendamento existente, dividindo o expediente em dois intervalos", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
      startTime: "09:00",
      endTime: "18:00",
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 30,
    });
    const client = await createTestClient(barbershop.id);

    const monday = getNextWeekday(1);
    const existingStart = new Date(monday);
    existingStart.setHours(10, 0, 0, 0);
    const existingEnd = new Date(monday);
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

    const slots = await getAvailableSlots({
      professionalId: professional.id,
      serviceId: service.id,
      date: monday,
    });

    expect(slots).toHaveLength(2);
    expect(slots[0].end.getHours()).toBe(10);
    expect(slots[0].end.getMinutes()).toBe(0);
    expect(slots[1].start.getHours()).toBe(10);
    expect(slots[1].start.getMinutes()).toBe(30);
  });

  it("não retorna um intervalo menor que a duração do serviço", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
      startTime: "09:00",
      endTime: "10:00", // só 1h de expediente
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 90, // não cabe em 1h
    });

    const monday = getNextWeekday(1);

    const slots = await getAvailableSlots({
      professionalId: professional.id,
      serviceId: service.id,
      date: monday,
    });

    expect(slots).toEqual([]);
  });

  it("desconta uma folga (time off) do profissional", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
      startTime: "09:00",
      endTime: "18:00",
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 30,
    });

    const monday = getNextWeekday(1);
    const timeOffStart = new Date(monday);
    timeOffStart.setHours(12, 0, 0, 0);
    const timeOffEnd = new Date(monday);
    timeOffEnd.setHours(14, 0, 0, 0);

    await prisma.professionalTimeOff.create({
      data: {
        professionalId: professional.id,
        startDateTime: timeOffStart,
        endDateTime: timeOffEnd,
        reason: "Almoço estendido",
      },
    });

    const slots = await getAvailableSlots({
      professionalId: professional.id,
      serviceId: service.id,
      date: monday,
    });

    expect(slots).toHaveLength(2);
    expect(slots[0].end.getHours()).toBe(12);
    expect(slots[1].start.getHours()).toBe(14);
  });
});
