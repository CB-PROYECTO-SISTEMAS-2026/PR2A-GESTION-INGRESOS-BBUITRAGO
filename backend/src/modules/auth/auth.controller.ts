import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const MINUTE = 60_000;

// "default" cuenta por IP + correo (ver AppThrottlerGuard); "ip" es el tope por IP, para que varios
// miembros del personal puedan iniciar sesión desde el WiFi del evento sin abrir la puerta a
// ataques de fuerza bruta desde una sola IP.

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({
    default: { limit: 5, ttl: 15 * MINUTE },
    ip: { limit: 30, ttl: 15 * MINUTE },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({
    default: { limit: 10, ttl: 15 * MINUTE },
    ip: { limit: 100, ttl: 15 * MINUTE },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({
    default: { limit: 3, ttl: 15 * MINUTE },
    ip: { limit: 15, ttl: 15 * MINUTE },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({
    default: { limit: 5, ttl: 15 * MINUTE },
    ip: { limit: 30, ttl: 15 * MINUTE },
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
