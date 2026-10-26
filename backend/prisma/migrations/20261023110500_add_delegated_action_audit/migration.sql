CREATE TABLE "DelegatedActionAudit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "actor_role" "UserRole" NOT NULL,
    "represented_specialist_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" VARCHAR(128) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedActionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DelegatedActionAudit_actor_id_created_at_idx"
    ON "DelegatedActionAudit"("actor_id", "created_at");
CREATE INDEX "DelegatedActionAudit_represented_specialist_id_created_at_idx"
    ON "DelegatedActionAudit"("represented_specialist_id", "created_at");
CREATE INDEX "DelegatedActionAudit_resource_type_resource_id_idx"
    ON "DelegatedActionAudit"("resource_type", "resource_id");
CREATE INDEX "DelegatedActionAudit_action_created_at_idx"
    ON "DelegatedActionAudit"("action", "created_at");
