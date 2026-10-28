import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Query,
  Optional,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { MeetingsService } from './meetings.service';
import { UserRole } from '@prisma/client';
import {
  ActorContext,
  ActorContextService,
} from 'src/shared/actor-context/actor-context.service';

@Controller('meetings')
@UseGuards(AuthGuard)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    @Optional() private readonly actorContextService?: ActorContextService,
  ) {}

  private async resolveSpecialistContext(
    user: any,
    targetSpecialistId?: string,
  ): Promise<ActorContext | undefined> {
    if (
      !this.actorContextService ||
      (user?.role !== UserRole.ADMIN && user?.role !== UserRole.SPECIALIST)
    ) {
      return undefined;
    }
    return this.actorContextService.resolve(user, targetSpecialistId);
  }

  @Get('process/:processId')
  async getMeetingByProcess(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const context = await this.resolveSpecialistContext(
      req.user,
      targetSpecialistId,
    );
    const meeting = await this.meetingsService.getMeetingByProcess(
      processId,
      userId,
      context,
    );

    return {
      success: true,
      message: meeting
        ? 'Reunião encontrada com sucesso'
        : 'Reunião ainda não iniciada para este processo',
      data: meeting,
    };
  }

  @Post('process/:processId/start')
  async startMeeting(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
    @Body() body: { isAdvanced?: boolean },
    @Query('target_specialist_id') targetSpecialistId?: string,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const context = await this.resolveSpecialistContext(
      req.user,
      targetSpecialistId,
    );
    const meeting = await this.meetingsService.startMeetingForProcess(
      processId,
      userId,
      body?.isAdvanced,
      context,
    );

    return {
      success: true,
      message: body?.isAdvanced
        ? 'Reunião adiantada com sucesso'
        : 'Reunião iniciada com sucesso',
      data: meeting,
    };
  }

  @Post('process/:processId/end')
  async endMeeting(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const context = await this.resolveSpecialistContext(
      req.user,
      targetSpecialistId,
    );
    const result = await this.meetingsService.endMeetingForProcess(
      processId,
      userId,
      context,
    );

    return {
      success: true,
      message: result.message,
      data: result,
    };
  }

  @Post('process/:processId/conversation-done')
  async markConversationDone(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const context = await this.resolveSpecialistContext(
      req.user,
      targetSpecialistId,
    );
    const result = await this.meetingsService.markConversationDone(
      processId,
      userId,
      context,
    );

    return {
      success: true,
      message: 'Conversa concluída e fluxo atualizado com sucesso',
      data: result,
    };
  }
}
