import { readFileSync } from 'fs';
import { resolve } from 'path';

const backendFile = (name: string) =>
  readFileSync(resolve(__dirname, '..', name), 'utf8');

describe('configuração de startup do backend', () => {
  it('inicia o Railway diretamente pelo artefato compilado', () => {
    const railway = backendFile('railway.toml');

    expect(railway).toMatch(/^startCommand = "node dist\/main\.js"$/m);
    expect(railway).not.toMatch(
      /^startCommand = .*prisma migrate deploy.*$/m,
    );
  });

  it('usa o mesmo startup direto como CMD da imagem', () => {
    const dockerfile = backendFile('Dockerfile');

    expect(dockerfile).toMatch(/^CMD \["node", "dist\/main\.js"\]$/m);
    expect(dockerfile).not.toMatch(/^CMD .*prisma migrate deploy.*$/m);
  });
});
