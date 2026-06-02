// E2E manual: seed 2 escritórios, valida isolamento OFFICE, faz cleanup.
// Uso: node scripts/e2e-office.mjs http://localhost:3001
// Dados criados são removidos no `finally`.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_ACCESS = process.env.JWT_SECRET_ACCESS;
if (!JWT_ACCESS) {
  console.error('Defina JWT_SECRET_ACCESS no env antes de rodar.');
  process.exit(1);
}
function mintAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_ACCESS, { expiresIn: '15m' });
}

const BASE = process.argv[2] || 'http://localhost:3001';
const prisma = new PrismaClient();

const TAG = `e2e-${Date.now()}`;
const cleanup = { companyIds: [], userIds: [] };

const log = (...a) => console.log('[E2E]', ...a);
const fail = (msg) => { console.error('❌', msg); process.exitCode = 1; };
const pass = (msg) => console.log('✅', msg);

function genCpf(seed) {
  // CPF inválido por validador real, mas único e 11 dígitos numéricos
  return String(10000000000 + seed).padStart(11, '0');
}
function genCnpj(seed) {
  return String(10000000000000 + seed).padStart(14, '0');
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

async function loginRaw(email, password) {
  // login direto via prisma → emite JWT manualmente (evita rate limit + bypass de bcrypt em CPF inválido)
  // melhor: usar /api/auth/login real
  return api('POST', '/auth/login', { body: { email, password } });
}

async function main() {
  log('Seedando dados...');

  // Hash da senha de teste
  const pwHash = await bcrypt.hash('test1234', 10);

  const companyA = await prisma.company.create({
    data: { name: `${TAG}-CompanyA`, cnpj: genCnpj(1) },
  });
  cleanup.companyIds.push(companyA.id);
  const companyB = await prisma.company.create({
    data: { name: `${TAG}-CompanyB`, cnpj: genCnpj(2) },
  });
  cleanup.companyIds.push(companyB.id);
  log('Companies criadas:', companyA.id, companyB.id);

  const officeA = await prisma.user.create({
    data: {
      name: 'OfficeA', surname: 'Manager',
      email: `${TAG}-officeA@test.com`,
      cpf: genCpf(1), rg: '1234567',
      role: 'OFFICE', company_id: companyA.id,
      password_hash: pwHash,
    },
  });
  cleanup.userIds.push(officeA.id);
  const officeB = await prisma.user.create({
    data: {
      name: 'OfficeB', surname: 'Manager',
      email: `${TAG}-officeB@test.com`,
      cpf: genCpf(2), rg: '1234568',
      role: 'OFFICE', company_id: companyB.id,
      password_hash: pwHash,
    },
  });
  cleanup.userIds.push(officeB.id);

  const consultorA = await prisma.user.create({
    data: {
      name: 'ConsultorA', surname: 'Test',
      email: `${TAG}-consultorA@test.com`,
      cpf: genCpf(3), rg: '1234569',
      role: 'CONSULTANT', company_id: companyA.id,
      password_hash: pwHash,
    },
  });
  cleanup.userIds.push(consultorA.id);
  const consultorB = await prisma.user.create({
    data: {
      name: 'ConsultorB', surname: 'Test',
      email: `${TAG}-consultorB@test.com`,
      cpf: genCpf(4), rg: '1234560',
      role: 'CONSULTANT', company_id: companyB.id,
      password_hash: pwHash,
    },
  });
  cleanup.userIds.push(consultorB.id);

  const clienteB = await prisma.user.create({
    data: {
      name: 'ClienteB', surname: 'Test',
      email: `${TAG}-clienteB@test.com`,
      cpf: genCpf(5), rg: '1234561',
      role: 'CUSTOMER', consultant_id: consultorB.id,
      password_hash: pwHash,
    },
  });
  cleanup.userIds.push(clienteB.id);
  log('Users criados.');

  // Outro consultor já desativado em A (testa is_active)
  const consultorAInactive = await prisma.user.create({
    data: {
      name: 'ConsultorAOff', surname: 'Inactive',
      email: `${TAG}-consultorAoff@test.com`,
      cpf: genCpf(6), rg: '1234562',
      role: 'CONSULTANT', company_id: companyA.id,
      password_hash: pwHash, is_active: false, deactivated_at: new Date(),
    },
  });
  cleanup.userIds.push(consultorAInactive.id);

  // ─── JWT direto p/ OFFICE A (evita rate limit em /auth/login) ──────────
  const tokenA = mintAccessToken(officeA);
  pass('JWT OFFICE A emitido (bypass rate limit)');

  // ─── L2: dashboard OFFICE A ─────────────────────────────────────────────
  const dash = await api('GET', '/office/dashboard', { token: tokenA });
  if (dash.status === 200 && dash.body.companyId === companyA.id) {
    pass(`Dashboard scope: companyId=${dash.body.companyId}, activeConsultants=${dash.body.activeConsultants}`);
  } else {
    fail(`Dashboard falhou: ${dash.status} ${JSON.stringify(dash.body)}`);
  }

  // ─── Lista consultores OFFICE A → só vê A ───────────────────────────────
  const listA = await api('GET', '/office/consultants', { token: tokenA });
  if (listA.status === 200 && Array.isArray(listA.body)) {
    const ids = listA.body.map((c) => c.id);
    if (ids.includes(consultorA.id) && ids.includes(consultorAInactive.id) && !ids.includes(consultorB.id)) {
      pass(`listConsultants escopo correto (A=${ids.length} items, B oculto)`);
    } else {
      fail(`listConsultants vazou ou escondeu errado: ${JSON.stringify(ids)}`);
    }
  } else {
    fail(`listConsultants falhou: ${listA.status} ${JSON.stringify(listA.body)}`);
  }

  // ─── S2 IDOR: PATCH consultor B → 404 ───────────────────────────────────
  const updB = await api('PATCH', `/office/consultants/${consultorB.id}`, {
    token: tokenA,
    body: { name: 'Hacked' },
  });
  if (updB.status === 404) {
    pass('IDOR S2: PATCH consultor B → 404 (esperado, evita oracle)');
  } else {
    fail(`IDOR S2 vazou: status=${updB.status} body=${JSON.stringify(updB.body)}`);
  }

  // ─── S3 IDOR: DELETE consultor B → 404 ─────────────────────────────────
  const delB = await api('DELETE', `/office/consultants/${consultorB.id}`, { token: tokenA });
  if (delB.status === 404) {
    pass('IDOR S3: DELETE consultor B → 404');
  } else {
    fail(`IDOR S3 vazou: status=${delB.status}`);
  }

  // ─── S11: PATCH consultor A tentando promover role=ADMIN (DTO whitelist) ─
  const promote = await api('PATCH', `/office/consultants/${consultorA.id}`, {
    token: tokenA,
    body: { name: 'OK', role: 'ADMIN', company_id: companyB.id },
  });
  if (promote.status === 400) {
    pass(`S11: campos extras rejeitados pelo whitelist (status=400)`);
  } else if (promote.status === 200) {
    // Whitelist removeu campos extras silenciosamente — verifica no DB
    const after = await prisma.user.findUnique({ where: { id: consultorA.id } });
    if (after?.role === 'CONSULTANT' && after?.company_id === companyA.id) {
      pass('S11: campos extras descartados, role/company_id preservados no DB');
    } else {
      fail(`S11 vazou: consultor A virou ${after?.role}/${after?.company_id}`);
    }
  } else {
    fail(`S11 status inesperado: ${promote.status} ${JSON.stringify(promote.body)}`);
  }

  // ─── S7: GET clients?consultantId=<de B> → escopo bloqueia, devolve vazio ─
  const clientsScoped = await api('GET', `/office/clients?consultantId=${consultorB.id}`, { token: tokenA });
  if (clientsScoped.status === 200 && Array.isArray(clientsScoped.body) && clientsScoped.body.length === 0) {
    pass('S7: clients?consultantId=<B> → [] (escopo bloqueou)');
  } else {
    fail(`S7 vazou: ${JSON.stringify(clientsScoped.body)}`);
  }

  // ─── L5: clients sem filtro → não vê ClienteB (de Company B) ───────────
  const clientsAll = await api('GET', '/office/clients', { token: tokenA });
  if (clientsAll.status === 200 && Array.isArray(clientsAll.body)) {
    const has = clientsAll.body.some((c) => c.id === clienteB.id);
    if (!has) pass('L5: OFFICE A não vê cliente da Company B');
    else fail(`L5 vazou: cliente B aparece para OFFICE A`);
  } else {
    fail(`L5 falhou: ${clientsAll.status}`);
  }

  // ─── GET /office/company → retorna apenas Company A ────────────────────
  const company = await api('GET', '/office/company', { token: tokenA });
  if (company.status === 200 && company.body.id === companyA.id) {
    pass(`GET /office/company: id=${company.body.id} (correto)`);
  } else {
    fail(`GET /office/company falhou: ${JSON.stringify(company.body)}`);
  }

  // ─── S5a IDOR: PATCH company com id no body → 400 (whitelist estrito) ───
  const patchInjection = await api('PATCH', '/office/company', {
    token: tokenA,
    body: { name: 'Try', id: companyB.id },
  });
  if (patchInjection.status === 400 && JSON.stringify(patchInjection.body).includes('id')) {
    pass('S5a: PATCH company com id no body → 400 (whitelist rejeita)');
  } else {
    fail(`S5a inesperado: ${patchInjection.status} ${JSON.stringify(patchInjection.body)}`);
  }

  // ─── S5b: PATCH legítimo só atualiza Company A ─────────────────────────
  const patchCo = await api('PATCH', '/office/company', {
    token: tokenA,
    body: { name: `${TAG}-A-renamed` },
  });
  if (patchCo.status === 200) {
    const cA = await prisma.company.findUnique({ where: { id: companyA.id } });
    const cB = await prisma.company.findUnique({ where: { id: companyB.id } });
    if (cA.name === `${TAG}-A-renamed` && cB.name === `${TAG}-CompanyB`) {
      pass('S5b: PATCH legítimo atualizou só Company A (B intacta)');
    } else {
      fail(`S5b vazou: A=${cA.name} B=${cB.name}`);
    }
  } else {
    fail(`S5b patch legítimo falhou: ${patchCo.status} ${JSON.stringify(patchCo.body)}`);
  }

  // ─── I1/I2: convite p/ e-mail já existente (consultorB) → 409 ───────────
  const inviteDup = await api('POST', '/office/consultants/invite', {
    token: tokenA,
    body: { email: consultorB.email },
  });
  if (inviteDup.status === 409) {
    pass('I2: convite de e-mail já existente → 409');
  } else {
    fail(`I2 inesperado: ${inviteDup.status} ${JSON.stringify(inviteDup.body)}`);
  }

  // ─── D2: desativa consultor A, depois mesmo com JWT válido → 401 (AuthGuard) ─
  const deact = await api('DELETE', `/office/consultants/${consultorA.id}`, { token: tokenA });
  if (deact.status === 200) {
    pass('D-X: desativação OK');
    // Emite JWT direto p/ consultorA (sem rate limit) e tenta acessar
    const tokDeact = mintAccessToken(consultorA);
    const meDeact = await api('GET', '/auth/me', { token: tokDeact });
    if (meDeact.status === 401) {
      pass('D2: AuthGuard bloqueia is_active=false mesmo com token válido (401)');
    } else {
      fail(`D2 vazou: GET /auth/me com user desativado → ${meDeact.status}`);
    }
  } else {
    fail(`Desativação falhou: ${deact.status} ${JSON.stringify(deact.body)}`);
  }

  // ─── S9: CONSULTANT não acessa /office (JWT direto, sem rate limit) ────
  const tokB = mintAccessToken(consultorB);
  const denied = await api('GET', '/office/dashboard', { token: tokB });
  if (denied.status === 403 || denied.status === 401) {
    pass(`S9: CONSULTANT → ${denied.status} em /office/dashboard`);
  } else {
    fail(`S9 vazou: CONSULTANT obteve ${denied.status}`);
  }
}

async function cleanupAll() {
  log('Cleanup...');
  for (const uid of cleanup.userIds.reverse()) {
    try { await prisma.refreshToken.deleteMany({ where: { user_id: uid } }); } catch {}
    try { await prisma.user.update({ where: { id: uid }, data: { consultant_id: null } }); } catch {}
  }
  for (const uid of cleanup.userIds) {
    try { await prisma.user.delete({ where: { id: uid } }); } catch (e) {
      log('warn delete user', uid, e?.message);
    }
  }
  for (const cid of cleanup.companyIds) {
    try { await prisma.company.delete({ where: { id: cid } }); } catch (e) {
      log('warn delete company', cid, e?.message);
    }
  }
  log('Cleanup done.');
}

try {
  await main();
} catch (e) {
  fail(`Exceção: ${e?.message}`);
  console.error(e);
} finally {
  await cleanupAll();
  await prisma.$disconnect();
}
