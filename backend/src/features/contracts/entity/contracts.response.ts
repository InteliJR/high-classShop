import { $Enums } from "@prisma/client";

export class ContractResponse {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    description: string | null;
    process_id: string;
    uploaded_by: {
        id: string;
        name: string;
        type: $Enums.UserRole;
    };
    created_at: Date;
}