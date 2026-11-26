import { Injectable } from '@nestjs/common';
import { MailService } from '../../common/mail/mail.service';
import { ContactoDto } from './dto/contacto.dto';

@Injectable()
export class ContactoService {
  constructor(private mail: MailService) {}

  async enviar(dto: ContactoDto) {
    await this.mail.sendContactoPromotora(dto.email, dto.mensaje);
    return {
      ok: true,
      message: 'Mensaje enviado. Te responderemos al correo que indicaste.',
    };
  }
}
