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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
// Socket PORT
const port = process.env.WSS_PORT || 3000;
//PINATA setting
const pinata = new sdk_1.default({ pinataJWTKey: process.env.PINATA_JWT });
// Crear un servidor HTTP para usar con Socket.IO
const server = http_1.default.createServer();
const io = new socket_io_1.Server(server, {
    cors: {
        origin: `"${process.env.WSS_CORS}"`, // Permitir todas las conexiones
    },
});
// Almacén en memoria para rastrear los tokens utilizados
const usedTokens = new Set();
// Ruta para autenticar y generar JWT
server.on("request", (req, res) => {
    if (req.method === "POST" && req.url === "/authenticate") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const { username, password } = JSON.parse(body);
            if (username === process.env.VALID_USER &&
                password === process.env.VALID_PASSWORD) {
                const fingerprint = generateFingerprint(req);
                const token = jsonwebtoken_1.default.sign({ username, fingerprint }, process.env.JWT_SECRET, {
                    expiresIn: "5m",
                });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ token }));
            }
            else {
                res.writeHead(401);
                res.end("Invalid credentials");
            }
        });
    }
});
function generateFingerprint(req) {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress; // Ejemplo: IP del cliente
    const userAgent = req.headers["user-agent"] || ""; // Ejemplo: User-Agent
    const fingerprint = `${clientIp}:${userAgent}`; // Crear un "fingerprint" simple combinando IP y User-Agent
    return fingerprint;
}
// Función para validar JWT
function validateJWT(token) {
    try {
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (error) {
        console.error("JWT verification failed:", error);
        return null;
    }
}
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Authentication error: Token is missing"));
    }
    const decoded = validateJWT(token);
    if (!decoded) {
        return next(new Error("Authentication error: Invalid token"));
    }
    // Verificar si el token ya ha sido utilizado
    const tokenFingerprint = decoded.fingerprint;
    if (usedTokens.has(tokenFingerprint)) {
        console.log("Authentication error: Token has already been used");
        return next(new Error("Authentication error: Token has already been used"));
    }
    // Marcar el token como utilizado
    usedTokens.add(tokenFingerprint);
    // Agregar el usuario al objeto `socket` para acceder a la información del usuario en otros eventos
    socket.user = decoded;
    next();
});
io.on("connection", (socket) => {
    console.log("Client Connected...", socket.id);
    socket.emit("server_message", "Welcome to Solana WebSocket Server!");
    socket.on("disconnect", () => {
        console.log("Client Disconected...", socket.id);
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
                !publicKey) {
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
            const { transactionDetails, estimatedGas } = yield prepareTokenTransaction(name, symbol, description, imageData, decimals, supply, publicKey, revokeFreeze, revokeMint);
            // Paso 3: Enviar detalles de la transacción al cliente
            console.log("Sending trx details to client...");
            socket.emit("transaction_details", {
                transaction: transactionDetails,
                estimatedGas,
            });
        }
        catch (error) {
            console.error("Error processing request", error);
            socket.emit("error", { message: "Error procesing request" });
        }
    }));
    // Paso 4: Cliente firma la transacción
    socket.on("signed_transaction", (signedTransaction) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log("Starting sending transaction process...");
            const { signedTransactionData } = signedTransaction;
            // Validar y ejecutar la transacción en la blockchain
            const result = yield executeTransaction(signedTransactionData);
            // Paso 5: Enviar el resultado al cliente
            socket.emit("transaction_result", result);
        }
        catch (error) {
            console.error("Error executing transaction", error);
            socket.emit("error", { message: "Error executing transaction" });
        }
    }));
});
// Función para obtener el recentBlockhash
function getRecentBlockhash() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash("finalized");
        if (!blockhash) {
            throw new Error("Cannot get the recentBlockhash.");
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
            const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey(`${process.env.TOKEN_METADATA_PROGRAM_ID}`);
            const [metadataPDA] = web3_js_1.PublicKey.findProgramAddressSync([
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                tokenMintAccount.publicKey.toBuffer(),
            ], TOKEN_METADATA_PROGRAM_ID);
            // Manipuling image token
            // Upload image and metadata JSON to Pinata
            console.log("Pre-process metadata");
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
            const freezeAuthority = revokeFreeze ? null : payerPublicKeyObject;
            const initMintInstruction = (0, spl_token_1.createInitializeMint2Instruction)(tokenMintAccount.publicKey, //Token Mint Account
            decimals, //Number of decimals in token account amounts
            payerPublicKeyObject, // Mint authority
            freezeAuthority // Freeze authority
            );
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
            const amountToMint = Number(supply) * Math.pow(10, 2); // Convert to minor units
            const mintToInstruction = (0, spl_token_1.createMintToInstruction)(tokenMintAccount.publicKey, ata, payerPublicKeyObject, amountToMint, [], spl_token_1.TOKEN_PROGRAM_ID);
            // Step 5: Transfer commission
            console.log("Creating Transfer Comission instruction....");
            const fees_account = process.env.FEES_ACCOUNT;
            console.log("Fees Account:", fees_account);
            const commissionAccount = new web3_js_1.PublicKey(fees_account);
            const fees_commission = Number(process.env.AKTYVO_FEES);
            const commissionLamports = fees_commission * 1000000000;
            const commissionInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: payerPublicKeyObject,
                toPubkey: commissionAccount,
                lamports: commissionLamports,
            });
            // Step 6: revoke mint authority
            // Si revokeMint es true, revocar el Mint Authority
            // Armo la transaccion
            const transaction = new web3_js_1.Transaction().add(createTokenAccountInstruction, initMintInstruction, createATAInstruction, metadataInstruction, mintToInstruction, commissionInstruction);
            if (revokeMint) {
                console.log("Creating revoke mint authority instruction");
                let revokeMintAuthorityInstruction = (0, spl_token_1.createSetAuthorityInstruction)(tokenMintAccount.publicKey, payerPublicKeyObject, spl_token_1.AuthorityType.MintTokens, null);
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
            console.error("Error preparing transaction:", error);
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
            const { blockhash, lastValidBlockHeight } = yield getRecentBlockhash();
            // Asignar el recentBlockhash a la transacción si no coincide
            if (signedTransaction.recentBlockhash !== blockhash) {
                console.log("Updating recentBlockhash in transaction.");
                console.log("latest - blockhash: ", blockhash);
                // signedTransaction.recentBlockhash = blockhash;
            }
            //COnsol
            console.log("Signing TRX with  MintAccount  ###", tokenMintAccount.publicKey.toBase58());
            signedTransaction.partialSign(tokenMintAccount);
            // Validar que la transacción tenga firmas válidas antes de enviarla
            if (!signedTransaction.verifySignatures()) {
                throw new Error("Signature verification failed: singatures are not valid or are missing.");
            }
            // Enviar la transacción ya firmada
            const txid = yield connection.sendRawTransaction(signedTransaction.serialize());
            // Confirmación opcional si quieres asegurarte de que esté incluida en un bloque
            yield connection.confirmTransaction({
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight,
                signature: txid,
            });
            console.log("Transaction sucessfull, txid:", txid);
            return { success: true, transactionId: txid };
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes("blockhash not found")) {
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
            return `${process.env.PINATA_GATEWAY}${result.IpfsHash}`;
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
            return `${process.env.PINATA_GATEWAY}${result.IpfsHash}`;
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
            return `${process.env.PINATA_GATEWAY}${result.IpfsHash}`;
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
