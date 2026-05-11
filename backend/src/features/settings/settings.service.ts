import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Configurações disponíveis no sistema
 */
export enum SettingKey {
  MINIMUM_PROPOSAL_ENABLED = 'minimum_proposal_enabled',
  MINIMUM_PROPOSAL_PERCENTAGE = 'minimum_proposal_percentage',
}

export interface SettingResponse {
  key: string;
  value: string;
  description: string | null;
}

/**
 * SettingsService
 *
 * Serviço responsável por gerenciar configurações do sistema
 * Permite ativar/desativar funcionalidades e configurar parâmetros
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtém todas as configurações
   */
  async findAll(): Promise<SettingResponse[]> {
    this.logger.debug('[findAll] Buscando todas as configurações');
    const settings = await this.prisma.settings.findMany({
      orderBy: { key: 'asc' },
    });
    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      description: s.description,
    }));
  }

  /**
   * Obtém uma configuração por chave
   */
  async findByKey(key: string): Promise<SettingResponse> {
    this.logger.debug(`[findByKey] Buscando configuração: ${key}`);
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Configuração não encontrada',
          details: { key },
        },
      });
    }

    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
    };
  }

  /**
   * Atualiza uma configuração
   */
  async update(key: string, value: string): Promise<SettingResponse> {
    this.logger.log(`[update] Atualizando configuração ${key} para ${value}`);

    const updated = await this.prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value, description: null },
    });

    return {
      key: updated.key,
      value: updated.value,
      description: updated.description,
    };
  }

  /**
   * Verifica se a validação de valor mínimo está ativada
   */
  async isMinimumProposalEnabled(): Promise<boolean> {
    try {
      const setting = await this.findByKey(SettingKey.MINIMUM_PROPOSAL_ENABLED);
      return setting.value === 'true';
    } catch {
      // Se não encontrar, assume que está ativado (comportamento padrão)
      return true;
    }
  }

  /**
   * Obtém a porcentagem mínima para propostas
   */
  async getMinimumProposalPercentage(): Promise<number> {
    try {
      const setting = await this.findByKey(
        SettingKey.MINIMUM_PROPOSAL_PERCENTAGE,
      );
      const percentage = parseFloat(setting.value);
      return isNaN(percentage) ? 0.8 : percentage;
    } catch {
      // Se não encontrar, retorna 80% (comportamento padrão)
      return 0.8;
    }
  }
}
