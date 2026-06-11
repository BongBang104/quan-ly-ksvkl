/**
 * Seed tài khoản admin ban đầu với password đã hash bcrypt.
 * Chạy MỘT LẦN sau khi DB rỗng: npx ts-node backend/scripts/seed-admin.ts
 *
 * Đọc password từ env ADMIN_INITIAL_PASSWORD, hoặc sinh ngẫu nhiên và in ra console.
 */
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Employee } from '../src/employees/employee.entity';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    database: process.env.DB_NAME ?? 'atc_pro',
    entities: [Employee],
    synchronize: false,
  });
  await ds.initialize();
  const repo = ds.getRepository(Employee);

  const adminExisting = await repo.findOne({ where: { id: 'admin' } });
  const tctsvipExisting = await repo.findOne({ where: { id: 'tctsvip' } });

  const plainAdmin = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString('base64url');
  const adminHash = await bcrypt.hash(plainAdmin, 10);
  const tctsvipHash = await bcrypt.hash('Tctsdn@123', 10);

  if (!adminExisting) {
    await repo.save({
      id: 'admin',
      name: 'Administrator',
      role: 'superadmin',
      password: adminHash,
      isFirstLogin: true,
      isApproved: true,
    } as Employee);
    console.log('✓ Đã tạo tài khoản admin.');
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.log('  Mật khẩu sinh ngẫu nhiên: ' + plainAdmin);
      console.log('  Hãy đăng nhập và đổi mật khẩu NGAY.');
    }
  } else {
    console.log('Tài khoản admin đã tồn tại — bỏ qua.');
  }

  if (!tctsvipExisting) {
    await repo.save({
      id: 'tctsvip',
      name: 'Hidden Super Admin',
      role: 'superadmin',
      password: tctsvipHash,
      isFirstLogin: true,
      isApproved: true,
    } as Employee);
    console.log('✓ Đã tạo tài khoản ẩn tctsvip với mật khẩu Tctsdn@123.');
  } else {
    await repo.update('tctsvip', {
      role: 'superadmin',
      password: tctsvipHash,
      isFirstLogin: true,
      isApproved: true,
    });
    console.log('✓ Đã cập nhật tài khoản ẩn tctsvip để đảm bảo là superadmin và mật khẩu mới.');
  }

  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
