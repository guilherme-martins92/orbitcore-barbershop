import { beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Apaga todos os dados do banco de teste, respeitando a ordem das
 * foreign keys (de "filho" pra "pai").
 */
export async function resetDatabase() {
  await prisma.appointment.deleteMany();
  await prisma.professionalTimeOff.deleteMany();
  await prisma.professionalSchedule.deleteMany();
  await prisma.professionalService.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.businessHours.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.barbershop.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
