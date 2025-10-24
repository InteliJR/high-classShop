-- AlterTable
ALTER TABLE "aircraft_images" ADD COLUMN     "aircraft_id" INTEGER;

-- AlterTable
ALTER TABLE "boat_images" ADD COLUMN     "boat_id" INTEGER;

-- AlterTable
ALTER TABLE "car_images" ADD COLUMN     "car_id" INTEGER;

-- AddForeignKey
ALTER TABLE "car_images" ADD CONSTRAINT "car_images_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_images" ADD CONSTRAINT "boat_images_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "boats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aircraft_images" ADD CONSTRAINT "aircraft_images_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
