import type { WorkflowRepository } from "./workflow-repository.js";
import type { WorkflowResource } from "./workflow-types.js";

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  categories() { return this.repository.categories(); }
  createCategory(name: string) { return this.repository.createCategory(name); }
  categoryDetails() { return this.repository.categoryDetails(); }
  updateCategory(name: string, patch: { name?: string; owner?: string }) { return this.repository.updateCategory(name, patch); }
  importMapping(input: unknown) { return this.repository.importMapping(input); }
  async batchLeads(ids: string[], patch: Record<string, unknown>) {
    const results = [];
    for (const id of ids) {
      try { results.push({ id, success: !!(await this.repository.update("leads", id, patch)) }); }
      catch { results.push({ id, success: false }); }
    }
    return { results, succeeded: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length };
  }
  list(resource: WorkflowResource, query: Parameters<WorkflowRepository["list"]>[1]) { return this.repository.list(resource, query); }
  get(resource: WorkflowResource, id: string) { return this.repository.get(resource, id); }
  create(resource: WorkflowResource, input: Record<string, unknown>) { return this.repository.create(resource, input); }

  async update(resource: WorkflowResource, id: string, patch: Record<string, unknown>) {
    if (resource === "talents" && !(await this.repository.categories()).includes(patch.category as string)) {
      return { status: "invalid-category" as const };
    }
    try {
      const item = await this.repository.update(resource, id, patch);
      return item ? { status: "ok" as const, item } : { status: "not-found" as const };
    } catch (error) {
      if (resource === "talents" && prismaCode(error) === "P2003") return { status: "invalid-category" as const };
      throw error;
    }
  }
}

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
}
