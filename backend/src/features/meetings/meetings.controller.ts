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
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
@UseGuards(AuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('process/:processId')
  async getMeetingByProcess(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const meeting = await this.meetingsService.getMeetingByProcess(
      processId,
      userId,
    );

    return {
      sucess: true,
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
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const meeting = await this.meetingsService.startMeetingForProcess(
      processId,
      userId,
      body?.isAdvanced,
    );

    return {
      sucess: true,
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
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const result = await this.meetingsService.endMeetingForProcess(
      processId,
      userId,
    );

    return {
      sucess: true,
      message: result.message,
      data: result,
    };
  }

  @Post('process/:processId/conversation-done')
  async markConversationDone(
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Req() req: any,
  ): Promise<ApiResponseDto<any>> {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Usuário autenticado não identificado');
    }

    const result = await this.meetingsService.markConversationDone(
      processId,
      userId,
    );

    return {
      sucess: true,
      message: 'Conversa concluída e fluxo atualizado com sucesso',
      data: result,
    };
  }
}
