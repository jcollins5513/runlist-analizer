import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { SOURCE_PRESETS } from '../src/lib/source-presets'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  for (const preset of SOURCE_PRESETS) {
    await prisma.auctionSource.upsert({
      where: { name: preset.name },
      update: {
        displayName: preset.displayName,
        columnMap: preset.columnMap,
      },
      create: {
        name: preset.name,
        displayName: preset.displayName,
        columnMap: preset.columnMap,
        isPreset: true,
      },
    })
    console.log(`Seeded: ${preset.displayName}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
