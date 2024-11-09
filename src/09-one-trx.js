"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const sdk_1 = __importDefault(require("@pinata/sdk"));
const helpers_1 = require("@solana-developers/helpers");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Configura el SDK de Pinata
const pinata = new sdk_1.default({
    pinataJWTKey: process.env.PINATA_JWT, // Usamos pinataJWTKey en lugar de pinataJwt
});
function createMetadataJSON(imageURI, _name, _symbol, _description) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const jsonFilePath = path_1.default.resolve("metadata.json");
        fs_1.default.writeFileSync(jsonFilePath, metadataJson);
        return jsonFilePath;
    });
}
function uploadJsonToPinata(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const readableStream = fs_1.default.createReadStream(filePath);
            const options = {
                pinataMetadata: {
                    name: "metadata.json", // Nombre del archivo JSON
                },
            };
            const result = yield pinata.pinFileToIPFS(readableStream, options);
            console.log("JSON subido exitosamente. IPFS Hash:", result.IpfsHash);
            // Retornamos la URL pública de Pinata
            return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        }
        catch (error) {
            console.error("Error al cargar el JSON en Pinata:", error);
            throw error;
        }
    });
}
// Función para cargar un archivo a Pinata
function uploadToPinata(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const readableStream = fs_1.default.createReadStream(filePath);
            const options = {
                pinataMetadata: {
                    name: "tokenlogo.png", // Asegúrate de incluir el nombre del archivo aquí
                },
            };
            const result = yield pinata.pinFileToIPFS(readableStream, options);
            console.log("Archivo subido exitosamente. IPFS Hash:", result.IpfsHash);
            // return `ipfs://${result.IpfsHash}`; // Retorna el hash de IPFS del archivo como URI
            // Usamos la URL HTTPS de Pinata para acceder al archivo
            return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        }
        catch (error) {
            console.error("Error al cargar en Pinata:", error);
            throw error;
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const payer = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        if (!payer || !payer.secretKey) {
            throw new Error("La clave secreta del payer no está configurada correctamente");
        }
        const tokenMintAccount = web3_js_1.Keypair.generate();
        const lamports = yield (0, spl_token_1.getMinimumBalanceForRentExemptMint)(connection);
        const decimals = 9;
        const _NAME = "Kulman Coin";
        const _SYMBOL = "KUL999";
        const _DESCRIPTION = "The best coin.";
        const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        const metadataPDAAndBump = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            tokenMintAccount.publicKey.toBuffer(),
        ], TOKEN_METADATA_PROGRAM_ID);
        const metadataPDA = metadataPDAAndBump[0];
        // Subir la imagen a Pinata y obtener la URI
        const imageURI = yield uploadToPinata(path_1.default.resolve("tokenlogo.png")); // Subimos la imagen
        const metadataJsonPath = yield createMetadataJSON(imageURI, _NAME, _SYMBOL, _DESCRIPTION); // Creamos el archivo JSON con la URI de la imagen
        const metadataURI = yield uploadJsonToPinata(metadataJsonPath); // Subimos el archivo JSON a Pinata
        console.log("URI del archivo JSON de metadata:", metadataURI);
        const recipient = payer.publicKey;
        // Paso 1: Crear la cuenta para el token mint y su instrucción de inicialización
        const createMintAccountInstruction = web3_js_1.SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: tokenMintAccount.publicKey,
            space: spl_token_1.MINT_SIZE,
            lamports,
            programId: spl_token_1.TOKEN_PROGRAM_ID,
        });
        const initializeMintInstruction = (0, spl_token_1.createInitializeMint2Instruction)(tokenMintAccount.publicKey, decimals, payer.publicKey, payer.publicKey, spl_token_1.TOKEN_PROGRAM_ID);
        // Paso 2: Crear la cuenta asociada de token (ATA) para el destinatario
        const ata = yield (0, spl_token_1.getAssociatedTokenAddress)(tokenMintAccount.publicKey, recipient, false, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
        const createATAInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(payer.publicKey, ata, recipient, tokenMintAccount.publicKey, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
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
        const metadataInstruction = (0, mpl_token_metadata_1.createCreateMetadataAccountV3Instruction)({
            metadata: metadataPDA,
            mint: tokenMintAccount.publicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
        }, {
            createMetadataAccountArgsV3: {
                data: metadataData,
                isMutable: true,
                collectionDetails: null,
            },
        });
        // Paso 4: Crear la instrucción para mintear tokens
        const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
        const amountToMint = 1000000000 * MINOR_UNITS_PER_MAJOR_UNITS;
        const mintToInstruction = (0, spl_token_1.createMintToInstruction)(tokenMintAccount.publicKey, ata, payer.publicKey, amountToMint, [], spl_token_1.TOKEN_PROGRAM_ID);
        // Paso 5: Crear la instrucción para la comisión de 0.12 SOL
        const commissionAccount = new web3_js_1.PublicKey("B27VYjc1kDeXfXaVGhMsBwyAMn4zUZWHAeWSJgSE4Cp1");
        const commissionLamports = 0.12 * 1000000000;
        const commissionInstruction = web3_js_1.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: commissionAccount,
            lamports: commissionLamports,
        });
        // Crear una única transacción con todas las instrucciones
        const transaction = new web3_js_1.Transaction().add(createMintAccountInstruction, initializeMintInstruction, createATAInstruction, metadataInstruction, mintToInstruction, commissionInstruction);
        try {
            const txid = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer, tokenMintAccount], {
                commitment: "confirmed",
            });
            console.log("Transacción completada. Txid:", txid);
        }
        catch (error) {
            console.error("Error al enviar la transacción:", error);
        }
    });
}
main().catch(console.log);
