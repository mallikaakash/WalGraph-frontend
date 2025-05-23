import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

import { GraphMetadata, StorageError } from './types';
import { CONSTANTS } from '../constants';

type ObjectChange = {
  type: string;
  objectType?: string;
  objectId: string;
  [key: string]: unknown;
};

type TransactionResult = {
  effects?: {
    status?: {
      status: string;
    };
  };
  objectChanges?: ObjectChange[];
  [key: string]: unknown;
};

type SignAndExecuteFunction = (params: {
  transaction: Transaction;
  options?: {
    showEffects?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
  };
}) => Promise<TransactionResult>;

export class SuiGraphService {
  private client: SuiClient;
  private packageId: string;
  private registryId: string;

  constructor() {
    this.client = new SuiClient({ 
      url: getFullnodeUrl('testnet') // TESTNET COMPULSORY
    });
    
    // Use constants for contract addresses
    this.packageId = CONSTANTS.packageId;
    this.registryId = CONSTANTS.registryId;
  }

  /**
   * Set package and registry IDs after deployment (deprecated - now using constants)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setContractAddresses(_packageId: string, _registryId: string) {
    // Parameters intentionally unused - kept for backward compatibility
    console.log('Using constants for contract addresses:', CONSTANTS.packageId, CONSTANTS.registryId);
  }

  /**
   * Create graph metadata on SUI after storing data on Walrus
   */
  async createGraphMetadata(
    metadata: {
      name: string;
      description: string;
      blobId: string;
      nodeCount: number;
      relationshipCount: number;
      isPublic: boolean;
      tags: string[];
    },
    signAndExecute: SignAndExecuteFunction
  ): Promise<string> {
    try {
      if (!this.packageId || !this.registryId) {
        throw new Error('Contract addresses not set. Deploy contract first.');
      }

      console.log('📡 Creating SUI transaction for graph metadata...');
      console.log('📋 Metadata:', {
        name: metadata.name,
        description: metadata.description,
        blobId: metadata.blobId,
        nodeCount: metadata.nodeCount,
        relationshipCount: metadata.relationshipCount,
        isPublic: metadata.isPublic,
        tags: metadata.tags
      });

      const tx = new Transaction();

      // Create graph metadata - NO clock creation needed, use existing system clock
      tx.moveCall({
        target: `${this.packageId}::graph_metadata::create_graph_metadata`,
        arguments: [
          tx.object(this.registryId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.name))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.description))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.blobId))),
          tx.pure.u64(metadata.nodeCount),
          tx.pure.u64(metadata.relationshipCount),
          tx.pure.bool(metadata.isPublic),
          tx.pure.vector('vector<u8>', metadata.tags.map(tag => 
            Array.from(new TextEncoder().encode(tag))
          )),
          tx.object('0x6'), // System clock object - use existing one
        ],
      });

      console.log('📡 Executing SUI transaction...');
      console.log('🔧 Transaction target:', `${this.packageId}::graph_metadata::create_graph_metadata`);
      console.log('🏢 Registry ID:', this.registryId);
      console.log('💰 Using system clock object: 0x6');
      
      // Validate transaction before sending
      if (!tx) {
        throw new Error('Transaction object is null');
      }

      // Log transaction details for debugging
      console.log('📋 Transaction arguments:', {
        registryId: this.registryId,
        nameLength: metadata.name.length,
        descriptionLength: metadata.description.length,
        blobIdLength: metadata.blobId.length,
        nodeCount: metadata.nodeCount,
        relationshipCount: metadata.relationshipCount,
        isPublic: metadata.isPublic,
        tagsCount: metadata.tags.length
      });
      
      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });

      console.log('📡 Raw SUI Transaction Result:', result);
      console.log('📡 Result type:', typeof result);
      console.log('📡 Result keys:', result ? Object.keys(result) : 'null');

      // Enhanced error checking
      if (!result) {
        throw new Error('Transaction failed: signAndExecute returned null/undefined. This usually means the transaction was rejected in the wallet or failed to execute.');
      }

      if (typeof result !== 'object') {
        throw new Error(`Transaction failed: Expected object result, got ${typeof result}`);
      }

      // Check for transaction status first
      if (result.effects && result.effects.status && result.effects.status.status !== 'success') {
        console.error('❌ Transaction failed with status:', result.effects.status);
        throw new Error(`Transaction failed with status: ${result.effects.status.status}. Error: ${JSON.stringify(result.effects.status)}`);
      }

      if (!result.objectChanges) {
        console.error('❌ Transaction result missing objectChanges:', result);
        console.error('❌ Available result properties:', Object.keys(result));
        
        // Try to extract more info from the result
        if (result.effects) {
          console.error('❌ Transaction effects:', result.effects);
        }
        
        throw new Error('Transaction succeeded but no object changes were returned. This might indicate a contract execution issue.');
      }

      console.log('🔍 Object Changes:', result.objectChanges);

      // Extract created object ID
      const created = result.objectChanges.find(
        (change: ObjectChange) => change.type === 'created' && 
                        change.objectType?.includes('GraphMetadata')
      );

      if (!created) {
        console.error('❌ No GraphMetadata object created. Available object changes:', result.objectChanges);
        const createdObjects = result.objectChanges.filter((change: ObjectChange) => change.type === 'created');
        console.error('❌ All created objects:', createdObjects);
        throw new Error('Failed to create graph metadata object. No GraphMetadata object found in transaction result.');
      }

      console.log('✅ Graph metadata created on SUI:', created.objectId);
      console.log('🎯 Created object details:', created);
      return created.objectId;

    } catch (error) {
      console.error('❌ Error creating metadata on SUI:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        packageId: this.packageId,
        registryId: this.registryId
      });
      throw new StorageError('Failed to create graph metadata on SUI', 'create', error);
    }
  }

  /**
   * Update graph metadata on SUI
   */
  async updateGraphMetadata(
    graphId: string,
    metadata: {
      name: string;
      description: string;
      blobId: string;
      nodeCount: number;
      relationshipCount: number;
      isPublic: boolean;
      tags: string[];
    },
    signAndExecute: SignAndExecuteFunction
  ): Promise<void> {
    try {
      console.log('📡 Updating SUI graph metadata...');
      console.log('🆔 Graph ID:', graphId);
      console.log('📋 Updated metadata:', metadata);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::graph_metadata::update_graph_metadata`,
        arguments: [
          tx.object(graphId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.name))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.description))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadata.blobId))),
          tx.pure.u64(metadata.nodeCount),
          tx.pure.u64(metadata.relationshipCount),
          tx.pure.bool(metadata.isPublic),
          tx.pure.vector('vector<u8>', metadata.tags.map(tag => 
            Array.from(new TextEncoder().encode(tag))
          )),
          tx.object('0x6'), // System clock
        ],
      });

      const txResult = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });

      if (txResult.effects && txResult.effects.status && txResult.effects.status.status !== 'success') {
        throw new Error(`Transaction failed: ${txResult.effects.status.status}`);
      }

      console.log('✅ Graph metadata updated on SUI');
    } catch (error) {
      console.error('❌ Error updating metadata on SUI:', error);
      throw new StorageError('Failed to update graph metadata on SUI', 'update', error);
    }
  }

  /**
   * Get graph metadata from SUI
   */
  async getGraphMetadata(graphId: string): Promise<GraphMetadata | null> {
    try {
      const object = await this.client.getObject({
        id: graphId,
        options: { showContent: true },
      });

      if (!object.data || !object.data.content || object.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = object.data.content.fields as {
        id: string;
        name: string;
        description: string;
        blob_id: string;
        owner: string;
        created_at: string; // Assuming these are string representations of numbers
        updated_at: string;
        node_count: string;
        relationship_count: string;
        is_public: boolean;
        tags: string[];
        version: string;
      };
      
      return {
        id: fields.id,
        name: fields.name,
        description: fields.description,
        blobId: fields.blob_id,
        owner: fields.owner,
        createdAt: Number(fields.created_at),
        updatedAt: Number(fields.updated_at),
        nodeCount: Number(fields.node_count),
        relationshipCount: Number(fields.relationship_count),
        isPublic: fields.is_public,
        tags: fields.tags,
        version: Number(fields.version)
      };
    } catch (error) {
      console.error('❌ Error getting metadata from SUI:', error);
      return null;
    }
  }

  /**
   * Get all graph metadata objects owned by a user
   */
  async getUserGraphs(ownerAddress: string): Promise<GraphMetadata[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::graph_metadata::GraphMetadata`,
        },
        options: { showContent: true },
      });

      return objects.data
        .filter(obj => obj.data && obj.data.content && obj.data.content.dataType === 'moveObject')
        .map(obj => {
          // Ensure content is SuiMoveObjectResponse before casting to access fields
          const content = obj.data!.content as { type?: string; fields?: Record<string, unknown> };
          if (content.type !== 'moveObject' || !content.fields) {
            // This should not happen due to the filter above, but as a safeguard:
            throw new Error('Unexpected object content type or missing fields');
          }
          const fields = content.fields as {
            id: string;
            name: string;
            description: string;
            blob_id: string;
            owner: string;
            created_at: string;
            updated_at: string;
            node_count: string;
            relationship_count: string;
            is_public: boolean;
            tags: string[];
            version: string;
          };
          return {
            id: fields.id,
            name: fields.name,
            description: fields.description,
            blobId: fields.blob_id,
            owner: fields.owner,
            createdAt: Number(fields.created_at),
            updatedAt: Number(fields.updated_at),
            nodeCount: Number(fields.node_count),
            relationshipCount: Number(fields.relationship_count),
            isPublic: fields.is_public,
            tags: fields.tags,
            version: Number(fields.version)
          };
        });
    } catch (error) {
      console.error('❌ Error getting user graphs from SUI:', error);
      return [];
    }
  }

  /**
   * Get IDs of all public graphs (from registry)
   */
  async getPublicGraphs(): Promise<string[]> {
    try {
      const registry = await this.client.getObject({
        id: this.registryId,
        options: { showContent: true },
      });

      if (!registry.data || !registry.data.content || registry.data.content.dataType !== 'moveObject') {
        return [];
      }

      const fields = registry.data.content.fields as { public_graphs?: { fields?: { contents?: string[] } } };
      return fields.public_graphs?.fields?.contents || [];
    } catch (error) {
      console.error('❌ Error getting public graphs from SUI:', error);
      return [];
    }
  }

  /**
   * Get graph IDs by tag (from registry)
   */
  async getGraphsByTag(tag: string): Promise<string[]> {
    try {
      const registry = await this.client.getObject({
        id: this.registryId,
        options: { showContent: true },
      });

      if (!registry.data || !registry.data.content || registry.data.content.dataType !== 'moveObject') {
        return [];
      }

      const fields = registry.data.content.fields as { graphs_by_tag?: { fields?: { contents?: Array<{ fields: { k: string[], v: { fields: { contents: string[] } } } }> } } };
      const tagBytes = Array.from(new TextEncoder().encode(tag));
      
      const tagEntry = fields.graphs_by_tag?.fields?.contents?.find(
        entry => JSON.stringify(entry.fields.k) === JSON.stringify(tagBytes)
      );
      
      return tagEntry?.fields.v.fields.contents || [];
    } catch (error) {
      console.error(`❌ Error getting graphs by tag "${tag}" from SUI:`, error);
      return [];
    }
  }

  /**
   * Delete graph metadata from SUI
   */
  async deleteGraphMetadata(
    graphId: string,
    signAndExecute: SignAndExecuteFunction
  ): Promise<void> {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::graph_metadata::delete_graph_metadata`,
        arguments: [
          tx.object(this.registryId),
          tx.object(graphId),
          tx.object('0x6') // System clock
        ],
      });

      const deleteResult = await signAndExecute({
        transaction: tx,
        options: { showEffects: true },
      });

      if (deleteResult.effects && deleteResult.effects.status && deleteResult.effects.status.status !== 'success') {
        throw new Error(`Transaction failed: ${deleteResult.effects.status.status}`);
      }

      console.log('✅ Graph metadata deleted from SUI');
    } catch (error) {
      console.error('❌ Error deleting metadata from SUI:', error);
      throw new StorageError('Failed to delete graph metadata from SUI', 'delete', error);
    }
  }

  /**
   * Get graph registry statistics
   */
  async getRegistryStats(): Promise<{ totalGraphs: number }> {
    try {
      const registry = await this.client.getObject({
        id: this.registryId,
        options: { showContent: true },
      });

      if (!registry.data || !registry.data.content || registry.data.content.dataType !== 'moveObject') {
        return { totalGraphs: 0 };
      }

      const fields = registry.data.content.fields as { total_graphs?: string }; // Assuming total_graphs is a string representation
      return { totalGraphs: Number(fields.total_graphs) || 0 };
    } catch (error) {
      console.error('❌ Error getting registry stats:', error);
      return { totalGraphs: 0 };
    }
  }

  /**
   * Subscribe to graph creation/update events
   */
  async subscribeToGraphEvents(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback: (event: unknown) => void, // Parameter intentionally unused
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _filter?: { owner?: string } // Parameter intentionally unused
  ): Promise<() => void> {
    console.log('ℹ️ Event subscription setup (mocked for now)');
    
    // Mock subscription - in a real scenario, this would use client.subscribeEvent
    const unsubscribe = () => {
      console.log('ℹ️ Event subscription stopped (mocked)');
    };

    // Simulate an event for testing
    // setTimeout(() => {
    //   console.log('🔔 Simulated event: GraphCreated');
    //   callback({
    //     type: 'GraphCreated',
    //     parsedJson: {
    //       graphId: 'mock_graph_id_123',
    //       owner: 'mock_owner_address',
    //       name: 'Mock Graph Event'
    //     }
    //   });
    // }, 5000);

    return unsubscribe;
  }

  /**
   * Get graph history (mocked)
   */
  async getGraphHistory(graphId: string): Promise<unknown[]> {
    console.log(`ℹ️ Fetching history for graph ${graphId} (mocked)`);
    return [
      { version: 1, changedAt: Date.now() - 100000, changes: 'Created graph' },
      { version: 2, changedAt: Date.now(), changes: 'Updated metadata' },
    ];
  }
}