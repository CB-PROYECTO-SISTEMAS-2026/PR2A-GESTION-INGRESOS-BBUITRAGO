import 'dotenv/config'
import { PrismaClient, Role } from '@prisma/client'

const PRODUCTORAS = [
  'Sich Producciones',
  'Beyond Eventos',
  'Showtime Bolivia',
  'CDM Producciones',
  'Descontrol Bolivia',
  'ONE Entertainment',
]

const prisma = new PrismaClient()

async function main() {
  const orgs = await prisma.usuario.findMany({
    where: { activo: true, roles: { some: { role: Role.ORGANIZADOR } } },
    orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      nombreProductora: true,
      createdAt: true,
    },
  })

  console.log(`Organizadores activos: ${orgs.length}`)
  if (orgs.length !== PRODUCTORAS.length) {
    throw new Error(
      `Se esperaban ${PRODUCTORAS.length} organizadores, hay ${orgs.length}. Aborto sin cambios.`,
    )
  }

  for (let i = 0; i < orgs.length; i += 1) {
    const org = orgs[i]
    const nombreProductora = PRODUCTORAS[i]
    await prisma.usuario.update({
      where: { id: org.id },
      data: { nombreProductora },
    })
    console.log(
      `${i + 1}. ${org.email} (${[org.nombre, org.apellido].filter(Boolean).join(' ')}) → ${nombreProductora}`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e.message || e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
