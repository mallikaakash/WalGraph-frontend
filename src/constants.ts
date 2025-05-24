// Contract Configuration
export const CONSTANTS = {
  // Sui Contract Addresses
  packageId: "0xe21c81834611d67b92751acb642d8b6587ce5da730cebace0d5f874015b92afa",
  registryId: "0xc09065c827a619ee2a3206017ddcd748ec89e4ac1520dbef57c2ef27e711d9fc",
  
  // Walrus Configuration - Using working testnet endpoints
  walrusPublisherUrl: "https://walrus-testnet-publisher.natsai.xyz",
  walrusAggregatorUrl: "https://walrus-testnet-aggregator.natsai.xyz",
  
  // Network Configuration
  suiNetwork: "testnet" as const,
  
  // Graph Types
  graphMetadataType: "0xe21c81834611d67b92751acb642d8b6587ce5da730cebace0d5f874015b92afa::graph_metadata::GraphMetadata",
  registryType: "0xe21c81834611d67b92751acb642d8b6587ce5da730cebace0d5f874015b92afa::graph_metadata::GraphRegistry",
  
  // Clock object for Sui transactions
  clockObjectId: "0x6",
}; 