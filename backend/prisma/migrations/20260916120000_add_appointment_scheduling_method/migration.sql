CREATE TYPE "AppointmentSchedulingMethod" AS ENUM ('CALENDLY', 'EMAIL', 'PLATFORM');

ALTER TABLE "Appointment"
ADD COLUMN "scheduling_method" "AppointmentSchedulingMethod",
ADD COLUMN "specialist_rescheduled_at" TIMESTAMP(3),
ADD COLUMN "specialist_rescheduled_from" TIMESTAMP(3);
