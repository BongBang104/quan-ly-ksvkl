import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Employee } from '../employees/employee.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  const fakeEmp = (overrides: Partial<Employee> = {}) => ({
    id: 'u1', name: 'User', role: 'STAFF', isApproved: true,
    password: '', ...overrides,
  } as Employee);

  const buildModule = async (emp: Employee | null) => {
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: () => 'fake-token' } },
        { provide: getRepositoryToken(Employee),
          useValue: { findOne: async () => emp, update: async () => undefined } },
      ],
    }).compile();
    return mod.get(AuthService);
  };

  it('reject login khi mật khẩu sai', async () => {
    const hash = await bcrypt.hash('correct', 10);
    service = await buildModule(fakeEmp({ password: hash }));
    await expect(service.login('u1', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('reject login khi password lưu plain-text (legacy không còn được chấp nhận)', async () => {
    service = await buildModule(fakeEmp({ password: 'tctsdn123' }));
    await expect(service.login('u1', 'tctsdn123')).rejects.toThrow(UnauthorizedException);
  });

  it('cho phép login khi mật khẩu đúng và đã hash', async () => {
    const hash = await bcrypt.hash('correct', 10);
    service = await buildModule(fakeEmp({ password: hash }));
    const result = await service.login('u1', 'correct');
    expect(result.token).toBe('fake-token');
    expect((result.user as any).password).toBeUndefined();
  });
});
