const _tokenMintAccount = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";
const _recipientAssociatedTokenAccount =
  "BQwXm8MRfqqNkk9obcMFpejYN9UfEw9zUsdzHxWSax94";
const _qtyMint = 50;

import { mintTo } from "@solana/spl-token";
// import "dotenv/config";
require("dotenv").config();
// import {
//   getExplorerLink,
//   getKeypairFromEnvironment,
// } from "@solana-developers/helpers";

const {
  getKeypairFromEnvironment,
  getExplorerLink,
} = require("@solana-developers/helpers");

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));

  // Our token has two decimal places
  const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);

  const user = getKeypairFromEnvironment("SECRET_KEY");

  // Substitute in your token mint account from create-token-mint.ts
  const tokenMintAccount = new PublicKey(_tokenMintAccount);

  // Substitute in your own, or a friend's token account address, based on the previous step.
  const recipientAssociatedTokenAccount = new PublicKey(
    _recipientAssociatedTokenAccount
  );

  const transactionSignature = await mintTo(
    connection,
    user,
    tokenMintAccount,
    recipientAssociatedTokenAccount,
    user,
    _qtyMint * MINOR_UNITS_PER_MAJOR_UNITS
  );

  const link = getExplorerLink("transaction", transactionSignature, "devnet");

  console.log(`✅ Success! Mint Token Transaction: ${link}`);
  console.log("Minted tokens:", _qtyMint);
}

main().catch(console.log);
