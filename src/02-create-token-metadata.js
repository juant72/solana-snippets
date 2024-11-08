"use strict";
// This uses "@metaplex-foundation/mpl-token-metadata@2" to create tokens
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
const _NAME = "SuperToken";
const _SYMBOL = "SUPERTK";
const _URI = "https://arweave.net/1234";
require("dotenv/config");
const helpers_1 = require("@solana-developers/helpers");
const web3_js_1 = require("@solana/web3.js");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const user = (0, helpers_1.getKeypairFromEnvironment)("SECRET_KEY");
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        console.log(`🔑 We've loaded our keypair securely, using an env file! Our public key is: ${user.publicKey.toBase58()}`);
        const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        // Substitute in your token mint account
        const tokenMintAccount = new web3_js_1.PublicKey(_tokenMintAccount);
        const metadataData = {
            name: _NAME,
            symbol: _SYMBOL,
            // Arweave / IPFS / Pinata etc link using metaplex standard for offchain data
            uri: _URI,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        };
        const metadataPDAAndBump = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            tokenMintAccount.toBuffer(),
        ], TOKEN_METADATA_PROGRAM_ID);
        const metadataPDA = metadataPDAAndBump[0];
        const transaction = new web3_js_1.Transaction();
        const createMetadataAccountInstruction = (0, mpl_token_metadata_1.createCreateMetadataAccountV3Instruction)({
            metadata: metadataPDA,
            mint: tokenMintAccount,
            mintAuthority: user.publicKey,
            payer: user.publicKey,
            updateAuthority: user.publicKey,
        }, {
            createMetadataAccountArgsV3: {
                collectionDetails: null,
                data: metadataData,
                isMutable: true,
            },
        });
        transaction.add(createMetadataAccountInstruction);
        const transactionSignature = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [user]);
        const transactionLink = (0, helpers_1.getExplorerLink)("transaction", transactionSignature, "devnet");
        console.log(`✅ Transaction confirmed, explorer link is: ${transactionLink}`);
        const tokenMintLink = (0, helpers_1.getExplorerLink)("address", tokenMintAccount.toString(), "devnet");
        console.log(`✅ Look at the token mint again: ${tokenMintLink}`);
    });
}
main().catch(console.error);
