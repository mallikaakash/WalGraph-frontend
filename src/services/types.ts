// Core Graph Database Types
export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  labels: string[];
  createdAt: number;
  updatedAt: number;
}

export interface GraphRelationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
  weight?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GraphSchema {
  nodeTypes: Record<string, { 
    requiredProperties: string[];
    optionalProperties: string[];
    indexes: string[];
  }>;
  relationshipTypes: Record<string, {
    allowedSourceTypes: string[];
    allowedTargetTypes: string[];
    requiredProperties: string[];
  }>;
}

export interface QueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  paths?: GraphPath[];
  aggregations?: Record<string, any>;
  executionTime: number;
  totalResults: number;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
  weight: number;
}

// Query Language Types
export interface MatchPattern {
  nodePattern?: {
    variable?: string;
    labels?: string[];
    properties?: Record<string, any>;
  };
  relationshipPattern?: {
    variable?: string;
    type?: string;
    direction?: 'in' | 'out' | 'both';
    properties?: Record<string, any>;
  };
}

export interface GraphQuery {
  match?: MatchPattern[];
  where?: WhereClause[];
  return?: ReturnClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  skip?: number;
}

export interface WhereClause {
  property: string;
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'IN' | 'NOT_IN';
  value: any;
}

export interface ReturnClause {
  variable: string;
  aggregation?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COLLECT';
  property?: string;
  alias?: string;
}

export interface OrderByClause {
  property: string;
  direction: 'ASC' | 'DESC';
}

// Walrus Types
export interface WalrusConfig {
  publisherUrl: string;
  aggregatorUrl: string;
  network: 'mainnet' | 'testnet';
}

export interface WalrusStorageResult {
  blobId: string;
  size: number;
  timestamp: number;
}

// SUI Types
export interface GraphMetadata {
  id: string;
  name: string;
  description: string;
  blobId: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  relationshipCount: number;
  isPublic: boolean;
  tags: string[];
  version: number;
}

// JSON-LD Types
export interface JsonLdContext {
  "@context": Record<string, any>;
}

export interface JsonLdGraphData extends JsonLdContext {
  "@type": "Graph";
  nodes: JsonLdNode[];
  relationships: JsonLdRelationship[];
  metadata?: {
    name: string;
    description: string;
    createdAt: number;
    version: number;
  };
}

export interface JsonLdNode {
  "@type": "Node";
  "@id": string;
  nodeType: string;
  labels: string[];
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface JsonLdRelationship {
  "@type": "Relationship";
  "@id": string;
  relationType: string;
  source: string;
  target: string;
  properties: Record<string, any>;
  weight?: number;
  createdAt: number;
  updatedAt: number;
}

// Graph Statistics
export interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
  nodeTypes: string[];
  relationshipTypes: string[];
  connectedComponents: number;
  averageDegree: number;
  density: number;
  diameter?: number;
  clustering?: number;
}

// Graph Algorithms
export interface TraversalOptions {
  maxDepth?: number;
  direction?: 'in' | 'out' | 'both';
  relationshipTypes?: string[];
  nodeTypes?: string[];
}

export interface CentralityMeasure {
  nodeId: string;
  degree: number;
  betweenness?: number;
  closeness?: number;
  pagerank?: number;
}

// Error Types
export interface GraphError {
  code: string;
  message: string;
  details?: any;
}

export class GraphValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'GraphValidationError';
  }
}

export class QueryParseError extends Error {
  constructor(message: string, public query?: string, public position?: number) {
    super(message);
    this.name = 'QueryParseError';
  }
}

export class StorageError extends Error {
  constructor(message: string, public operation?: string, public details?: any) {
    super(message);
    this.name = 'StorageError';
  }
} 