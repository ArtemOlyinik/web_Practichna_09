import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../users/entities/user.entity.js';

export const ROLES_KEY = 'roles';

/**
 * Записує перелік дозволених ролей у метадані обробника.
 * Читається у RolesGuard через Reflector.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
