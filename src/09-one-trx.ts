require("dotenv").config();
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
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

  const _NAME = "Sumi";
  const _SYMBOL = "SUMI";
  const _URI = "https://arweave.net/1234";

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

  // Crear una única transacción con todas las instrucciones
  const transaction = new Transaction().add(
    createMintAccountInstruction,
    initializeMintInstruction,
    createATAInstruction,
    metadataInstruction
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
