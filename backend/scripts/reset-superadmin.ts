/**
 * Script CLI: Reset mật khẩu tài khoản superadmin (tctsvip).
 * Chạy trực tiếp trên server, không qua HTTP, không cần đăng nhập.
 *
 * Cách dùng:
 *   npm --prefix backend run reset-superadmin
 * Hoặc từ trong thư mục backend/:
 *   npm run reset-superadmin
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt    from 'bcrypt';
import { randomBytes } from 'crypto';
import * as readline  from 'readline';
import * as dotenv    from 'dotenv';
import * as path      from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Employee } from '../src/employees/employee.entity';

async function getDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type:        'postgres',
    host:        process.env.DB_HOST ?? 'localhost',
    port:        parseInt(process.env.DB_PORT ?? '5432'),
    username:    process.env.DB_USER ?? 'postgres',
    password:    process.env.DB_PASS,
    database:    process.env.DB_NAME ?? 'atc_pro',
    entities:    [Employee],
    synchronize: false,
    ssl:         process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await ds.initialize();
  return ds;
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  const SUPERADMIN_ID = process.env.HIDDEN_ADMIN_ID ?? 'tctsvip';

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  SCRIPT RESET MẬT KHẨU SUPERADMIN — quan-ly-ksvkl');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Tài khoản sẽ được reset: ${SUPERADMIN_ID}`);
  console.log('──────────────────────────────────────────────────────────\n');

  const ok = await confirm(`  Xác nhận reset password cho "${SUPERADMIN_ID}"? (y/N): `);
  if (!ok) {
    console.log('\n  Đã huỷ. Không có gì thay đổi.\n');
    process.exit(0);
  }

  let ds: DataSource | null = null;

  try {
    console.log('\n  Đang kết nối database...');
    ds = await getDataSource();
    console.log('  ✓ Kết nối thành công.\n');

    const repo = ds.getRepository(Employee);
    const emp  = await repo.findOne({ where: { id: SUPERADMIN_ID } });

    if (!emp) {
      console.log(`  ✗ Không tìm thấy tài khoản "${SUPERADMIN_ID}" trong DB.`);
      console.log('  → Hãy khởi động server bình thường lần đầu để tạo tài khoản.');
      process.exit(1);
    }

    const newPassword = randomBytes(18).toString('base64url');
    const hashed      = await bcrypt.hash(newPassword, 10);

    await repo.update(SUPERADMIN_ID, {
      password:     hashed,
      isFirstLogin: true,
    });

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  ✓ ĐÃ RESET MẬT KHẨU cho tài khoản: ${SUPERADMIN_ID}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  MẬT KHẨU MỚI:  ${newPassword}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('  ⚠️  GHI LẠI NGAY. Script KHÔNG lưu và KHÔNG hiển thị lại.');
    console.log('  ⚠️  Đăng nhập → hệ thống yêu cầu đổi mật khẩu ngay lập tức.');
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n  ✗ Lỗi:', (err as Error).message);
    process.exit(1);
  } finally {
    if (ds?.isInitialized) await ds.destroy();
  }
}

main();
