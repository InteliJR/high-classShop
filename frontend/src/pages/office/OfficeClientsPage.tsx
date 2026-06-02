import { useEffect, useState } from "react";
import { officeService, type OfficeClient } from "../../services/office";

export default function OfficeClientsPage() {
  const [clients, setClients] = useState<OfficeClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    officeService
      .listClients({ q: q || undefined })
      .then(setClients)
      .catch((e) =>
        setError((e as { friendlyMessage?: string }).friendlyMessage || "Erro ao carregar clientes"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Clientes do escritório</h1>
      <p className="text-sm text-gray-500 mb-4">Visualização somente leitura.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Buscar por nome ou email..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {loading && <p className="text-gray-500">Carregando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && clients.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          Nenhum cliente ainda.
        </div>
      )}

      {clients.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Consultor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{c.name} {c.surname}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.consultant ? `${c.consultant.name} ${c.consultant.surname}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
