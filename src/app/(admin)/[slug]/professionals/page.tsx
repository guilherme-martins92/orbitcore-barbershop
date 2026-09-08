import { requireBarbershopOwnerPage } from "@/lib/require-owner";
import { prisma } from "@/lib/prisma";
import { ProfessionalsManager } from "@/components/admin/professionals-manager";
import { LogoutButton } from "@/components/admin/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function ProfessionalsAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { barbershop } = await requireBarbershopOwnerPage(slug);

  const [professionals, services] = await Promise.all([
    prisma.professional.findMany({
      where: { barbershopId: barbershop.id },
      orderBy: { name: "asc" },
      include: {
        schedules: { orderBy: { weekday: "asc" } },
        services: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.service.findMany({
      where: { barbershopId: barbershop.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="font-sans text-sm tracking-wide text-brass">
              Backoffice
            </p>
            <h1 className="mt-2 font-display text-4xl">
              {barbershop.name} — Profissionais
            </h1>
          </div>
          <LogoutButton />
        </header>

        <AdminNav barbershopSlug={barbershop.slug} />

        <ProfessionalsManager
          barbershopSlug={barbershop.slug}
          allServices={services.map((s) => ({ id: s.id, name: s.name }))}
          initialProfessionals={professionals.map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
            serviceIds: p.services.map((ps) => ps.serviceId),
            weekdays: p.schedules.map((s) => s.weekday),
            startTime: p.schedules[0]?.startTime ?? "09:00",
            endTime: p.schedules[0]?.endTime ?? "18:00",
          }))}
        />
      </div>
    </main>
  );
}
