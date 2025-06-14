import { v4 as uuidv4 } from 'uuid';
import { 
  GraphNode, 
  GraphRelationship, 
  GraphQuery, 
  QueryResult, 
  GraphStats,
  TraversalOptions,
  CentralityMeasure,
  GraphPath,
  MatchPattern,
  WhereClause,
  OrderByClause,
  GraphValidationError,
  QueryParseError,
  StorageError
} from './types';
import { WalrusService } from './walrus-service';
import { SuiGraphService } from './sui-service';

type PropertyValue = string | number | boolean | object;
// Import the types from sui-service to ensure compatibility
type SignAndExecuteFunction = (params: unknown) => Promise<unknown>;

export class CompleteGraphService {
  private walrusService: WalrusService;
  private suiService: SuiGraphService;
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: Map<string, GraphRelationship> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();
  private nodesByType: Map<string, Set<string>> = new Map();
  private relationshipsByType: Map<string, Set<string>> = new Map();
  private propertyIndexes: Map<string, Map<PropertyValue, Set<string>>> = new Map();

  constructor() {
    this.walrusService = new WalrusService();
    this.suiService = new SuiGraphService();
  }

  // ==========================
  // INITIALIZATION & SETUP
  // ==========================

  setContractAddresses(packageId: string, registryId: string) {
    this.suiService.setContractAddresses(packageId, registryId);
  }

  // ==========================
  // CRUD OPERATIONS - NODES
  // ==========================

  /**
   * Create a new node with validation
   */
  createNode(type: string, properties: Record<string, unknown> = {}, labels: string[] = []): string {
    const id = `node_${uuidv4()}`;
    const now = Date.now();
    
    // Validate input
    if (!type || type.trim() === '') {
      throw new GraphValidationError('Node type cannot be empty');
    }

    const node: GraphNode = {
      id,
      type: type.trim(),
      properties: { ...properties },
      labels: [...new Set(labels)], // Remove duplicates
      createdAt: now,
      updatedAt: now
    };

    // Add to main storage
    this.nodes.set(id, node);
    
    // Update indexes
    this.updateNodeIndexes(node);
    
    console.log(`✅ Created node: ${id} (${type})`);
    return id;
  }

  /**
   * Read/Get a node by ID
   */
  getNode(id: string): GraphNode | null {
    return this.nodes.get(id) || null;
  }

  /**
   * Update node properties
   */
  updateNode(id: string, updates: {
    type?: string;
    properties?: Record<string, unknown>;
    labels?: string[];
  }): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from old indexes
    this.removeNodeFromIndexes(node);

    // Apply updates
    if (updates.type) node.type = updates.type.trim();
    if (updates.properties) node.properties = { ...node.properties, ...updates.properties };
    if (updates.labels) node.labels = [...new Set(updates.labels)];
    node.updatedAt = Date.now();

    // Update indexes
    this.updateNodeIndexes(node);
    
    console.log(`✅ Updated node: ${id}`);
    return true;
  }

  /**
   * Delete a node and all its relationships
   */
  deleteNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Delete all relationships connected to this node
    const connectedRels = this.getNodeRelationships(id);
    connectedRels.forEach(rel => this.deleteRelationship(rel.id));

    // Remove from indexes
    this.removeNodeFromIndexes(node);
    
    // Remove from main storage
    this.nodes.delete(id);
    
    console.log(`✅ Deleted node: ${id}`);
    return true;
  }

  // ==========================
  // CRUD OPERATIONS - RELATIONSHIPS
  // ==========================

  /**
   * Create a new relationship
   */
  createRelationship(
    type: string,
    sourceId: string,
    targetId: string,
    properties: Record<string, unknown> = {},
    weight?: number
  ): string {
    // Validate nodes exist
    if (!this.nodes.has(sourceId)) {
      throw new GraphValidationError(`Source node ${sourceId} does not exist`);
    }
    if (!this.nodes.has(targetId)) {
      throw new GraphValidationError(`Target node ${targetId} does not exist`);
    }

    const id = `rel_${uuidv4()}`;
    const now = Date.now();

    const relationship: GraphRelationship = {
      id,
      type: type.trim(),
      sourceId,
      targetId,
      properties: { ...properties },
      weight,
      createdAt: now,
      updatedAt: now
    };

    // Add to main storage
    this.relationships.set(id, relationship);
    
    // Update indexes
    this.updateRelationshipIndexes(relationship);
    
    console.log(`✅ Created relationship: ${sourceId} -[${type}]-> ${targetId}`);
    return id;
  }

  /**
   * Get relationship by ID
   */
  getRelationship(id: string): GraphRelationship | null {
    return this.relationships.get(id) || null;
  }

  /**
   * Update relationship
   */
  updateRelationship(id: string, updates: {
    type?: string;
    properties?: Record<string, unknown>;
    weight?: number;
  }): boolean {
    const rel = this.relationships.get(id);
    if (!rel) return false;

    // Remove from old indexes
    this.removeRelationshipFromIndexes(rel);

    // Apply updates
    if (updates.type) rel.type = updates.type.trim();
    if (updates.properties) rel.properties = { ...rel.properties, ...updates.properties };
    if (updates.weight !== undefined) rel.weight = updates.weight;
    rel.updatedAt = Date.now();

    // Update indexes
    this.updateRelationshipIndexes(rel);
    
    console.log(`✅ Updated relationship: ${id}`);
    return true;
  }

  /**
   * Delete relationship
   */
  deleteRelationship(id: string): boolean {
    const rel = this.relationships.get(id);
    if (!rel) return false;

    // Remove from indexes
    this.removeRelationshipFromIndexes(rel);
    
    // Remove from main storage
    this.relationships.delete(id);
    
    console.log(`✅ Deleted relationship: ${id}`);
    return true;
  }

  // ==========================
  // QUERY SYSTEM
  // ==========================

  /**
   * Execute graph query (Cypher-like)
   */
  query(query: GraphQuery): QueryResult {
    const startTime = Date.now();
    let resultNodes: GraphNode[] = [];
    let resultRelationships: GraphRelationship[] = [];
    let resultPaths: GraphPath[] = [];

    try {
      // Start with all nodes if no match pattern
      let candidateNodes = Array.from(this.nodes.values());
      let candidateRelationships = Array.from(this.relationships.values());

      // Apply MATCH patterns
      if (query.match && query.match.length > 0) {
        const matchResult = this.processMatchPatterns(query.match);
        candidateNodes = matchResult.nodes;
        candidateRelationships = matchResult.relationships;
        resultPaths = matchResult.paths || [];
      }

      // Apply WHERE clauses
      if (query.where && query.where.length > 0) {
        candidateNodes = this.applyWhereClausesToNodes(candidateNodes, query.where);
        candidateRelationships = this.applyWhereClausesToRelationships(candidateRelationships, query.where);
      }

      // Apply ORDER BY
      if (query.orderBy && query.orderBy.length > 0) {
        candidateNodes = this.applyOrderBy(candidateNodes, query.orderBy);
      }

      // Apply SKIP and LIMIT
      if (query.skip || query.limit) {
        const skip = query.skip || 0;
        const limit = query.limit;
        candidateNodes = candidateNodes.slice(skip, limit ? skip + limit : undefined);
      }

      // Determine what to return
      if (query.return && query.return.length > 0) {
        const returnResult = this.processReturnClauses(candidateNodes, candidateRelationships);
        resultNodes = returnResult.nodes;
        resultRelationships = returnResult.relationships;
      } else {
        resultNodes = candidateNodes;
        resultRelationships = candidateRelationships;
      }

      const executionTime = Date.now() - startTime;
      
      return {
        nodes: resultNodes,
        relationships: resultRelationships,
        paths: resultPaths,
        executionTime,
        totalResults: resultNodes.length + resultRelationships.length
      };

    } catch (error) {
      throw new QueryParseError(`Query execution failed: ${error}`);
    }
  }

  /**
   * Find shortest path between two nodes
   */
  findShortestPath(sourceId: string, targetId: string, options?: TraversalOptions): GraphPath | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return null;
    }

    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[]; relationships: string[] }[] = [
      { nodeId: sourceId, path: [sourceId], relationships: [] }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.nodeId === targetId) {
        // Found target, construct path
        const pathNodes = current.path.map(id => this.nodes.get(id)!);
        const pathRels = current.relationships.map(id => this.relationships.get(id)!);
        
        return {
          nodes: pathNodes,
          relationships: pathRels,
          length: pathNodes.length - 1,
          weight: pathRels.reduce((sum, rel) => sum + (rel.weight || 1), 0)
        };
      }

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      // Get neighbors
      const neighbors = this.getNodeNeighbors(current.nodeId, options);
      
      for (const { nodeId, relationshipId } of neighbors) {
        if (!visited.has(nodeId)) {
          queue.push({
            nodeId,
            path: [...current.path, nodeId],
            relationships: [...current.relationships, relationshipId]
          });
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between two nodes (with max depth)
   */
  findAllPaths(sourceId: string, targetId: string, maxDepth: number = 5): GraphPath[] {
    const paths: GraphPath[] = [];
    
    const dfs = (
      currentId: string, 
      currentPath: string[], 
      currentRels: string[], 
      visited: Set<string>
    ) => {
      if (currentPath.length > maxDepth) return;
      
      if (currentId === targetId && currentPath.length > 1) {
        const pathNodes = currentPath.map(id => this.nodes.get(id)!);
        const pathRels = currentRels.map(id => this.relationships.get(id)!);
        
        paths.push({
          nodes: pathNodes,
          relationships: pathRels,
          length: pathNodes.length - 1,
          weight: pathRels.reduce((sum, rel) => sum + (rel.weight || 1), 0)
        });
        return;
      }

      const neighbors = this.getNodeNeighbors(currentId);
      
      for (const { nodeId, relationshipId } of neighbors) {
        if (!visited.has(nodeId)) {
          visited.add(nodeId);
          dfs(nodeId, [...currentPath, nodeId], [...currentRels, relationshipId], visited);
          visited.delete(nodeId);
        }
      }
    };

    const visited = new Set([sourceId]);
    dfs(sourceId, [sourceId], [], visited);
    
    return paths.sort((a, b) => a.length - b.length);
  }

  // ==========================
  // GRAPH ALGORITHMS
  // ==========================

  /**
   * Calculate degree centrality for all nodes
   */
  calculateDegreeCentrality(): CentralityMeasure[] {
    return Array.from(this.nodes.keys()).map(nodeId => {
      const degree = this.getNodeDegree(nodeId);
      return { nodeId, degree };
    }).sort((a, b) => b.degree - a.degree);
  }

  /**
   * Calculate PageRank (simplified implementation)
   */
  calculatePageRank(damping: number = 0.85, iterations: number = 100): CentralityMeasure[] {
    const nodes = Array.from(this.nodes.keys());
    const n = nodes.length;
    
    if (n === 0) return [];

    // Initialize PageRank values
    const pagerank = new Map<string, number>();
    nodes.forEach(nodeId => pagerank.set(nodeId, 1.0 / n));

    // Iterate
    for (let i = 0; i < iterations; i++) {
      const newPagerank = new Map<string, number>();
      
      nodes.forEach(nodeId => {
        let sum = 0;
        const incomingNeighbors = this.getNodeNeighbors(nodeId, { direction: 'in' });
        
        incomingNeighbors.forEach(({ nodeId: neighborId }) => {
          const neighborOutDegree = this.getNodeDegree(neighborId, 'out');
          if (neighborOutDegree > 0) {
            sum += pagerank.get(neighborId)! / neighborOutDegree;
          }
        });
        
        newPagerank.set(nodeId, (1 - damping) / n + damping * sum);
      });
      
      // Update PageRank values
      pagerank.clear();
      newPagerank.forEach((value, key) => pagerank.set(key, value));
    }

    return nodes.map(nodeId => ({
      nodeId,
      degree: this.getNodeDegree(nodeId),
      pagerank: pagerank.get(nodeId)!
    })).sort((a, b) => b.pagerank! - a.pagerank!);
  }

  /**
   * Find connected components
   */
  findConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        const component: string[] = [];
        this.dfsComponent(nodeId, visited, component);
        components.push(component);
      }
    }

    return components.sort((a, b) => b.length - a.length);
  }

  /**
   * Calculate graph statistics
   */
  getGraphStats(): GraphStats {
    const nodeCount = this.nodes.size;
    const relationshipCount = this.relationships.size;
    const nodeTypes = [...new Set(Array.from(this.nodes.values()).map(n => n.type))];
    const relationshipTypes = [...new Set(Array.from(this.relationships.values()).map(r => r.type))];
    const components = this.findConnectedComponents();
    
    let totalDegree = 0;
    this.nodes.forEach((_, nodeId) => {
      totalDegree += this.getNodeDegree(nodeId);
    });
    
    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? (relationshipCount * 2) / maxPossibleEdges : 0;

    return {
      nodeCount,
      relationshipCount,
      nodeTypes,
      relationshipTypes,
      connectedComponents: components.length,
      averageDegree: avgDegree,
      density
    };
  }

  // ==========================
  // PERSISTENCE & STORAGE
  // ==========================

  /**
   * Save graph to Walrus and create metadata on SUI
   */
  async saveGraph(
    metadata: {
      name: string;
      description: string;
      isPublic: boolean;
      tags: string[];
    },
    signAndExecute: SignAndExecuteFunction
  ): Promise<{ blobId: string; graphId: string }> {
    const graphData = {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
    };

    console.log('📡 Saving graph with metadata:', metadata);
    console.log('📊 Graph contains:', graphData.nodes.length, 'nodes and', graphData.relationships.length, 'relationships');

    // Store data to Walrus
    const walrusResult = await this.walrusService.storeGraph(
      graphData.nodes,
      graphData.relationships,
      {
        name: metadata.name,
        description: metadata.description,
      }
    );

    console.log('✅ Walrus storage result:', walrusResult);

    // Create metadata on SUI
    const graphId = await this.suiService.createGraphMetadata(
      {
        name: metadata.name,
        description: metadata.description,
        blobId: walrusResult.blobId,
        nodeCount: graphData.nodes.length,
        relationshipCount: graphData.relationships.length,
        isPublic: metadata.isPublic,
        tags: metadata.tags,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signAndExecute as any
    );

    console.log('✅ SUI metadata creation result:', graphId);

    return {
      blobId: walrusResult.blobId,
      graphId: graphId,
    };
  }

  /**
   * NEW: Save current graph as a new version of an existing graph
   */
  async createNewVersion(
    graphId: string,
    changes: string,
    signAndExecute: SignAndExecuteFunction
  ): Promise<{ blobId: string; version: number }> {
    const graphData = {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
    };

    console.log('📡 Saving new version for graph:', graphId);
    console.log('📊 Changes:', changes);
    console.log('📊 Graph contains:', graphData.nodes.length, 'nodes and', graphData.relationships.length, 'relationships');

    // Store new version data to Walrus
    const walrusResult = await this.walrusService.storeGraph(
      graphData.nodes,
      graphData.relationships,
      {
        name: `Version update`,
        description: changes,
      }
    );

    console.log('✅ Walrus storage result:', walrusResult);

    // Create new version on SUI
    const version = await this.suiService.createNewGraphVersion(
      graphId,
      {
        blobId: walrusResult.blobId,
        nodeCount: graphData.nodes.length,
        relationshipCount: graphData.relationships.length,
        changes,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signAndExecute as any
    );

    console.log('✅ SUI version creation result:', version);

    return {
      blobId: walrusResult.blobId,
      version: version,
    };
  }

  /**
   * NEW: Switch to a different version of the graph
   */
  async switchToVersion(
    graphId: string,
    targetVersion: number,
    signAndExecute: SignAndExecuteFunction
  ): Promise<void> {
    console.log('📡 Switching to version:', targetVersion, 'for graph:', graphId);

    // Switch version on SUI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.suiService.switchToGraphVersion(graphId, targetVersion, signAndExecute as any);

    // Reload graph data from the new version
    const metadata = await this.suiService.getGraphMetadata(graphId);
    if (metadata) {
      await this.loadGraph(metadata.blobId);
    }

    console.log('✅ Successfully switched to version:', targetVersion);
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    // This is a simple check - in a real implementation you might want to 
    // calculate a hash of current data and compare with saved state
    return this.nodes.size > 0 || this.relationships.size > 0;
  }

  /**
   * Get a summary of the current graph state
   */
  getGraphStateSummary(): { nodeCount: number; relationshipCount: number; lastModified: number } {
    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.size,
      lastModified: Date.now(),
    };
  }

  /**
   * Load graph from Walrus
   */
  async loadGraph(blobId: string): Promise<void> {
    try {
      console.log('📖 Loading graph from Walrus...');
      
      const { nodes, relationships } = await this.walrusService.readGraph(blobId);
      
      // Clear current graph
      this.clearGraph();
      
      // Load nodes
      nodes.forEach(node => {
        this.nodes.set(node.id, node);
        this.updateNodeIndexes(node);
      });
      
      // Load relationships
      relationships.forEach(rel => {
        this.relationships.set(rel.id, rel);
        this.updateRelationshipIndexes(rel);
      });

      console.log(`✅ Loaded ${nodes.length} nodes and ${relationships.length} relationships`);

    } catch (error) {
      console.error('❌ Error loading graph:', error);
      throw new StorageError('Failed to load graph', 'load', error);
    }
  }

  // ==========================
  // SEARCH & FILTERING
  // ==========================

  /**
   * Search nodes by property values
   */
  searchNodes(criteria: {
    type?: string;
    labels?: string[];
    properties?: Record<string, unknown>;
    textSearch?: string;
  }): GraphNode[] {
    let candidates = Array.from(this.nodes.values());

    // Filter by type
    if (criteria.type) {
      candidates = candidates.filter(node => node.type === criteria.type);
    }

    // Filter by labels
    if (criteria.labels && criteria.labels.length > 0) {
      candidates = candidates.filter(node => 
        criteria.labels!.every(label => node.labels.includes(label))
      );
    }

    // Filter by properties
    if (criteria.properties) {
      candidates = candidates.filter(node => {
        return Object.entries(criteria.properties!).every(([key, value]) => {
          return node.properties[key] === value;
        });
      });
    }

    // Text search across all properties
    if (criteria.textSearch) {
      const searchTerm = criteria.textSearch.toLowerCase();
      candidates = candidates.filter(node => {
        const searchableText = [
          node.type,
          ...node.labels,
          ...Object.values(node.properties).map(v => String(v))
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchTerm);
      });
    }

    return candidates;
  }

  /**
   * Get all nodes and relationships for visualization
   */
  getAllData(): { nodes: GraphNode[]; relationships: GraphRelationship[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values())
    };
  }

  /**
   * Clear all graph data
   */
  clearGraph(): void {
    this.nodes.clear();
    this.relationships.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.nodesByType.clear();
    this.relationshipsByType.clear();
    this.propertyIndexes.clear();
    
    console.log('✅ Graph cleared');
  }

  // ==========================
  // PRIVATE HELPER METHODS
  // ==========================

  private updateNodeIndexes(node: GraphNode): void {
    // Update type index
    if (!this.nodesByType.has(node.type)) {
      this.nodesByType.set(node.type, new Set());
    }
    this.nodesByType.get(node.type)!.add(node.id);

    // Update property indexes (for common searchable properties)
    const indexableProps = ['name', 'title', 'email', 'status'];
    indexableProps.forEach(prop => {
      if (node.properties[prop] !== undefined && node.properties[prop] !== null) {
        if (!this.propertyIndexes.has(prop)) {
          this.propertyIndexes.set(prop, new Map());
        }
        const propIndex = this.propertyIndexes.get(prop)!;
        const value = node.properties[prop] as PropertyValue; // Safe cast after null check
        if (!propIndex.has(value)) {
          propIndex.set(value, new Set());
        }
        propIndex.get(value)!.add(node.id);
      }
    });
  }

  private removeNodeFromIndexes(node: GraphNode): void {
    // Remove from type index
    this.nodesByType.get(node.type)?.delete(node.id);
    
    // Remove from property indexes
    this.propertyIndexes.forEach(propIndex => {
      propIndex.forEach(nodeSet => {
        nodeSet.delete(node.id);
      });
    });
  }

  private updateRelationshipIndexes(rel: GraphRelationship): void {
    // Update type index
    if (!this.relationshipsByType.has(rel.type)) {
      this.relationshipsByType.set(rel.type, new Set());
    }
    this.relationshipsByType.get(rel.type)!.add(rel.id);

    // Update adjacency lists
    if (!this.adjacencyList.has(rel.sourceId)) {
      this.adjacencyList.set(rel.sourceId, new Set());
    }
    this.adjacencyList.get(rel.sourceId)!.add(rel.targetId);

    if (!this.reverseAdjacencyList.has(rel.targetId)) {
      this.reverseAdjacencyList.set(rel.targetId, new Set());
    }
    this.reverseAdjacencyList.get(rel.targetId)!.add(rel.sourceId);
  }

  private removeRelationshipFromIndexes(rel: GraphRelationship): void {
    // Remove from type index
    this.relationshipsByType.get(rel.type)?.delete(rel.id);
    
    // Remove from adjacency lists
    this.adjacencyList.get(rel.sourceId)?.delete(rel.targetId);
    this.reverseAdjacencyList.get(rel.targetId)?.delete(rel.sourceId);
  }

  private getNodeRelationships(nodeId: string): GraphRelationship[] {
    return Array.from(this.relationships.values()).filter(rel => 
      rel.sourceId === nodeId || rel.targetId === nodeId
    );
  }

  private getNodeNeighbors(
    nodeId: string, 
    options?: TraversalOptions
  ): { nodeId: string; relationshipId: string }[] {
    const neighbors: { nodeId: string; relationshipId: string }[] = [];
    const direction = options?.direction || 'both';

    this.relationships.forEach(rel => {
      let isValidDirection = false;
      let neighborId = '';

      if ((direction === 'out' || direction === 'both') && rel.sourceId === nodeId) {
        isValidDirection = true;
        neighborId = rel.targetId;
      } else if ((direction === 'in' || direction === 'both') && rel.targetId === nodeId) {
        isValidDirection = true;
        neighborId = rel.sourceId;
      }

      if (isValidDirection) {
        // Apply filters
        if (options?.relationshipTypes && !options.relationshipTypes.includes(rel.type)) {
          return;
        }

        const neighborNode = this.nodes.get(neighborId);
        if (options?.nodeTypes && neighborNode && !options.nodeTypes.includes(neighborNode.type)) {
          return;
        }

        neighbors.push({ nodeId: neighborId, relationshipId: rel.id });
      }
    });

    return neighbors;
  }

  private getNodeDegree(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): number {
    let degree = 0;

    this.relationships.forEach(rel => {
      if ((direction === 'out' || direction === 'both') && rel.sourceId === nodeId) {
        degree++;
      } else if ((direction === 'in' || direction === 'both') && rel.targetId === nodeId) {
        degree++;
      }
    });

    return degree;
  }

  private dfsComponent(nodeId: string, visited: Set<string>, component: string[]): void {
    visited.add(nodeId);
    component.push(nodeId);

    const neighbors = this.getNodeNeighbors(nodeId);
    neighbors.forEach(({ nodeId: neighborId }) => {
      if (!visited.has(neighborId)) {
        this.dfsComponent(neighborId, visited, component);
      }
    });
  }

  private processMatchPatterns(patterns: MatchPattern[]): {
    nodes: GraphNode[];
    relationships: GraphRelationship[];
    paths?: GraphPath[];
  } {
    // Simplified implementation - would need more sophisticated pattern matching
    let nodes = Array.from(this.nodes.values());
    let relationships = Array.from(this.relationships.values());

    patterns.forEach(pattern => {
      if (pattern.nodePattern) {
        if (pattern.nodePattern.labels) {
          nodes = nodes.filter(node => 
            pattern.nodePattern!.labels!.every(label => node.labels.includes(label))
          );
        }
        if (pattern.nodePattern.properties) {
          nodes = nodes.filter(node => 
            Object.entries(pattern.nodePattern!.properties!).every(([key, value]) => 
              node.properties[key] === value
            )
          );
        }
      }

      if (pattern.relationshipPattern) {
        if (pattern.relationshipPattern.type) {
          relationships = relationships.filter(rel => 
            rel.type === pattern.relationshipPattern!.type
          );
        }
      }
    });

    return { nodes, relationships };
  }

  private applyWhereClausesToNodes(nodes: GraphNode[], whereClauses: WhereClause[]): GraphNode[] {
    return nodes.filter(node => {
      return whereClauses.every(clause => {
        const value = node.properties[clause.property];
        return this.evaluateWhereClause(value, clause.operator, clause.value);
      });
    });
  }

  private applyWhereClausesToRelationships(
    relationships: GraphRelationship[], 
    whereClauses: WhereClause[]
  ): GraphRelationship[] {
    return relationships.filter(rel => {
      return whereClauses.every(clause => {
        const value = rel.properties[clause.property];
        return this.evaluateWhereClause(value, clause.operator, clause.value);
      });
    });
  }

  private evaluateWhereClause(value: unknown, operator: string, expectedValue: unknown): boolean {
    switch (operator) {
      case '=': return value === expectedValue;
      case '!=': return value !== expectedValue;
      case '<': return (value as number) < (expectedValue as number);
      case '>': return (value as number) > (expectedValue as number);
      case '<=': return (value as number) <= (expectedValue as number);
      case '>=': return (value as number) >= (expectedValue as number);
      case 'CONTAINS': return String(value).includes(String(expectedValue));
      case 'STARTS_WITH': return String(value).startsWith(String(expectedValue));
      case 'ENDS_WITH': return String(value).endsWith(String(expectedValue));
      case 'IN': return Array.isArray(expectedValue) && expectedValue.includes(value);
      case 'NOT_IN': return Array.isArray(expectedValue) && !expectedValue.includes(value);
      default: return false;
    }
  }

  private applyOrderBy(nodes: GraphNode[], orderClauses: OrderByClause[]): GraphNode[] {
    return nodes.sort((a, b) => {
      for (const clause of orderClauses) {
        const aValue = a.properties[clause.property];
        const bValue = b.properties[clause.property];
        
        let comparison = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((aValue as any) < (bValue as any)) comparison = -1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if ((aValue as any) > (bValue as any)) comparison = 1;
        
        if (clause.direction === 'DESC') comparison *= -1;
        
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }

  private processReturnClauses(
    nodes: GraphNode[],
    relationships: GraphRelationship[]
  ): { nodes: GraphNode[]; relationships: GraphRelationship[] } {
    // Simplified implementation - just return the input for now
    // In a full implementation, this would filter and transform the results
    // based on the RETURN clauses in the query
    return { nodes, relationships };
  }
} 