export type specialityValues = ['car', 'boat', 'aircraft' ];

export class RegisterDto {
    name: string;
    surname: string;
    email: string;
    cpf: string;
    password_hash: string;
    civil_state: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    speciality?: specialityValues;
    identification_number?: string;
    consultant_id?: string;
}

export class LoginDto {
    email: string;
    password_hash: string;
}

export class ApiResponseDto<D, M, ED> {
    sucess: boolean;
    message?: string;
    data?: D;
    meta?: M;
    error?: {
        code: number;
        message: string;
        details?: ED[];
    };
}