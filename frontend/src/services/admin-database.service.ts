import api from "./api";

export type EntityInfo = { key: string; label: string };

/** Célula já formatada pelo backend. Texto, salvo a exceção da imagem (logo). */
export type Cell =
  | string
  | { kind: "image"; url: string | null; alt: string };

export type ColumnMeta = { label: string; wide?: boolean };

export type RecordsPage = {
  columns: ColumnMeta[];
  data: Cell[][];
  total: number;
  page: number;
  pageSize: number;
};

export async function getEntities(): Promise<EntityInfo[]> {
  const { data } = await api.get<EntityInfo[]>("admin/database/entities");
  return data;
}

export async function getRecords(
  entity: string,
  page: number,
  pageSize: number,
): Promise<RecordsPage> {
  const { data } = await api.get<RecordsPage>(`admin/database/${entity}`, {
    params: { page, pageSize },
  });
  return data;
}
