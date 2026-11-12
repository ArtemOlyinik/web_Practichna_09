import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import type { UsersService } from '../users/users.service.js';
import { Role, type UserEntity } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';

const buildUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
  ({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    email: 'driver@example.com',
    passwordHash: '',
    role: Role.Driver,
    hashedRefreshToken: null,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  }) as UserEntity;

describe('AuthService', () => {
  const jwtService = new JwtService({});

  it('хешує пароль під час реєстрації та призначає роль DRIVER', async () => {
    const create = vi.fn(async (data: { email: string; passwordHash: string; role: Role }) =>
      buildUser({ email: data.email, passwordHash: data.passwordHash, role: data.role }),
    );
    const usersService = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create,
    } as unknown as UsersService;
    const service = new AuthService(usersService, jwtService);

    const result = await service.register({
      email: 'driver@example.com',
      password: 'Driver123',
    });

    const saved = create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe('Driver123');
    expect(await bcrypt.compare('Driver123', saved.passwordHash)).toBe(true);
    expect(saved.role).toBe(Role.Driver);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('hashedRefreshToken');
  });

  it('відхиляє вхід із неправильним паролем', async () => {
    const passwordHash = await bcrypt.hash('Correct123', 4);
    const usersService = {
      findByEmailWithSecrets: vi
        .fn()
        .mockResolvedValue(buildUser({ passwordHash })),
    } as unknown as UsersService;
    const service = new AuthService(usersService, jwtService);

    await expect(
      service.login({ email: 'driver@example.com', password: 'Wrong123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('оновлює пару токенів і перезаписує хеш refresh token', async () => {
    const oldRefreshToken = await jwtService.signAsync(
      {
        sub: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        email: 'driver@example.com',
        role: Role.Driver,
        jti: 'old-token',
      },
      { secret: 'refreshSecretKey', expiresIn: 604800 },
    );
    const user = buildUser({
      hashedRefreshToken: await bcrypt.hash(
        createHash('sha256').update(oldRefreshToken).digest('hex'),
        4,
      ),
    });
    const setHashedRefreshToken = vi.fn().mockResolvedValue(undefined);
    const usersService = {
      findByIdWithSecrets: vi.fn().mockResolvedValue(user),
      setHashedRefreshToken,
    } as unknown as UsersService;
    const service = new AuthService(usersService, jwtService);

    const tokens = await service.refresh(oldRefreshToken);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).not.toBe(oldRefreshToken);
    expect(setHashedRefreshToken).toHaveBeenCalledWith(
      user.id,
      expect.any(String),
    );
    const savedHash = setHashedRefreshToken.mock.calls[0][1] as string;
    expect(
      await bcrypt.compare(
        createHash('sha256').update(tokens.refreshToken).digest('hex'),
        savedHash,
      ),
    ).toBe(true);
    expect(
      await bcrypt.compare(
        createHash('sha256').update(oldRefreshToken).digest('hex'),
        savedHash,
      ),
    ).toBe(false);
  });

  it('відхиляє refresh token, якого немає в базі', async () => {
    const refreshToken = await jwtService.signAsync(
      {
        sub: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        email: 'driver@example.com',
        role: Role.Driver,
      },
      { secret: 'refreshSecretKey', expiresIn: 604800 },
    );
    const usersService = {
      findByIdWithSecrets: vi
        .fn()
        .mockResolvedValue(buildUser({ hashedRefreshToken: null })),
    } as unknown as UsersService;
    const service = new AuthService(usersService, jwtService);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('очищає хеш refresh token під час виходу', async () => {
    const setHashedRefreshToken = vi.fn().mockResolvedValue(undefined);
    const usersService = {
      setHashedRefreshToken,
    } as unknown as UsersService;
    const service = new AuthService(usersService, jwtService);

    await service.logout('user-id');

    expect(setHashedRefreshToken).toHaveBeenCalledWith('user-id', null);
  });
});
