import { connection } from "./../../aktyvo/app/utils/connection";
import * as dotenv from "dotenv";
dotenv.config();
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import PinataSDK from "@pinata/sdk";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
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
} from "@solana/web3.js";
import { Server, Socket } from "socket.io";
import http, { IncomingMessage } from "http";
import fs from "fs";
import { Readable } from "stream";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import https from "https";

//////////// END IMPORTS ////////////////

let tokenMintAccount: Keypair;

// Socket PORT
const port = process.env.WSS_PORT || 3000;

//PINATA setting
const pinata = new PinataSDK({ pinataJWTKey: process.env.PINATA_JWT! });

// Cargar los certificados SSL
const sslOptions = {
  key: fs.readFileSync(process.env.SSL_KEY!),
  cert: fs.readFileSync(process.env.SSL_CERT!),
};

// Crear un servidor HTTP para usar con Socket.IO
const server = https.createServer(sslOptions);
const io = new Server(server, {
  cors: {
    origin: `"${process.env.WSS_CORS}"`, // Permitir todas las conexiones
  },
});

// Almacén en memoria para rastrear los tokens utilizados
const usedTokens: Set<string> = new Set();

// Ruta para autenticar y generar JWT
server.on("request", (req, res) => {
  if (req.method === "POST" && req.url === "/authenticate") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { username, password } = JSON.parse(body);
      if (
        username === process.env.VALID_USER! &&
        password === process.env.VALID_PASSWORD!
      ) {
        const fingerprint = generateFingerprint(req);
        const token = jwt.sign(
          { username, fingerprint },
          process.env.JWT_SECRET!,
          {
            expiresIn: "5m",
          }
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token }));
      } else {
        res.writeHead(401);
        res.end("Invalid credentials");
      }
    });
  }
});

function generateFingerprint(req: IncomingMessage) {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress; // Ejemplo: IP del cliente
  const userAgent = req.headers["user-agent"] || ""; // Ejemplo: User-Agent
  const fingerprint = `${clientIp}:${userAgent}`; // Crear un "fingerprint" simple combinando IP y User-Agent

  return fingerprint;
}
// Función para validar JWT
function validateJWT(token: string): string | JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token is missing"));
  }

  const decoded = validateJWT(token);
  if (!decoded) {
    return next(new Error("Authentication error: Invalid token"));
  }

  // Verificar si el token ya ha sido utilizado
  const tokenFingerprint = (decoded as JwtPayload).fingerprint;
  if (usedTokens.has(tokenFingerprint)) {
    console.log("Authentication error: Token has already been used");
    return next(new Error("Authentication error: Token has already been used"));
  }

  // Marcar el token como utilizado
  usedTokens.add(tokenFingerprint);

  // Agregar el usuario al objeto `socket` para acceder a la información del usuario en otros eventos
  (socket as any).user = decoded;
  next();
});

io.on("connection", (socket) => {
  console.log("Client Connected...", socket.id);

  socket.emit("server_message", "Welcome to Solana WebSocket Server!");

  socket.on("disconnect", () => {
    console.log("Client Disconected...", socket.id);
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
        !publicKey
      ) {
        console.log("name", name);
        console.log("symbol", symbol);
        console.log("description", description);
        console.log("publicKey", publicKey);
        console.log("decimals", decimals);

        console.log("revokeMint", revokeMint);
        console.log("revokeFreeze", revokeFreeze);
        throw new Error("Missing parameters");
      }

      console.log("Calculating cost and creating transaction...");
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
      console.log("Sending trx details to client...");
      socket.emit("transaction_details", {
        transaction: transactionDetails,
        estimatedGas,
      });
    } catch (error) {
      console.error("Error processing request", error);
      socket.emit("error", { message: "Error procesing request" });
    }
  });

  // Paso 4: Cliente firma la transacción
  socket.on("signed_transaction", async (signedTransaction) => {
    try {
      console.log("Starting sending transaction process...");
      const { signedTransactionData } = signedTransaction;

      // Validar y ejecutar la transacción en la blockchain
      const result = await executeTransaction(signedTransactionData);

      // Paso 5: Enviar el resultado al cliente
      socket.emit("transaction_result", result);
    } catch (error) {
      console.error("Error executing transaction", error);
      socket.emit("error", { message: "Error executing transaction" });
    }
  });
});

// Función para obtener el recentBlockhash
async function getRecentBlockhash() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("finalized");

  if (!blockhash) {
    throw new Error("Cannot get the recentBlockhash.");
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
      `${process.env.TOKEN_METADATA_PROGRAM_ID}`
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
    console.log("Pre-process metadata");
    const imageStream = base64ToReadableStream(imageData);
    // const imageURI = await uploadToPinata(path.resolve("tokenlogo.png"));
    const imageIpfsURI = await uploadReadableStreamToPinata(imageStream);

    const metadataJsonString = await createMetadataJSON(
      imageIpfsURI,
      name,
      symbol,
      description
    );

    const metadataJsonIpfsURI = await uploadJsonToPinata(
      stringToReadableStream(metadataJsonString)
    );
    console.log("Metadata IPFS JSon URI:", metadataJsonIpfsURI);

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

    const freezeAuthority = revokeFreeze ? null : payerPublicKeyObject;
    const initMintInstruction = createInitializeMint2Instruction(
      tokenMintAccount.publicKey, //Token Mint Account
      decimals, //Number of decimals in token account amounts
      payerPublicKeyObject, // Mint authority
      freezeAuthority // Freeze authority
    );

    // Step 2: Create Associated Token Account (ATA)
    console.log("Creating Asociated Token Account instruction....");
    const ata = await getAssociatedTokenAddress(
      tokenMintAccount.publicKey,
      payerPublicKeyObject,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createATAInstruction = createAssociatedTokenAccountInstruction(
      payerPublicKeyObject,
      ata,
      payerPublicKeyObject,
      tokenMintAccount.publicKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Step 3: Create metadata instruction for the token
    console.log("Creating Metadata instruction....");
    const metadataData = {
      name: name,
      symbol: symbol,
      uri: metadataJsonIpfsURI,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: tokenMintAccount.publicKey,
        mintAuthority: payerPublicKeyObject,
        payer: payerPublicKeyObject,
        updateAuthority: payerPublicKeyObject,
      },
      {
        createMetadataAccountArgsV3: {
          data: metadataData,
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    // Step 4: Mint tokens
    console.log("Minting tokens instruction....");
    const amountToMint = Number(supply) * Math.pow(10, 2); // Convert to minor units
    const mintToInstruction = createMintToInstruction(
      tokenMintAccount.publicKey,
      ata,
      payerPublicKeyObject,
      amountToMint,
      [],
      TOKEN_PROGRAM_ID
    );

    // Step 5: Transfer commission
    console.log("Creating Transfer Comission instruction....");
    const fees_account = process.env.FEES_ACCOUNT! as String;
    console.log("Fees Account:", fees_account);
    const commissionAccount = new PublicKey(fees_account);

    const fees_commission = Number(process.env.AKTYVO_FEES!);
    const commissionLamports = fees_commission * 1_000_000_000;

    const commissionInstruction = SystemProgram.transfer({
      fromPubkey: payerPublicKeyObject,
      toPubkey: commissionAccount,
      lamports: commissionLamports,
    });

    // Step 6: revoke mint authority
    // Si revokeMint es true, revocar el Mint Authority

    // Armo la transaccion
    const transaction = new Transaction().add(
      createTokenAccountInstruction,
      initMintInstruction,
      createATAInstruction,
      metadataInstruction,
      mintToInstruction,
      commissionInstruction
    );

    if (revokeMint) {
      console.log("Creating revoke mint authority instruction");
      let revokeMintAuthorityInstruction = createSetAuthorityInstruction(
        tokenMintAccount.publicKey,
        payerPublicKeyObject,
        AuthorityType.MintTokens,
        null
      );
      transaction.add(revokeMintAuthorityInstruction);
    }

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
    console.error("Error preparing transaction:", error);
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
    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();

    // Asignar el recentBlockhash a la transacción si no coincide
    if (signedTransaction.recentBlockhash !== blockhash) {
      console.log("Updating recentBlockhash in transaction.");
      console.log("latest - blockhash: ", blockhash);
      // signedTransaction.recentBlockhash = blockhash;
    }
    //COnsol
    console.log(
      "Signing TRX with  MintAccount  ###",
      tokenMintAccount.publicKey.toBase58()
    );
    signedTransaction.partialSign(tokenMintAccount);

    // Validar que la transacción tenga firmas válidas antes de enviarla
    if (!signedTransaction.verifySignatures()) {
      throw new Error(
        "Signature verification failed: singatures are not valid or are missing."
      );
    }

    // Enviar la transacción ya firmada
    const txid = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );

    // Confirmación opcional si quieres asegurarte de que esté incluida en un bloque
    await connection.confirmTransaction({
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
      signature: txid,
    });

    console.log("Transaction sucessfull, txid:", txid);
    return { success: true, transactionId: txid };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("blockhash not found")
    ) {
      // Si el blockhash es inválido, pedimos al cliente que firme nuevamente
      console.error("Blockhash expired. Reques a new signature to client.");
      return {
        success: false,
        error: "Blockhash expired. Request a new signature to client.",
      };
    }

    console.error("Error executing transaction", error);
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

    return `${process.env.PINATA_GATEWAY!}${result.IpfsHash}`;
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

    return `${process.env.PINATA_GATEWAY}${result.IpfsHash}`;
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

    return `${process.env.PINATA_GATEWAY}${result.IpfsHash}`;
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
