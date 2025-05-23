import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

const getSigner = () => {
  const mnemonic = 'your_mnemonic_phrase'; // Replace with user's mnemonic
  return Ed25519Keypair.deriveKeypair(mnemonic);
};

export { client, getSigner };