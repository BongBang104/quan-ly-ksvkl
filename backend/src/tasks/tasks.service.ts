import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Task }             from './task.entity';
import { sanitizePlain, sanitize } from '../common/sanitize.util';

const DEFAULT_TEAM = 'ALL';

// Fields stored directly on the entity
const ENTITY_FIELDS = new Set(['id', 'team', 'title', 'description', 'priority', 'status',
  'assignedTo', 'dueDate', 'createdBy', 'targetEmpIds', 'comments', 'acknowledgments',
  'visibility']);

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly repo: Repository<Task>,
  ) {}

  async findAll(): Promise<{ list: any[] }> {
    const list = await this.repo.find({ order: { createdAt: 'DESC' } });
    return { list: list.map(t => this.toFrontend(t)) };
  }

  async findByTeam(team?: string, requesterId?: string, requesterRole?: string): Promise<{ list: any[] }> {
    const all = await this.repo.find({ order: { createdAt: 'DESC' } });
    const visible = all.filter(task => {
      const v = (task as any).visibility ?? 'team';
      if (v === 'unit') return true;
      if (v === 'private') {
        return task.createdBy === requesterId ||
               (task.targetEmpIds || []).includes(requesterId);
      }
      // v === 'team' (default): cùng team với tác giả hoặc là người được chỉ định
      if (!team) return true;
      return task.team === team ||
             task.team === 'ALL' ||
             task.createdBy === requesterId ||
             (task.targetEmpIds || []).includes(requesterId);
    });
    return { list: visible.map(t => this.toFrontend(t)) };
  }

  async replaceByTeam(team: string, list: any[]): Promise<{ list: any[] }> {
    const t = team || DEFAULT_TEAM;
    await this.repo.delete({ team: t });
    const saved = await this.repo.save(list.map(raw => this.toEntity(raw, t)));
    return { list: saved.map(t => this.toFrontend(t)) };
  }

  async upsertOne(raw: any): Promise<any> {
    const saved = await this.repo.save(this.toEntity(raw, raw.team || DEFAULT_TEAM));
    return this.toFrontend(saved);
  }

  async remove(id: string, team?: string): Promise<void> {
    await this.repo.delete({ id, team: team || DEFAULT_TEAM });
  }

  private toEntity(raw: any, team: string): Partial<Task> {
    const extraData: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!ENTITY_FIELDS.has(k) && k !== 'createdAt' && k !== 'updatedAt') {
        extraData[k] = v;
      }
    }
    return {
      id:             raw.id,
      team,
      title:          sanitizePlain(raw.title),
      description:    sanitize(raw.description ?? raw.content),
      priority:       raw.priority ?? 'normal',
      status:         raw.status ?? 'PUBLISHED',
      assignedTo:     raw.assignedTo,
      dueDate:        raw.dueDate ?? raw.deadlineDate ?? raw.date,
      createdBy:      raw.createdBy ?? raw.authorId,
      visibility:     raw.visibility ?? 'team',
      targetEmpIds:   raw.targetEmpIds ?? [],
      comments:       raw.comments ?? [],
      acknowledgments: raw.acknowledgments ?? [],
      extraData,
    };
  }

  private toFrontend(row: Task): any {
    const extra = row.extraData ?? {};
    return {
      id:             row.id,
      team:           row.team,
      title:          row.title,
      description:    row.description,
      content:        extra.content ?? row.description,
      priority:       row.priority,
      status:         row.status,
      assignedTo:     row.assignedTo,
      dueDate:        row.dueDate,
      date:           extra.date ?? row.dueDate,
      deadlineDate:   extra.deadlineDate ?? row.dueDate,
      deadlineTime:   extra.deadlineTime,
      createdBy:      row.createdBy,
      visibility:     (row as any).visibility ?? 'team',
      authorId:       extra.authorId ?? row.createdBy,
      authorName:     extra.authorName,
      authorRole:     extra.authorRole,
      author:         extra.author ?? extra.authorName,
      targetEmpIds:   row.targetEmpIds,
      comments:       row.comments,
      acknowledgments: row.acknowledgments,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
      ...extra,
    };
  }
}
