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
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

async function sendTransactionToNetwork(
  transaction: Transaction,
  payer: Keypair,
  tokenMintAccount: Keypair,
  connection: Connection
): Promise<string> {
  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, tokenMintAccount],
      { commitment: "confirmed" }
    );
    console.log("Transacción enviada y confirmada. Txid:", txid);
    return txid;
  } catch (error) {
    console.error("Error al enviar la transacción:", error);
    throw new Error("Error al enviar la transacción");
  }
}

function createAccountInstruction(
  payer: PublicKey,
  tokenMintAccount: Keypair,
  lamports: number,
  programId: PublicKey
): TransactionInstruction {
  return SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: tokenMintAccount.publicKey,
    space: MINT_SIZE,
    lamports,
    programId,
  });
}

// Función para verificar o crear la cuenta asociada de token (ATA)
async function getOrCreateAssociatedTokenAccount2(
  connection: Connection,
  payer: Keypair,
  tokenMintAccount: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddressSync(
    tokenMintAccount,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  console.log("ATA calculated:", ata.toBase58());

  const accountInfo = await connection.getAccountInfo(ata);
  if (accountInfo) {
    console.log("La cuenta asociada de token ya existe:", ata.toBase58());
    return ata;
  }

  const ataInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    tokenMintAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(ataInstruction);
  await sendAndConfirmTransaction(connection, transaction, [payer]);
  console.log("Cuenta ATA creada:", ata.toBase58());

  return ata;
}

async function createTokenTransaction(
  payer: Keypair,
  tokenMintAccount: Keypair,
  lamports: number,
  decimals: number,
  programId: PublicKey,
  metadataData: any,
  connection: Connection,
  recipient: PublicKey,
  confirmOptions?: any
): Promise<string> {
  const instructions = [
    createAccountInstruction(
      payer.publicKey,
      tokenMintAccount,
      lamports,
      programId
    ),
    createInitializeMint2Instruction(
      tokenMintAccount.publicKey,
      decimals,
      payer.publicKey,
      programId
    ),
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataData.metadataPDA,
        mint: tokenMintAccount.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          collectionDetails: null,
          data: metadataData.metadataData,
          isMutable: true,
        },
      }
    ),
  ];

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    tokenMintAccount.publicKey,
    recipient
  );

  const transaction = new Transaction().add(...instructions);
  const sendTransactionResult = await sendTransactionToNetwork(
    transaction,
    payer,
    tokenMintAccount,
    connection
  );
  return sendTransactionResult;
}

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
  const programId = TOKEN_PROGRAM_ID;

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
    metadataPDA,
    metadataData: {
      name: _NAME,
      symbol: _SYMBOL,
      uri: _URI,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
  };

  const recipient = payer.publicKey;

  try {
    const txid = await createTokenTransaction(
      payer,
      tokenMintAccount,
      lamports,
      decimals,
      programId,
      metadataData,
      connection,
      recipient
    );
    console.log("Transacción completada. Txid:", txid);
  } catch (error) {
    console.error("Error creando transacción:", error);
  }
}

main().catch(console.log);
