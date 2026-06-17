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
  const hiddenAdminId = process.env.HIDDEN_ADMIN_ID ?? 'tctsvip';
  const tctsvipExisting = await repo.findOne({ where: { id: hiddenAdminId } });

  const plainAdmin = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString('base64url');
  const adminHash = await bcrypt.hash(plainAdmin, 10);

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

  // Owner account được tạo tự động bởi backend khi khởi động lần đầu.
  // seed-admin.ts chỉ tạo nếu hoàn toàn chưa tồn tại, với random password.
  if (!tctsvipExisting) {
    const plainOwner = randomBytes(18).toString('base64url');
    const ownerHash = await bcrypt.hash(plainOwner, 10);
    await repo.save({
      id: hiddenAdminId,
      name: 'System Owner Account',
      role: 'superadmin',
      password: ownerHash,
      isFirstLogin: true,
      isApproved: true,
    } as Employee);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`⚠️  ONE-TIME PASSWORD cho tài khoản ${hiddenAdminId}:`);
    console.log(`⚠️  ${plainOwner}`);
    console.log('⚠️  GHI LẠI NGAY và LƯU AN TOÀN. KHÔNG hiển thị lại lần nữa.');
    console.log('═══════════════════════════════════════════════════════════════');
  } else {
    console.log(`Tài khoản ${hiddenAdminId} đã tồn tại — KHÔNG reset password.`);
  }

  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
