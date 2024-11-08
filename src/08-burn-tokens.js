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
const _TOKEN_MINT_ADDRESS = "AfjoQmPcyoR1S7LCPSEy3m2cm4JpCxYoL6c6Q1kKvRZZ";
require("dotenv/config");
const helpers_1 = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const DEVNET_URL = (0, web3_js_1.clusterApiUrl)("devnet");
        const TOKEN_DECIMALS = 2;
        const BURN_AMOUNT = 5;
        // Substitute your token mint address
        const TOKEN_MINT_ADDRESS = _TOKEN_MINT_ADDRESS;
        const connection = new web3_js_1.Connection(DEVNET_URL);
        const user = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        console.log(`🔑 Loaded keypair. Public key: ${user.publicKey.toBase58()}`);
        try {
            const tokenMintAccount = new web3_js_1.PublicKey(TOKEN_MINT_ADDRESS);
            const userTokenAccount = yield (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, user, tokenMintAccount, user.publicKey);
            const burnAmount = BURN_AMOUNT * 10 ** TOKEN_DECIMALS;
            const transactionSignature = yield (0, spl_token_1.burn)(connection, user, userTokenAccount.address, tokenMintAccount, user, burnAmount);
            const explorerLink = (0, helpers_1.getExplorerLink)("transaction", transactionSignature, "devnet");
            console.log(`✅ Burn Transaction: ${explorerLink}`);
        }
        catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
main().catch(console.log);
