import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import { Role, type UserEntity } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { JwtPayload } from './types/authenticated-user.js';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'accessSecretKey';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(
        'Користувач з такою електронною поштою вже існує',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        role: Role.Driver,
      });
      return this.toPublicUser(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new ConflictException(
          'Користувач з такою електронною поштою вже існує',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);

    if (!user) {
      throw new UnauthorizedException('Невірні облікові дані');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Невірні облікові дані');
    }

    const tokens = await this.issueTokenPair(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return { ...tokens, user: this.toPublicUser(user) };
  }

  /**
   * Ротація сесії: старий refresh token звіряється з хешем у БД,
   * після чого видається нова пара токенів і хеш перезаписується.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token недійсний або термін його дії минув',
      );
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException(
        'Сесію не знайдено. Виконайте вхід повторно',
      );
    }

    const tokenMatches = await bcrypt.compare(
      this.digestToken(refreshToken),
      user.hashedRefreshToken,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Refresh token недійсний');
    }

    const tokens = await this.issueTokenPair(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setHashedRefreshToken(userId, null);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Користувача не знайдено');
    }
    return this.toPublicUser(user);
  }

  private async issueTokenPair(user: UserEntity): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.accessSecret,
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.refreshSecret,
          expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(this.digestToken(refreshToken), BCRYPT_ROUNDS);
    await this.usersService.setHashedRefreshToken(userId, hash);
  }

  /**
   * bcrypt враховує лише перші 72 байти пароля, а JWT довший.
   * Тому перед bcrypt токен стискаємо до SHA-256: усі байти токена
   * впливають на результат, а ротація справді змінює збережений хеш.
   */
  private digestToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
