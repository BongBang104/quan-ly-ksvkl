/**
 * Script: Chạy migration.sql vào database.
 * Dùng cho local dev — Docker dùng docker-entrypoint.sh.
 *
 * Chạy từ thư mục gốc:
 *   npm --prefix backend run migrate
 * Hoặc từ thư mục backend/:
 *   npm run migrate
 */

import 'reflect-metadata';
import * as fs     from 'fs';
import * as path   from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  const ds  = new DataSource(
    url
      ? { type: 'postgres' as const, url, synchronize: false }
      : {
          type:        'postgres' as const,
          host:        process.env.DB_HOST  ?? 'localhost',
          port:        parseInt(process.env.DB_PORT ?? '5432'),
          username:    process.env.DB_USER  ?? 'postgres',
          password:    process.env.DB_PASS  ?? 'postgres',
          database:    process.env.DB_NAME  ?? 'atc_pro',
          synchronize: false,
        },
  );

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  MIGRATION — quan-ly-ksvkl');
  console.log('══════════════════════════════════════════════════════════');

  try {
    await ds.initialize();
    console.log('  ✓ Kết nối DB thành công.\n');

    const sqlPath = path.join(__dirname, '../migration.sql');
    const sql     = fs.readFileSync(sqlPath, 'utf-8');

    // Chạy toàn bộ file một lần — tránh lỗi thứ tự khi tách từng câu lệnh
    await ds.query(sql);

    console.log('  ✓ Migration hoàn tất.');
    console.log('══════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error('  ✗ Migration thất bại:', err.message);
    process.exit(1);
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

main();
