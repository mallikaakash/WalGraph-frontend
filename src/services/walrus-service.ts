import jsonld from 'jsonld';
import { 
  WalrusConfig, 
  WalrusStorageResult, 
  JsonLdGraphData, 
  JsonLdNode, 
  JsonLdRelationship,
  GraphNode,
  GraphRelationship,
  StorageError
} from './types';
import { CONSTANTS } from '../constants';

type GraphData = {
  nodes?: Array<{
    id?: string;
    type?: string;
    properties?: Record<string, unknown>;
    labels?: string[];
    createdAt?: number;
    updatedAt?: number;
  }>;
  relationships?: Array<{
    id?: string;
    type?: string;
    sourceId?: string;
    targetId?: string;
    properties?: Record<string, unknown>;
    weight?: number;
    createdAt?: number;
    updatedAt?: number;
  }>;
  [key: string]: unknown;
};

export class WalrusService {
  private config: WalrusConfig;
  private readonly CONTEXT = {
    "@context": {
      "@version": "1.1" as const,
      "id": "@id",
      "type": "@type",
      "Graph": "https://walgraph.dev/ontology#Graph",
      "Node": "https://walgraph.dev/ontology#Node",
      "Relationship": "https://walgraph.dev/ontology#Relationship",
      "nodeType": "https://walgraph.dev/ontology#nodeType",
      "relationType": "https://walgraph.dev/ontology#relationType",
      "source": "https://walgraph.dev/ontology#source",
      "target": "https://walgraph.dev/ontology#target",
      "properties": "https://walgraph.dev/ontology#properties",
      "labels": "https://walgraph.dev/ontology#labels",
      "weight": "https://walgraph.dev/ontology#weight",
      "createdAt": {
        "@id": "https://walgraph.dev/ontology#createdAt",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "updatedAt": {
        "@id": "https://walgraph.dev/ontology#updatedAt", 
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "name": "https://schema.org/name",
      "description": "https://schema.org/description"
    }
  };

  constructor() {
    this.config = {
      publisherUrl: CONSTANTS.walrusPublisherUrl,
      aggregatorUrl: CONSTANTS.walrusAggregatorUrl,
      network: 'testnet'
    };

    console.log('🌊 Walrus service initialized:', this.config);
  }

  /**
   * Store graph data as JSON-LD in Walrus
   */
  async storeGraph(
    nodes: GraphNode[], 
    relationships: GraphRelationship[], 
    metadata?: { name: string; description: string }
  ): Promise<WalrusStorageResult> {
    try {
      console.log('🔄 Preparing graph data...');
      
      // Simplified storage - store as plain JSON for now to test connection
      const graphData = {
        "@type": "Graph",
        "nodes": nodes,
        "relationships": relationships,
        "metadata": metadata ? {
          ...metadata,
          createdAt: Date.now(),
          version: 1
        } : undefined,
        "timestamp": Date.now()
      };
      
      console.log('🔄 Storing to Walrus...');
      const result = await this.storeBlob(graphData);
      
      // Improved logging to distinguish between Walrus and localStorage
      if (result.blobId.startsWith('local_')) {
        console.log('⚠️ Used localStorage fallback:', result);
      } else {
        console.log('✅ Successfully stored to Walrus:', result);
      }
      return result;
    } catch (error) {
      console.error('❌ Error storing graph to Walrus:', error);
      throw new StorageError('Failed to store graph to Walrus', 'store', error);
    }
  }

  /**
   * Read graph data from Walrus using blob ID
   */
  async readGraph(blobId: string): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> {
    try {
      console.log('🌊 Reading graph from Walrus:', blobId);
      
      const graphData = await this.readBlob(blobId) as GraphData;
      console.log('📊 Raw data structure:', Object.keys(graphData));
      console.log('🔄 Processing graph data...');
      
      // Handle simplified JSON format
      const nodes: GraphNode[] = (graphData.nodes || []).map((node: {
        id?: string;
        type?: string;
        properties?: Record<string, unknown>;
        labels?: string[];
        createdAt?: number;
        updatedAt?: number;
      }) => ({
        id: node.id || this.generateId(),
        type: node.type || 'Unknown',
        properties: node.properties || {},
        labels: node.labels || [],
        createdAt: node.createdAt || Date.now(),
        updatedAt: node.updatedAt || Date.now()
      }));

      const relationships: GraphRelationship[] = (graphData.relationships || []).map((rel: {
        id?: string;
        type?: string;
        sourceId?: string;
        targetId?: string;
        properties?: Record<string, unknown>;
        weight?: number;
        createdAt?: number;
        updatedAt?: number;
      }) => ({
        id: rel.id || this.generateId(),
        type: rel.type || 'RELATES_TO',
        sourceId: rel.sourceId || '',
        targetId: rel.targetId || '',
        properties: rel.properties || {},
        weight: rel.weight,
        createdAt: rel.createdAt || Date.now(),
        updatedAt: rel.updatedAt || Date.now()
      }));
      
      console.log('✅ Successfully read from Walrus');
      return { nodes, relationships };
    } catch (error) {
      console.error('❌ Error reading graph from Walrus:', error);
      throw new StorageError('Failed to read graph from Walrus', 'read', error);
    }
  }

  /**
   * Store blob data to Walrus
   */
  private async storeBlob(data: Record<string, unknown>): Promise<WalrusStorageResult> {
    const jsonString = JSON.stringify(data, null, 2);
    
    // Convert to ArrayBuffer as required by official API
    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(jsonString);

    const url = `${this.config.publisherUrl}/v1/blobs`;
    console.log('🔄 Attempting to store at URL:', url);
    console.log('🔄 Data size:', arrayBuffer.length, 'bytes');

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: arrayBuffer
      });

      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Walrus HTTP error:', response.status, errorText);
        
        // Fallback to localStorage if Walrus is not available
        console.log('⚠️ Walrus HTTP error, falling back to localStorage...');
        return this.storeToLocalStorage(data);
      }

      const result = await response.json() as {
        newlyCreated?: { blobObject?: { blobId?: string } };
        alreadyCertified?: { blobId?: string };
        blobId?: string;
      };
      console.log('🌊 Raw Walrus response:', result);
      
      // Handle different response formats from Walrus
      const blobId = result.newlyCreated?.blobObject?.blobId || 
                     result.alreadyCertified?.blobId ||
                     result.blobId;

      if (!blobId) {
        console.error('❌ No blob ID in Walrus response:', result);
        console.log('⚠️ Invalid Walrus response, falling back to localStorage...');
        return this.storeToLocalStorage(data);
      }

      console.log('🎉 Successfully stored to Walrus with blob ID:', blobId);
      return {
        blobId,
        size: arrayBuffer.length,
        timestamp: Date.now()
      };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ Network/CORS error connecting to Walrus:', error.message);
        console.log('⚠️ CORS/Network error, falling back to localStorage...');
      } else {
        console.error('❌ Unexpected error with Walrus:', error);
        console.log('⚠️ Unexpected error, falling back to localStorage...');
      }
      return this.storeToLocalStorage(data);
    }
  }

  /**
   * Fallback storage using localStorage
   */
  private storeToLocalStorage(data: Record<string, unknown>): WalrusStorageResult {
    const blobId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jsonString = JSON.stringify(data);
    
    try {
      localStorage.setItem(`walrus_blob_${blobId}`, jsonString);
      console.log('✅ Successfully stored to localStorage with ID:', blobId);
      
      return {
        blobId,
        size: jsonString.length,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ localStorage storage failed:', error);
      throw new Error('Both Walrus and localStorage storage failed');
    }
  }

  /**
   * Read blob data from Walrus
   */
  private async readBlob(blobId: string): Promise<Record<string, unknown>> {
    // Check if this is a localStorage blob
    if (blobId.startsWith('local_')) {
      return this.readFromLocalStorage(blobId);
    }

    const url = `${this.config.aggregatorUrl}/v1/blobs/${blobId}`;
    console.log('🔄 Reading from Walrus URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Walrus read failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') || contentType?.includes('application/ld+json')) {
      return await response.json() as Record<string, unknown>;
    } else {
      const text = await response.text();
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error('Invalid JSON data received from Walrus');
      }
    }
  }

  /**
   * Read blob data from localStorage
   */
  private readFromLocalStorage(blobId: string): Record<string, unknown> {
    try {
      const jsonString = localStorage.getItem(`walrus_blob_${blobId}`);
      if (!jsonString) {
        throw new Error(`Blob ${blobId} not found in localStorage`);
      }
      return JSON.parse(jsonString) as Record<string, unknown>;
    } catch (error) {
      console.error('❌ localStorage read failed:', error);
      throw new Error(`Failed to read blob ${blobId} from localStorage`);
    }
  }

  /**
   * Convert graph data to JSON-LD format
   */
  private async convertToJsonLD(
    nodes: GraphNode[], 
    relationships: GraphRelationship[],
    metadata?: { name: string; description: string }
  ): Promise<JsonLdGraphData> {
    // Convert nodes to JSON-LD format
    const jsonldNodes: JsonLdNode[] = nodes.map(node => ({
      "@type": "Node",
      "@id": node.id,
      "nodeType": node.type,
      "labels": node.labels,
      "properties": node.properties,
      "createdAt": node.createdAt,
      "updatedAt": node.updatedAt
    }));

    // Convert relationships to JSON-LD format
    const jsonldRelationships: JsonLdRelationship[] = relationships.map(rel => ({
      "@type": "Relationship", 
      "@id": rel.id,
      "relationType": rel.type,
      "source": rel.sourceId,
      "target": rel.targetId,
      "properties": rel.properties,
      "weight": rel.weight,
      "createdAt": rel.createdAt,
      "updatedAt": rel.updatedAt
    }));

    // Create the complete JSON-LD document
    const document: JsonLdGraphData = {
      ...this.CONTEXT,
      "@type": "Graph",
      "nodes": jsonldNodes,
      "relationships": jsonldRelationships,
      "metadata": metadata ? {
        ...metadata,
        createdAt: Date.now(),
        version: 1
      } : undefined
    };

    // Compact the JSON-LD document
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compacted = await jsonld.compact(document as any, this.CONTEXT["@context"]);
      return compacted as unknown as JsonLdGraphData;
    } catch (error) {
      console.warn('JSON-LD compaction failed, returning uncompacted:', error);
      return document;
    }
  }

  /**
   * Convert JSON-LD back to graph format
   */
  private async convertFromJsonLD(jsonldData: Record<string, unknown>): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> {
    try {
      console.log('🔄 Converting from JSON-LD format');
      
      // Extract nodes array - handle both direct array and wrapped format
      const nodesData = jsonldData.nodes || jsonldData['@graph'];
      const relationshipsData = jsonldData.relationships || jsonldData.edges;
      
      const nodes: GraphNode[] = (Array.isArray(nodesData) ? nodesData : []).map((nodeData: {
        "@id"?: string;
        id?: string;
        "@type"?: string;
        nodeType?: string;
        type?: string;
        labels?: string[];
        properties?: Record<string, unknown>;
        createdAt?: number;
        updatedAt?: number;
      }) => {
        const id = nodeData["@id"] || nodeData.id || this.generateId();
        const type = nodeData.nodeType || nodeData.type || nodeData["@type"] || 'Unknown';
        const labels = Array.isArray(nodeData.labels) ? nodeData.labels : [];
        const properties = typeof nodeData.properties === 'object' && nodeData.properties !== null ? nodeData.properties : {};
        
        return {
          id,
          type,
          labels,
          properties,
          createdAt: nodeData.createdAt || Date.now(),
          updatedAt: nodeData.updatedAt || Date.now()
        };
      });

      const relationships: GraphRelationship[] = (Array.isArray(relationshipsData) ? relationshipsData : []).map((relData: {
        "@id"?: string;
        id?: string;
        relationType?: string;
        type?: string;
        source?: string;
        sourceId?: string;
        target?: string;
        targetId?: string;
        properties?: Record<string, unknown>;
        weight?: number;
        createdAt?: number;
        updatedAt?: number;
      }) => {
        const id = relData["@id"] || relData.id || this.generateId();
        const type = relData.relationType || relData.type || 'RELATES_TO';
        const sourceId = relData.source || relData.sourceId || '';
        const targetId = relData.target || relData.targetId || '';
        const properties = typeof relData.properties === 'object' && relData.properties !== null ? relData.properties : {};
        
        return {
          id,
          type,
          sourceId,
          targetId,
          properties,
          weight: relData.weight,
          createdAt: relData.createdAt || Date.now(),
          updatedAt: relData.updatedAt || Date.now()
        };
      });

      console.log(`✅ Converted JSON-LD: ${nodes.length} nodes, ${relationships.length} relationships`);
      return { nodes, relationships };
    } catch (error) {
      console.error('❌ JSON-LD conversion failed:', error);
      return this.fallbackParse(jsonldData);
    }
  }

  /**
   * Fallback parser for various JSON formats
   */
  private fallbackParse(data: Record<string, unknown>): { nodes: GraphNode[]; relationships: GraphRelationship[] } {
    const nodes: GraphNode[] = (data.nodes as Array<{
      id?: string;
      type?: string;
      properties?: Record<string, unknown>;
      labels?: string[];
      createdAt?: number;
      updatedAt?: number;
    }> || []).map((node) => ({
      id: node.id || this.generateId(),
      type: node.type || 'Unknown',
      properties: node.properties || {},
      labels: node.labels || [],
      createdAt: node.createdAt || Date.now(),
      updatedAt: node.updatedAt || Date.now()
    }));

    const relationships: GraphRelationship[] = (data.relationships as Array<{
      id?: string;
      type?: string;
      sourceId?: string;
      targetId?: string;
      properties?: Record<string, unknown>;
      weight?: number;
      createdAt?: number;
      updatedAt?: number;
    }> || []).map((rel) => ({
      id: rel.id || this.generateId(),
      type: rel.type || 'RELATES_TO',
      sourceId: rel.sourceId || '',
      targetId: rel.targetId || '',
      properties: rel.properties || {},
      weight: rel.weight,
      createdAt: rel.createdAt || Date.now(),
      updatedAt: rel.updatedAt || Date.now()
    }));

    return { nodes, relationships };
  }

  /**
   * Extract value handling different JSON-LD field formats
   */
  private extractValue(field: unknown): unknown {
    if (typeof field === 'object' && field !== null && '@value' in field) {
      return (field as { '@value': unknown })['@value'];
    }
    return field;
  }

  /**
   * Extract array handling different JSON-LD array formats
   */
  private extractArray(field: unknown): unknown[] {
    if (Array.isArray(field)) {
      return field.map(item => this.extractValue(item));
    } else if (field) {
      return [this.extractValue(field)];
    }
    return [];
  }

  /**
   * Extract number with validation
   */
  private extractNumber(field: unknown): number | undefined {
    const value = this.extractValue(field);
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Generate unique identifier
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.aggregatorUrl}/v1/${blobId}`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get blob metadata
   */
  async getBlobInfo(blobId: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const response = await fetch(`${this.config.aggregatorUrl}/v1/${blobId}`, {
        method: 'HEAD',
      });
      
      if (!response.ok) return null;

      return {
        size: parseInt(response.headers.get('content-length') || '0'),
        contentType: response.headers.get('content-type') || 'application/octet-stream'
      };
    } catch {
      return null;
    }
  }
} 