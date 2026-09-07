"use client";

import { useState } from "react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
};

function centsToInputValue(cents: number) {
  return (cents / 100).toFixed(2);
}

function inputValueToCents(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatPriceDisplay(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ServicesManager({
  barbershopSlug,
  initialServices,
}: {
  barbershopSlug: string;
  initialServices: Service[];
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`/api/barbershops/${barbershopSlug}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          durationMinutes: parseInt(newDuration, 10),
          priceCents: inputValueToCents(newPrice || "0"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o serviço.");
        return;
      }
      setServices((prev) =>
        [...prev, data.service].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setNewDuration("30");
      setNewPrice("");
    } catch {
      setError("Falha de conexão ao criar o serviço.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(service: Service, changes: Partial<Service>) {
    setError(null);
    try {
      const res = await fetch(
        `/api/barbershops/${barbershopSlug}/services/${service.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível atualizar o serviço.");
        return;
      }
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? data.service : s)),
      );
      setEditingId(null);
    } catch {
      setError("Falha de conexão ao atualizar o serviço.");
    }
  }

  async function handleToggleActive(service: Service) {
    await handleUpdate(service, { active: !service.active });
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-sans text-sm tracking-wide text-brass">
          Novo serviço
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-4 border border-brass/20 p-4">
          <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
            Nome
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Corte de cabelo"
              className="border border-brass/30 bg-transparent px-3 py-2 text-paper placeholder:text-paper/40"
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
            Duração (min)
            <input
              type="number"
              min={5}
              step={5}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="w-28 border border-brass/30 bg-transparent px-3 py-2 text-paper"
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm text-paper/70">
            Preço (R$)
            <input
              type="text"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="40,00"
              className="w-28 border border-brass/30 bg-transparent px-3 py-2 text-paper placeholder:text-paper/40"
            />
          </label>
          <button
            onClick={handleCreate}
            disabled={creating || !newName || !newPrice}
            className="border border-brass bg-brass px-5 py-2 font-sans text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {creating ? "Criando..." : "Adicionar"}
          </button>
        </div>
      </section>

      {error && <p className="font-sans text-sm text-rust">{error}</p>}

      <section>
        <h2 className="font-sans text-sm tracking-wide text-brass">
          Serviços cadastrados
        </h2>
        <div className="mt-4 divide-y divide-brass/20 border-y border-brass/20">
          {services.length === 0 && (
            <p className="py-6 font-sans text-sm text-paper/50">
              Nenhum serviço cadastrado ainda.
            </p>
          )}
          {services.map((service) =>
            editingId === service.id ? (
              <EditRow
                key={service.id}
                service={service}
                onCancel={() => setEditingId(null)}
                onSave={(changes) => handleUpdate(service, changes)}
              />
            ) : (
              <div
                key={service.id}
                className={`flex items-center justify-between px-2 py-4 font-sans ${
                  service.active ? "" : "opacity-40"
                }`}
              >
                <div>
                  <span className="block text-paper">
                    {service.name}
                    {!service.active && (
                      <span className="ml-2 text-xs text-rust">(inativo)</span>
                    )}
                  </span>
                  <span className="block text-xs text-paper/50">
                    {service.durationMinutes} min ·{" "}
                    {formatPriceDisplay(service.priceCents)}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <button
                    onClick={() => setEditingId(service.id)}
                    className="text-brass hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(service)}
                    className="text-paper/60 hover:underline"
                  >
                    {service.active ? "Desativar" : "Reativar"}
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
  service,
  onCancel,
  onSave,
}: {
  service: Service;
  onCancel: () => void;
  onSave: (changes: Partial<Service>) => void;
}) {
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [price, setPrice] = useState(centsToInputValue(service.priceCents));

  return (
    <div className="flex flex-wrap items-end gap-4 px-2 py-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper"
      />
      <input
        type="number"
        min={5}
        step={5}
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className="w-24 border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper"
      />
      <input
        type="text"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-24 border border-brass/30 bg-transparent px-3 py-2 font-sans text-paper"
      />
      <button
        onClick={() =>
          onSave({
            name,
            durationMinutes: parseInt(duration, 10),
            priceCents: inputValueToCents(price),
          })
        }
        className="border border-brass bg-brass px-4 py-2 font-sans text-sm text-ink hover:opacity-90"
      >
        Salvar
      </button>
      <button
        onClick={onCancel}
        className="font-sans text-sm text-paper/60 hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}
