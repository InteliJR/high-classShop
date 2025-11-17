-- AlterTable
ALTER TABLE "Aircraft_image" ADD COLUMN     "aircraft_id" INTEGER;

-- AlterTable
ALTER TABLE "Boat_image" ADD COLUMN     "boat_id" INTEGER;

-- AlterTable
ALTER TABLE "Car_image" ADD COLUMN     "car_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Car_image" ADD CONSTRAINT "Car_image_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat_image" ADD CONSTRAINT "Boat_image_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "Boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft_image" ADD CONSTRAINT "Aircraft_image_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
