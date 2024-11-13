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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const faker_1 = require("@faker-js/faker");
const readline_sync_1 = __importDefault(require("readline-sync"));
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
let socket;
// Load the local wallet from the JSON file
const walletPath = "~/wallet-client.json";
let keypair = new web3_js_1.Keypair();
try {
    keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs_1.default.readFileSync(walletPath, "utf-8"))));
    console.log("Wallet loaded successfully. Public address:", keypair.publicKey.toString());
}
catch (err) {
    console.error("Error loading the wallet:", err);
    process.exit(1);
}
let authToken = null;
/**
 * Authenticates the user and retrieves the JWT token.
 */
function authenticate() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Example fetch request to authenticate the user
            const response = yield fetch("http://localhost:3000/authenticate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "user", password: "pass" }),
            });
            const data = yield response.json();
            authToken = data.token; // Store the JWT token
            console.log("Authenticated. Token received.");
        }
        catch (error) {
            console.error("Error during authentication:", error);
        }
    });
}
/**
 * Establishes the WebSocket connection after successful authentication.
 */
function connectSocket() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!authToken) {
            console.error("No auth token found. Please authenticate first.");
            return;
        }
        // Connect to the server only after obtaining the token
        socket = (0, socket_io_client_1.io)("http://localhost:3000", {
            auth: {
                token: authToken, // Send the token as part of the connection
            },
        });
        socket.on("connect", () => {
            console.log("Socket connected with JWT token!");
        });
        socket.on("server_message", (message) => {
            console.log("Server message:", message);
        });
        socket.on("transaction_details", (data) => __awaiter(this, void 0, void 0, function* () {
            console.log("Transaction details received.");
            console.log("Estimated Gas: ", data.estimatedGas);
            const acceptTransaction = readline_sync_1.default.keyInYNStrict("Do you want to approve this transaction and execute?");
            if (acceptTransaction) {
                console.log("Signing transaction...");
                const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
                const { blockhash, lastValidBlockHeight } = yield getRecentBlockhash();
                console.log("****************");
                console.log("*** Received recentBlockhash: ", blockhash);
                try {
                    let transaction;
                    console.log("Processing transaction...");
                    try {
                        transaction = web3_js_1.Transaction.from(Buffer.from(data.transaction, "base64"));
                        transaction.recentBlockhash = blockhash;
                        transaction.compileMessage();
                    }
                    catch (error) {
                        transaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
                    }
                    if (transaction instanceof web3_js_1.VersionedTransaction) {
                        console.log("Versioned Transaction.");
                        transaction.sign([keypair]);
                    }
                    else {
                        console.log("Normal Transaction.");
                        transaction.partialSign(keypair);
                    }
                    console.log("Transaction signed");
                    console.log("Sending Signed Transaction to Server...");
                    socket.emit("signed_transaction", {
                        signedTransactionData: transaction
                            .serialize({ requireAllSignatures: false })
                            .toString("base64"),
                    });
                }
                catch (err) {
                    console.error("Error signing transaction in the client: ", err);
                }
            }
            else {
                console.log("Transaction canceled.");
            }
            console.log("Waiting for server response...");
        }));
        socket.on("transaction_result", (result) => {
            if (result.success) {
                console.log("Token created successfully!");
                console.log("Transaction ID:", result.transactionId);
            }
            else {
                console.error("Error executing the transaction:", result.error);
                console.error("Full Details Error: ", result);
            }
        });
        socket.on("error", (error) => {
            console.error("Error: ", error.message);
            console.error("Error details:", error.error);
        });
    });
}
/**
 * Retrieves the recent blockhash from the Solana network.
 * @returns {Promise<{blockhash: string, lastValidBlockHeight: number}>} The blockhash and the last valid block height.
 */
function getRecentBlockhash() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"));
        const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash("finalized");
        if (!blockhash) {
            throw new Error("Cannot get recentBlockhash.");
        }
        return { blockhash, lastValidBlockHeight };
    });
}
/**
 * Displays the menu options to the user.
 */
function showMenu() {
    console.log("\nChoose an option:");
    console.log("1. Create token");
    console.log("2. Exit");
}
/**
 * Handles the menu selection and initiates the corresponding actions.
 */
function handleMenuSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        const choice = readline_sync_1.default.question("Enter your option: ");
        switch (choice) {
            case "1":
                // Generate default values with Faker
                const defaultTokenName = faker_1.faker.finance.currencyName();
                const defaultTokenSymbol = faker_1.faker.finance.currencyCode();
                const defaultTokenDescription = faker_1.faker.lorem.sentence();
                const defaultTokenDecimals = "6";
                const defaultTokenSupply = "1000000";
                const defaulImagePath = "tokenlogo.png";
                const defaultRevokeFreeze = false;
                const defaultRevokeMint = false;
                // Prompt the user for token details
                const tokenName = readline_sync_1.default.question(`Token Name: (default: ${defaultTokenName}): `, { defaultInput: defaultTokenName });
                const tokenSymbol = readline_sync_1.default.question(`Token Symbol: (default: ${defaultTokenSymbol}): `, { defaultInput: defaultTokenSymbol });
                const tokenDescription = readline_sync_1.default.question(`Token Description: (default: ${defaultTokenDescription}): `, { defaultInput: defaultTokenDescription });
                const tokenDecimals = readline_sync_1.default.question(`Decimals (default: ${defaultTokenDecimals}): `, { defaultInput: defaultTokenDecimals });
                const tokenSupply = readline_sync_1.default.question(`Token Supply: (default: ${defaultTokenSupply}): `, { defaultInput: defaultTokenSupply });
                const revokeFreeze = readline_sync_1.default.keyInYNStrict(`"Revoke Freeze Authority? (Yes/No) (default: ${defaultRevokeFreeze}): "`);
                console.log("revokefreeze: ", revokeFreeze);
                const revokeMint = readline_sync_1.default.keyInYNStrict("Revoke Mint Authority? (Yes/No): ");
                console.log("revokeMint: ", revokeMint);
                // Process the image upload in base64 format
                const tokenImagePath = readline_sync_1.default.question(`Image token path: (${defaulImagePath}:) `, { defaultInput: defaulImagePath });
                let tokenImageData;
                try {
                    const imageBuffer = fs_1.default.readFileSync(tokenImagePath);
                    tokenImageData = `data:image/${tokenImagePath
                        .split(".")
                        .pop()};base64,${imageBuffer.toString("base64")}`;
                }
                catch (err) {
                    console.error("Error reading image:", err);
                    tokenImageData = "";
                }
                const tokenData = {
                    name: tokenName,
                    symbol: tokenSymbol,
                    description: tokenDescription,
                    imageData: tokenImageData,
                    decimals: tokenDecimals,
                    supply: tokenSupply,
                    publicKey: keypair.publicKey.toString(),
                    revokeFreeze,
                    revokeMint,
                };
                // Emit the 'create_token' event with the data
                socket.emit("create_token", tokenData);
                break;
            case "2":
                console.log("Exiting...");
                socket.disconnect();
                process.exit(0);
                break;
            default:
                console.log("Invalid option. Try again.");
                break;
        }
    });
}
/**
 * Starts the process by authenticating the user, connecting to the socket, and showing the menu.
 */
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        yield authenticate();
        yield connectSocket(); // Connect after authentication
        showMenu();
        yield handleMenuSelection();
    });
}
start();
