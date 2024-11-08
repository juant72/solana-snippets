require("dotenv").config();
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const payer = getKeypairFromEnvironment("SECRET_KEY") as Keypair;

  if (!payer || !payer.secretKey) {
    throw new Error(
      "La clave secreta del payer no está configurada correctamente"
    );
  }

  const tokenMintAccount = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const decimals = 9;

  const _NAME = "Kulman Coin";
  const _SYMBOL = "KUL999";
  const _URI =
    "https://imgcdn.stablediffusionweb.com/2024/4/10/ac1f3df7-450c-41bc-8656-79ce78abccdd.jpg";
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const metadataPDAAndBump = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintAccount.publicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const metadataPDA = metadataPDAAndBump[0];

  const metadataData = {
    name: _NAME,
    symbol: _SYMBOL,
    uri: _URI,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const recipient = payer.publicKey;

  // Paso 1: Crear la cuenta para el token mint y su instrucción de inicialización
  const createMintAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: tokenMintAccount.publicKey,
    space: MINT_SIZE,
    lamports,
    programId: TOKEN_PROGRAM_ID,
  });

  const initializeMintInstruction = createInitializeMint2Instruction(
    tokenMintAccount.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_PROGRAM_ID
  );

  // Paso 2: Crear la cuenta asociada de token (ATA) para el destinatario
  const ata = await getAssociatedTokenAddress(
    tokenMintAccount.publicKey,
    recipient,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const createATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    recipient,
    tokenMintAccount.publicKey,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Paso 3: Crear la instrucción para los metadatos del token
  const metadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: tokenMintAccount.publicKey,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: metadataData,
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  // Paso 4: Crear la instrucción para mintear tokens
  const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
  const amountToMint = 1000000000 * MINOR_UNITS_PER_MAJOR_UNITS;
  const mintToInstruction = createMintToInstruction(
    tokenMintAccount.publicKey,
    ata,
    payer.publicKey,
    amountToMint,
    [],
    TOKEN_PROGRAM_ID
  );

  // Paso 5: Crear la instrucción para la comisión de 0.12 SOL
  const commissionAccount = new PublicKey(
    "B27VYjc1kDeXfXaVGhMsBwyAMn4zUZWHAeWSJgSE4Cp1"
  );
  const commissionLamports = 0.12 * 1_000_000_000; // Convertir 0.12 SOL a lamports

  const commissionInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: commissionAccount,
    lamports: commissionLamports,
  });

  // Crear una única transacción con todas las instrucciones
  const transaction = new Transaction().add(
    createMintAccountInstruction,
    initializeMintInstruction,
    createATAInstruction,
    metadataInstruction,
    mintToInstruction,
    commissionInstruction // Añadir la instrucción de comisión
  );

  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, tokenMintAccount],
      { commitment: "confirmed" }
    );
    console.log("Transacción completada. Txid:", txid);
  } catch (error) {
    console.error("Error al enviar la transacción:", error);
  }
}

main().catch(console.log);
