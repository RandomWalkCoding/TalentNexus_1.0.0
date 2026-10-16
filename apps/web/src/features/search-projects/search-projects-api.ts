import { searchProjectDetailSchema, searchProjectListResponseSchema, searchProjectCandidateUpdateSchema } from "@hr-console/contracts";
import type { CandidateProjectStage, SearchProjectDetail } from "@hr-console/contracts";

export async function getSearchProjects(signal?: AbortSignal) {
  const response = await fetch("/api/v1/search-projects?page=1&pageSize=50", signal ? { signal } : {});
  if (!response.ok) throw new Error(`Search project request failed (${response.status})`);
  return searchProjectListResponseSchema.parse(await response.json());
}

export async function getSearchProject(id: string, signal?: AbortSignal): Promise<SearchProjectDetail> {
  const response = await fetch(`/api/v1/search-projects/${encodeURIComponent(id)}`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Search project detail request failed (${response.status})`);
  return searchProjectDetailSchema.parse(await response.json());
}

export async function updateCandidateStage(projectId: string, candidateId: string, stage: CandidateProjectStage): Promise<void> {
  const body = searchProjectCandidateUpdateSchema.parse({ stage });
  const response = await fetch(`/api/v1/search-projects/${projectId}/candidates/${candidateId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Candidate update failed (${response.status})`);
}
