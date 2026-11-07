import { randomBytes } from 'node:crypto';
import { getPrisma } from '../index';
export function assertDevSeed(nodeEnv: string | undefined) {
  if (nodeEnv !== 'development' && nodeEnv !== 'test')
    throw new Error('Seed requires NODE_ENV=development or test');
}
assertDevSeed(process.env.NODE_ENV);
const prisma = getPrisma();
try {
  for (const name of ['traffic', 'data', 'ops']) {
    const id = `dev_${name}`;
    await prisma.user.upsert({
      where: { id },
      create: { id, name: `Dev ${name}`, email: `${name}@example.invalid` },
      update: {},
    });
    const token = randomBytes(32).toString('hex');
    await prisma.session.create({
      data: { userId: id, sessionToken: token, expires: new Date(Date.now() + 60 * 60 * 1000) },
    });
  }
  // Session tokens are credentials: query them locally in your DB, never print or commit them.
} finally {
  await prisma.$disconnect();
}
