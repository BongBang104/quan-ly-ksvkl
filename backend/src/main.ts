import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AppModule } from './app.module';
import { Employee } from './employees/employee.entity';

const HIDDEN_ADMIN_ID = process.env.HIDDEN_ADMIN_ID ?? 'tctsvip';
const HIDDEN_ADMIN_NAME = 'System Owner Account';

async function ensureHiddenSuperAdmin(dataSource: DataSource) {
  const repo = dataSource.getRepository(Employee);
  const hidden = await repo.findOne({ where: { id: HIDDEN_ADMIN_ID } });

  if (hidden) {
    // Chỉ đảm bảo role + isApproved. KHÔNG reset password.
    if (hidden.role !== 'superadmin' || !hidden.isApproved) {
      await repo.update(HIDDEN_ADMIN_ID, { role: 'superadmin', isApproved: true });
      console.log(`✓ Đảm bảo ${HIDDEN_ADMIN_ID} là superadmin (KHÔNG đổi password).`);
    }
    return;
  }

  // Tạo lần đầu với password random 24 ký tự, in 1 lần duy nhất ra console.
  const initialPassword = randomBytes(18).toString('base64url');
  const hashedPassword = await bcrypt.hash(initialPassword, 10);
  await repo.save({
    id: HIDDEN_ADMIN_ID,
    name: HIDDEN_ADMIN_NAME,
    role: 'superadmin',
    password: hashedPassword,
    isFirstLogin: true,
    isApproved: true,
  } as Employee);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`⚠️  ONE-TIME PASSWORD cho tài khoản ${HIDDEN_ADMIN_ID}:`);
  console.log(`⚠️  ${initialPassword}`);
  console.log('⚠️  GHI LẠI NGAY và LƯU AN TOÀN. KHÔNG hiển thị lại lần nữa.');
  console.log('⚠️  Đăng nhập lần đầu → đổi mật khẩu ngay qua giao diện.');
  console.log('═══════════════════════════════════════════════════════════════');
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
