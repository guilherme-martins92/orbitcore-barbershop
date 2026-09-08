"use client";

import { useState } from "react";

type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: Status;
  professionalName: string;
  serviceName: string;
  priceCents: number;
  clientName: string;
  clientPhone: string;
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const STATUS_COLOR: Record<Status, string> = {
  PENDING: "text-paper/60",
  CONFIRMED: "text-brass",
  COMPLETED: "text-forest",
  CANCELLED: "text-rust",
  NO_SHOW: "text-rust",
};

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function AgendaManager({
  barbershopSlug,
  initialDate,
  initialAppointments,
}: {
  barbershopSlug: string;
  initialDate: string;
  initialAppointments: Appointment[];
}) {
  const [date, setDate] = useState(initialDate);
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function fetchDay(targetDate: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/appointments?date=${targetDate}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível carregar a agenda.");
        return;
      }
      setAppointments(data.appointments);
    } catch {
      setError("Falha de conexão ao carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(appointmentId: string, status: Status) {
    setUpdatingId(appointmentId);
    setError(null);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/appointments/${appointmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível atualizar o agendamento.");
        return;
      }
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? { ...a, status: data.appointment.status }
            : a,
        ),
      );
    } catch {
      setError("Falha de conexão ao atualizar o agendamento.");
    } finally {
      setUpdatingId(null);
    }
  }

  const isFinal = (status: Status) =>
    status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              fetchDay(e.target.value);
            }}
            className="border border-brass/30 bg-transparent px-3 py-2 text-paper [color-scheme:dark]"
          />
        </label>
        <button
          onClick={() => {
            const today = toDateInputValue(new Date());
            setDate(today);
            fetchDay(today);
          }}
          className="border border-brass/30 px-4 py-2 font-sans text-sm text-paper/70 hover:border-brass/60"
        >
          Hoje
        </button>
        {loading && (
          <span className="font-sans text-sm text-paper/50">Carregando...</span>
        )}
      </div>

      {error && <p className="font-sans text-sm text-rust">{error}</p>}

      <div className="divide-y divide-brass/20 border-y border-brass/20">
        {appointments.length === 0 && (
          <p className="py-6 font-sans text-sm text-paper/50">
            Nenhum agendamento nesse dia.
          </p>
        )}
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex flex-wrap items-center justify-between gap-4 px-2 py-4"
          >
            <div>
              <span className="block font-sans text-paper">
                {formatTime(appointment.startTime)} · {appointment.clientName}
              </span>
              <span className="block font-sans text-xs text-paper/50">
                {appointment.serviceName} com {appointment.professionalName} ·{" "}
                {formatPrice(appointment.priceCents)} ·{" "}
                {appointment.clientPhone}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={`font-sans text-xs uppercase tracking-wide ${STATUS_COLOR[appointment.status]}`}
              >
                {STATUS_LABEL[appointment.status]}
              </span>

              {!isFinal(appointment.status) && (
                <div className="flex gap-3 text-sm">
                  <button
                    disabled={updatingId === appointment.id}
                    onClick={() =>
                      handleStatusChange(appointment.id, "COMPLETED")
                    }
                    className="text-forest hover:underline disabled:opacity-40"
                  >
                    Concluir
                  </button>
                  <button
                    disabled={updatingId === appointment.id}
                    onClick={() =>
                      handleStatusChange(appointment.id, "NO_SHOW")
                    }
                    className="text-rust hover:underline disabled:opacity-40"
                  >
                    Não veio
                  </button>
                  <button
                    disabled={updatingId === appointment.id}
                    onClick={() =>
                      handleStatusChange(appointment.id, "CANCELLED")
                    }
                    className="text-paper/60 hover:underline disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
