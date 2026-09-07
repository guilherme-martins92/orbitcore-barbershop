import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingFlow } from "@/components/booking-flow";

export default async function BarbershopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const barbershop = await prisma.barbershop.findFirst({
    where: { slug, active: true },
    include: {
      services: { where: { active: true }, orderBy: { name: "asc" } },
      professionals: {
        where: { active: true },
        include: { services: { select: { serviceId: true } } },
      },
    },
  });

  if (!barbershop) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-14 border-b border-brass/30 pb-8">
          <p className="font-sans text-sm tracking-wide text-brass">
            Agendamento
          </p>
          <h1 className="mt-2 font-display text-5xl leading-tight">
            {barbershop.name}
          </h1>
          {barbershop.address && (
            <p className="mt-3 font-sans text-sm text-paper/60">
              {barbershop.address}
            </p>
          )}
        </header>

        <BookingFlow
          barbershopSlug={barbershop.slug}
          services={barbershop.services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
          }))}
          professionals={barbershop.professionals.map((p) => ({
            id: p.id,
            name: p.name,
            serviceIds: p.services.map((ps) => ps.serviceId),
          }))}
        />
      </div>
    </main>
  );
}
