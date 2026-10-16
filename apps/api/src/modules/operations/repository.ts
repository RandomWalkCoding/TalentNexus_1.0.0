import type {
  Competitor,
  CompetitorDetailResponse,
  CompetitorListQuery,
  CompetitorListResponse,
  IntelligenceItem,
  IntelligenceListQuery,
  IntelligenceListResponse
} from "@hr-console/contracts";

export type IntelligencePage = Omit<IntelligenceListResponse, "requestId">;
export type CompetitorPage = Omit<CompetitorListResponse, "requestId">;

export interface OperationsRepository {
  listIntelligence(query: IntelligenceListQuery): Promise<IntelligencePage>;
  getIntelligence(id: string): Promise<IntelligenceItem | null>;
  listCompetitors(query: CompetitorListQuery): Promise<CompetitorPage>;
  getCompetitor(id: string): Promise<CompetitorDetailResponse | null>;
  setCompetitorMonitoring(id: string, monitored: boolean): Promise<Competitor | null>;
}
