import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService }       from '@nestjs/jwt';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import { Employee }         from '../employees/employee.entity';
import { AuditService }     from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private readonly empRepo: Repository<Employee>,
    private readonly jwt:     JwtService,
    private readonly audit:   AuditService,
  ) {}

  async login(id: string, password: string, ip?: string, userAgent?: string) {
    const emp = await this.empRepo.findOne({ where: { id } });

    if (!emp) {
      await this.audit.log({ action: 'LOGIN_FAIL', resourceId: id, payload: { reason: 'not_found' }, ip, userAgent });
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    const valid = await this.verifyPassword(password, emp.password);
    if (!valid) {
      await this.audit.log({ action: 'LOGIN_FAIL', actorId: emp.id, actorName: emp.name, payload: { reason: 'wrong_password' }, ip, userAgent });
      throw new UnauthorizedException('Mật khẩu không chính xác.');
    }

    if (emp.role === 'ADMIN' && !emp.isApproved) {
      await this.audit.log({ action: 'LOGIN_FAIL', actorId: emp.id, actorName: emp.name, payload: { reason: 'not_approved' }, ip, userAgent });
      throw new ForbiddenException('Tài khoản chưa được phê duyệt. Vui lòng liên hệ quản trị cấp cao.');
    }

    await this.audit.log({ action: 'LOGIN_SUCCESS', actorId: emp.id, actorName: emp.name, ip, userAgent });

    const { password: _pw, ...user } = emp;
    const token = this.jwt.sign({ sub: emp.id, role: emp.role, name: emp.name });
    return { token, user };
  }

  async changePassword(empId: string, newPassword: string, actorId?: string, actorName?: string) {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.empRepo.update(empId, { password: hash, isFirstLogin: false });
    await this.audit.log({
      action: 'CHANGE_PASSWORD',
      actorId,
      actorName,
      resourceType: 'employee',
      resourceId: empId,
    });
  }

  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (!stored.startsWith('$2')) return false;
    return bcrypt.compare(plain, stored);
  }
}
