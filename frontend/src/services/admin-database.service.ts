import api from "./api";

export type EntityInfo = { key: string; label: string };

export type RecordsPage = {
  data: Record<string, unknown>[];
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
