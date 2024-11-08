require("dotenv").config();
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
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
  payer: Keypair, // Asegúrate de usar un Keypair
  tokenMintAccount: Keypair,
  connection: Connection
): Promise<string> {
  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, tokenMintAccount], // El Keypair que firma la transacción
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
  tokenMintAccount: Keypair, // Aseguramos que 'accountKeypair' sea de tipo 'Keypair'
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

async function createTokenTransaction(
  payer: Keypair, // 'payer' debe ser un Keypair
  tokenMintAccount: Keypair,
  lamports: number,
  decimals: number,
  programId: PublicKey,
  metadataData: any,
  connection: Connection,
  confirmOptions?: any
): Promise<string> {
  // Crear las instrucciones por separado
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
    // Crear la instrucción de metadata
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

  const payer = getKeypairFromEnvironment("SECRET_KEY") as Keypair; // Especificar que es un 'Keypair'

  // Verificar que el 'payer' tiene claves y está correctamente cargado
  if (!payer || !payer.secretKey) {
    throw new Error(
      "La clave secreta del payer no está configurada correctamente"
    );
  }

  const tokenMintAccount = Keypair.generate();

  // Obtener la cantidad de lamports necesarios para crear la cuenta
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const decimals = 9;
  const programId = TOKEN_PROGRAM_ID;

  // Variables de metadata
  const _NAME = "Sumi";
  const _SYMBOL = "SUMI";
  const _URI = "https://arweave.net/1234"; // Arweave/IPFS link

  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  // Datos de metadata
  const metadataPDAAndBump = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintAccount.publicKey.toBuffer(), // Usar el mint del token
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const metadataPDA = metadataPDAAndBump[0];

  const metadataData = {
    metadataPDA, // Usamos la PDA correctamente calculada
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

  try {
    const txid = await createTokenTransaction(
      payer,
      tokenMintAccount,
      lamports,
      decimals,
      programId,
      metadataData,
      connection
    );
    console.log("Transacción completada. Txid:", txid);
  } catch (error) {
    console.error("Error creando transacción:", error);
  }
}

main().catch(console.log);
