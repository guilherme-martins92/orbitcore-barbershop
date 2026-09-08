import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardRedirectPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const barbershop = await prisma.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    redirect("/login");
  }

  redirect(`/${barbershop.slug}/services`);
}
