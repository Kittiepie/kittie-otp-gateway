/**
 * Seeds the admin account (from ADMIN_EMAIL / ADMIN_PASSWORD) and, when the database has
 * no clients yet, a demo client with one API key. Safe to run many times.
 */
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { generateApiKey } from '../src/common/api-key';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: ['.env', '../../.env'], quiet: true });

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    const email = ADMIN_EMAIL.trim().toLowerCase();
    const passwordHash = await hash(ADMIN_PASSWORD);
    await prisma.admin.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    });
    console.log(`Admin ready: ${email}`);

    if ((await prisma.client.count()) === 0) {
      const key = generateApiKey();
      await prisma.client.create({
        data: {
          name: 'Demo client',
          apiKeys: { create: { prefix: key.prefix, keyHash: key.keyHash } },
        },
      });
      console.log(`Demo client created. API key (shown only once): ${key.fullKey}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
