import { leaderDetailResponseSchema, organizationDetailResponseSchema, organizationsResponseSchema, reviewEvidenceRequestSchema } from "@hr-console/contracts";
import type { OrganizationDetailResponse, OrganizationEvidenceStatus, OrganizationUnit } from "@hr-console/contracts";

export type OrganizationList = { items: OrganizationUnit[]; total: number; page: number; pageSize: number; requestId: string };

export async function getOrganizations(signal?: AbortSignal): Promise<OrganizationList> {
  const response = await fetch("/api/v1/organizations?page=1&pageSize=100", signal ? { signal } : {});
  if (!response.ok) throw new Error(`Organization request failed (${response.status})`);
  return organizationsResponseSchema.parse(await response.json());
}

export async function getOrganization(id: string, signal?: AbortSignal): Promise<OrganizationDetailResponse> {
  const response = await fetch(`/api/v1/organizations/${encodeURIComponent(id)}`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Organization detail request failed (${response.status})`);
  return organizationDetailResponseSchema.parse(await response.json());
}

export async function getLeader(id: string, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/leaders/${encodeURIComponent(id)}`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Leader detail request failed (${response.status})`);
  return leaderDetailResponseSchema.parse(await response.json());
}

export async function reviewOrganizationEvidence(id: string, status: OrganizationEvidenceStatus): Promise<void> {
  const body = reviewEvidenceRequestSchema.parse({ status });
  const response = await fetch(`/api/v1/organizations/evidence/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Evidence review failed (${response.status})`);
}
