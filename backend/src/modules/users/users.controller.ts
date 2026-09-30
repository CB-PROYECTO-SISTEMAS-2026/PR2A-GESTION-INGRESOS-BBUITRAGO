import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { memoryUpload } from '../../common/storage/upload.options';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.usersService.me(userId);
  }

  @Get('me/profile')
  profile(@CurrentUser('id') userId: string) {
    return this.usersService.profile(userId);
  }

  @Get('me/saldo')
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENTE)
  saldo(@CurrentUser('id') userId: string) {
    return this.usersService.saldo(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('me/foto')
  @UseInterceptors(FileInterceptor('foto', memoryUpload))
  updateFoto(@CurrentUser('id') userId: string, @UploadedFile() file?: Express.Multer.File) {
    return this.usersService.updateFoto(userId, file);
  }

  @Delete('me/foto')
  removeFoto(@CurrentUser('id') userId: string) {
    return this.usersService.removeFoto(userId);
  }
}
