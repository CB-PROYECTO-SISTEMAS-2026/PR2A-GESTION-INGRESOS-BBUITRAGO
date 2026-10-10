import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Usuario autenticado que JwtStrategy.validate deja en `request.user`. */
export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  roles: Role[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return data ? user?.[data] : user;
  },
);
