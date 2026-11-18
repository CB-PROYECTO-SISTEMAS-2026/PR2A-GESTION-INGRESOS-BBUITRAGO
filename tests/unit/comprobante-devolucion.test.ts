import { ConflictException } from '@nestjs/common';
import { IdentidadService } from '../../backend/src/modules/reembolsos/identidad.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { StorageService } from '../../backend/src/common/storage/storage.service';
import { CodigoClienteService } from '../../backend/src/modules/saldo/codigo-cliente.service';

test('un mismo comprobante se reutiliza, y una foto distinta no sustituye la original', async () => {
  let evidenciaUrl: string | null = null;
  const db = {
    staffEvento: { findFirst: jest.fn().mockResolvedValue({ id: 'asignado' }) },
    transaccionSaldo: {
      findFirst: jest.fn(() => Promise.resolve({ eventoId: 'evento', evidenciaUrl })),
      updateMany: jest.fn(({data}: {data: { evidenciaUrl: string }}) => {
        evidenciaUrl = data.evidenciaUrl;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const storage = { upload: jest.fn((_file, folder) => Promise.resolve({ url: 'https://cdn.example/' + folder + '/imagen.png' })) };
  const servicio = new IdentidadService(db as unknown as PrismaService, {} as CodigoClienteService, storage as unknown as StorageService);
  const foto = (s: string) => ({ buffer: Buffer.from(s) }) as Express.Multer.File;
  const primero = await servicio.comprobante('operador', 'id', foto('A'));
  expect(await servicio.comprobante('operador', 'id', foto('A'))).toEqual(primero);
  await expect(servicio.comprobante('operador', 'id', foto('B'))).rejects.toThrow(ConflictException);
  expect(storage.upload).toHaveBeenCalledTimes(1);
});
