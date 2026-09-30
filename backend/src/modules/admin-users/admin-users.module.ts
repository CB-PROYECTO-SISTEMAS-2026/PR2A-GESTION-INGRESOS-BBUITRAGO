import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController, InvitacionesPublicController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, InvitacionesPublicController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
