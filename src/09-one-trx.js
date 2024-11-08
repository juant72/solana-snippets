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
require("dotenv").config();
const helpers_1 = require("@solana-developers/helpers");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
// Variables de metadata
const _NAME = "Sumi";
const _SYMBOL = "SUMI";
const _URI = "https://arweave.net/1234"; // Arweave/IPFS link
function sendTransactionToNetwork(transaction, payer, // Asegúrate de usar un Keypair
tokenMintAccount, connection) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const txid = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer, tokenMintAccount], // El Keypair que firma la transacción
            { commitment: "confirmed" });
            console.log("Transacción enviada y confirmada. Txid:", txid);
            return txid;
        }
        catch (error) {
            console.error("Error al enviar la transacción:", error);
            throw new Error("Error al enviar la transacción");
        }
    });
}
function createAccountInstruction(payer, tokenMintAccount, // Aseguramos que 'accountKeypair' sea de tipo 'Keypair'
lamports, programId) {
    return web3_js_1.SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: tokenMintAccount.publicKey,
        space: spl_token_1.MINT_SIZE,
        lamports,
        programId,
    });
}
function createTokenTransaction(payer, // 'payer' debe ser un Keypair
tokenMintAccount, lamports, decimals, programId, metadataData, connection, confirmOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        // Crear las instrucciones por separado
        const instructions = [
            createAccountInstruction(payer.publicKey, tokenMintAccount, lamports, programId),
            (0, spl_token_1.createInitializeMint2Instruction)(tokenMintAccount.publicKey, decimals, payer.publicKey, programId),
            // Crear la instrucción de metadata
            (0, mpl_token_metadata_1.createCreateMetadataAccountV3Instruction)({
                metadata: metadataData.metadataPDA,
                mint: tokenMintAccount.publicKey,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
            }, {
                createMetadataAccountArgsV3: {
                    collectionDetails: null,
                    data: metadataData.metadataData,
                    isMutable: true,
                },
            }),
        ];
        const transaction = new web3_js_1.Transaction().add(...instructions);
        const sendTransactionResult = yield sendTransactionToNetwork(transaction, payer, tokenMintAccount, connection);
        return sendTransactionResult;
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const payer = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY"); // Especificar que es un 'Keypair'
        // Verificar que el 'payer' tiene claves y está correctamente cargado
        if (!payer || !payer.secretKey) {
            throw new Error("La clave secreta del payer no está configurada correctamente");
        }
        const tokenMintAccount = web3_js_1.Keypair.generate();
        // Obtener la cantidad de lamports necesarios para crear la cuenta
        const lamports = yield (0, spl_token_1.getMinimumBalanceForRentExemptMint)(connection);
        const decimals = 9;
        const programId = spl_token_1.TOKEN_PROGRAM_ID;
        const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        // Datos de metadata
        const metadataPDAAndBump = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            tokenMintAccount.publicKey.toBuffer(), // Usar el mint del token
        ], TOKEN_METADATA_PROGRAM_ID);
        const metadataPDA = metadataPDAAndBump[0];
        const metadataData = {
            metadataPDA, // Usamos la PDA correctamente calculada
            metadataData: {
                name: _NAME,
                symbol: _SYMBOL,
                uri: _URI,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
            },
        };
        try {
            const txid = yield createTokenTransaction(payer, tokenMintAccount, lamports, decimals, programId, metadataData, connection);
            console.log("Transacción completada. Txid:", txid);
        }
        catch (error) {
            console.error("Error creando transacción:", error);
        }
    });
}
main().catch(console.log);
