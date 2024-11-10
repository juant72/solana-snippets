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
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import fs from "fs";
import path from "path";

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJWTKey: process.env.PINATA_JWT!, // JWT key for Pinata authentication
});

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

  // Save the metadata JSON locally
  const jsonFilePath = path.resolve("metadata.json");
  fs.writeFileSync(jsonFilePath, metadataJson);

  return jsonFilePath;
}

/**
 * Uploads a JSON file to Pinata and returns the IPFS URL.
 * @param filePath - Path to the JSON file
 * @returns Public URL to access the JSON file on IPFS
 */
async function uploadJsonToPinata(filePath: string): Promise<string> {
  try {
    const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: "metadata.json",
      },
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);
    console.log("JSON successfully uploaded. IPFS Hash:", result.IpfsHash);

    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading JSON to Pinata:", error);
    throw error;
  }
}

/**
 * Uploads an image file to Pinata and returns the IPFS URL.
 * @param filePath - Path to the image file
 * @returns Public URL to access the image on IPFS
 */
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

/**
 * Main function to set up a token mint on Solana, upload metadata to Pinata, and complete a transaction.
 */
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const payer = getKeypairFromEnvironment("SECRET_KEY") as Keypair;

  if (!payer || !payer.secretKey) {
    throw new Error("Payer secret key is not configured properly");
  }

  const tokenMintAccount = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const decimals = 9;

  // Token metadata
  const _NAME = "Kulman Coin";
  const _SYMBOL = "KUL999";
  const _DESCRIPTION = "The best coin.";
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  // Derive the Program Derived Address (PDA) for token metadata
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintAccount.publicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Upload image and metadata JSON to Pinata
  const imageURI = await uploadToPinata(path.resolve("tokenlogo.png"));
  const metadataJsonPath = await createMetadataJSON(
    imageURI,
    _NAME,
    _SYMBOL,
    _DESCRIPTION
  );
  const metadataURI = await uploadJsonToPinata(metadataJsonPath);
  console.log("Metadata JSON URI:", metadataURI);

  // Define recipient
  const recipient = payer.publicKey;

  // Step 1: Initialize mint account and instruction
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

  // Step 2: Create Associated Token Account (ATA)
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

  // Step 3: Create metadata instruction for the token
  const metadataData = {
    name: _NAME,
    symbol: _SYMBOL,
    uri: metadataURI,
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

  // Step 4: Mint tokens
  const amountToMint = 1000000000 * Math.pow(10, 2); // Convert to minor units
  const mintToInstruction = createMintToInstruction(
    tokenMintAccount.publicKey,
    ata,
    payer.publicKey,
    amountToMint,
    [],
    TOKEN_PROGRAM_ID
  );

  // Step 5: Transfer commission (0.12 SOL)
  const commissionAccount = new PublicKey(
    "B27VYjc1kDeXfXaVGhMsBwyAMn4zUZWHAeWSJgSE4Cp1"
  );
  const commissionLamports = 0.12 * 1_000_000_000;

  const commissionInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: commissionAccount,
    lamports: commissionLamports,
  });

  // Combine all instructions into a single transaction
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
    console.log("Transaction completed. Txid:", txid);
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

// Execute the main function
main().catch(console.log);
