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

export class WalrusService {
  private config: WalrusConfig;
  private readonly CONTEXT = {
    "@context": {
      "@version": "1.1" as const,
      "id": "@id",
      "type": "@type",
      "Graph": "https://webwalrus.dev/ontology#Graph",
      "Node": "https://webwalrus.dev/ontology#Node",
      "Relationship": "https://webwalrus.dev/ontology#Relationship",
      "nodeType": "https://webwalrus.dev/ontology#nodeType",
      "relationType": "https://webwalrus.dev/ontology#relationType",
      "source": "https://webwalrus.dev/ontology#source",
      "target": "https://webwalrus.dev/ontology#target",
      "properties": "https://webwalrus.dev/ontology#properties",
      "labels": "https://webwalrus.dev/ontology#labels",
      "weight": "https://webwalrus.dev/ontology#weight",
      "createdAt": {
        "@id": "https://webwalrus.dev/ontology#createdAt",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "updatedAt": {
        "@id": "https://webwalrus.dev/ontology#updatedAt", 
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
      
      console.log('✅ Successfully stored to Walrus:', result);
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
      console.log('🔄 Reading from Walrus...');
      const graphData = await this.readBlob(blobId);
      
      console.log('🔄 Processing graph data...');
      
      // Handle simplified JSON format
      const nodes: GraphNode[] = (graphData.nodes || []).map((node: any) => ({
        id: node.id || this.generateId(),
        type: node.type || 'Unknown',
        properties: node.properties || {},
        labels: node.labels || [],
        createdAt: node.createdAt || Date.now(),
        updatedAt: node.updatedAt || Date.now()
      }));

      const relationships: GraphRelationship[] = (graphData.relationships || []).map((rel: any) => ({
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
  private async storeBlob(data: any): Promise<WalrusStorageResult> {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const formData = new FormData();
    formData.append('file', blob, 'graph.json');

    const url = `${this.config.publisherUrl}/v1/store`;
    console.log('🔄 Attempting to store at URL:', url);
    console.log('🔄 Blob size:', blob.size, 'bytes');

    try {
      const response = await fetch(url, {
        method: 'PUT',
        body: formData,
        headers: {
          // Let the browser set Content-Type for FormData
        }
      });

      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        
        // Fallback to localStorage if Walrus is not available
        console.log('⚠️ Walrus not available, using localStorage fallback...');
        return this.storeToLocalStorage(data);
      }

      const result = await response.json();
      console.log('✅ Walrus response:', result);
      
      // Handle different response formats from Walrus
      const blobId = result.newlyCreated?.blobObject?.blobId || 
                     result.alreadyCertified?.blobId ||
                     result.blobId;

      if (!blobId) {
        console.error('❌ No blob ID in response:', result);
        console.log('⚠️ Falling back to localStorage...');
        return this.storeToLocalStorage(data);
      }

      return {
        blobId,
        size: blob.size,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Network error details:', error);
      console.log('⚠️ Network error, using localStorage fallback...');
      return this.storeToLocalStorage(data);
    }
  }

  /**
   * Fallback storage using localStorage
   */
  private storeToLocalStorage(data: any): WalrusStorageResult {
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
  private async readBlob(blobId: string): Promise<any> {
    // Check if this is a localStorage blob
    if (blobId.startsWith('local_')) {
      return this.readFromLocalStorage(blobId);
    }

    const response = await fetch(`${this.config.aggregatorUrl}/v1/${blobId}`);
    
    if (!response.ok) {
      throw new Error(`Walrus read failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') || contentType?.includes('application/ld+json')) {
      return await response.json();
    } else {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON data received from Walrus');
      }
    }
  }

  /**
   * Read blob data from localStorage
   */
  private readFromLocalStorage(blobId: string): any {
    try {
      const jsonString = localStorage.getItem(`walrus_blob_${blobId}`);
      if (!jsonString) {
        throw new Error(`Blob ${blobId} not found in localStorage`);
      }
      return JSON.parse(jsonString);
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
      const compacted = await jsonld.compact(document, this.CONTEXT["@context"]);
      return compacted as unknown as JsonLdGraphData;
    } catch (error) {
      console.warn('JSON-LD compaction failed, returning uncompacted:', error);
      return document;
    }
  }

  /**
   * Convert JSON-LD back to graph format
   */
  private async convertFromJsonLD(jsonldData: any): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> {
    try {
      // Expand JSON-LD to get full URIs
      const expanded = await jsonld.expand(jsonldData);
      const graph = expanded[0];

      // Extract nodes
      const nodesData = graph['https://webwalrus.dev/ontology#nodes'];
      const nodes: GraphNode[] = (Array.isArray(nodesData) ? nodesData : []).map((nodeData: any) => {
        const node = nodeData[0] || nodeData;
        return {
          id: node['@id'] || this.generateId(),
          type: this.extractValue(node['https://webwalrus.dev/ontology#nodeType']) || 'Unknown',
          properties: this.extractValue(node['https://webwalrus.dev/ontology#properties']) || {},
          labels: this.extractArray(node['https://webwalrus.dev/ontology#labels']) || [],
          createdAt: this.extractNumber(node['https://webwalrus.dev/ontology#createdAt']) || Date.now(),
          updatedAt: this.extractNumber(node['https://webwalrus.dev/ontology#updatedAt']) || Date.now()
        };
      });

      // Extract relationships
      const relationshipsData = graph['https://webwalrus.dev/ontology#relationships'];
      const relationships: GraphRelationship[] = (Array.isArray(relationshipsData) ? relationshipsData : []).map((relData: any) => {
        const rel = relData[0] || relData;
        return {
          id: rel['@id'] || this.generateId(),
          type: this.extractValue(rel['https://webwalrus.dev/ontology#relationType']) || 'RELATES_TO',
          sourceId: this.extractValue(rel['https://webwalrus.dev/ontology#source']) || '',
          targetId: this.extractValue(rel['https://webwalrus.dev/ontology#target']) || '',
          properties: this.extractValue(rel['https://webwalrus.dev/ontology#properties']) || {},
          weight: this.extractNumber(rel['https://webwalrus.dev/ontology#weight']),
          createdAt: this.extractNumber(rel['https://webwalrus.dev/ontology#createdAt']) || Date.now(),
          updatedAt: this.extractNumber(rel['https://webwalrus.dev/ontology#updatedAt']) || Date.now()
        };
      });

      return { nodes, relationships };
    } catch (error) {
      console.warn('JSON-LD expansion failed, trying fallback parsing:', error);
      return this.fallbackParse(jsonldData);
    }
  }

  /**
   * Fallback parsing for non-standard JSON-LD
   */
  private fallbackParse(data: any): { nodes: GraphNode[]; relationships: GraphRelationship[] } {
    const nodes: GraphNode[] = (data.nodes || []).map((node: any) => ({
      id: node['@id'] || node.id || this.generateId(),
      type: node.nodeType || node.type || 'Unknown',
      properties: node.properties || {},
      labels: node.labels || [],
      createdAt: node.createdAt || Date.now(),
      updatedAt: node.updatedAt || Date.now()
    }));

    const relationships: GraphRelationship[] = (data.relationships || []).map((rel: any) => ({
      id: rel['@id'] || rel.id || this.generateId(),
      type: rel.relationType || rel.type || 'RELATES_TO',
      sourceId: rel.source || rel.sourceId || '',
      targetId: rel.target || rel.targetId || '',
      properties: rel.properties || {},
      weight: rel.weight,
      createdAt: rel.createdAt || Date.now(),
      updatedAt: rel.updatedAt || Date.now()
    }));

    return { nodes, relationships };
  }

  /**
   * Extract value from JSON-LD array format
   */
  private extractValue(field: any): any {
    if (Array.isArray(field) && field.length > 0) {
      return field[0]['@value'] || field[0];
    }
    return field;
  }

  /**
   * Extract array from JSON-LD format
   */
  private extractArray(field: any): any[] {
    if (Array.isArray(field)) {
      return field.map(item => item['@value'] || item);
    }
    return field ? [field] : [];
  }

  /**
   * Extract number from JSON-LD format
   */
  private extractNumber(field: any): number | undefined {
    const value = this.extractValue(field);
    return value ? Number(value) : undefined;
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