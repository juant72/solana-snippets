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
        const _URI = "https://imgcdn.stablediffusionweb.com/2024/4/10/ac1f3df7-450c-41bc-8656-79ce78abccdd.jpg";
        const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        const metadataPDAAndBump = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            tokenMintAccount.publicKey.toBuffer(),
        ], TOKEN_METADATA_PROGRAM_ID);
        const metadataPDA = metadataPDAAndBump[0];
        const metadataData = {
            name: _NAME,
            symbol: _SYMBOL,
            uri: _URI,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        };
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
        const commissionLamports = 0.12 * 1000000000; // Convertir 0.12 SOL a lamports
        const commissionInstruction = web3_js_1.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: commissionAccount,
            lamports: commissionLamports,
        });
        // Crear una única transacción con todas las instrucciones
        const transaction = new web3_js_1.Transaction().add(createMintAccountInstruction, initializeMintInstruction, createATAInstruction, metadataInstruction, mintToInstruction, commissionInstruction // Añadir la instrucción de comisión
        );
        try {
            const txid = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer, tokenMintAccount], { commitment: "confirmed" });
            console.log("Transacción completada. Txid:", txid);
        }
        catch (error) {
            console.error("Error al enviar la transacción:", error);
        }
    });
}
main().catch(console.log);
