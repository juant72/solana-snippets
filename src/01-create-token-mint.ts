// Usar require para cargar dotenv
require("dotenv").config(); // Cargar variables de entorno

import { createMint } from "@solana/spl-token";
import {
  getKeypairFromEnvironment,
  getExplorerLink,
} from "@solana-developers/helpers";
import { Connection, clusterApiUrl } from "@solana/web3.js";

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));

  const user = getKeypairFromEnvironment("SECRET_KEY");

  console.log(
    `🔑 Loaded our keypair securely, using an env file! Our public key is: ${user.publicKey.toBase58()}`
  );

  // return the public key of the new token
  const tokenMint = await createMint(
    connection, // Connection
    user, // payer
    user.publicKey, // mint authority
    null, // Freeze Authority
    2 // decimals
  );

  const link = getExplorerLink("address", tokenMint.toString(), "devnet");

  console.log(`✅ Finished! Created token mint: ${link}`);
  console.log("Token Mint address: ", tokenMint.toString());
}

// Ejecuta la función main
main().catch(console.error);
