import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Позначає маршрут як відкритий. Глобальний JwtAuthGuard пропускає
 * такі обробники без перевірки заголовка Authorization.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
