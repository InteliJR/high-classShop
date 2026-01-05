export class ProcessWithHistory {
    id: string;
    status: string;
    notes: string | null;
    updated_at: Date;
    status_history: ProcessStatusHistory[];
}

export class ProcessStatusHistory {
    status: string;
    changed_at: Date;
}