import { FiltersDto } from "./filters.dto";
import { PaginationDto } from "./pagination.dto";

export class ApiResponseDto<T, F = unknown, S = unknown> {
    sucess: boolean;
    message: String;
    data: T;
    meta?: {
        pagination: PaginationDto;
        filters?: FiltersDto<F>;
        summary?: S;
    };
}