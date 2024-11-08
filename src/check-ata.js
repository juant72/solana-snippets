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
const _tokenMintAccount = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
require("dotenv").config();
const { getKeypairFromEnvironment, getExplorerLink, } = require("@solana-developers/helpers");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
        const user = getKeypairFromEnvironment("SECRET_KEY");
        // Clave pública de tu token mint
        const tokenMintAccount = new web3_js_1.PublicKey(_tokenMintAccount);
        // Crea o obtiene la cuenta de token asociada para el destinatario
        const recipientAssociatedTokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, user, // Pagador
        tokenMintAccount, // Cuenta de mint del token
        user.publicKey // Dirección del destinatario
        );
        console.log("Token Account: ", recipientAssociatedTokenAccount.address.toBase58());
        // Realiza la transacción de minting
        const transactionSignature = yield (0, spl_token_1.mintTo)(connection, user, // Cuenta del pagador
        tokenMintAccount, // Mint del token
        recipientAssociatedTokenAccount.address, // Dirección de la cuenta de token asociada
        user, // Autoridad del mint
        10 * MINOR_UNITS_PER_MAJOR_UNITS // Cantidad de tokens a crear
        );
        const link = getExplorerLink("transaction", transactionSignature, "devnet");
        console.log(`✅ Success! Mint Token Transaction: ${link}`);
        console.log("Cuenta asociada:", recipientAssociatedTokenAccount.address.toBase58());
    });
}
main().catch(console.error);
