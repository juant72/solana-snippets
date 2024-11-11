import * as dotenv from "dotenv";
dotenv.config();

import PinataSDK from "@pinata/sdk";
import {
  createInitializeMint2Instruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  SystemProgram,
  Transaction,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Server } from "socket.io";
import http from "http";

const port = process.env.PORT || 3000;
const pinata = new PinataSDK({ pinataJWTKey: process.env.PINATA_JWT! });

// Crear un servidor HTTP para usar con Socket.IO
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir todas las conexiones
  },
});

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.emit("server_message", "Bienvenido al servidor WebSocket de Solana!");

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

  // Paso 1: Cliente solicita la creación del token
  socket.on("create_token", async (data) => {
    try {
      const { name, symbol, description, imageURI, publicKey } = data;

      // Validamos los parámetros recibidos
      if (!name || !symbol || !description || !imageURI || !publicKey) {
        throw new Error("Faltan parámetros necesarios.");
      }

      console.log("Calculamos los costos y generamos la transacción");
      // Calculamos los costos y generamos la transacción
      const { transactionDetails, estimatedGas } =
        await prepareTokenTransaction(
          name,
          symbol,
          description,
          imageURI,
          publicKey
        );

      // Paso 3: Enviar detalles de la transacción al cliente
      socket.emit("transaction_details", {
        transaction: transactionDetails,
        estimatedGas,
      });
    } catch (error) {
      console.error("Error al procesar la solicitud:", error);
      socket.emit("error", { message: "Error al procesar la solicitud." });
    }
  });

  // Paso 4: Cliente firma la transacción
  socket.on("signed_transaction", async (signedTransaction) => {
    try {
      const { signedTransactionData } = signedTransaction;

      // Validar y ejecutar la transacción en la blockchain
      const result = await executeTransaction(signedTransactionData);

      // Paso 5: Enviar el resultado al cliente
      socket.emit("transaction_result", result);
    } catch (error) {
      console.error("Error al ejecutar la transacción:", error);
      socket.emit("error", { message: "Error al ejecutar la transacción." });
    }
  });
});

// Función para obtener el recentBlockhash
async function getRecentBlockhash() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  if (!blockhash) {
    throw new Error("No se pudo obtener el recentBlockhash.");
  }

  return { blockhash, lastValidBlockHeight };
}

// Función para preparar la transacción de creación de token
async function prepareTokenTransaction(
  name: string,
  symbol: string,
  description: string,
  imageURI: string,
  publicKey: string
) {
  try {
    const connection = new Connection(clusterApiUrl("devnet"));
    const tokenMintAccount = Keypair.generate();
    console.log("Token MINT account:", tokenMintAccount.publicKey.toBase58());
    const lamports = await connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );
    const decimals = 9;

    // Obtener el recentBlockhash y el lastValidBlockHeight
    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();

    const publicKeyObject = new PublicKey(publicKey);

    // Instrucción para crear la cuenta de token mint
    const createTokenAccountInstruction = SystemProgram.createAccount({
      fromPubkey: publicKeyObject,
      newAccountPubkey: tokenMintAccount.publicKey,
      lamports,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    const initMintInstruction = createInitializeMint2Instruction(
      tokenMintAccount.publicKey,
      decimals,
      publicKeyObject, // Usar la clave pública del cliente como mint authority
      publicKeyObject // Usar la clave pública del cliente como freeze authority
    );

    const transaction = new Transaction().add(
      createTokenAccountInstruction,
      initMintInstruction
    );

    // Asignar el recentBlockhash a la transacción
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = publicKeyObject; // Establecer el feePayer correctamente
    console.log("Fee payer: ", transaction.feePayer);
    console.log("# signs: ", transaction.signatures.length);

    // Añadir la cuenta de mint a la transacción para ser firmada por el cliente
    transaction.sign(tokenMintAccount); // Agregar la firma de la cuenta de mint

    // Calculamos el gas estimado
    const estimatedGas = await connection.getFeeForMessage(
      transaction.compileMessage()
    );

    console.log("TRX to send: ", transaction);

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: true,
    });

    const transactionBase64 = serializedTransaction.toString("base64");

    return {
      // transactionDetails: transaction,
      transactionDetails: transactionBase64,
      estimatedGas,
    };
  } catch (error) {
    console.error("Error en la preparación de la transacción:", error);
    throw error;
  }
}

// Función para ejecutar la transacción en la blockchain
async function executeTransaction(signedTransactionData: string) {
  try {
    const connection = new Connection(clusterApiUrl("devnet"));
    const signedTransaction = Transaction.from(
      Buffer.from(signedTransactionData, "base64")
    );

    console.log("Signed transaction: ", signedTransaction);

    const txid = await sendAndConfirmTransaction(
      connection,
      signedTransaction,
      [] // Aquí se podría añadir el array de firmas necesarias si corresponde
    );
    return { success: true, transactionId: txid };
  } catch (error) {
    console.error("Error al ejecutar la transacción:", error);
    throw error;
  }
}

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
