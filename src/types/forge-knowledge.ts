export type ForgeKnowledgeCategory =
  | "layout"
  | "navigation"
  | "feature"
  | "workflow"
  | "shortcuts"
  | "settings"
  | "agents"
  | "tools";

export interface KnowledgeEmbedding {
  values: number[];
  model: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: ForgeKnowledgeCategory;
  content: string;
  tags: string[];
  relatedFeatures: string[];
  lastUpdated: number;
  searchableEmbedding: KnowledgeEmbedding;
}

export interface FeatureReference {
  featureId: string;
  featureName: string;
  description: string;
  uiLocation: string;
  actions: string[];
  shortcuts: string[];
  relatedFeatures: string[];
}

export interface ForgeKnowledgeBase {
  version: string;
  generatedAt: number;
  sections: string[];
  documents: KnowledgeDocument[];
  features: FeatureReference[];
}

export interface ForgeKnowledgeHit {
  document: KnowledgeDocument;
  score: number;
  matchedTerms: string[];
}
