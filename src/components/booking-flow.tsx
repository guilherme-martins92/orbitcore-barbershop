"use client";

import { useMemo, useState } from "react";

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type Professional = {
  id: string;
  name: string;
  serviceIds: string[];
};

type Slot = { start: string; end: string };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Gera horários sugeridos dentro de um intervalo livre, de 15 em 15 min.
 * Isso é só uma conveniência de UI — o backend continua aceitando
 * qualquer horário exato dentro do intervalo, não só esses múltiplos.
 */
function generateSuggestedTimes(
  slot: Slot,
  durationMinutes: number,
  stepMinutes = 15,
) {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const durationMs = durationMinutes * 60_000;
  const stepMs = stepMinutes * 60_000;

  const times: Date[] = [];
  let cursor = new Date(start);
  while (cursor.getTime() + durationMs <= end.getTime()) {
    times.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return times;
}

export function BookingFlow({
  barbershopSlug,
  services,
  professionals,
}: {
  barbershopSlug: string;
  services: Service[];
  professionals: Professional[];
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => toDateInputValue(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ startTime: string } | null>(
    null,
  );

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  const eligibleProfessionals = useMemo(() => {
    if (!serviceId) return [];
    return professionals.filter((p) => p.serviceIds.includes(serviceId));
  }, [serviceId, professionals]);

  async function handleFetchSlots() {
    if (!serviceId || !professionalId || !date) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedTime(null);
    try {
      const query = new URLSearchParams({ professionalId, serviceId, date });
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/availability?${query}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível consultar os horários.");
        setSlots(null);
        return;
      }
      setSlots(data.slots);
    } catch {
      setError("Falha de conexão ao consultar horários.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleSubmit() {
    if (!serviceId || !professionalId || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/appointments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professionalId,
            serviceId,
            startTime: selectedTime.toISOString(),
            client: { name: clientName, phone: clientPhone },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível confirmar o agendamento.");
        // Horário foi ocupado por outra pessoa: força reconsulta
        if (res.status === 409) {
          setSlots(null);
          setSelectedTime(null);
        }
        return;
      }
      setConfirmed({ startTime: data.appointment.startTime });
    } catch {
      setError("Falha de conexão ao confirmar o agendamento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    const confirmedDate = new Date(confirmed.startTime);
    return (
      <div className="border border-brass/40 p-8">
        <p className="font-sans text-sm tracking-wide text-brass">Confirmado</p>
        <h2 className="mt-2 font-display text-3xl">Até breve.</h2>
        <p className="mt-4 font-sans text-paper/80">
          Seu horário está marcado para{" "}
          <span className="text-paper">
            {confirmedDate.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>{" "}
          às{" "}
          <span className="text-paper">
            {confirmedDate.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* I. Serviço */}
      <section>
        <StepLabel index="I" title="Escolha o serviço" />
        <div className="mt-4 divide-y divide-brass/20 border-y border-brass/20">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => {
                setServiceId(service.id);
                setProfessionalId(null);
                setSlots(null);
                setSelectedTime(null);
              }}
              className={`flex w-full items-center justify-between px-2 py-4 text-left font-sans transition-colors ${
                serviceId === service.id
                  ? "text-brass"
                  : "text-paper/80 hover:text-paper"
              }`}
            >
              <span>
                <span className="block">{service.name}</span>
                <span className="block text-xs text-paper/50">
                  {service.durationMinutes} min
                </span>
              </span>
              <span>{formatPrice(service.priceCents)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* II. Profissional */}
      {serviceId && (
        <section>
          <StepLabel index="II" title="Escolha o profissional" />
          <div className="mt-4 flex flex-wrap gap-3">
            {eligibleProfessionals.length === 0 && (
              <p className="font-sans text-sm text-paper/50">
                Nenhum profissional disponível para esse serviço.
              </p>
            )}
            {eligibleProfessionals.map((professional) => (
              <button
                key={professional.id}
                onClick={() => {
                  setProfessionalId(professional.id);
                  setSlots(null);
                  setSelectedTime(null);
                }}
                className={`border px-5 py-3 font-sans text-sm transition-colors ${
                  professionalId === professional.id
                    ? "border-brass bg-brass text-ink"
                    : "border-brass/30 text-paper/80 hover:border-brass/60"
                }`}
              >
                {professional.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* III. Data e horário */}
      {professionalId && (
        <section>
          <StepLabel index="III" title="Escolha o dia e o horário" />
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
              Data
              <input
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlots(null);
                  setSelectedTime(null);
                }}
                className="border border-brass/30 bg-transparent px-3 py-2 text-paper [color-scheme:dark]"
              />
            </label>
            <button
              onClick={handleFetchSlots}
              disabled={loadingSlots}
              className="border border-brass px-5 py-2 font-sans text-sm text-brass transition-colors hover:bg-brass hover:text-ink disabled:opacity-50"
            >
              {loadingSlots ? "Consultando..." : "Ver horários"}
            </button>
          </div>

          {slots && (
            <div className="mt-6">
              {slots.length === 0 ? (
                <p className="font-sans text-sm text-paper/50">
                  Sem horários livres nesse dia. Tente outra data.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.flatMap((slot) =>
                    generateSuggestedTimes(
                      slot,
                      selectedService?.durationMinutes ?? 30,
                    ).map((time) => {
                      const isSelected =
                        selectedTime?.getTime() === time.getTime();
                      return (
                        <button
                          key={time.toISOString()}
                          onClick={() => setSelectedTime(time)}
                          className={`border px-4 py-2 font-sans text-sm transition-colors ${
                            isSelected
                              ? "border-brass bg-brass text-ink"
                              : "border-brass/30 text-paper/80 hover:border-brass/60"
                          }`}
                        >
                          {time.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      );
                    }),
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* IV. Dados do cliente */}
      {selectedTime && (
        <section>
          <StepLabel index="IV" title="Seus dados" />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              placeholder="Nome completo"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="flex-1 border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper placeholder:text-paper/40"
            />
            <input
              type="tel"
              placeholder="Telefone (WhatsApp)"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="flex-1 border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper placeholder:text-paper/40"
            />
          </div>

          {error && <p className="mt-4 font-sans text-sm text-rust">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !clientName || !clientPhone}
            className="mt-6 w-full border border-brass bg-brass px-5 py-3 font-sans text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
          >
            {submitting ? "Confirmando..." : "Confirmar agendamento"}
          </button>
        </section>
      )}
    </div>
  );
}

function StepLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-lg text-brass">{index}.</span>
      <h2 className="font-sans text-base text-paper/90">{title}</h2>
    </div>
  );
}
