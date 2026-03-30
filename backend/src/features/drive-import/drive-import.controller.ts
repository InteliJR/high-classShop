import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ImportDriveImagesDto } from './dto/import-drive-images.dto';
import { DriveImportService } from './drive-import.service';

@Controller('drive-import')
export class DriveImportController {
  constructor(private readonly driveImportService: DriveImportService) {}

  @Post('images')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async importImagesFromPublicFolder(
    @Body() dto: ImportDriveImagesDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.driveImportService.importPublicFolderImages(dto, user);
  }
}
