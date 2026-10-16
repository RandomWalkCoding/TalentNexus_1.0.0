import type {
  Competitor,
  CompetitorDetailResponse,
  CompetitorListQuery,
  IntelligenceItem,
  IntelligenceListQuery
} from "@hr-console/contracts";

import type { CompetitorPage, IntelligencePage, OperationsRepository } from "./repository.js";

export class OperationsService {
  constructor(private readonly repository: OperationsRepository) {}

  listIntelligence(query: IntelligenceListQuery): Promise<IntelligencePage> {
    return this.repository.listIntelligence(query);
  }

  getIntelligence(id: string): Promise<IntelligenceItem | null> {
    return this.repository.getIntelligence(id);
  }

  listCompetitors(query: CompetitorListQuery): Promise<CompetitorPage> {
    return this.repository.listCompetitors(query);
  }

  getCompetitor(id: string): Promise<CompetitorDetailResponse | null> {
    return this.repository.getCompetitor(id);
  }

  setCompetitorMonitoring(id: string, monitored: boolean): Promise<Competitor | null> {
    return this.repository.setCompetitorMonitoring(id, monitored);
  }
}
