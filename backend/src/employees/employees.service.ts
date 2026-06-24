import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not }   from 'typeorm';
import * as bcrypt           from 'bcrypt';
import { Employee }          from './employee.entity';

export interface UpsertResult {
  employee: Omit<Employee, 'password'>;
  generatedPassword?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  async findAll(): Promise<{ list: Omit<Employee, 'password'>[] }> {
    const emps = await this.repo.find({
      where: { role: Not('superadmin') },
      order: { name: 'ASC' },
    });
    const list = emps.map(({ password, ...e }) => e);
    return { list };
  }

  // Replace entire list — preserves superadmin, preserves existing passwords, generates for new
  async replaceAll(list: any[]): Promise<{ list: any[]; passwords: Record<string, string> }> {
    const passwords: Record<string, string> = {};

    // Snapshot existing passwords before delete
    const existingEmps = await this.repo.find({ where: { role: Not('superadmin') } });
    const existingPwMap = new Map(existingEmps.map(e => [e.id, e.password]));

    await this.repo.delete({ role: Not('superadmin') });

    const filtered = list
      .filter(e => e.role !== 'superadmin')
      .map(e => ({
        ...e,
        isApproved: e.isApproved !== undefined ? e.isApproved : (e.role === 'ADMIN' ? false : true),
      }));

    const hashed = await Promise.all(
      filtered.map(async e => {
        if (existingPwMap.has(e.id)) {
          // Existing employee — keep their current password, preserve isFirstLogin state
          return { ...e, password: existingPwMap.get(e.id) };
        }
        // New employee — generate random password
        const plain = this.generatePassword();
        passwords[e.id] = plain;
        return { ...e, password: await bcrypt.hash(plain, 10), isFirstLogin: true };
      }),
    );

    const saved = await this.repo.save(hashed);
    return {
      list: saved.map(({ password, ...e }) => e as any),
      passwords,
    };
  }

  async upsertOne(
    emp: Partial<Employee> & { isApproved?: boolean },
    isNew: boolean = false,
  ): Promise<UpsertResult> {
    // Owner account: luôn duy trì superadmin + isApproved
    if (emp.id === (process.env.HIDDEN_ADMIN_ID ?? 'tctsvip')) {
      emp.role = 'superadmin';
      emp.isApproved = true;
    }

    // New ADMIN accounts must wait for superadmin approval
    if (isNew && emp.isApproved === undefined && emp.role === 'ADMIN') {
      (emp as any).isApproved = false;
    }

    let generatedPassword: string | undefined;

    if (isNew) {
      generatedPassword = this.generatePassword();
      emp.password     = await bcrypt.hash(generatedPassword, 10);
      emp.isFirstLogin = true;
    } else {
      // isNew=false: không cho đổi password qua endpoint này.
      // Dùng PATCH /api/employees/:id/password (có ChangePasswordDto validation).
      delete (emp as any).password;
    }

    const saved = await this.repo.save(emp);
    const { password: _pw, ...employee } = saved;
    return { employee: employee as any, generatedPassword };
  }

  async resetPassword(empId: string): Promise<{ generatedPassword: string }> {
    const plain = this.generatePassword();
    const hash  = await bcrypt.hash(plain, 10);
    await this.repo.update(empId, { password: hash, isFirstLogin: true });
    return { generatedPassword: plain };
  }

  private async hashIfPlain(password: string | undefined): Promise<string | undefined> {
    if (!password) return undefined;
    if (password.startsWith('$2')) return password;
    return bcrypt.hash(password, 10);
  }

  async setApproved(id: string, isApproved: boolean): Promise<void> {
    await this.repo.update(id, { isApproved });
  }

  async remove(id: string): Promise<void> {
    const emp = await this.repo.findOne({ where: { id } });
    if (!emp || emp.role === 'superadmin') return;
    await this.repo.delete(id);
  }

  private generatePassword(): string {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const all    = upper + lower + digits;

    const pick = (src: string) => src[Math.floor(Math.random() * src.length)];
    const rest = Array.from({ length: 7 }, () => pick(all));
    const chars = [pick(upper), pick(lower), pick(digits), ...rest];

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
