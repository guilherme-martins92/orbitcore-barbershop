import { requireBarbershopOwnerPage } from "@/lib/require-owner";
import { prisma } from "@/lib/prisma";
import { AgendaManager } from "@/components/admin/agenda-manager";
import { LogoutButton } from "@/components/admin/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AgendaAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { barbershop } = await requireBarbershopOwnerPage(slug);

  const date = todayDateString();
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);

  const appointments = await prisma.appointment.findMany({
    where: {
      barbershopId: barbershop.id,
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
    include: {
      professional: { select: { id: true, name: true } },
      service: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          priceCents: true,
        },
      },
      client: { select: { id: true, name: true, phone: true } },
    },
  });

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="font-sans text-sm tracking-wide text-brass">
              Backoffice
            </p>
            <h1 className="mt-2 font-display text-4xl">
              {barbershop.name} — Agenda
            </h1>
          </div>
          <LogoutButton />
        </header>

        <AdminNav barbershopSlug={barbershop.slug} />

        <AgendaManager
          barbershopSlug={barbershop.slug}
          initialDate={date}
          initialAppointments={appointments.map((a) => ({
            id: a.id,
            startTime: a.startTime.toISOString(),
            endTime: a.endTime.toISOString(),
            status: a.status,
            professionalName: a.professional.name,
            serviceName: a.service.name,
            priceCents: a.service.priceCents,
            clientName: a.client.name,
            clientPhone: a.client.phone,
          }))}
        />
      </div>
    </main>
  );
}
