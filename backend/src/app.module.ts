import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import {
  AppThrottlerGuard,
  clientIp,
} from './common/guards/app-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './common/mail/mail.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { PosModule } from './modules/pos/pos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // default: por usuario autenticado (o IP + correo sin sesión). ip: tope de respaldo por IP,
    // holgado para que el personal de un evento comparta el WiFi sin bloquearse.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      {
        name: 'ip',
        ttl: 60_000,
        limit: 1000,
        getTracker: (req) => clientIp(req),
      },
    ]),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    UsersModule,
    EventsModule,
    TicketsModule,
    BusinessesModule,
    AdminUsersModule,
    PosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
