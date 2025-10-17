import { IsOptional, IsPositive, Min } from "class-validator";

export class PaginationQueryDto {
    @IsOptional()
    @Min(0)
    take?: number;
    
    @IsOptional()   
    @IsPositive()
    skip?: number;
}