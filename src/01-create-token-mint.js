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
// Usar require para cargar dotenv
require("dotenv").config(); // Cargar variables de entorno
const spl_token_1 = require("@solana/spl-token");
const helpers_1 = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const user = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        console.log(`🔑 Loaded our keypair securely, using an env file! Our public key is: ${user.publicKey.toBase58()}`);
        // return the public key of the new token
        const tokenMint = yield (0, spl_token_1.createMint)(connection, // Connection
        user, // payer
        user.publicKey, // mint authority
        null, // Freeze Authority
        2 // decimals
        );
        const link = (0, helpers_1.getExplorerLink)("address", tokenMint.toString(), "devnet");
        console.log(`✅ Finished! Created token mint: ${link}`);
        console.log("Token Mint address: ", tokenMint.toString());
    });
}
// Ejecuta la función main
main().catch(console.error);
