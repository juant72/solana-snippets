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
const _recipientAssociatedTokenAccount = "BQwXm8MRfqqNkk9obcMFpejYN9UfEw9zUsdzHxWSax94";
const _qtyMint = 50;
const spl_token_1 = require("@solana/spl-token");
// import "dotenv/config";
require("dotenv").config();
// import {
//   getExplorerLink,
//   getKeypairFromEnvironment,
// } from "@solana-developers/helpers";
const { getKeypairFromEnvironment, getExplorerLink, } = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        // Our token has two decimal places
        const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);
        const user = getKeypairFromEnvironment("SECRET_KEY");
        // Substitute in your token mint account from create-token-mint.ts
        const tokenMintAccount = new web3_js_1.PublicKey(_tokenMintAccount);
        // Substitute in your own, or a friend's token account address, based on the previous step.
        const recipientAssociatedTokenAccount = new web3_js_1.PublicKey(_recipientAssociatedTokenAccount);
        const transactionSignature = yield (0, spl_token_1.mintTo)(connection, user, tokenMintAccount, recipientAssociatedTokenAccount, user, _qtyMint * MINOR_UNITS_PER_MAJOR_UNITS);
        const link = getExplorerLink("transaction", transactionSignature, "devnet");
        console.log(`✅ Success! Mint Token Transaction: ${link}`);
        console.log("Minted tokens:", _qtyMint);
    });
}
main().catch(console.log);
