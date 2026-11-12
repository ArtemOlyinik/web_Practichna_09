import type { Role } from '../../users/entities/user.entity.js';

/** Дані, які JwtStrategy записує у req.user після перевірки токена. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

/** Корисне навантаження підписаного JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
