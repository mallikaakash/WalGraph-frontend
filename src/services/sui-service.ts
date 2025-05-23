import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';
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

type SubscriptionCallback = (event: {
  parsedJson?: {
    graphId?: string;
    owner?: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}) => void;

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
  setContractAddresses(packageId: string, registryId: string) {
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

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      if (!result) {
        throw new Error('Transaction failed');
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
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!object.data?.content || object.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = (object.data.content as any).fields;
      
      return {
        id: graphId,
        name: fields.name || 'Untitled',
        description: fields.description || '',
        blobId: fields.blob_id || '',
        owner: fields.owner || '',
        createdAt: parseInt(fields.created_at) || 0,
        updatedAt: parseInt(fields.updated_at) || 0,
        nodeCount: parseInt(fields.node_count) || 0,
        relationshipCount: parseInt(fields.relationship_count) || 0,
        isPublic: fields.is_public || false,
        tags: fields.tags || [],
        version: parseInt(fields.version) || 1,
      };

    } catch (error) {
      console.error('❌ Error getting graph metadata:', error);
      return null;
    }
  }

  /**
   * Get all graphs owned by a specific address
   */
  async getUserGraphs(ownerAddress: string): Promise<GraphMetadata[]> {
    try {
      // Query for GraphMetadata objects owned by the user
      const objects = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::graph_metadata::GraphMetadata`
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const graphs: GraphMetadata[] = [];
      
      for (const obj of objects.data) {
        if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
          const fields = (obj.data.content as any).fields;
          graphs.push({
            id: obj.data.objectId,
            name: fields.name || 'Untitled',
            description: fields.description || '',
            blobId: fields.blob_id || '',
            owner: fields.owner || '',
            createdAt: parseInt(fields.created_at) || 0,
            updatedAt: parseInt(fields.updated_at) || 0,
            nodeCount: parseInt(fields.node_count) || 0,
            relationshipCount: parseInt(fields.relationship_count) || 0,
            isPublic: fields.is_public || false,
            tags: fields.tags || [],
            version: parseInt(fields.version) || 1,
          });
        }
      }

      return graphs.sort((a, b) => b.updatedAt - a.updatedAt);

    } catch (error) {
      console.error('❌ Error getting user graphs:', error);
      return [];
    }
  }

  /**
   * Get public graphs from registry
   */
  async getPublicGraphs(): Promise<string[]> {
    try {
      if (!this.registryId) {
        throw new Error('Registry ID not set');
      }

      // Query registry for public graph IDs
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${this.packageId}::graph_metadata::get_public_graph_ids`,
            arguments: [tx.object(this.registryId)],
          });
          return tx;
        })(),
        sender: '0x1', // Dummy sender for dev inspect
      });

      // Parse the result to get graph IDs
      // Note: This is a simplified implementation
      return [];

    } catch (error) {
      console.error('❌ Error getting public graphs:', error);
      return [];
    }
  }

  /**
   * Get graphs by tag
   */
  async getGraphsByTag(tag: string): Promise<string[]> {
    try {
      if (!this.registryId) {
        throw new Error('Registry ID not set');
      }

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${this.packageId}::graph_metadata::get_graphs_by_tag`,
            arguments: [
              tx.object(this.registryId),
              tx.pure.string(tag)
            ],
          });
          return tx;
        })(),
        sender: '0x1',
      });

      // Parse result and return graph IDs
      return [];

    } catch (error) {
      console.error('❌ Error getting graphs by tag:', error);
      return [];
    }
  }

  /**
   * Delete graph metadata
   */
  async deleteGraphMetadata(
    graphId: string,
    signAndExecute: Function
  ): Promise<void> {
    try {
      console.log('📡 Deleting SUI graph metadata...');
      console.log('🆔 Graph ID to delete:', graphId);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::graph_metadata::delete_graph_metadata`,
        arguments: [
          tx.object(graphId),
          tx.object(this.registryId),
        ],
      });

      console.log('📡 Executing delete transaction...');

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });

      console.log('📡 Delete transaction result:', result);

      // Enhanced error checking for delete
      if (!result) {
        throw new Error('Delete transaction failed: No result returned');
      }

      if (result.effects?.status?.status !== 'success') {
        console.error('❌ Delete transaction status:', result.effects?.status);
        throw new Error(`Delete transaction failed with status: ${result.effects?.status?.status || 'unknown'}`);
      }

      console.log('✅ Graph metadata deleted from SUI');

    } catch (error) {
      console.error('❌ Error deleting metadata from SUI:', error);
      console.error('❌ Delete error details:', {
        message: error instanceof Error ? error.message : String(error),
        graphId,
        packageId: this.packageId,
        registryId: this.registryId
      });
      throw new StorageError('Failed to delete graph metadata from SUI', 'delete', error);
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{ totalGraphs: number }> {
    try {
      if (!this.registryId) {
        return { totalGraphs: 0 };
      }

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${this.packageId}::graph_metadata::get_total_graphs`,
            arguments: [tx.object(this.registryId)],
          });
          return tx;
        })(),
        sender: '0x1',
      });

      // Parse result to get total count
      return { totalGraphs: 0 };

    } catch (error) {
      console.error('❌ Error getting registry stats:', error);
      return { totalGraphs: 0 };
    }
  }

  /**
   * Listen for graph events
   */
  async subscribeToGraphEvents(
    callback: (event: any) => void,
    filter?: { owner?: string }
  ): Promise<() => void> {
    try {
      // Event subscription temporarily disabled due to API changes
      console.log('Event subscription feature temporarily disabled');
      return () => {};
      
      /*
      // Subscribe to graph creation events
      const unsubscribe = await this.client.subscribeEvent({
        filter: {
          Package: this.packageId
        },
        onMessage: (event) => {
          // Filter events based on type and optional filters
          if (event.type.includes('GraphCreated') || 
              event.type.includes('GraphUpdated') || 
              event.type.includes('GraphDeleted')) {
            
            if (filter?.owner) {
              const eventData = event.parsedJson as any;
              if (eventData?.owner === filter.owner) {
                callback(event);
              }
            } else {
              callback(event);
            }
          }
        },
      });

      return unsubscribe;
      */

    } catch (error) {
      console.error('❌ Error subscribing to events:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Get transaction history for a graph
   */
  async getGraphHistory(graphId: string): Promise<any[]> {
    try {
      const transactions = await this.client.queryTransactionBlocks({
        filter: {
          InputObject: graphId
        },
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
        },
      });

      return transactions.data;

    } catch (error) {
      console.error('❌ Error getting graph history:', error);
      return [];
    }
  }
} 