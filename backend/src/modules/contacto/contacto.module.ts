import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { ContactoController } from './contacto.controller';
import { ContactoService } from './contacto.service';

@Module({
  imports: [MailModule],
  controllers: [ContactoController],
  providers: [ContactoService],
})
export class ContactoModule {}
