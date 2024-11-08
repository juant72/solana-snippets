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
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config(); // Cargar variables de entorno
const helpers_1 = require("@solana-developers/helpers");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
// Conexión a la red de Solana (Devnet)
const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
function sendTransactionToNetwork(transaction, payer, // Asegúrate de usar un Keypair
accountKeypair) {
    return __awaiter(this, void 0, void 0, function* () {
        // Establecer el feePayer y el bloque reciente para la transacción
        transaction.feePayer = payer.publicKey;
        const recentBlockhash = yield connection.getLatestBlockhash();
        transaction.recentBlockhash = recentBlockhash.blockhash;
        // Firmar la transacción con el Keypair del payer y accountKeypair
        transaction.sign(payer, accountKeypair);
        // Enviar la transacción a la red de Solana usando `sendAndConfirmTransaction`
        try {
            const txid = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer, accountKeypair], // Los dos signers para la transacción
            {
                commitment: "confirmed", // Confirmación de la transacción
            });
            console.log("Transacción enviada y confirmada. Txid:", txid);
            return txid; // Retornar el txid (string)
        }
        catch (error) {
            console.error("Error al enviar la transacción:", error);
            throw new Error("Error al enviar la transacción");
        }
    });
}
function createAccountInstruction(payer, accountKeypair, // Aseguramos que 'accountKeypair' sea de tipo 'Keypair'
lamports, programId) {
    return web3_js_1.SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: accountKeypair.publicKey,
        space: spl_token_1.MINT_SIZE,
        lamports,
        programId,
    });
}
function createTokenTransaction(payer, // 'payer' debe ser un Keypair
accountKeypair, lamports, decimals, programId, confirmOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        // Crear las instrucciones por separado
        const instructions = [
            createAccountInstruction(payer.publicKey, accountKeypair, lamports, programId),
            (0, spl_token_1.createInitializeMint2Instruction)(accountKeypair.publicKey, decimals, payer.publicKey, // Se usa la clave pública del 'payer'
            programId),
        ];
        // Crear la transacción e incluir las instrucciones
        const transaction = new web3_js_1.Transaction().add(...instructions);
        // Enviar la transacción a la red y retornar el txid
        const sendTransactionResult = yield sendTransactionToNetwork(transaction, payer, // Pasamos el 'payer' para firmar la transacción
        accountKeypair);
        return sendTransactionResult; // Retorna el txid como string
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Cargar el par de claves del ambiente (asegúrate de que sea un Keypair)
        const payer = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY"); // Especificar que es un 'Keypair'
        // Verificar que el 'payer' tiene claves y está correctamente cargado
        if (!payer || !payer.secretKey) {
            throw new Error("La clave secreta del payer no está configurada correctamente");
        }
        // Generar el par de claves para el mint (la cuenta que va a contener el mint)
        const accountKeypair = web3_js_1.Keypair.generate();
        // Obtener la cantidad de lamports necesarios para crear la cuenta
        const lamports = yield (0, spl_token_1.getMinimumBalanceForRentExemptMint)(connection);
        // Número de decimales para el token mint
        const decimals = 9;
        // ProgramId de SPL Token
        const programId = spl_token_1.TOKEN_PROGRAM_ID;
        try {
            const txid = yield createTokenTransaction(payer, accountKeypair, lamports, decimals, programId);
            console.log("Transacción completada. Txid:", txid);
        }
        catch (error) {
            console.error("Error creando transacción:", error);
        }
    });
}
main().catch(console.log);
