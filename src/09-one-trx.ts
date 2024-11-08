require("dotenv").config(); // Cargar variables de entorno

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
  ConfirmOptions,
  TransactionInstruction,
} from "@solana/web3.js";

// Conexión a la red de Solana (Devnet)
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

async function sendTransactionToNetwork(
  transaction: Transaction,
  payer: Keypair, // Asegúrate de usar un Keypair
  accountKeypair: Keypair
): Promise<string> {
  // Establecer el feePayer y el bloque reciente para la transacción
  transaction.feePayer = payer.publicKey;
  const recentBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = recentBlockhash.blockhash;

  // Firmar la transacción con el Keypair del payer y accountKeypair
  transaction.sign(payer, accountKeypair);

  // Enviar la transacción a la red de Solana usando `sendAndConfirmTransaction`
  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, accountKeypair], // Los dos signers para la transacción
      {
        commitment: "confirmed", // Confirmación de la transacción
      }
    );

    console.log("Transacción enviada y confirmada. Txid:", txid);
    return txid; // Retornar el txid (string)
  } catch (error) {
    console.error("Error al enviar la transacción:", error);
    throw new Error("Error al enviar la transacción");
  }
}

function createAccountInstruction(
  payer: PublicKey,
  accountKeypair: Keypair, // Aseguramos que 'accountKeypair' sea de tipo 'Keypair'
  lamports: number,
  programId: PublicKey
): TransactionInstruction {
  return SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: accountKeypair.publicKey,
    space: MINT_SIZE,
    lamports,
    programId,
  });
}

async function createTokenTransaction(
  payer: Keypair, // 'payer' debe ser un Keypair
  accountKeypair: Keypair,
  lamports: number,
  decimals: number,
  programId: PublicKey,
  confirmOptions?: ConfirmOptions
): Promise<string> {
  // Crear las instrucciones por separado
  const instructions = [
    createAccountInstruction(
      payer.publicKey,
      accountKeypair,
      lamports,
      programId
    ),
    createInitializeMint2Instruction(
      accountKeypair.publicKey,
      decimals,
      payer.publicKey, // Se usa la clave pública del 'payer'
      programId
    ),
  ];

  // Crear la transacción e incluir las instrucciones
  const transaction = new Transaction().add(...instructions);

  // Enviar la transacción a la red y retornar el txid
  const sendTransactionResult = await sendTransactionToNetwork(
    transaction,
    payer, // Pasamos el 'payer' para firmar la transacción
    accountKeypair
  );

  return sendTransactionResult; // Retorna el txid como string
}

async function main() {
  // Cargar el par de claves del ambiente (asegúrate de que sea un Keypair)
  const payer = getKeypairFromEnvironment("SECRET_KEY") as Keypair; // Especificar que es un 'Keypair'

  // Verificar que el 'payer' tiene claves y está correctamente cargado
  if (!payer || !payer.secretKey) {
    throw new Error(
      "La clave secreta del payer no está configurada correctamente"
    );
  }

  // Generar el par de claves para el mint (la cuenta que va a contener el mint)
  const accountKeypair = Keypair.generate();

  // Obtener la cantidad de lamports necesarios para crear la cuenta
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  // Número de decimales para el token mint
  const decimals = 9;

  // ProgramId de SPL Token
  const programId = TOKEN_PROGRAM_ID;

  try {
    const txid = await createTokenTransaction(
      payer,
      accountKeypair,
      lamports,
      decimals,
      programId
    );
    console.log("Transacción completada. Txid:", txid);
  } catch (error) {
    console.error("Error creando transacción:", error);
  }
}

main().catch(console.log);
