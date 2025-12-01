import { IsEmail, IsNotEmpty, IsOptional, IsUrl, IsUUID } from "class-validator";

export class CreateContractDto {
    @IsUUID()
    @IsNotEmpty()
    process_id: string;

    @IsOptional()
    description: string;

    @IsNotEmpty()
    @IsEmail()
    client_email: string;
}