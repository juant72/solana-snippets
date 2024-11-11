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
const readline_sync_1 = __importDefault(require("readline-sync"));
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
const socket = (0, socket_io_client_1.io)("http://localhost:3000"); // Asegúrate de que el puerto sea correcto
// Cargar la wallet local desde el archivo JSON
const walletPath = "~/wallet-client.json"; // Ruta de tu wallet creada
let keypair;
try {
    keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs_1.default.readFileSync(walletPath, "utf-8"))));
    console.log("Wallet cargada con éxito. Dirección pública:", keypair.publicKey.toString());
}
catch (err) {
    console.error("Error al cargar la wallet:", err);
    process.exit(1); // Salir si no se puede cargar la wallet
}
socket.on("server_message", (message) => {
    console.log(message);
});
function showMenu() {
    console.log("\nSelecciona una opción:");
    console.log("1. Crear token");
    console.log("2. Salir");
}
function handleMenuSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        const choice = readline_sync_1.default.question("Ingresa tu opción: ");
        switch (choice) {
            case "1":
                const tokenName = readline_sync_1.default.question("Ingrese el nombre del token: ");
                const tokenSymbol = readline_sync_1.default.question("Ingrese el símbolo del token: ");
                const tokenDescription = readline_sync_1.default.question("Ingrese una descripción del token: ");
                const tokenImageURI = readline_sync_1.default.question("Ingrese la URL de la imagen del token: ");
                const tokenData = {
                    name: tokenName,
                    symbol: tokenSymbol,
                    description: tokenDescription,
                    imageURI: tokenImageURI,
                    publicKey: keypair.publicKey.toString(),
                };
                console.log("Solicitando la creación del token...");
                socket.emit("create_token", tokenData);
                break;
            case "2":
                console.log("Saliendo...");
                socket.disconnect();
                process.exit(0);
                break;
            default:
                console.log("Opción no válida. Intenta de nuevo.");
                break;
        }
    });
}
socket.on("transaction_details", (data) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Detalles de la transacción recibidos.");
    const acceptTransaction = readline_sync_1.default.keyInYNStrict("¿Deseas firmar esta transacción y proceder?");
    if (acceptTransaction) {
        console.log("Signing trx start!:");
        try {
            let transaction;
            console.log("Settin let!:");
            try {
                console.log("transaction = Transaction.from(Buffer.from(data.transaction))");
                transaction = web3_js_1.Transaction.from(Buffer.from(data.transaction, "base64"));
            }
            catch (error) {
                transaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
            }
            if (transaction instanceof web3_js_1.VersionedTransaction) {
                transaction.sign([keypair]);
            }
            else {
                transaction.partialSign(keypair);
            }
            //   const txnSignature = await connection.sendRawTransaction(
            //     transaction.serialize(),
            //   );
            // Convertir la transacción serializada de base64 a un objeto de transacción
            //   const transaction = Transaction.from(
            //     Buffer.from(data.serializedTransaction, "base64")
            //   );
            console.log("TRX as object: ", transaction);
            // Firmar la transacción con el Keypair
            //   transaction.sign(keypair);
            console.log("Transacción firmada");
            // Enviar la transacción firmada al servidor
            socket.emit("signed_transaction", {
                signedTransactionData: transaction.serialize().toString("base64"),
            });
        }
        catch (err) {
            console.error("Error al firmar la transacción:", err);
        }
    }
    else {
        console.log("Transacción cancelada.");
    }
}));
socket.on("transaction_result", (result) => {
    if (result.success) {
        console.log("¡Token creado con éxito!");
        console.log("Transaction ID:", result.transactionId);
    }
    else {
        console.error("Error al ejecutar la transacción:", result.error);
        console.error("Detalles completos del error:", result);
    }
});
socket.on("error", (error) => {
    console.error(error.message);
    console.error("Detalles del error:", error.error);
});
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        showMenu();
        yield handleMenuSelection();
    });
}
start();
