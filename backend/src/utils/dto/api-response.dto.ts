import { FiltersDto } from "./filters.dto";
import { PaginationDto } from "./pagination.dto";

export class ApiResponseDto<T, S> {
    sucess: boolean;
    message: String;
    data: T;
    meta?: {
        pagination: PaginationDto,
        filters: FiltersDto <S>
    };
}