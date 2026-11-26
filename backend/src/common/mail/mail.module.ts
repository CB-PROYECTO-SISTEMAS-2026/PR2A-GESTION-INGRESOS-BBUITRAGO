import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailOutboxWorker } from './mail-outbox.worker';

@Global()
@Module({
  providers: [MailService, MailOutboxWorker],
  exports: [MailService],
})
export class MailModule {}
