#!/usr/bin/env node
/**
 * Наскрізний сценарій практичної роботи №9:
 * реєстрація -> логін -> профіль -> RBAC -> ротація refresh token ->
 * повторне використання старого токена -> вихід -> відмова в оновленні.
 *
 * Запуск: npm run demo:auth (сервер має бути вже запущений).
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const stamp = Date.now().toString().slice(-6);
const pauseAfter = Number(
  process.argv
    .find((arg) => arg.startsWith('--pause-after='))
    ?.split('=')[1] ?? 0,
);
const phase =
  process.argv
    .find((arg) => arg.startsWith('--phase='))
    ?.split('=')[1] ?? 'all';

const color = {
  gray: (text) => `\u001b[90m${text}\u001b[0m`,
  green: (text) => `\u001b[32m${text}\u001b[0m`,
  red: (text) => `\u001b[31m${text}\u001b[0m`,
  cyan: (text) => `\u001b[36m${text}\u001b[0m`,
  bold: (text) => `\u001b[1m${text}\u001b[0m`,
};

let failures = 0;

function statusLabel(status) {
  if (status >= 200 && status < 300) return color.green(`${status}`);
  if (status >= 400) return color.red(`${status}`);
  return color.cyan(`${status}`);
}

function shortToken(token) {
  return token ? `${token.slice(0, 28)}...${token.slice(-8)}` : 'немає';
}

function printCookie(setCookie) {
  if (!setCookie) {
    console.log(`  ${color.gray('Set-Cookie: відсутній')}`);
    return;
  }
  const masked = setCookie.replace(
    /refreshToken=[^;]+/,
    `refreshToken=${shortToken(setCookie.split(';')[0].slice('refreshToken='.length))}`,
  );
  console.log(`  ${color.gray('Set-Cookie:')} ${masked}`);
}

async function request(method, path, { token, body, cookie } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const setCookie = response.headers.getSetCookie?.() ?? [];
  const refreshCookie = setCookie.find((item) =>
    item.startsWith('refreshToken='),
  );
  const nextCookie = refreshCookie
    ? refreshCookie.split(';')[0]
    : undefined;

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return { status: response.status, payload, setCookie, nextCookie };
}

function expectStatus(step, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? color.green('OK') : color.red('FAIL')} ${step}: очікували ${expected}, отримали ${actual}`,
  );
}

async function maybePause(step) {
  if (pauseAfter === step) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
}

async function main() {
  console.log(color.bold('\nСценарій життєвого циклу сесії\n'));

  if (phase !== 'session') {
  console.log(color.cyan('1. Реєстрація нового користувача'));
  const register = await request('POST', '/auth/register', {
    body: {
      email: `demo.driver.${stamp}@autoparts.local`,
      password: 'Driver12345',
    },
  });
  console.log(`  POST /auth/register -> ${statusLabel(register.status)}`);
  console.log(
    `  ${color.gray('role:')} ${register.payload?.role}  ${color.gray('email:')} ${register.payload?.email}`,
  );
  expectStatus('реєстрація', register.status, 201);

  console.log(color.cyan('\n2. Вхід водія та отримання пари токенів'));
  const login = await request('POST', '/auth/login', {
    body: {
      email: `demo.driver.${stamp}@autoparts.local`,
      password: 'Driver12345',
    },
  });
  console.log(`  POST /auth/login -> ${statusLabel(login.status)}`);
  console.log(`  ${color.gray('accessToken:')} ${shortToken(login.payload?.accessToken)}`);
  printCookie(login.setCookie[0]);
  expectStatus('вхід', login.status, 200);
  if (!login.payload?.accessToken || !login.nextCookie) {
    throw new Error('Сервер не повернув accessToken або refresh cookie');
  }

  console.log(color.cyan('\n3. Захищений профіль GET /auth/me'));
  const me = await request('GET', '/auth/me', { token: login.payload.accessToken });
  console.log(`  GET /auth/me -> ${statusLabel(me.status)}`);
  console.log(
    `  ${color.gray('id:')} ${me.payload?.id}  ${color.gray('role:')} ${me.payload?.role}`,
  );
  console.log(`  ${color.gray('passwordHash у відповіді:')} ${me.payload?.passwordHash ?? 'відсутній'}`);
  expectStatus('профіль', me.status, 200);

  console.log(color.cyan('\n4. Публічний каталог без токена'));
  const catalog = await request('GET', '/auto-parts?page=1&limit=2');
  console.log(`  GET /auto-parts -> ${statusLabel(catalog.status)}`);
  console.log(`  ${color.gray('запчастин усього:')} ${catalog.payload?.total}`);
  expectStatus('публічний каталог', catalog.status, 200);

  console.log(color.cyan('\n5. Водій намагається створити запчастину'));
  const denied = await request('POST', '/auto-parts', {
    token: login.payload.accessToken,
    body: {
      title: 'Спроба водія',
      price: 1500,
      oemCode: `DENIED-${stamp}`,
      condition: 'NEW',
      carModelId: '00000000-0000-0000-0000-000000000000',
    },
  });
  console.log(`  POST /auto-parts -> ${statusLabel(denied.status)}`);
  console.log(`  ${color.gray('message:')} ${denied.payload?.message}`);
  expectStatus('RBAC для DRIVER', denied.status, 403);

  await maybePause(5);

  if (phase === 'basics') {
    finish();
    return;
  }
  }

  console.log(color.cyan('\n6. Вхід механіка'));
  const mechanic = await request('POST', '/auth/login', {
    body: {
      email: 'mechanic@autoparts.local',
      password: 'Mechanic12345',
    },
  });
  console.log(`  POST /auth/login -> ${statusLabel(mechanic.status)}`);
  console.log(`  ${color.gray('role:')} ${mechanic.payload?.user?.role}`);
  expectStatus('вхід механіка', mechanic.status, 200);

  const models = await request('GET', '/car-models');
  const carModelId = models.payload?.[0]?.id;

  console.log(color.cyan('\n7. Механік створює запчастину'));
  const part = await request('POST', '/auto-parts', {
    token: mechanic.payload.accessToken,
    body: {
      title: 'Демонстраційний паливний фільтр',
      price: 780,
      oemCode: `DEMO-${stamp}`,
      condition: 'NEW',
      carModelId,
      specificationNames: ['Паливна система'],
    },
  });
  console.log(`  POST /auto-parts -> ${statusLabel(part.status)}`);
  console.log(`  ${color.gray('id:')} ${part.payload?.id}`);
  expectStatus('створення запчастини', part.status, 201);

  console.log(color.cyan('\n8. Механік додає код сумісності'));
  const code = await request(
    'POST',
    `/auto-parts/${part.payload.id}/compatibility-code`,
    {
      token: mechanic.payload.accessToken,
      body: {
        code: `DEMO-${stamp}-OEM`,
        manufacturer: 'Mann-Filter',
        isInterchangeable: true,
        notes: 'Перевірено під час демонстрації',
      },
    },
  );
  console.log(`  POST /auto-parts/:id/compatibility-code -> ${statusLabel(code.status)}`);
  console.log(`  ${color.gray('code:')} ${code.payload?.code}`);
  expectStatus('код сумісності', code.status, 201);

  console.log(color.cyan('\n9. Оновлення сесії та ротація refresh token'));
  const oldCookie = mechanic.nextCookie;
  const refreshed = await request('POST', '/auth/refresh', {
    cookie: oldCookie,
  });
  console.log(`  POST /auth/refresh -> ${statusLabel(refreshed.status)}`);
  printCookie(refreshed.setCookie[0]);
  console.log(`  ${color.gray('новий accessToken:')} ${shortToken(refreshed.payload?.accessToken)}`);
  expectStatus('оновлення сесії', refreshed.status, 200);
  console.log(
    `  ${color.gray('токен змінився:')} ${refreshed.nextCookie !== oldCookie ? 'так' : 'ні'}`,
  );
  if (refreshed.nextCookie === oldCookie) failures += 1;

  console.log(color.cyan('\n10. Повторне використання старого refresh token'));
  const replay = await request('POST', '/auth/refresh', { cookie: oldCookie });
  console.log(`  POST /auth/refresh (старий токен) -> ${statusLabel(replay.status)}`);
  console.log(`  ${color.gray('message:')} ${replay.payload?.message}`);
  expectStatus('відмова старому токену', replay.status, 401);

  console.log(color.cyan('\n11. Вихід: cookie видаляється, хеш у базі очищується'));
  const logout = await request('POST', '/auth/logout', {
    token: refreshed.payload.accessToken,
    cookie: refreshed.nextCookie,
  });
  console.log(`  POST /auth/logout -> ${statusLabel(logout.status)}`);
  console.log(`  ${color.gray('message:')} ${logout.payload?.message}`);
  printCookie(logout.setCookie[0]);
  expectStatus('вихід', logout.status, 200);

  console.log(color.cyan('\n12. Оновлення після виходу'));
  const afterLogout = await request('POST', '/auth/refresh', {
    cookie: refreshed.nextCookie,
  });
  console.log(`  POST /auth/refresh (після виходу) -> ${statusLabel(afterLogout.status)}`);
  console.log(`  ${color.gray('message:')} ${afterLogout.payload?.message}`);
  expectStatus('відмова після виходу', afterLogout.status, 401);

  finish();
}

function finish() {
  console.log(
    failures === 0
      ? color.green('\nУсі кроки сценарію виконано з очікуваними статусами.\n')
      : color.red(`\nКроків із неочікуваним статусом: ${failures}\n`),
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(color.red(`\nПомилка сценарію: ${error.message}\n`));
  process.exitCode = 1;
});
