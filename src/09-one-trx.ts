import * as dotenv from "dotenv";
dotenv.config();

import PinataSDK from "@pinata/sdk";
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
  StakeInstruction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import fs from "fs";
import path from "path";

// Configura el SDK de Pinata
const pinata = new PinataSDK({
  pinataJWTKey: process.env.PINATA_JWT!, // Usamos pinataJWTKey en lugar de pinataJwt
});

async function createMetadataJSON(
  imageURI: string,
  _name: String,
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

  // Guardamos el archivo JSON en el sistema localmente
  const jsonFilePath = path.resolve("metadata.json");
  fs.writeFileSync(jsonFilePath, metadataJson);

  return jsonFilePath;
}

async function uploadJsonToPinata(filePath: string): Promise<string> {
  try {
    const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: "metadata.json", // Nombre del archivo JSON
      },
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);
    console.log("JSON subido exitosamente. IPFS Hash:", result.IpfsHash);

    // Retornamos la URL pública de Pinata
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error al cargar el JSON en Pinata:", error);
    throw error;
  }
}

// Función para cargar un archivo a Pinata
async function uploadToPinata(filePath: string): Promise<string> {
  try {
    const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: "tokenlogo.png", // Asegúrate de incluir el nombre del archivo aquí
      },
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);

    console.log("Archivo subido exitosamente. IPFS Hash:", result.IpfsHash);
    // return `ipfs://${result.IpfsHash}`; // Retorna el hash de IPFS del archivo como URI
    // Usamos la URL HTTPS de Pinata para acceder al archivo
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error al cargar en Pinata:", error);
    throw error;
  }
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

  const _NAME = "Kulman Coin";
  const _SYMBOL = "KUL999";
  const _DESCRIPTION = "The best coin.";
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

  // Subir la imagen a Pinata y obtener la URI
  const imageURI = await uploadToPinata(path.resolve("tokenlogo.png")); // Subimos la imagen
  const metadataJsonPath = await createMetadataJSON(
    imageURI,
    _NAME,
    _SYMBOL,
    _DESCRIPTION
  ); // Creamos el archivo JSON con la URI de la imagen
  const metadataURI = await uploadJsonToPinata(metadataJsonPath); // Subimos el archivo JSON a Pinata

  console.log("URI del archivo JSON de metadata:", metadataURI);

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
  const metadataData = {
    name: _NAME,
    symbol: _SYMBOL,
    uri: metadataURI, // Usamos la URI de metadata obtenida de Pinata
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

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
  const commissionLamports = 0.12 * 1_000_000_000;

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
    commissionInstruction
  );

  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, tokenMintAccount],
      {
        commitment: "confirmed",
      }
    );
    console.log("Transacción completada. Txid:", txid);
  } catch (error) {
    console.error("Error al enviar la transacción:", error);
  }
}

main().catch(console.log);
