import { PrismaClient } from '@prisma/client';
import { generateUniqueSlug } from '../src/features/companies/slug.util';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });
  for (const c of companies) {
    const slug = await generateUniqueSlug(
      c.name,
      async (s) =>
        (await prisma.company.findUnique({ where: { slug: s } })) !== null,
    );
    await prisma.company.update({ where: { id: c.id }, data: { slug } });
    console.log(`${c.name} → ${slug}`);
  }
  console.log(`Backfill concluído: ${companies.length} escritórios.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
