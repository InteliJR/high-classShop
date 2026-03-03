import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Logger,
} from '@nestjs/common';
import { SettingsService, SettingResponse } from './settings.service';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UpdateSettingDto } from './dto/update-setting.dto';

/**
 * SettingsController
 *
 * Controlador para gerenciamento de configurações do sistema
 * Apenas ADMIN pode modificar configurações
 *
 * Endpoints:
 * - GET /api/settings → Lista todas as configurações
 * - GET /api/settings/:key → Obtém configuração específica
 * - PATCH /api/settings/:key → Atualiza configuração (ADMIN only)
 */
@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /api/settings
   * Lista todas as configurações do sistema
   */
  @Get()
  @Roles('ADMIN')
  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: SettingResponse[];
  }> {
    this.logger.log(`[findAll] Listando todas as configurações`);
    const settings = await this.settingsService.findAll();
    this.logger.log(`[findAll] Total de configurações: ${settings.length}`);
    return {
      success: true,
      message: 'Configurações listadas com sucesso',
      data: settings,
    };
  }

  /**
   * GET /api/settings/:key
   * Obtém uma configuração específica
   */
  @Get(':key')
  @Roles('ADMIN')
  async findByKey(
    @Param('key') key: string,
  ): Promise<{ success: boolean; message: string; data: SettingResponse }> {
    this.logger.log(`[findByKey] Buscando configuração: ${key}`);
    const setting = await this.settingsService.findByKey(key);
    this.logger.log(`[findByKey] Configuração encontrada para key=${key}`);
    return {
      success: true,
      message: 'Configuração obtida com sucesso',
      data: setting,
    };
  }

  /**
   * PATCH /api/settings/:key
   * Atualiza uma configuração (apenas ADMIN)
   */
  @Patch(':key')
  @Roles('ADMIN')
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<{ success: boolean; message: string; data: SettingResponse }> {
    this.logger.log(`[update] Iniciando atualização de configuração ${key}`);
    this.logger.log(`[update] Novo valor: ${dto.value}`);
    const setting = await this.settingsService.update(key, dto.value);
    this.logger.log(`[update] Configuração ${key} atualizada com sucesso`);
    return {
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: setting,
    };
  }
}
