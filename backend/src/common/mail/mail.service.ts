import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  ORGANIZADOR: 'Organizador de eventos',
  JEFE_NEGOCIO: 'Jefe de negocio',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0b1b33;padding:20px 28px;color:#ffffff;font-size:22px;font-weight:bold;">
            Even<span style="color:#00c9d4;">Tix</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
            ${body}
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
            EvenTix · Cochabamba, Bolivia
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#00c9d4;color:#0b1b33;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;">${label}</a>
  </p>
  <p style="font-size:12px;color:#64748b;">Si el botón no funciona, copia este enlace en tu navegador:<br>
    <span style="word-break:break-all;">${url}</span>
  </p>`;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.getOrThrow<string>('MAIL_HOST'),
      port: Number(config.getOrThrow<string>('MAIL_PORT')),
      secure: config.get<string>('MAIL_SECURE', 'true') === 'true',
      auth: {
        user: config.getOrThrow<string>('MAIL_USER'),
        pass: config.getOrThrow<string>('MAIL_PASS'),
      },
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL').replace(/\/+$/, '');
  }

  buildUrl(path: string, token: string) {
    return `${this.frontendUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  async sendPasswordReset(to: string, nombre: string, token: string, expiresInMinutes: number) {
    const url = this.buildUrl('/reset-password', token);
    const html = layout(
      'Restablece tu contraseña',
      `<p>Hola ${escapeHtml(nombre)},</p>
       <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta EvenTix.</p>
       ${button(url, 'Restablecer contraseña')}
       <p>El enlace vence en ${expiresInMinutes} minutos y solo puede usarse una vez.</p>
       <p>Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue siendo válida.</p>`,
    );
    const text = [
      `Hola ${nombre},`,
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta EvenTix.',
      `Abre este enlace para definir una nueva: ${url}`,
      `El enlace vence en ${expiresInMinutes} minutos y solo puede usarse una vez.`,
      'Si no solicitaste este cambio, ignora este correo.',
    ].join('\n\n');
    await this.send(to, 'Restablece tu contraseña de EvenTix', html, text);
  }

  async sendInvitation(to: string, nombre: string, role: string, token: string, expiresInHours: number) {
    const url = this.buildUrl('/activar-cuenta', token);
    const roleLabel = ROLE_LABELS[role] ?? role;
    const html = layout(
      'Confirma la creación de tu cuenta',
      `<p>Hola ${escapeHtml(nombre)},</p>
       <p>Un administrador de EvenTix creó una cuenta para ti con el rol <strong>${escapeHtml(roleLabel)}</strong>.</p>
       <p>Para activarla, confirma la invitación y define tu contraseña.</p>
       ${button(url, 'Confirmar y crear mi cuenta')}
       <p>La invitación vence en ${expiresInHours} horas.</p>
       <p>Si no esperabas este correo, ignóralo y no se creará ninguna cuenta.</p>`,
    );
    const text = [
      `Hola ${nombre},`,
      `Un administrador de EvenTix creó una cuenta para ti con el rol ${roleLabel}.`,
      `Para activarla, confirma la invitación y define tu contraseña: ${url}`,
      `La invitación vence en ${expiresInHours} horas.`,
      'Si no esperabas este correo, ignóralo y no se creará ninguna cuenta.',
    ].join('\n\n');
    await this.send(to, 'Confirma tu cuenta de EvenTix', html, text);
  }

  async sendSolicitudRevisada(
    to: string,
    nombre: string,
    evento: { nombre: string; aprobada: boolean; observaciones?: string | null },
  ) {
    const url = `${this.frontendUrl}/organizador/solicitudes`;
    const estado = evento.aprobada ? 'aprobada' : 'rechazada';
    const detalle = evento.aprobada
      ? 'Nuestro equipo ya está preparando la página del evento. Te avisaremos cuando esté publicado.'
      : 'Puedes revisar las observaciones y enviar una nueva solicitud cuando lo necesites.';
    const obs = evento.observaciones?.trim();
    const html = layout(
      `Tu solicitud fue ${estado}`,
      `<p>Hola ${escapeHtml(nombre)},</p>
       <p>Revisamos tu solicitud para el evento <strong>${escapeHtml(evento.nombre)}</strong> y fue <strong>${estado}</strong>.</p>
       ${obs ? `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #00c9d4;">${escapeHtml(obs).replace(/\n/g, '<br>')}</p>` : ''}
       <p>${detalle}</p>
       ${button(url, 'Ver mis solicitudes')}`,
    );
    const text = [
      `Hola ${nombre},`,
      `Revisamos tu solicitud para el evento ${evento.nombre} y fue ${estado}.`,
      ...(obs ? [`Observaciones: ${obs}`] : []),
      detalle,
      `Puedes ver tus solicitudes aquí: ${url}`,
    ].join('\n\n');
    await this.send(to, `Solicitud ${estado}: ${evento.nombre}`, html, text);
  }

  async sendAyudanteBienvenida(to: string, nombre: string, datos: { negocio: string; jefe: string }) {
    const url = `${this.frontendUrl}/login`;
    const html = layout(
      'Ya formas parte de un negocio',
      `<p>Hola ${escapeHtml(nombre)},</p>
       <p>${escapeHtml(datos.jefe)} te registró como ayudante de <strong>${escapeHtml(datos.negocio)}</strong> en EvenTix.</p>
       <p>Ingresa con este correo y la contraseña que te entregó tu jefe de negocio. Si la olvidas, puedes restablecerla desde la pantalla de inicio de sesión.</p>
       ${button(url, 'Iniciar sesión')}`,
    );
    const text = [
      `Hola ${nombre},`,
      `${datos.jefe} te registró como ayudante de ${datos.negocio} en EvenTix.`,
      'Ingresa con este correo y la contraseña que te entregó tu jefe de negocio. Si la olvidas, puedes restablecerla desde la pantalla de inicio de sesión.',
      `Inicia sesión aquí: ${url}`,
    ].join('\n\n');
    await this.send(to, `Te agregaron a ${datos.negocio}`, html, text);
  }

  async sendEventoPublicado(to: string, nombre: string, evento: { id: string; titulo: string }) {
    const url = `${this.frontendUrl}/eventos/${evento.id}`;
    const html = layout(
      'Tu evento ya está publicado',
      `<p>Hola ${escapeHtml(nombre)},</p>
       <p><strong>${escapeHtml(evento.titulo)}</strong> ya está visible para el público en EvenTix.</p>
       ${button(url, 'Ver el evento')}`,
    );
    const text = [
      `Hola ${nombre},`,
      `${evento.titulo} ya está visible para el público en EvenTix.`,
      `Míralo aquí: ${url}`,
    ].join('\n\n');
    await this.send(to, `Evento publicado: ${evento.titulo}`, html, text);
  }

  private async send(to: string, subject: string, html: string, text: string) {
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`Correo "${subject}" enviado a ${to} (${info.messageId})`);
    } catch (err) {
      this.logger.error(`No se pudo enviar el correo "${subject}" a ${to}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo enviar el correo. Intenta nuevamente en unos minutos.');
    }
  }
}
