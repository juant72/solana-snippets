const _TOKEN_MINT_ADDRESS = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";

import "dotenv/config";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { revoke, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

async function main() {
  const DEVNET_URL = clusterApiUrl("devnet");
  // Substitute your token mint address
  const TOKEN_MINT_ADDRESS = _TOKEN_MINT_ADDRESS;

  const connection = new Connection(DEVNET_URL);
  const user = getKeypairFromEnvironment("SECRET_KEY");

  console.log(`🔑 Loaded keypair. Public key: ${user.publicKey.toBase58()}`);

  try {
    const tokenMintAddress = new PublicKey(TOKEN_MINT_ADDRESS);

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      tokenMintAddress,
      user.publicKey
    );
    console.log("Get Token Account", userTokenAccount.address.toBase58());
    const revokeTransactionSignature = await revoke(
      connection,
      user,
      userTokenAccount.address,
      user.publicKey
    );

    const explorerLink = getExplorerLink(
      "transaction",
      revokeTransactionSignature,
      "devnet"
    );

    console.log(`✅ Revoke Delegate Transaction: ${explorerLink}`);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

main().catch(console.log);
