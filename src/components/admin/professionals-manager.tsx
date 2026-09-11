"use client";

import { useState } from "react";

type ServiceOption = { id: string; name: string };

type Professional = {
  id: string;
  name: string;
  active: boolean;
  serviceIds: string[];
  weekdays: number[];
  startTime: string;
  endTime: string;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function isValidTimeRange(start: string, end: string) {
  return start < end;
}

function mapApiProfessional(p: {
  id: string;
  name: string;
  active: boolean;
  services: { serviceId: string }[];
  schedules: { weekday: number; startTime: string; endTime: string }[];
}): Professional {
  return {
    id: p.id,
    name: p.name,
    active: p.active,
    serviceIds: p.services.map((ps) => ps.serviceId),
    weekdays: p.schedules.map((s) => s.weekday),
    startTime: p.schedules[0]?.startTime ?? "09:00",
    endTime: p.schedules[0]?.endTime ?? "18:00",
  };
}

export function ProfessionalsManager({
  barbershopSlug,
  allServices,
  initialProfessionals,
}: {
  barbershopSlug: string;
  allServices: ServiceOption[];
  initialProfessionals: Professional[];
}) {
  const [professionals, setProfessionals] =
    useState<Professional[]>(initialProfessionals);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [newWeekdays, setNewWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("18:00");

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  async function handleCreate() {
    setError(null);
    if (!isValidTimeRange(newStart, newEnd)) {
      setError("O horário de início deve ser antes do horário de fim.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/professionals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            serviceIds: newServiceIds,
            weekdays: newWeekdays,
            startTime: newStart,
            endTime: newEnd,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o profissional.");
        return;
      }
      setProfessionals((prev) =>
        [...prev, mapApiProfessional(data.professional)].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewName("");
      setNewServiceIds([]);
      setNewWeekdays([1, 2, 3, 4, 5]);
      setNewStart("09:00");
      setNewEnd("18:00");
    } catch {
      setError("Falha de conexão ao criar o profissional.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(
    professional: Professional,
    changes: Partial<{
      name: string;
      active: boolean;
      serviceIds: string[];
      weekdays: number[];
      startTime: string;
      endTime: string;
    }>,
  ) {
    setError(null);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/professionals/${professional.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível atualizar o profissional.");
        return;
      }
      const updated = mapApiProfessional(data.professional);
      setProfessionals((prev) =>
        prev.map((item) => (item.id === professional.id ? updated : item)),
      );
      setEditingId(null);
    } catch {
      setError("Falha de conexão ao atualizar o profissional.");
    }
  }

  async function handleToggleActive(professional: Professional) {
    await handleUpdate(professional, { active: !professional.active });
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-sans text-sm tracking-wide text-brass">
          Novo profissional
        </h2>
        <div className="mt-4 flex flex-col gap-4 border border-brass/20 p-4">
          <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
            Nome
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: João Barbeiro"
              className="border border-brass/30 bg-transparent px-3 py-2 text-paper placeholder:text-paper/40"
            />
          </label>

          <div>
            <p className="font-sans text-sm text-paper/70">
              Serviços que realiza
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {allServices.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 font-sans text-sm text-paper/80"
                >
                  <input
                    type="checkbox"
                    checked={newServiceIds.includes(service.id)}
                    onChange={() =>
                      setNewServiceIds((prev) => toggle(prev, service.id))
                    }
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="font-sans text-sm text-paper/70">Dias de trabalho</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {WEEKDAY_LABELS.map((label, day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 font-sans text-sm text-paper/80"
                >
                  <input
                    type="checkbox"
                    checked={newWeekdays.includes(day)}
                    onChange={() => setNewWeekdays((prev) => toggle(prev, day))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-4">
            <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
              Início
              <input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="border border-brass/30 bg-transparent px-3 py-2 text-paper [color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
              Fim
              <input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="border border-brass/30 bg-transparent px-3 py-2 text-paper [color-scheme:dark]"
              />
            </label>
            <button
              onClick={handleCreate}
              disabled={creating || !newName}
              className="border border-brass bg-brass px-5 py-2 font-sans text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {creating ? "Criando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </section>

      {error && <p className="font-sans text-sm text-rust">{error}</p>}

      <section>
        <h2 className="font-sans text-sm tracking-wide text-brass">
          Profissionais cadastrados
        </h2>
        <div className="mt-4 divide-y divide-brass/20 border-y border-brass/20">
          {professionals.length === 0 && (
            <p className="py-6 font-sans text-sm text-paper/50">
              Nenhum profissional cadastrado ainda.
            </p>
          )}
          {professionals.map((professional) =>
            editingId === professional.id ? (
              <EditRow
                key={professional.id}
                professional={professional}
                allServices={allServices}
                onCancel={() => setEditingId(null)}
                onSave={(changes) => handleUpdate(professional, changes)}
              />
            ) : (
              <div
                key={professional.id}
                className={`flex items-center justify-between px-2 py-4 font-sans ${
                  professional.active ? "" : "opacity-40"
                }`}
              >
                <div>
                  <span className="block text-paper">
                    {professional.name}
                    {!professional.active && (
                      <span className="ml-2 text-xs text-rust">(inativo)</span>
                    )}
                  </span>
                  <span className="block text-xs text-paper/50">
                    {professional.weekdays
                      .map((d) => WEEKDAY_LABELS[d])
                      .join(", ") || "sem dias definidos"}{" "}
                    · {professional.startTime}–{professional.endTime} ·{" "}
                    {professional.serviceIds.length} serviço(s)
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <button
                    onClick={() => setEditingId(professional.id)}
                    className="text-brass hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(professional)}
                    className="text-paper/60 hover:underline"
                  >
                    {professional.active ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function EditRow({
  professional,
  allServices,
  onCancel,
  onSave,
}: {
  professional: Professional;
  allServices: ServiceOption[];
  onCancel: () => void;
  onSave: (changes: {
    name: string;
    serviceIds: string[];
    weekdays: number[];
    startTime: string;
    endTime: string;
  }) => void;
}) {
  const [name, setName] = useState(professional.name);
  const [serviceIds, setServiceIds] = useState<string[]>(
    professional.serviceIds,
  );
  const [weekdays, setWeekdays] = useState<number[]>(professional.weekdays);
  const [startTime, setStartTime] = useState(professional.startTime);
  const [endTime, setEndTime] = useState(professional.endTime);
  const [saving, setSaving] = useState(false);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  return (
    <div className="flex flex-col gap-4 px-2 py-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper"
      />

      <div className="flex flex-wrap gap-3">
        {allServices.map((service) => (
          <label
            key={service.id}
            className="flex items-center gap-2 font-sans text-sm text-paper/80"
          >
            <input
              type="checkbox"
              checked={serviceIds.includes(service.id)}
              onChange={() => setServiceIds((prev) => toggle(prev, service.id))}
            />
            {service.name}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {WEEKDAY_LABELS.map((label, day) => (
          <label
            key={day}
            className="flex items-center gap-2 font-sans text-sm text-paper/80"
          >
            <input
              type="checkbox"
              checked={weekdays.includes(day)}
              onChange={() => setWeekdays((prev) => toggle(prev, day))}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex items-end gap-4">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper [color-scheme:dark]"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper [color-scheme:dark]"
        />
        <button
          onClick={async () => {
            setSaving(true);
            await onSave({ name, serviceIds, weekdays, startTime, endTime });
            setSaving(false);
          }}
          disabled={saving}
          className="border border-brass bg-brass px-4 py-2 font-sans text-sm text-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={onCancel}
          className="font-sans text-sm text-paper/60 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
