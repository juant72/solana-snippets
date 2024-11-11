"use strict";
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
const socket_io_client_1 = require("socket.io-client");
const faker_1 = require("@faker-js/faker");
const readline_sync_1 = __importDefault(require("readline-sync"));
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
const socket = (0, socket_io_client_1.io)("http://localhost:3000");
// Cargar la wallet local desde el archivo JSON
const walletPath = "~/wallet-client.json";
let keypair = new web3_js_1.Keypair();
try {
    keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs_1.default.readFileSync(walletPath, "utf-8"))));
    console.log("Wallet cargada con éxito. Dirección pública:", keypair.publicKey.toString());
}
catch (err) {
    console.error("Error al cargar la wallet:", err);
    process.exit(1);
}
socket.on("server_message", (message) => {
    console.log(message);
});
function showMenu() {
    console.log("\nChoose an option:");
    console.log("1. Create token");
    console.log("2. Exit");
}
function handleMenuSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        const choice = readline_sync_1.default.question("Enter your option: ");
        switch (choice) {
            case "1":
                // Generar valores por defecto con Faker
                const defaultTokenName = faker_1.faker.finance.currencyName();
                const defaultTokenSymbol = faker_1.faker.finance.currencyCode();
                const defaultTokenDescription = faker_1.faker.lorem.sentence();
                const defaultTokenDecimals = "6";
                const defaultTokenSupply = "1000000";
                const defaulImagePath = "tokenlogo.png";
                // Preguntar por detalles del token
                const tokenName = readline_sync_1.default.question(`Token Name: (default: ${defaultTokenName}): `, { defaultInput: defaultTokenName });
                const tokenSymbol = readline_sync_1.default.question(`Token Symbol: (default: ${defaultTokenSymbol}): `, { defaultInput: defaultTokenSymbol });
                const tokenDescription = readline_sync_1.default.question(`Token Description: (default: ${defaultTokenDescription}): `, { defaultInput: defaultTokenDescription });
                const tokenDecimals = readline_sync_1.default.question(`Decimals (default: ${defaultTokenDecimals}): `, { defaultInput: defaultTokenDecimals });
                const tokenSupply = readline_sync_1.default.question(`Token Supply: (default: ${defaultTokenSupply}): `, { defaultInput: defaultTokenSupply });
                const revokeFreeze = readline_sync_1.default.keyInYNStrict("Revoke Freeze Authority? (Yes/No): ");
                const revokeMint = readline_sync_1.default.keyInYNStrict("Revoke Mint Authority? (Yes/No): ");
                // Procesar carga de imagen en base64
                const tokenImagePath = readline_sync_1.default.question(`Image token path: (${defaulImagePath}:) `, { defaultInput: defaulImagePath });
                let tokenImageData;
                try {
                    const imageBuffer = fs_1.default.readFileSync(tokenImagePath);
                    tokenImageData = `data:image/${tokenImagePath
                        .split(".")
                        .pop()};base64,${imageBuffer.toString("base64")}`;
                }
                catch (err) {
                    console.error("Error reading image:", err);
                    tokenImageData = "";
                }
                const tokenData = {
                    name: tokenName,
                    symbol: tokenSymbol,
                    description: tokenDescription,
                    imageData: tokenImageData,
                    decimals: tokenDecimals,
                    supply: tokenSupply,
                    publicKey: keypair.publicKey.toString(),
                    revokeFreeze,
                    revokeMint,
                };
                console.log("Emiting event 'create_token' with the next data:", tokenData);
                //   if (socket.connected) {
                //     socket.emit("create_token", tokenData);
                //   } else {
                //     console.error("Error: El socket no está conectado.");
                //   }
                socket.on("connect", () => {
                    console.log("Socket connected!");
                    // Ahora puedes emitir el evento
                    socket.emit("create_token", tokenData);
                });
                break;
            case "2":
                console.log("Exiting...");
                socket.disconnect();
                process.exit(0);
                break;
            default:
                console.log("Invalid option. Try again.");
                break;
        }
    });
}
socket.on("transaction_details", (data) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Transaction details received.");
    const acceptTransaction = readline_sync_1.default.keyInYNStrict("¿Do you want to approve this transaction and execute?");
    if (acceptTransaction) {
        console.log("Signing transaction...");
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const { blockhash, lastValidBlockHeight } = yield getRecentBlockhash();
        console.log("****************");
        console.log("*** Recibido recentBlockhash: ", blockhash);
        try {
            let transaction;
            console.log("Proccessing transaction...");
            try {
                transaction = web3_js_1.Transaction.from(Buffer.from(data.transaction, "base64"));
                transaction.recentBlockhash = blockhash;
                transaction.compileMessage();
            }
            catch (error) {
                transaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
            }
            if (transaction instanceof web3_js_1.VersionedTransaction) {
                console.log("Versioned Transaction.");
                transaction.sign([keypair]);
            }
            else {
                console.log("Normal Transaction.");
                transaction.partialSign(keypair);
            }
            console.log("Transaction signed");
            console.log("Sending Signed Transaction to Server...");
            socket.emit("signed_transaction", {
                signedTransactionData: transaction
                    .serialize({ requireAllSignatures: false })
                    .toString("base64"),
            });
        }
        catch (err) {
            console.error("Error signing transaction in the client: ", err);
        }
    }
    else {
        console.log("Transaction canceled.");
    }
    console.log("Waiting answer from server...");
}));
socket.on("transaction_result", (result) => {
    if (result.success) {
        console.log("¡Token created successfully!");
        console.log("Transaction ID:", result.transactionId);
    }
    else {
        console.error("Error executing transaction:", result.error);
        console.error("Full Details Error: ", result);
    }
});
socket.on("error", (error) => {
    console.error(error.message);
    console.error("Error Details:", error.error);
});
function getRecentBlockhash() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash("finalized");
        if (!blockhash) {
            throw new Error("Cannot get recentBlockhash.");
        }
        return { blockhash, lastValidBlockHeight };
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        showMenu();
        yield handleMenuSelection();
    });
}
start();
