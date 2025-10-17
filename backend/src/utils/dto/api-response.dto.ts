import { MetaDto } from "./meta.dto";

export class ApiResponseDto<T> {
    sucess: boolean;
    message: String;
    data: T;
    meta?: MetaDto;
}