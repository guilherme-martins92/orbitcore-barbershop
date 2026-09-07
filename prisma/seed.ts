import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const owner = await prisma.user.create({
    data: {
      email: "dono@barbearia.com",
      name: "Dono Teste",
      role: "OWNER",
    },
  });

  const barbershop = await prisma.barbershop.create({
    data: {
      name: "Barbearia do Zé",
      slug: "barbearia-do-ze",
      ownerId: owner.id,
    },
  });

  console.log("Seed criado:", { owner, barbershop });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
