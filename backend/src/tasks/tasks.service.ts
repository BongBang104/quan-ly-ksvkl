import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Task }             from './task.entity';

const DEFAULT_TEAM = 'ALL';

// Fields stored directly on the entity
const ENTITY_FIELDS = new Set(['id', 'team', 'title', 'description', 'priority', 'status',
  'assignedTo', 'dueDate', 'createdBy', 'targetEmpIds', 'comments', 'acknowledgments']);

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

  async findByTeam(team?: string): Promise<{ list: any[] }> {
    if (!team) return this.findAll();
    const list = await this.repo.find({ where: { team }, order: { createdAt: 'DESC' } });
    return { list: list.map(t => this.toFrontend(t)) };
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
      title:          raw.title,
      description:    raw.description ?? raw.content,
      priority:       raw.priority ?? 'normal',
      status:         raw.status ?? 'PUBLISHED',
      assignedTo:     raw.assignedTo,
      dueDate:        raw.dueDate ?? raw.deadlineDate ?? raw.date,
      createdBy:      raw.createdBy ?? raw.authorId,
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
