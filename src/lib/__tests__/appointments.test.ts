import { describe, it, expect } from "vitest";
import {
  createAppointment,
  SlotUnavailableError,
  OutsideWorkingHoursError,
} from "@/lib/appointments";
import {
  createTestBarbershop,
  createTestProfessional,
  createTestService,
  createTestClient,
  getNextWeekday,
} from "@/tests/factories";

describe("createAppointment", () => {
  it("cria um agendamento dentro do expediente", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 30,
    });
    const client = await createTestClient(barbershop.id);

    const monday = getNextWeekday(1);
    const startTime = new Date(monday);
    startTime.setHours(10, 0, 0, 0);

    const appointment = await createAppointment({
      barbershopId: barbershop.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: client.id,
      startTime,
    });

    expect(appointment.status).toBe("PENDING");
  });

  it("rejeita um horário fora do expediente", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
      startTime: "09:00",
      endTime: "18:00",
    });
    const service = await createTestService(barbershop.id);
    const client = await createTestClient(barbershop.id);

    const monday = getNextWeekday(1);
    const startTime = new Date(monday);
    startTime.setHours(20, 0, 0, 0); // fora do expediente

    await expect(
      createAppointment({
        barbershopId: barbershop.id,
        professionalId: professional.id,
        serviceId: service.id,
        clientId: client.id,
        startTime,
      }),
    ).rejects.toThrow(OutsideWorkingHoursError);
  });

  it("rejeita um horário já ocupado por outro agendamento", async () => {
    const { barbershop } = await createTestBarbershop();
    const professional = await createTestProfessional(barbershop.id, {
      weekdays: [1],
    });
    const service = await createTestService(barbershop.id, {
      durationMinutes: 30,
    });
    const clientA = await createTestClient(barbershop.id, "11911111111");
    const clientB = await createTestClient(barbershop.id, "11922222222");

    const monday = getNextWeekday(1);
    const startTime = new Date(monday);
    startTime.setHours(10, 0, 0, 0);

    await createAppointment({
      barbershopId: barbershop.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: clientA.id,
      startTime,
    });

    await expect(
      createAppointment({
        barbershopId: barbershop.id,
        professionalId: professional.id,
        serviceId: service.id,
        clientId: clientB.id,
        startTime,
      }),
    ).rejects.toThrow(SlotUnavailableError);
  });
});
