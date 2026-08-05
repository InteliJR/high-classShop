import type { OfficeClient } from "../services/office";

export interface ConsultantClientGroup {
  consultantId: string;
  consultantName: string;
  clients: OfficeClient[];
}

export interface GroupedClients {
  groups: ConsultantClientGroup[];
  withoutConsultant: OfficeClient[];
}

// Agrupa clientes de um escritório pelos consultores a que estão vinculados.
// Clientes com consultant_id nulo (cadastro via whitelabel do escritório,
// sem consultor) vão para `withoutConsultant`.
export function groupClientsByConsultant(clients: OfficeClient[]): GroupedClients {
  const byConsultant = new Map<string, ConsultantClientGroup>();
  const withoutConsultant: OfficeClient[] = [];

  for (const client of clients) {
    if (!client.consultant_id || !client.consultant) {
      withoutConsultant.push(client);
      continue;
    }
    const existing = byConsultant.get(client.consultant_id);
    if (existing) {
      existing.clients.push(client);
    } else {
      byConsultant.set(client.consultant_id, {
        consultantId: client.consultant_id,
        consultantName: `${client.consultant.name} ${client.consultant.surname}`,
        clients: [client],
      });
    }
  }

  const groups = Array.from(byConsultant.values()).sort((a, b) =>
    a.consultantName.localeCompare(b.consultantName, "pt-BR"),
  );

  return { groups, withoutConsultant };
}
