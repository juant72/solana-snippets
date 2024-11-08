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
const _tokenMintAddress = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";
require("dotenv/config");
const helpers_1 = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const DEVNET_URL = (0, web3_js_1.clusterApiUrl)("devnet");
        const TOKEN_DECIMALS = 2;
        const DELEGATE_AMOUNT = 50;
        const MINOR_UNITS_PER_MAJOR_UNITS = 10 ** TOKEN_DECIMALS;
        // Initialize connection and load user keypair
        const connection = new web3_js_1.Connection(DEVNET_URL);
        const user = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        console.log(`🔑 Loaded keypair. Public key: ${user.publicKey.toBase58()}`);
        // Replace this with your actual address
        // For this example, we will be using System Program's ID as a delegate
        const delegatePublicKey = new web3_js_1.PublicKey(web3_js_1.SystemProgram.programId);
        // Substitute your token mint address
        const tokenMintAddress = new web3_js_1.PublicKey(_tokenMintAddress);
        try {
            // Get or create the user's token account
            const userTokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, user, tokenMintAddress, user.publicKey);
            // Approve the delegate
            const approveTransactionSignature = yield (0, spl_token_1.approve)(connection, user, userTokenAccount.address, delegatePublicKey, user.publicKey, DELEGATE_AMOUNT * MINOR_UNITS_PER_MAJOR_UNITS);
            const explorerLink = (0, helpers_1.getExplorerLink)("transaction", approveTransactionSignature, "devnet");
            console.log(`✅ Delegate approved. Transaction: ${explorerLink}`);
        }
        catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
main().catch(console.log);
