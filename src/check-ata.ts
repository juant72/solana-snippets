const _tokenMintAccount = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";

import { mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
require("dotenv").config();

const {
  getKeypairFromEnvironment,
  getExplorerLink,
} = require("@solana-developers/helpers");

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
  const user = getKeypairFromEnvironment("SECRET_KEY");

  // Clave pública de tu token mint
  const tokenMintAccount = new PublicKey(_tokenMintAccount);

  // Crea o obtiene la cuenta de token asociada para el destinatario
  const recipientAssociatedTokenAccount =
    await getOrCreateAssociatedTokenAccount(
      connection,
      user, // Pagador
      tokenMintAccount, // Cuenta de mint del token
      user.publicKey // Dirección del destinatario
    );

  console.log(
    "Token Account: ",
    recipientAssociatedTokenAccount.address.toBase58()
  );

  // Realiza la transacción de minting
  const transactionSignature = await mintTo(
    connection,
    user, // Cuenta del pagador
    tokenMintAccount, // Mint del token
    recipientAssociatedTokenAccount.address, // Dirección de la cuenta de token asociada
    user, // Autoridad del mint
    10 * MINOR_UNITS_PER_MAJOR_UNITS // Cantidad de tokens a crear
  );

  const link = getExplorerLink("transaction", transactionSignature, "devnet");
  console.log(`✅ Success! Mint Token Transaction: ${link}`);
  console.log(
    "Cuenta asociada:",
    recipientAssociatedTokenAccount.address.toBase58()
  );
}

main().catch(console.error);
