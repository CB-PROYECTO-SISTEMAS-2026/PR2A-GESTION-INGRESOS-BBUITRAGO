import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MailService } from './mail.service';

/** Cada minuto reintenta correos que fallaron al SMTP (cola en Archivo). */
@Injectable()
export class MailOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailOutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private mail: MailService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 60_000);
    // Primer pase a los 15 s para no competir con el arranque.
    setTimeout(() => void this.tick(), 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.mail.flushOutbox();
      if (n > 0) this.logger.log(`Cola de correo: ${n} mensaje(s) reenviado(s).`);
    } catch (err) {
      this.logger.error(
        `Error al vaciar cola de correo: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }
}
