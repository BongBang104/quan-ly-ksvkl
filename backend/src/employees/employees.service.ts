import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not }   from 'typeorm';
import { Employee }          from './employee.entity';

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

  // Replace entire list — preserves superadmin, enforces isApproved=false for new ADMINs
  async replaceAll(list: any[]): Promise<{ list: any[] }> {
    await this.repo.delete({ role: Not('superadmin') });
    const filtered = list
      .filter(e => e.role !== 'superadmin')
      .map(e => ({
        ...e,
        isApproved: e.isApproved !== undefined ? e.isApproved : (e.role === 'ADMIN' ? false : true),
      }));
    const saved = await this.repo.save(filtered);
    return { list: saved.map(({ password, ...e }) => e as any) };
  }

  async upsertOne(emp: Partial<Employee> & { isApproved?: boolean }): Promise<Employee> {
    // New ADMIN accounts must wait for superadmin approval
    if (emp.isApproved === undefined && emp.role === 'ADMIN') {
      (emp as any).isApproved = false;
    }
    return this.repo.save(emp);
  }

  async setApproved(id: string, isApproved: boolean): Promise<void> {
    await this.repo.update(id, { isApproved });
  }

  async remove(id: string): Promise<void> {
    const emp = await this.repo.findOne({ where: { id } });
    if (!emp || emp.role === 'superadmin') return;
    await this.repo.delete(id);
  }
}
