import type { PrismaClient } from "../generated/client/index.js";
import { leadCreateSchema, leadUpdateSchema, mappingImportSchema, mappingUpdateSchema, outreachCreateSchema, outreachUpdateSchema, researchTaskCreateSchema, researchTaskUpdateSchema, talentUpdateSchema, type OperationListQuery } from "@hr-console/contracts";
import type { WorkflowResource } from "./workflow-types.js";
import { seed } from "./extra-operations.js";

export type RecordItem = Record<string, unknown> & { id: string; updatedAt: string };
export interface WorkflowRepository {
  categories(): Promise<string[]>;
  createCategory(name: string): Promise<boolean>;
  categoryDetails(): Promise<Array<{ name: string; owner: string; count: number }>>;
  updateCategory(name: string, patch: { name?: string; owner?: string }): Promise<"ok" | "not-found" | "conflict">;
  importMapping(input: unknown): Promise<number>;
  list(resource: WorkflowResource, query: OperationListQuery): Promise<{ items: RecordItem[]; total: number }>;
  get(resource: WorkflowResource, id: string): Promise<RecordItem | null>;
  update(resource: WorkflowResource, id: string, patch: Record<string, unknown>): Promise<RecordItem | null>;
  create(resource: WorkflowResource, input: Record<string, unknown>): Promise<RecordItem>;
}

function serialize(item: object | null): RecordItem | null {
  if (!item) return null;
  return { ...item, updatedAt: (item as { updatedAt: Date }).updatedAt.toISOString() } as RecordItem;
}

export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async categories(): Promise<string[]> {
    return (await this.prisma.talentCategory.findMany({ orderBy: { name: "asc" } })).map(({ name }) => name);
  }

  async createCategory(name: string): Promise<boolean> {
    try { await this.prisma.talentCategory.create({ data: { name } }); return true; }
    catch (error) { if (prismaCode(error) === "P2002") return false; throw error; }
  }

  async list(resource: WorkflowResource, query: OperationListQuery): Promise<{ items: RecordItem[]; total: number }> {
    const paging = { orderBy: [{ updatedAt: "desc" as const }, { id: "asc" as const }], skip: (query.page - 1) * query.pageSize, take: query.pageSize };
    const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
    if (resource === "leads") {
      const where = { ...(query.filter ? { stage: query.filter } : {}), ...(query.q ? { OR: [{ subject: contains(query.q) }, { company: contains(query.q) }, { source: contains(query.q) }, { summary: contains(query.q) }] } : {}) };
      const [items, total] = await Promise.all([this.prisma.lead.findMany({ where, ...paging }), this.prisma.lead.count({ where })]);
      return { items: items.map((item) => serialize(item)!), total };
    }
    if (resource === "talents") {
      const where = { ...(query.filter ? { category: query.filter } : {}), ...(query.location ? { location: contains(query.location) } : {}), ...(query.tag ? { tags: { has: query.tag } } : {}), ...(query.q ? { OR: [{ name: contains(query.q) }, { title: contains(query.q) }, { company: contains(query.q) }, { location: contains(query.q) }, { tags: { has: query.q } }] } : {}) };
      const [items, total] = await Promise.all([this.prisma.talent.findMany({ where, ...paging }), this.prisma.talent.count({ where })]);
      return { items: items.map((item) => serialize(item)!), total };
    }
    if (resource === "research-tasks") {
      const where = { ...(query.filter ? { status: query.filter } : {}), ...(query.q ? { OR: [{ name: contains(query.q) }, { owner: contains(query.q) }, { target: contains(query.q) }, { summary: contains(query.q) }] } : {}) };
      const [items, total] = await Promise.all([this.prisma.researchTask.findMany({ where, ...paging }), this.prisma.researchTask.count({ where })]);
      return { items: items.map((item) => serialize(item)!), total };
    }
    if (resource === "outreach") {
      const where = { ...(query.filter ? { status: query.filter } : {}), ...(query.channel ? { channel: query.channel } : {}), ...(query.q ? { OR: [{ name: contains(query.q) }, { channel: contains(query.q) }, { summary: contains(query.q) }] } : {}) };
      const [items, total] = await Promise.all([this.prisma.outreachCampaign.findMany({ where, ...paging }), this.prisma.outreachCampaign.count({ where })]);
      return { items: items.map((item) => serialize(item)!), total };
    }
    const where = { ...(query.filter ? { type: query.filter } : {}), ...(query.q ? { OR: [{ source: contains(query.q) }, { target: contains(query.q) }, { summary: contains(query.q) }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.mappingItem.findMany({ where, ...paging }), this.prisma.mappingItem.count({ where })]);
    return { items: items.map((item) => serialize(item)!), total };
  }

  async get(resource: WorkflowResource, id: string): Promise<RecordItem | null> {
    const where = { id };
    const value = resource === "leads" ? await this.prisma.lead.findUnique({ where })
      : resource === "talents" ? await this.prisma.talent.findUnique({ where })
      : resource === "research-tasks" ? await this.prisma.researchTask.findUnique({ where })
      : resource === "outreach" ? await this.prisma.outreachCampaign.findUnique({ where })
      : await this.prisma.mappingItem.findUnique({ where });
    return serialize(value);
  }

  async update(resource: WorkflowResource, id: string, patch: Record<string, unknown>): Promise<RecordItem | null> {
    const where = { id };
    try {
    const item = resource === "leads" ? await this.prisma.lead.update({ where, data: { ...Object.fromEntries(Object.entries(leadUpdateSchema.parse(patch)).filter(([, value]) => value !== undefined)) } })
      : resource === "talents" ? await this.prisma.talent.update({ where, data: talentUpdateSchema.parse(patch) })
      : resource === "research-tasks" ? await this.prisma.researchTask.update({ where, data: { ...Object.fromEntries(Object.entries(researchTaskUpdateSchema.parse(patch)).filter(([, value]) => value !== undefined)) } })
      : resource === "outreach" ? await this.prisma.outreachCampaign.update({ where, data: { ...Object.fromEntries(Object.entries(outreachUpdateSchema.parse(patch)).filter(([, value]) => value !== undefined)) } })
      : await this.prisma.mappingItem.update({ where, data: { ...Object.fromEntries(Object.entries(mappingUpdateSchema.parse(patch)).filter(([, value]) => value !== undefined)) } });
    return serialize(item);
    } catch (error) {
      if (prismaCode(error) === "P2025") return null;
      throw error;
    }
  }

  async create(resource: WorkflowResource, input: Record<string, unknown>): Promise<RecordItem> {
    const id = `${resource.slice(0, 4)}-${crypto.randomUUID().slice(0, 8)}`;
    if (resource !== "leads" && resource !== "research-tasks" && resource !== "outreach") throw new Error("Unsupported creation resource");
    const value = resource === "leads" ? await this.prisma.lead.create({ data: { id, ...leadCreateSchema.parse(input) } })
      : resource === "research-tasks" ? await this.prisma.researchTask.create({ data: { id, ...researchTaskCreateSchema.parse(input) } })
      : await this.prisma.outreachCampaign.create({ data: { id, ...outreachCreateSchema.parse(input) } });
    return serialize(value)!;
  }

  async categoryDetails() {
    return (await this.prisma.talentCategory.findMany({ include: { _count: { select: { talents: true } } }, orderBy: { name: "asc" } })).map(({ name, owner, _count }) => ({ name, owner, count: _count.talents }));
  }
  async updateCategory(name: string, patch: { name?: string; owner?: string }): Promise<"ok" | "not-found" | "conflict"> {
    try { await this.prisma.talentCategory.update({ where: { name }, data: patch }); return "ok"; }
    catch (error) { if (prismaCode(error) === "P2025") return "not-found"; if (prismaCode(error) === "P2002") return "conflict"; throw error; }
  }
  async importMapping(input: unknown) {
    const { items } = mappingImportSchema.parse(input);
    await this.prisma.$transaction(items.map((item) => this.prisma.mappingItem.create({ data: { ...item, id: `map-${crypto.randomUUID()}` } })));
    return items.length;
  }
}

export function createMemoryWorkflowRepository(): WorkflowRepository {
  const records = structuredClone(seed) as unknown as Record<WorkflowResource, RecordItem[]>;
  const categories = new Set(["未分类", "技术", "产品", "商业化"]);
  const owners = new Map<string, string>();
  return {
    async categories() { return [...categories].sort(); },
    async createCategory(name) { if (categories.has(name)) return false; categories.add(name); return true; },
    async categoryDetails() { return [...categories].sort().map((name) => ({ name, owner: owners.get(name) ?? "未分配", count: records.talents.filter((item) => item.category === name).length })); },
    async updateCategory(name, patch) {
      if (!categories.has(name)) return "not-found";
      const next = patch.name ?? name;
      if (next !== name && categories.has(next)) return "conflict";
      if (next !== name) { categories.delete(name); categories.add(next); records.talents.forEach((item) => { if (item.category === name) item.category = next; }); }
      owners.set(next, patch.owner ?? owners.get(name) ?? "未分配");
      if (next !== name) owners.delete(name);
      return "ok";
    },
    async importMapping(input) { const { items } = mappingImportSchema.parse(input); records.mapping.unshift(...items.map((item) => ({ ...item, id: `map-${crypto.randomUUID()}`, updatedAt: new Date().toISOString() }))); return items.length; },
    async list(resource, query) {
      const filtered = records[resource].filter((item) => {
        const text = searchFields[resource].map((field) => String(item[field] ?? "")).join(" ").toLowerCase();
        const tagMatch = resource === "talents" && !!query.q && Array.isArray(item.tags) && item.tags.includes(query.q);
        return (!query.q || text.includes(query.q.toLowerCase()) || tagMatch) && (!query.filter || String(item[filterFields[resource]]) === query.filter)
          && (!query.location || String(item.location).toLowerCase().includes(query.location.toLowerCase()))
          && (!query.tag || Array.isArray(item.tags) && item.tags.includes(query.tag))
          && (!query.channel || item.channel === query.channel);
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((item) => ({ ...item })), total: filtered.length };
    },
    async get(resource, id) { return records[resource].find((item) => item.id === id) ?? null; },
    async update(resource, id, patch) {
      const item = records[resource].find((entry) => entry.id === id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
      return { ...item };
    },
    async create(resource, input) {
      const item = { id: `${resource}-${records[resource].length + 1}`, updatedAt: new Date().toISOString(), ...input } as RecordItem;
      records[resource].unshift(item); return { ...item };
    }
  };
}

const filterFields: Record<WorkflowResource, string> = { leads: "stage", talents: "category", "research-tasks": "status", outreach: "status", mapping: "type" };
const searchFields: Record<WorkflowResource, string[]> = { leads: ["subject", "company", "source", "summary"], talents: ["name", "title", "company", "location"], "research-tasks": ["name", "owner", "target", "summary"], outreach: ["name", "channel", "summary"], mapping: ["source", "target", "summary"] };

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
}
