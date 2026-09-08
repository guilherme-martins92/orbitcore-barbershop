import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = "dono@barbearia.com";
  const plainPassword = "senha123"; // troque por algo seu, é só pra teste local

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(
    `Senha definida para ${user.email}. Use "${plainPassword}" para logar.`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
