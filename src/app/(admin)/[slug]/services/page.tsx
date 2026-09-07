import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServicesManager } from "@/components/admin/services-manager";

export default async function ServicesAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const barbershop = await prisma.barbershop.findUnique({ where: { slug } });
  if (!barbershop) {
    notFound();
  }

  const services = await prisma.service.findMany({
    where: { barbershopId: barbershop.id },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-10 border-b border-brass/30 pb-8">
          <p className="font-sans text-sm tracking-wide text-brass">
            Backoffice
          </p>
          <h1 className="mt-2 font-display text-4xl">
            {barbershop.name} — Serviços
          </h1>
        </header>

        <ServicesManager
          barbershopSlug={barbershop.slug}
          initialServices={services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
            active: s.active,
          }))}
        />
      </div>
    </main>
  );
}
