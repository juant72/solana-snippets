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
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = require("stream");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
//////////// END IMPORTS ////////////////
let tokenMintAccount;
const port = process.env.PORT || 3000;
const pinata = new sdk_1.default({ pinataJWTKey: process.env.PINATA_JWT });
// Crear un servidor HTTP para usar con Socket.IO
const server = http_1.default.createServer();
const io = new socket_io_1.Server(server, {
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
    socket.on("create_token", (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { name, symbol, description, imageData, decimals, supply, publicKey, revokeFreeze, revokeMint, } = data;
            // Validamos los parámetros recibidos
            if (!name ||
                !symbol ||
                !description ||
                !imageData ||
                !decimals ||
                !supply ||
                !publicKey ||
                !revokeFreeze ||
                !revokeMint) {
                throw new Error("Faltan parámetros necesarios.");
            }
            console.log("Calculamos los costos y generamos la transacción");
            // Calculamos los costos y generamos la transacción
            const { transactionDetails, estimatedGas } = yield prepareTokenTransaction(name, symbol, description, imageData, decimals, supply, publicKey, revokeFreeze, revokeMint);
            // Paso 3: Enviar detalles de la transacción al cliente
            socket.emit("transaction_details", {
                transaction: transactionDetails,
                estimatedGas,
            });
        }
        catch (error) {
            console.error("Error al procesar la solicitud:", error);
            socket.emit("error", { message: "Error al procesar la solicitud." });
        }
    }));
    // Paso 4: Cliente firma la transacción
    socket.on("signed_transaction", (signedTransaction) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log("Iniciando proceso de envio de TRX a Blockchain");
            const { signedTransactionData } = signedTransaction;
            // Validar y ejecutar la transacción en la blockchain
            const result = yield executeTransaction(signedTransactionData);
            // Paso 5: Enviar el resultado al cliente
            socket.emit("transaction_result", result);
        }
        catch (error) {
            console.error("Error al ejecutar la transacción:", error);
            socket.emit("error", { message: "Error al ejecutar la transacción." });
        }
    }));
});
// Función para obtener el recentBlockhash
function getRecentBlockhash() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash("finalized");
        if (!blockhash) {
            throw new Error("No se pudo obtener el recentBlockhash.");
        }
        return { blockhash, lastValidBlockHeight };
    });
}
// Función para preparar la transacción de creación de token
function prepareTokenTransaction(name, symbol, description, imageData, decimals, supply, payerPublicKey, revokeFreeze, revokeMint) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
            tokenMintAccount = web3_js_1.Keypair.generate();
            console.log("Token MINT account:", tokenMintAccount.publicKey.toBase58());
            const lamports = yield connection.getMinimumBalanceForRentExemption(spl_token_1.MINT_SIZE);
            // Preparing Metadata Stuff
            // Derive the Program Derived Address (PDA) for token metadata
            const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
            const [metadataPDA] = web3_js_1.PublicKey.findProgramAddressSync([
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                tokenMintAccount.publicKey.toBuffer(),
            ], TOKEN_METADATA_PROGRAM_ID);
            // Manipuling image token
            // Upload image and metadata JSON to Pinata
            const imageStream = base64ToReadableStream(imageData);
            // const imageURI = await uploadToPinata(path.resolve("tokenlogo.png"));
            const imageIpfsURI = yield uploadReadableStreamToPinata(imageStream);
            const metadataJsonString = yield createMetadataJSON(imageIpfsURI, name, symbol, description);
            const metadataJsonIpfsURI = yield uploadJsonToPinata(stringToReadableStream(metadataJsonString));
            console.log("Metadata IPFS JSon URI:", metadataJsonIpfsURI);
            // Obtener el recentBlockhash y el lastValidBlockHeight
            const { blockhash, lastValidBlockHeight } = yield getRecentBlockhash();
            // El address del payer
            const payerPublicKeyObject = new web3_js_1.PublicKey(payerPublicKey);
            // Instrucción para crear la cuenta de token mint
            const createTokenAccountInstruction = web3_js_1.SystemProgram.createAccount({
                fromPubkey: payerPublicKeyObject,
                newAccountPubkey: tokenMintAccount.publicKey,
                lamports,
                space: spl_token_1.MINT_SIZE,
                programId: spl_token_1.TOKEN_PROGRAM_ID,
            });
            const initMintInstruction = (0, spl_token_1.createInitializeMint2Instruction)(tokenMintAccount.publicKey, decimals, payerPublicKeyObject, // Usar la clave pública del cliente como mint authority
            payerPublicKeyObject // Usar la clave pública del cliente como freeze authority
            );
            // el mint Authority al principio debe permitir mintear los tokens
            // Step 2: Create Associated Token Account (ATA)
            console.log("Creating Asociated Token Account instruction....");
            const ata = yield (0, spl_token_1.getAssociatedTokenAddress)(tokenMintAccount.publicKey, payerPublicKeyObject, false, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
            const createATAInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(payerPublicKeyObject, ata, payerPublicKeyObject, tokenMintAccount.publicKey, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
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
            const metadataInstruction = (0, mpl_token_metadata_1.createCreateMetadataAccountV3Instruction)({
                metadata: metadataPDA,
                mint: tokenMintAccount.publicKey,
                mintAuthority: payerPublicKeyObject,
                payer: payerPublicKeyObject,
                updateAuthority: payerPublicKeyObject,
            }, {
                createMetadataAccountArgsV3: {
                    data: metadataData,
                    isMutable: true,
                    collectionDetails: null,
                },
            });
            // Step 4: Mint tokens
            console.log("Minting tokens instruction....");
            const amountToMint = 1000000000 * Math.pow(10, 2); // Convert to minor units
            const mintToInstruction = (0, spl_token_1.createMintToInstruction)(tokenMintAccount.publicKey, ata, payerPublicKeyObject, amountToMint, [], spl_token_1.TOKEN_PROGRAM_ID);
            // Step 5: Transfer commission (0.12 SOL)
            console.log("Creating Transfer Comission instruction....");
            const fees_account = process.env.FEES_ACCOUNT;
            console.log("Fees Account:", fees_account);
            const commissionAccount = new web3_js_1.PublicKey(fees_account);
            const commissionLamports = 0.12 * 1000000000;
            const commissionInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: payerPublicKeyObject,
                toPubkey: commissionAccount,
                lamports: commissionLamports,
            });
            // Armo la transaccion
            const transaction = new web3_js_1.Transaction().add(createTokenAccountInstruction, initMintInstruction, createATAInstruction, metadataInstruction, mintToInstruction, commissionInstruction);
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
            const estimatedGas = yield connection.getFeeForMessage(transaction.compileMessage());
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
        }
        catch (error) {
            console.error("Error en la preparación de la transacción:", error);
            throw error;
        }
    });
}
function executeTransaction(signedTransactionData) {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        try {
            // Decodificar y crear la transacción desde el dato firmado recibido
            let signedTransaction = web3_js_1.Transaction.from(Buffer.from(signedTransactionData, "base64"));
            // Obtener el recentBlockhash más actualizado
            const { blockhash: recentBlockhash } = yield connection.getLatestBlockhash();
            const latestBlockHash = yield connection.getLatestBlockhash();
            const { blockhash, lastValidBlockHeight } = yield getRecentBlockhash();
            // Asignar el recentBlockhash a la transacción si no coincide
            if (signedTransaction.recentBlockhash !== blockhash) {
                console.log("Actualizando el recentBlockhash en la transacción.");
                console.log("latest - blockhash: ", blockhash);
                // signedTransaction.recentBlockhash = blockhash;
            }
            //COnsol
            console.log("Signing TRX with  MintAccount  ###", tokenMintAccount.publicKey.toBase58());
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
                throw new Error("Signature verification failed: las firmas no son válidas o están incompletas.");
            }
            // Enviar la transacción ya firmada
            const txid = yield connection.sendRawTransaction(signedTransaction.serialize());
            // Confirmación opcional si quieres asegurarte de que esté incluida en un bloque
            // await connection.confirmTransaction(txid, "confirmed");
            yield connection.confirmTransaction({
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight,
                signature: txid,
            });
            console.log("Transacción exitosa, txid:", txid);
            return { success: true, transactionId: txid };
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes("blockhash not found")) {
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
    });
}
function uploadToPinata(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const readableStream = fs_1.default.createReadStream(filePath);
            const options = {
                pinataMetadata: {
                    name: "tokenlogo.png",
                },
            };
            const result = yield pinata.pinFileToIPFS(readableStream, options);
            console.log("Image successfully uploaded. IPFS Hash:", result.IpfsHash);
            return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        }
        catch (error) {
            console.error("Error uploading image to Pinata:", error);
            throw error;
        }
    });
}
function base64ToReadableStream(base64Image) {
    // Paso 1: Eliminar el prefijo 'data:image/...;base64,'
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    // Paso 2: Decodificar el contenido base64 en un Buffer
    const imageBuffer = Buffer.from(base64Data, "base64");
    // Paso 3: Convertir el Buffer a un ReadableStream
    const readableStream = new stream_1.Readable();
    readableStream.push(imageBuffer);
    readableStream.push(null); // Señalar el final del flujo
    return readableStream;
}
function uploadReadableStreamToPinata(imageStream) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const options = {
                pinataMetadata: {
                    name: "tokenlogo.png",
                },
            };
            const result = yield pinata.pinFileToIPFS(imageStream, options);
            console.log("Image successfully uploaded. IPFS Hash:", result.IpfsHash);
            return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        }
        catch (error) {
            console.error("Error uploading image to Pinata:", error);
            throw error;
        }
    });
}
/**
 * Uploads a JSON file to Pinata and returns the IPFS URL.
 * @param filePath - Path to the JSON file
 * @returns Public URL to access the JSON file on IPFS
 */
function uploadJsonToPinata(metadataJson) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // const readableStream = fs.createReadStream(filePath);
            const options = {
                pinataMetadata: {
                    name: "metadata.json",
                },
            };
            const result = yield pinata.pinFileToIPFS(metadataJson, options);
            console.log("JSON successfully uploaded. IPFS Hash:", result.IpfsHash);
            return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        }
        catch (error) {
            console.error("Error uploading JSON to Pinata:", error);
            throw error;
        }
    });
}
function stringToReadableStream(text) {
    return new stream_1.Readable({
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
        // // Save the metadata JSON locally
        // const jsonFilePath = path.resolve("metadata.json");
        // fs.writeFileSync(jsonFilePath, metadataJson);
        // return jsonFilePath;
        return metadataJson;
    });
}
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
