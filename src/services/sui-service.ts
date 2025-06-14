import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

import { 
  GraphMetadata, 
  GraphVersionHistoryEntry,
  TransactionResult,
  VersionInfo
} from './types';
import { CONSTANTS } from '@/constants';
import { StorageError } from './types';

type ObjectChange = {
  type?: string;
  objectType?: string;
  objectId?: string;
  version?: number;
  previousVersion?: number;
  digest?: string;
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
      // const created = result.objectChanges?.find(
      //   (change: unknown) => {
      //     const objChange = change as ObjectChange;
      //     return objChange.type === 'created' && 
      //            objChange.objectType?.includes('GraphMetadata');
      //   }
      // ) as ObjectChange | undefined;

      const metadataObjects = result.objectChanges?.filter(
        (change: unknown) => {
          const objChange = change as ObjectChange;
          return objChange.type === 'created' && 
                 objChange.objectType?.includes('GraphMetadata');
        }
      ).map((change: unknown) => {
        const objChange = change as ObjectChange;
        return {
          objectId: objChange.objectId || '',
          version: objChange.version || 0,
          owner: '', // Will be filled from the transaction sender
        };
      }) || [];

      if (metadataObjects.length > 0) {
        const metadataObject = metadataObjects[0];
        
        // Add default currentVersionInfo for backward compatibility
        // const defaultVersionInfo: VersionInfo = {
        //   blobId: metadata.blobId,
        //   nodeCount: metadata.nodeCount,
        //   relationshipCount: metadata.relationshipCount,
        //   changes: "Initial version",
        //   createdAt: Date.now(),
        //   createdBy: metadataObject.owner,
        // };

        return metadataObject.objectId;
      }

      throw new Error('Failed to create graph metadata object. No GraphMetadata object found in transaction result.');

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
   * NEW: Create a new version of an existing graph
   */
  async createNewGraphVersion(
    graphId: string,
    versionData: {
      blobId: string;
      nodeCount: number;
      relationshipCount: number;
      changes: string;
    },
    signAndExecute: SignAndExecuteFunction
  ): Promise<number> {
    try {
      console.log('📡 Creating new graph version...');
      console.log('🆔 Graph ID:', graphId);
      console.log('📋 Version data:', versionData);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::graph_metadata::create_new_version`,
        arguments: [
          tx.object(graphId),
          tx.pure.string(versionData.blobId),
          tx.pure.u64(versionData.nodeCount),
          tx.pure.u64(versionData.relationshipCount),
          tx.pure.string(versionData.changes),
          tx.object(CONSTANTS.clockObjectId),
        ],
      });

      const txResult = await signAndExecute({
        transaction: tx,
        options: { showEffects: true, showEvents: true }
      });

      console.log('✅ Version creation transaction result:', txResult);

      // Extract version number from event
      let versionNumber = 0;
      if (txResult.events && Array.isArray(txResult.events)) {
        const versionEvent = txResult.events.find(
          (event: { type: string; parsedJson?: { version?: number } }) => 
            event.type.includes('VersionCreated')
        );
        versionNumber = versionEvent?.parsedJson?.version || 0;
      }

      return versionNumber;
    } catch (error) {
      console.error('❌ Error creating new graph version:', error);
      throw error;
    }
  }

  /**
   * NEW: Switch to a different version of the graph
   */
  async switchToGraphVersion(
    graphId: string,
    targetVersion: number,
    signAndExecute: SignAndExecuteFunction
  ): Promise<void> {
    try {
      console.log('📡 Switching graph version...');
      console.log('🆔 Graph ID:', graphId);
      console.log('🎯 Target version:', targetVersion);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::graph_metadata::switch_to_version`,
        arguments: [
          tx.object(graphId),
          tx.pure.u64(targetVersion),
          tx.object(CONSTANTS.clockObjectId),
        ],
      });

      await signAndExecute({
        transaction: tx,
        options: { showEffects: true, showEvents: true }
      });

      console.log('✅ Version switch completed');
    } catch (error) {
      console.error('❌ Error switching graph version:', error);
      throw error;
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
      
      // Add default currentVersionInfo for backward compatibility
      const defaultVersionInfo: VersionInfo = {
        blobId: fields.blob_id,
        nodeCount: Number(fields.node_count),
        relationshipCount: Number(fields.relationship_count),
        changes: "Initial version",
        createdAt: Number(fields.created_at),
        createdBy: fields.owner,
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
        isPublic: Boolean(fields.is_public),
        tags: fields.tags,
        version: Number(fields.version || 1),
        currentVersionInfo: defaultVersionInfo,
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
          const content = obj.data!.content;
          if (!content || content.dataType !== 'moveObject') {
            throw new Error('Unexpected object content type');
          }
          
          // Cast to the correct type for moveObject content
          const moveContent = content as { fields: Record<string, unknown> };
          if (!moveContent.fields) {
            throw new Error('Missing fields in move object');
          }
          
          const fields = moveContent.fields as {
            id: { id: string } | string;
            name: string;
            description: string;
            blob_id: string;
            owner: string;
            created_at: string;
            updated_at: string;
            node_count: string;
            relationship_count: string;
            is_public: boolean;
            tags: { fields?: { contents?: string[] } } | string[];
            version: string;
          };
          
          // Handle different field formats
          const id = typeof fields.id === 'object' ? fields.id.id : fields.id;
          const tags = Array.isArray(fields.tags) ? fields.tags : (fields.tags?.fields?.contents || []);
          
          // Add default currentVersionInfo for backward compatibility
          const defaultVersionInfo: VersionInfo = {
            blobId: fields.blob_id,
            nodeCount: Number(fields.node_count),
            relationshipCount: Number(fields.relationship_count),
            changes: "Initial version",
            createdAt: Number(fields.created_at),
            createdBy: fields.owner,
          };

          return {
            id: id,
            name: fields.name,
            description: fields.description,
            blobId: fields.blob_id,
            owner: fields.owner,
            createdAt: Number(fields.created_at),
            updatedAt: Number(fields.updated_at),
            nodeCount: Number(fields.node_count),
            relationshipCount: Number(fields.relationship_count),
            isPublic: fields.is_public,
            tags: tags,
            version: Number(fields.version || 1),
            currentVersionInfo: defaultVersionInfo,
          };
        });
    } catch (error) {
      console.error('❌ Error getting user graphs from SUI:', error);
      // Return empty array instead of throwing to gracefully handle errors
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
    callback: (event: {
      type: string;
      data: {
        graphId?: string;
        owner?: string;
        name?: string;
        blobId?: string;
        isPublic?: boolean;
        sharedWith?: string;
      };
    }) => void,
    filter?: { owner?: string }
  ): Promise<() => void> {
    try {
      console.log('🔔 Setting up event subscription...');
      
      // Check if WebSocket connections are supported/available
      if (typeof WebSocket === 'undefined') {
        console.warn('⚠️ WebSocket not supported, skipping event subscription');
        return () => console.log('📵 No events to unsubscribe from (WebSocket not supported)');
      }

      const subscriptions: Array<() => Promise<boolean>> = [];
      let isSubscribed = false;

      try {
        // Subscribe to GraphCreated events with timeout
        console.log('🔔 Subscribing to GraphCreated events...');
        const createdSubPromise = this.client.subscribeEvent({
          filter: {
            MoveEventType: `${this.packageId}::graph_metadata::GraphCreated`
          },
          onMessage: (event) => {
            console.log('📧 GraphCreated event received:', event);
            
            const parsedJson = event.parsedJson as {
              graph_id?: string;
              owner?: string;
              name?: string;
              blob_id?: string;
              is_public?: boolean;
            };
            
            // Filter by owner if specified
            if (filter?.owner && parsedJson.owner !== filter.owner) {
              return;
            }
            
            callback({
              type: 'GraphCreated',
              data: {
                graphId: parsedJson.graph_id,
                owner: parsedJson.owner,
                name: parsedJson.name,
                blobId: parsedJson.blob_id,
                isPublic: parsedJson.is_public
              }
            });
          }
        });

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<() => Promise<boolean>>((_, reject) => {
          setTimeout(() => reject(new Error('Event subscription timeout')), 10000); // 10 second timeout
        });

        const createdSub = await Promise.race([createdSubPromise, timeoutPromise]);
        subscriptions.push(createdSub);
        console.log('✅ GraphCreated subscription established');

        // Only try other subscriptions if the first one succeeds
        try {
          const updatedSub = await this.client.subscribeEvent({
            filter: {
              MoveEventType: `${this.packageId}::graph_metadata::GraphUpdated`
            },
            onMessage: (event) => {
              console.log('📧 GraphUpdated event received:', event);
              
              const parsedJson = event.parsedJson as {
                graph_id?: string;
                owner?: string;
                name?: string;
                blob_id?: string;
                version?: number;
              };
              
              if (filter?.owner && parsedJson.owner !== filter.owner) {
                return;
              }
              
              callback({
                type: 'GraphUpdated',
                data: {
                  graphId: parsedJson.graph_id,
                  owner: parsedJson.owner,
                  name: parsedJson.name,
                  blobId: parsedJson.blob_id
                }
              });
            }
          });
          subscriptions.push(updatedSub);
          console.log('✅ GraphUpdated subscription established');

          const sharedSub = await this.client.subscribeEvent({
            filter: {
              MoveEventType: `${this.packageId}::graph_metadata::GraphShared`
            },
            onMessage: (event) => {
              console.log('📧 GraphShared event received:', event);
              
              const parsedJson = event.parsedJson as {
                graph_id?: string;
                owner?: string;
                shared_with?: string;
              };
              
              if (filter?.owner && parsedJson.owner !== filter.owner && parsedJson.shared_with !== filter.owner) {
                return;
              }
              
              callback({
                type: 'GraphShared',
                data: {
                  graphId: parsedJson.graph_id,
                  owner: parsedJson.owner,
                  sharedWith: parsedJson.shared_with
                }
              });
            }
          });
          subscriptions.push(sharedSub);
          console.log('✅ GraphShared subscription established');

        } catch (additionalSubError) {
          console.warn('⚠️ Some event subscriptions failed, continuing with partial subscription:', additionalSubError);
        }

        isSubscribed = true;
        console.log('✅ Event subscriptions established successfully');

      } catch (subscriptionError) {
        console.warn('⚠️ Event subscription failed:', subscriptionError);
        
        // Clean up any partial subscriptions
        for (const sub of subscriptions) {
          try {
            await sub();
          } catch (cleanupError) {
            console.warn('⚠️ Error cleaning up partial subscription:', cleanupError);
          }
        }
        
        // Return a no-op unsubscribe function
        return () => {
          console.log('📵 No active event subscriptions to clean up');
        };
      }

      // Return unsubscribe function
      return async () => {
        console.log('🔄 Unsubscribing from graph events...');
        
        if (!isSubscribed || subscriptions.length === 0) {
          console.log('📵 No active subscriptions to clean up');
          return;
        }

        try {
          const results = await Promise.allSettled(subscriptions.map(sub => sub()));
          const successful = results.filter(r => r.status === 'fulfilled').length;
          console.log(`✅ Successfully unsubscribed from ${successful}/${subscriptions.length} events`);
        } catch (error) {
          console.warn('⚠️ Some errors occurred while unsubscribing:', error);
        }
      };

    } catch (error) {
      console.warn('⚠️ Event subscription setup failed completely:', error);
      
      // Return a no-op unsubscribe function for failed setup
      return () => {
        console.log('📵 Event subscription was never established, no cleanup needed');
      };
    }
  }

  /**
   * Get graph history by querying transactions and events
   */
  async getGraphHistory(graphId: string): Promise<Array<{
    version: number;
    changedAt: number;
    changes: string;
    transactionDigest: string;
    eventType: string;
  }>> {
    try {
      console.log(`📜 Fetching real history for graph ${graphId}...`);
      
      const history: Array<{
        version: number;
        changedAt: number;
        changes: string;
        transactionDigest: string;
        eventType: string;
      }> = [];

      // Query for events related to this graph
      try {
        // Query GraphCreated events
        const createdEvents = await this.client.queryEvents({
          query: {
            MoveEventType: `${this.packageId}::graph_metadata::GraphCreated`
          }
        });

        // Query GraphUpdated events  
        const updatedEvents = await this.client.queryEvents({
          query: {
            MoveEventType: `${this.packageId}::graph_metadata::GraphUpdated`
          }
        });

        // Query GraphShared events
        const sharedEvents = await this.client.queryEvents({
          query: {
            MoveEventType: `${this.packageId}::graph_metadata::GraphShared`
          }
        });

        // Process GraphCreated events
        for (const event of createdEvents.data) {
          const parsedJson = event.parsedJson as {
            graph_id?: string;
            owner?: string;
            name?: string;
            is_public?: boolean;
          };
          
          if (parsedJson.graph_id === graphId) {
            history.push({
              version: 1,
              changedAt: parseInt(event.timestampMs || '0'),
              changes: `Graph created: "${parsedJson.name}" by ${parsedJson.owner}`,
              transactionDigest: event.id.txDigest,
              eventType: 'GraphCreated'
            });
          }
        }

        // Process GraphUpdated events
        for (const event of updatedEvents.data) {
          const parsedJson = event.parsedJson as {
            graph_id?: string;
            owner?: string;
            name?: string;
            version?: number;
          };
          
          if (parsedJson.graph_id === graphId) {
            history.push({
              version: parsedJson.version || 1,
              changedAt: parseInt(event.timestampMs || '0'),
              changes: `Graph updated: "${parsedJson.name}" (v${parsedJson.version})`,
              transactionDigest: event.id.txDigest,
              eventType: 'GraphUpdated'
            });
          }
        }

        // Process GraphShared events
        for (const event of sharedEvents.data) {
          const parsedJson = event.parsedJson as {
            graph_id?: string;
            owner?: string;
            shared_with?: string;
          };
          
          if (parsedJson.graph_id === graphId) {
            history.push({
              version: 0, // Sharing doesn't change version
              changedAt: parseInt(event.timestampMs || '0'),
              changes: `Graph shared with ${parsedJson.shared_with}`,
              transactionDigest: event.id.txDigest,
              eventType: 'GraphShared'
            });
          }
        }

        // Sort by timestamp, most recent first
        history.sort((a, b) => b.changedAt - a.changedAt);

        console.log(`✅ Found ${history.length} history entries for graph ${graphId}`);
        return history;

      } catch (eventError) {
        console.warn('⚠️ Could not fetch events, returning basic history:', eventError);
        
        // Fallback: return basic history with just creation info
        try {
          const graphMetadata = await this.getGraphMetadata(graphId);
          if (graphMetadata) {
            return [{
              version: graphMetadata.version,
              changedAt: graphMetadata.createdAt,
              changes: `Graph created: "${graphMetadata.name}"`,
              transactionDigest: 'unknown',
              eventType: 'GraphCreated'
            }];
          }
        } catch (metadataError) {
          console.error('❌ Could not fetch graph metadata for history:', metadataError);
        }
        
        return [];
      }
    } catch (error) {
      console.error(`❌ Error fetching history for graph ${graphId}:`, error);
      return [];
    }
  }

  /**
   * Get graph version history by reading events
   */
  async getGraphVersionHistory(graphId: string): Promise<GraphVersionHistoryEntry[]> {
    try {
      console.log('📡 Fetching version history for graph:', graphId);

      // Query VersionCreated events for this graph
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::graph_metadata::VersionCreated`
        },
        limit: 50,
        order: 'descending'
      });

      const versionHistory: GraphVersionHistoryEntry[] = [];

      for (const event of events.data) {
        if (event.parsedJson && 
            typeof event.parsedJson === 'object' && 
            'graph_id' in event.parsedJson &&
            event.parsedJson.graph_id === graphId) {
          
          const parsedEvent = event.parsedJson as {
            graph_id: string;
            version: number;
            blob_id: string;
            changes: string;
            owner: string;
          };

          versionHistory.push({
            version: parsedEvent.version,
            blobId: parsedEvent.blob_id,
            changes: parsedEvent.changes,
            createdAt: parseInt(event.timestampMs || '0'),
            createdBy: parsedEvent.owner,
            nodeCount: 0, // Would need additional event data
            relationshipCount: 0, // Would need additional event data
          });
        }
      }

      console.log('✅ Found', versionHistory.length, 'version entries');
      return versionHistory.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('❌ Error fetching version history:', error);
      return [];
    }
  }
}