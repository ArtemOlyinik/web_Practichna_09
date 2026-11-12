import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Role, UserEntity } from './entities/user.entity.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  /**
   * Пошук без службових полів. Саме цей метод використовують профіль
   * та JwtStrategy, тому passwordHash і hashedRefreshToken назовні не потрапляють.
   */
  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepo.findOneBy({ email });
  }

  /**
   * Пошук для перевірки пароля або refresh token: явно додає поля,
   * позначені select: false.
   */
  findByEmailWithSecrets(email: string): Promise<UserEntity | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.hashedRefreshToken'])
      .where('user.email = :email', { email })
      .getOne();
  }

  findByIdWithSecrets(id: string): Promise<UserEntity | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.hashedRefreshToken'])
      .where('user.id = :id', { id })
      .getOne();
  }

  create(data: CreateUserData): Promise<UserEntity> {
    const user = this.usersRepo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.Driver,
    });
    return this.usersRepo.save(user);
  }

  async setHashedRefreshToken(
    id: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.usersRepo.update({ id }, { hashedRefreshToken });
  }
}
