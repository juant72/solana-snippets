const _tokenMintAccount = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";
const _recipient = "J5F8dTpEq8uNdQmrnYALPN2KMHhWLzaJpsU21E6Gv5bR"; // target account for transfer

import "dotenv/config";
import {
  getExplorerLink,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { Console } from "console";

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));

  const sender = getKeypairFromEnvironment("SECRET_KEY");

  console.log(
    `🔑 Loaded our keypair securely, using an env file! Our public key is: ${sender.publicKey.toBase58()}`
  );

  // Add the recipient public key here.
  const recipient = new PublicKey(_recipient);

  // Substitute in your token mint account
  const tokenMintAccount = new PublicKey(_tokenMintAccount);

  // Our token has two decimal places
  const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);

  console.log(`💸 Attempting to send 1 token to ${recipient.toBase58()}...`);

  // Get or create the source token account to store this token
  const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    tokenMintAccount,
    sender.publicKey
  );

  console.log("Source token account:", sourceTokenAccount.address.toBase58());

  // Get or create the destination token account to store this token
  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    tokenMintAccount,
    recipient
  );
  console.log(
    "Destination token account: ",
    destinationTokenAccount.address.toBase58()
  );

  // Transfer the tokens
  const signature = await transfer(
    connection,
    sender,
    sourceTokenAccount.address,
    destinationTokenAccount.address,
    sender,
    1 * MINOR_UNITS_PER_MAJOR_UNITS
  );

  const explorerLink = getExplorerLink("transaction", signature, "devnet");

  console.log(`✅ Transaction confirmed, explorer link is: ${explorerLink}`);
}

main().catch(console.log);
