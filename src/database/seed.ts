import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source.js';
import {
  PartCondition,
  AutoPartEntity,
} from '../auto-parts/entities/auto-part.entity.js';
import { CarModelEntity } from '../auto-parts/entities/car-model.entity.js';
import { CompatibilityCodeEntity } from '../auto-parts/entities/compatibility-code.entity.js';
import { SpecificationEntity } from '../auto-parts/entities/specification.entity.js';
import { Role, UserEntity } from '../users/entities/user.entity.js';

interface SeedUser {
  email: string;
  password: string;
  role: Role;
}

interface SeedPart {
  title: string;
  price: number;
  oemCode: string;
  condition: PartCondition;
  brand: string;
  model: string;
  yearFrom: number;
  specifications: string[];
  compatibilityCode: {
    code: string;
    manufacturer: string;
    isInterchangeable: boolean;
    notes: string;
  };
}

const USERS: SeedUser[] = [
  { email: 'admin@autoparts.local', password: 'Admin12345', role: Role.Admin },
  {
    email: 'mechanic@autoparts.local',
    password: 'Mechanic12345',
    role: Role.Mechanic,
  },
  {
    email: 'driver@autoparts.local',
    password: 'Driver12345',
    role: Role.Driver,
  },
];

const MODELS = [
  { brand: 'Toyota', name: 'Camry XV70', yearFrom: 2017, yearTo: 2024 },
  { brand: 'Volkswagen', name: 'Passat B8', yearFrom: 2015, yearTo: 2023 },
  { brand: 'BMW', name: '3 Series G20', yearFrom: 2019, yearTo: 2025 },
];

const SPECIFICATIONS = [
  { name: 'Гальмівна система', description: 'Колодки, диски, супорти' },
  { name: 'Підвіска', description: 'Амортизатори, пружини, важелі' },
  { name: 'Електрика', description: 'Стартери, генератори, датчики' },
  { name: 'Охолодження', description: 'Радіатори, помпи, термостати' },
];

const PARTS: SeedPart[] = [
  {
    title: 'Гальмівні колодки передні Brembo P85020',
    price: 2450,
    oemCode: 'P85020',
    condition: PartCondition.New,
    brand: 'Toyota',
    model: 'Camry XV70',
    yearFrom: 2017,
    specifications: ['Гальмівна система', 'Підвіска'],
    compatibilityCode: {
      code: 'P85020-OEM',
      manufacturer: 'Brembo',
      isInterchangeable: true,
      notes: 'Аналог TRW GDB1330',
    },
  },
  {
    title: 'Радіатор охолодження Nissens 606811',
    price: 5200,
    oemCode: '606811',
    condition: PartCondition.New,
    brand: 'Volkswagen',
    model: 'Passat B8',
    yearFrom: 2015,
    specifications: ['Охолодження', 'Електрика'],
    compatibilityCode: {
      code: '606811-OEM',
      manufacturer: 'Nissens',
      isInterchangeable: false,
      notes: 'Оригінальна геометрія кріплень',
    },
  },
  {
    title: 'Стартер Bosch 0001108231',
    price: 4300,
    oemCode: '0001108231',
    condition: PartCondition.Refurbished,
    brand: 'BMW',
    model: '3 Series G20',
    yearFrom: 2019,
    specifications: ['Електрика'],
    compatibilityCode: {
      code: '0001108231-OEM',
      manufacturer: 'Bosch',
      isInterchangeable: true,
      notes: 'Відновлений, гарантія 12 місяців',
    },
  },
  {
    title: 'Амортизатор передній KYB 339258',
    price: 1980,
    oemCode: '339258',
    condition: PartCondition.New,
    brand: 'Toyota',
    model: 'Camry XV70',
    yearFrom: 2017,
    specifications: ['Підвіска'],
    compatibilityCode: {
      code: '339258-OEM',
      manufacturer: 'KYB',
      isInterchangeable: false,
      notes: 'Газомасляний, для європейської підвіски',
    },
  },
];

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    const usersRepo = dataSource.getRepository(UserEntity);
    for (const item of USERS) {
      const existing = await usersRepo.findOneBy({ email: item.email });
      if (existing) {
        console.log(`Користувач ${item.email} уже існує - пропущено`);
        continue;
      }
      const passwordHash = await bcrypt.hash(item.password, 10);
      await usersRepo.save(
        usersRepo.create({
          email: item.email,
          passwordHash,
          role: item.role,
        }),
      );
      console.log(`Створено користувача ${item.email} (${item.role})`);
    }

    const modelsRepo = dataSource.getRepository(CarModelEntity);
    for (const item of MODELS) {
      const existing = await modelsRepo.findOneBy({
        brand: item.brand,
        name: item.name,
        yearFrom: item.yearFrom,
      });
      if (!existing) {
        await modelsRepo.save(modelsRepo.create(item));
        console.log(`Створено модель ${item.brand} ${item.name}`);
      }
    }

    const specificationsRepo = dataSource.getRepository(SpecificationEntity);
    for (const item of SPECIFICATIONS) {
      const existing = await specificationsRepo.findOneBy({ name: item.name });
      if (!existing) {
        await specificationsRepo.save(specificationsRepo.create(item));
        console.log(`Створено вузол ${item.name}`);
      }
    }

    const partsRepo = dataSource.getRepository(AutoPartEntity);
    for (const item of PARTS) {
      const existing = await partsRepo.findOneBy({ oemCode: item.oemCode });
      if (existing) {
        console.log(`Запчастина ${item.oemCode} уже існує - пропущено`);
        continue;
      }

      const carModel = await modelsRepo.findOneByOrFail({
        brand: item.brand,
        name: item.model,
        yearFrom: item.yearFrom,
      });
      const specifications = await specificationsRepo.findBy(
        item.specifications.map((name) => ({ name })),
      );

      const part = partsRepo.create({
        title: item.title,
        price: item.price,
        oemCode: item.oemCode,
        condition: item.condition,
        carModel,
        specifications,
        compatibilityCode: {
          code: item.compatibilityCode.code,
          manufacturer: item.compatibilityCode.manufacturer,
          isInterchangeable:
            item.compatibilityCode.isInterchangeable,
          notes: item.compatibilityCode.notes,
        } satisfies Partial<CompatibilityCodeEntity>,
      });
      await partsRepo.save(part);
      console.log(`Створено запчастину ${item.oemCode}`);
    }

    console.log('Початкові дані готові');
  } finally {
    await dataSource.destroy();
  }
}

void seed();
