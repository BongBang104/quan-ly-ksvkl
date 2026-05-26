import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService }       from '@nestjs/jwt';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import { Employee }         from '../employees/employee.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private readonly empRepo: Repository<Employee>,
    private readonly jwt:     JwtService,
  ) {}

  async login(id: string, password: string) {
    const emp = await this.empRepo.findOne({ where: { id } });
    if (!emp) throw new UnauthorizedException('Tài khoản không tồn tại.');

    const valid = await this.verifyPassword(password, emp.password);
    if (!valid) throw new UnauthorizedException('Mật khẩu không chính xác.');

    if (emp.role === 'ADMIN' && !emp.isApproved) {
      throw new ForbiddenException('Tài khoản chưa được phê duyệt. Vui lòng liên hệ quản trị cấp cao.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...user } = emp;
    const token = this.jwt.sign({ sub: emp.id, role: emp.role });
    return { token, user };
  }

  async changePassword(empId: string, newPassword: string) {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.empRepo.update(empId, { password: hash, isFirstLogin: false });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    // Support both plain-text legacy passwords ('tctsdn123') and bcrypt hashes
    if (stored.startsWith('$2')) {
      return bcrypt.compare(plain, stored);
    }
    return plain === stored; // legacy plain-text — will be replaced on first change
  }
}
