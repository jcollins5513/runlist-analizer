import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await db.runList.delete({ where: { id } })
    return Response.json({ deleted: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
