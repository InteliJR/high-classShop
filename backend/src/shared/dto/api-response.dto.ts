import { FiltersDto } from './filters.dto';
import { PaginationDto } from './pagination.dto';

export class ApiResponseDto<T, F = unknown, S = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    pagination: PaginationDto;
    filters?: FiltersDto<F>;
    summary?: S;
  };
}
