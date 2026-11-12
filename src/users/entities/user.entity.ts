import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Ролі користувачів для предметної області «Автозапчастини» (варіант 7).
 * ADMIN - повний доступ, MECHANIC - керування каталогом і кодами сумісності,
 * DRIVER - лише перегляд каталогу.
 */
export enum Role {
  Admin = 'ADMIN',
  Mechanic = 'MECHANIC',
  Driver = 'DRIVER',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 60, name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, default: Role.Driver })
  role!: Role;

  @Column({
    type: 'varchar',
    length: 60,
    name: 'hashed_refresh_token',
    nullable: true,
    select: false,
  })
  hashedRefreshToken!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
