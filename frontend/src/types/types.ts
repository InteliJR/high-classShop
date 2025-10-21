// Comuns
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface Product {
  id: number;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl: string;
}
