/**
 * Script para limpar todos os processos e dados relacionados
 *
 * ATENÇÃO: Este script remove PERMANENTEMENTE todos os dados de:
 * - Processos (Process)
 * - Contratos (Contract)
 * - Propostas de negociação (NegotiationProposal)
 * - Histórico de status (ProcessStatusHistory)
 * - Rejeições de processo (ProcessRejection)
 * - Agendamentos (Appointment)
 *
 * Os dados de usuários, produtos (Car, Boat, Aircraft) e imagens são PRESERVADOS.
 *
 * Uso:
 *   npx ts-node prisma/clear-processes.ts
 *   npx ts-node prisma/clear-processes.ts --dry-run  # Apenas mostra o que seria deletado
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(
    '╔═══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║           LIMPEZA DE PROCESSOS E DADOS RELACIONADOS           ║',
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════╝',
  );
  console.log();

  if (isDryRun) {
    console.log('🔍 MODO DRY-RUN: Apenas mostrando o que seria deletado...\n');
  } else {
    console.log('⚠️  MODO REAL: Os dados serão PERMANENTEMENTE DELETADOS!\n');
  }

  // Contar registros antes da limpeza
  const counts = {
    contracts: await prisma.contract.count(),
    negotiationProposals: await prisma.negotiationProposal.count(),
    processStatusHistory: await prisma.processStatusHistory.count(),
    processRejections: await prisma.processRejection.count(),
    processes: await prisma.process.count(),
    appointments: await prisma.appointment.count(),
  };

  console.log('📊 Registros encontrados:');
  console.log('─────────────────────────────────────────');
  console.log(`   Contratos:              ${counts.contracts}`);
  console.log(`   Propostas de negociação: ${counts.negotiationProposals}`);
  console.log(`   Histórico de status:    ${counts.processStatusHistory}`);
  console.log(`   Rejeições:              ${counts.processRejections}`);
  console.log(`   Processos:              ${counts.processes}`);
  console.log(`   Agendamentos:           ${counts.appointments}`);
  console.log('─────────────────────────────────────────');
  console.log(
    `   TOTAL:                  ${Object.values(counts).reduce((a, b) => a + b, 0)}`,
  );
  console.log();

  if (isDryRun) {
    console.log('✅ Dry-run concluído. Nenhum dado foi deletado.');
    console.log('   Para deletar de verdade, execute sem --dry-run');
    return;
  }

  // Confirmação adicional em produção
  if (process.env.NODE_ENV === 'production') {
    console.log('🚨 ATENÇÃO: Você está em ambiente de PRODUÇÃO!');
    console.log('   Este script não deve ser executado em produção.');
    console.log('   Se realmente precisa, defina a variável FORCE_CLEAR=true');

    if (process.env.FORCE_CLEAR !== 'true') {
      console.log('\n❌ Operação cancelada por segurança.');
      return;
    }
  }

  console.log('🗑️  Iniciando limpeza...\n');

  try {
    // Ordem de deleção respeitando foreign keys:
    // 1. Primeiro, limpar referências circulares (accepted_proposal_id em Process)
    console.log(
      '1/7 Removendo referências de proposta aceita dos processos...',
    );
    await prisma.process.updateMany({
      where: { accepted_proposal_id: { not: null } },
      data: { accepted_proposal_id: null },
    });
    console.log('   ✓ Referências de proposta aceita removidas');

    // 2. Limpar referência de contrato ativo (active_contract_id em Process)
    console.log('2/7 Removendo referências de contrato ativo dos processos...');
    await prisma.process.updateMany({
      where: { active_contract_id: { not: null } },
      data: { active_contract_id: null },
    });
    console.log('   ✓ Referências de contrato ativo removidas');

    // 3. Deletar contratos
    console.log('3/7 Deletando contratos...');
    const deletedContracts = await prisma.contract.deleteMany();
    console.log(`   ✓ ${deletedContracts.count} contratos deletados`);

    // 4. Deletar propostas de negociação
    console.log('4/7 Deletando propostas de negociação...');
    const deletedProposals = await prisma.negotiationProposal.deleteMany();
    console.log(`   ✓ ${deletedProposals.count} propostas deletadas`);

    // 5. Deletar histórico de status
    console.log('5/7 Deletando histórico de status...');
    const deletedHistory = await prisma.processStatusHistory.deleteMany();
    console.log(
      `   ✓ ${deletedHistory.count} registros de histórico deletados`,
    );

    // 6. Deletar rejeições
    console.log('6/7 Deletando rejeições de processo...');
    const deletedRejections = await prisma.processRejection.deleteMany();
    console.log(`   ✓ ${deletedRejections.count} rejeições deletadas`);

    // 7. Deletar processos (isso também deleta appointments via cascade)
    console.log('7/7 Deletando processos...');
    const deletedProcesses = await prisma.process.deleteMany();
    console.log(`   ✓ ${deletedProcesses.count} processos deletados`);

    // Deletar agendamentos órfãos (que não tinham processo associado)
    console.log('   Deletando agendamentos órfãos...');
    const deletedAppointments = await prisma.appointment.deleteMany();
    console.log(`   ✓ ${deletedAppointments.count} agendamentos deletados`);

    console.log(
      '\n╔═══════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║                    ✅ LIMPEZA CONCLUÍDA                        ║',
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════════╝',
    );
    console.log();
    console.log('📊 Resumo:');
    console.log('─────────────────────────────────────────');
    console.log(`   Contratos deletados:     ${deletedContracts.count}`);
    console.log(`   Propostas deletadas:     ${deletedProposals.count}`);
    console.log(`   Histórico deletado:      ${deletedHistory.count}`);
    console.log(`   Rejeições deletadas:     ${deletedRejections.count}`);
    console.log(`   Processos deletados:     ${deletedProcesses.count}`);
    console.log(`   Agendamentos deletados:  ${deletedAppointments.count}`);
    console.log('─────────────────────────────────────────');

    const total =
      deletedContracts.count +
      deletedProposals.count +
      deletedHistory.count +
      deletedRejections.count +
      deletedProcesses.count +
      deletedAppointments.count;
    console.log(`   TOTAL DELETADO:          ${total}`);
    console.log();
    console.log(
      'ℹ️  Dados preservados: Usuários, Carros, Barcos, Aeronaves, Imagens',
    );
  } catch (error) {
    console.error('\n❌ Erro durante a limpeza:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
