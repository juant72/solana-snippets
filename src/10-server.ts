import { connection } from "./../../aktyvo/app/utils/connection";
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
import fs from "fs";
import path from "path";
import { Readable } from "stream";

//////////// END IMPORTS ////////////////

let tokenMintAccount: Keypair;

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
      const {
        name,
        symbol,
        description,
        imageData,
        decimals,
        supply,
        publicKey,
        revokeFreeze,
        revokeMint,
      } = data;

      // Validamos los parámetros recibidos
      if (
        !name ||
        !symbol ||
        !description ||
        !imageData ||
        !decimals ||
        !supply ||
        !publicKey ||
        !revokeFreeze ||
        !revokeMint
      ) {
        throw new Error("Faltan parámetros necesarios.");
      }

      console.log("Calculamos los costos y generamos la transacción");
      // Calculamos los costos y generamos la transacción
      const { transactionDetails, estimatedGas } =
        await prepareTokenTransaction(
          name,
          symbol,
          description,
          imageData,
          decimals,
          supply,
          publicKey,
          revokeFreeze,
          revokeMint
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
      console.log("Iniciando proceso de envio de TRX a Blockchain");
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
    await connection.getLatestBlockhash("finalized");

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
  imageData: string,
  decimals: number,
  supply: BigInt,
  payerPublicKey: string,
  revokeFreeze: boolean,
  revokeMint: boolean
) {
  try {
    const connection = new Connection(clusterApiUrl("devnet"));
    tokenMintAccount = Keypair.generate();
    console.log("Token MINT account:", tokenMintAccount.publicKey.toBase58());
    const lamports = await connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );

    // Preparing Metadata Stuff
    // Derive the Program Derived Address (PDA) for token metadata
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );

    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        tokenMintAccount.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Manipuling image token
    // Upload image and metadata JSON to Pinata

    const imageStream = base64ToReadableStream(imageData);
    // const imageURI = await uploadToPinata(path.resolve("tokenlogo.png"));
    const imageIpfsURI = await uploadReadableStreamToPinata(imageStream);

    const metadataJsonString = await createMetadataJSON(
      imageIpfsURI,
      name,
      symbol,
      description
    );

    const metadataIpfsURI = await uploadJsonToPinata(
      stringToReadableStream(metadataJsonString)
    );
    console.log("Metadata IPFS JSon URI:", metadataIpfsURI);

    // Obtener el recentBlockhash y el lastValidBlockHeight
    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();

    // El address del payer
    const payerPublicKeyObject = new PublicKey(payerPublicKey);

    // Instrucción para crear la cuenta de token mint
    const createTokenAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payerPublicKeyObject,
      newAccountPubkey: tokenMintAccount.publicKey,
      lamports,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    const initMintInstruction = createInitializeMint2Instruction(
      tokenMintAccount.publicKey,
      decimals,
      payerPublicKeyObject, // Usar la clave pública del cliente como mint authority
      payerPublicKeyObject // Usar la clave pública del cliente como freeze authority
    );
    // el mint Authority al principio debe permitir mintear los tokens

    // Armo la transaccion
    const transaction = new Transaction().add(
      createTokenAccountInstruction,
      initMintInstruction
    );

    // Asignar el recentBlockhash a la transacción
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payerPublicKeyObject; // Establecer el feePayer correctamente
    console.log("Fee payer: ", transaction.feePayer);
    console.log("# signs: ", transaction.signatures.length);
    console.log("Blockhash Server out", blockhash);

    // Añadir la cuenta de mint a la transacción para ser firmada por el cliente
    // transaction.sign(tokenMintAccount); // Agregar la firma de la cuenta de mint

    // Calculamos el gas estimado
    const estimatedGas = await connection.getFeeForMessage(
      transaction.compileMessage()
    );

    // console.log("TRX to send: ", transaction);
    transaction.compileMessage();
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

async function executeTransaction(signedTransactionData: string) {
  const connection = new Connection(clusterApiUrl("devnet"));

  try {
    // Decodificar y crear la transacción desde el dato firmado recibido
    let signedTransaction = Transaction.from(
      Buffer.from(signedTransactionData, "base64")
    );

    // Obtener el recentBlockhash más actualizado
    const { blockhash: recentBlockhash } =
      await connection.getLatestBlockhash();

    const latestBlockHash = await connection.getLatestBlockhash();

    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();

    // Asignar el recentBlockhash a la transacción si no coincide
    if (signedTransaction.recentBlockhash !== blockhash) {
      console.log("Actualizando el recentBlockhash en la transacción.");
      console.log("latest - blockhash: ", blockhash);
      // signedTransaction.recentBlockhash = blockhash;
    }
    //COnsol
    console.log(
      "Signing TRX with  MintAccount  ###",
      tokenMintAccount.publicKey.toBase58()
    );

    // console.log("******************************");
    // console.log("Antes de la firma=\n", signedTransaction);
    // console.log("******++*****************");

    signedTransaction.partialSign(tokenMintAccount);
    // console.log("=======================");
    // console.log(
    //   "After Mint Account SIGNING TRX =============",
    //   signedTransaction
    // );
    // console.log("=======================");

    // Validar que la transacción tenga firmas válidas antes de enviarla
    if (!signedTransaction.verifySignatures()) {
      throw new Error(
        "Signature verification failed: las firmas no son válidas o están incompletas."
      );
    }

    // Enviar la transacción ya firmada
    const txid = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );

    // Confirmación opcional si quieres asegurarte de que esté incluida en un bloque
    // await connection.confirmTransaction(txid, "confirmed");
    await connection.confirmTransaction({
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
      signature: txid,
    });

    console.log("Transacción exitosa, txid:", txid);
    return { success: true, transactionId: txid };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("blockhash not found")
    ) {
      // Si el blockhash es inválido, pedimos al cliente que firme nuevamente
      console.error("Blockhash vencido. Solicita una firma nueva al cliente.");
      return {
        success: false,
        error: "Blockhash vencido. Solicita una firma nueva.",
      };
    }

    console.error("Error al ejecutar la transacción:", error);
    throw error;
  }
}

async function uploadToPinata(filePath: string): Promise<string> {
  try {
    const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: "tokenlogo.png",
      },
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);
    console.log("Image successfully uploaded. IPFS Hash:", result.IpfsHash);

    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading image to Pinata:", error);
    throw error;
  }
}

function base64ToReadableStream(base64Image: string) {
  // Paso 1: Eliminar el prefijo 'data:image/...;base64,'
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  // Paso 2: Decodificar el contenido base64 en un Buffer
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Paso 3: Convertir el Buffer a un ReadableStream
  const readableStream = new Readable();
  readableStream.push(imageBuffer);
  readableStream.push(null); // Señalar el final del flujo

  return readableStream;
}

async function uploadReadableStreamToPinata(
  imageStream: Readable
): Promise<string> {
  try {
    const options = {
      pinataMetadata: {
        name: "tokenlogo.png",
      },
    };

    const result = await pinata.pinFileToIPFS(imageStream, options);
    console.log("Image successfully uploaded. IPFS Hash:", result.IpfsHash);

    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading image to Pinata:", error);
    throw error;
  }
}

/**
 * Uploads a JSON file to Pinata and returns the IPFS URL.
 * @param filePath - Path to the JSON file
 * @returns Public URL to access the JSON file on IPFS
 */
async function uploadJsonToPinata(metadataJson: Readable): Promise<string> {
  try {
    // const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: "metadata.json",
      },
    };

    const result = await pinata.pinFileToIPFS(metadataJson, options);
    console.log("JSON successfully uploaded. IPFS Hash:", result.IpfsHash);

    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading JSON to Pinata:", error);
    throw error;
  }
}

function stringToReadableStream(text: string): Readable {
  return new Readable({
    read() {
      this.push(text);
      this.push(null); // Señala el final del stream
    },
  });
}
/**
 * Creates a metadata JSON file with details for the token and stores it locally.
 * @param imageURI - URI of the token image on IPFS
 * @param _name - Name of the token
 * @param _symbol - Symbol of the token
 * @param _description - Description of the token
 * @returns The file path of the created JSON metadata file
 */
async function createMetadataJSON(
  imageURI: string,
  _name: string,
  _symbol: string,
  _description: string
): Promise<string> {
  const metadata = {
    name: _name,
    symbol: _symbol,
    description: _description,
    image: imageURI,
    showName: true,
    createdOn: "",
    website: "",
  };

  const metadataJson = JSON.stringify(metadata);

  // // Save the metadata JSON locally
  // const jsonFilePath = path.resolve("metadata.json");
  // fs.writeFileSync(jsonFilePath, metadataJson);

  // return jsonFilePath;
  return metadataJson;
}

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
