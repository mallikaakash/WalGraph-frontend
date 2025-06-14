// Contract Configuration
export const CONSTANTS = {
  // Sui Contract Addresses - Updated with newly deployed contract
  packageId: "0xf09c72dec8a6360808719e798ea59b625bcf4a8489ca00fc9fd380e3e645376d",
  registryId: "0x5281a565ac0f401591a192a8b39a49e65b711dd3baf351644556227a0f5643dd",
  
  // Walrus Configuration - Using working testnet endpoints
  walrusPublisherUrl: "https://walrus-testnet-publisher.natsai.xyz",
  walrusAggregatorUrl: "https://walrus-testnet-aggregator.natsai.xyz",
  
  // Network Configuration
  suiNetwork: "testnet" as const,
  
  // Graph Types - Updated with new package ID
  graphMetadataType: "0xf09c72dec8a6360808719e798ea59b625bcf4a8489ca00fc9fd380e3e645376d::graph_metadata::GraphMetadata",
  registryType: "0xf09c72dec8a6360808719e798ea59b625bcf4a8489ca00fc9fd380e3e645376d::graph_metadata::GraphRegistry",
  
  // Clock object for Sui transactions
  clockObjectId: "0x6",
}; 