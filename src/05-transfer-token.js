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
const _recipient = "J5F8dTpEq8uNdQmrnYALPN2KMHhWLzaJpsU21E6Gv5bR"; // target account for transfer
require("dotenv/config");
const helpers_1 = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const sender = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        console.log(`🔑 Loaded our keypair securely, using an env file! Our public key is: ${sender.publicKey.toBase58()}`);
        // Add the recipient public key here.
        const recipient = new web3_js_1.PublicKey(_recipient);
        // Substitute in your token mint account
        const tokenMintAccount = new web3_js_1.PublicKey(_tokenMintAccount);
        // Our token has two decimal places
        const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
        console.log(`💸 Attempting to send 1 token to ${recipient.toBase58()}...`);
        // Get or create the source token account to store this token
        const sourceTokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, sender, tokenMintAccount, sender.publicKey);
        console.log("Source token account:", sourceTokenAccount.address.toBase58());
        // Get or create the destination token account to store this token
        const destinationTokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, sender, tokenMintAccount, recipient);
        console.log("Destination token account: ", destinationTokenAccount.address.toBase58());
        // Transfer the tokens
        const signature = yield (0, spl_token_1.transfer)(connection, sender, sourceTokenAccount.address, destinationTokenAccount.address, sender, 1 * MINOR_UNITS_PER_MAJOR_UNITS);
        const explorerLink = (0, helpers_1.getExplorerLink)("transaction", signature, "devnet");
        console.log(`✅ Transaction confirmed, explorer link is: ${explorerLink}`);
    });
}
main().catch(console.log);
