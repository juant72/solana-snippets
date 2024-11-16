const fetch = require("node-fetch");
import { io, Socket } from "socket.io-client";
import { faker } from "@faker-js/faker";
import readlineSync from "readline-sync";
import http from "http";
import {
  Transaction,
  Keypair,
  VersionedTransaction,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import fs from "fs";

interface AuthResponse {
  token: string;
}

let socket: Socket;

// Load the local wallet from the JSON file
const walletPath = "~/wallet-client.json";

let keypair = new Keypair();
try {
  keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(
    "Wallet loaded successfully. Public address:",
    keypair.publicKey.toString()
  );
} catch (err) {
  console.error("Error loading the wallet:", err);
  process.exit(1);
}

let authToken: string | null = null;

/**
 * Authenticates the user and retrieves the JWT token.
 */
async function authenticate() {
  try {
    // const agent = new http.Agent({
    //   rejectUnauthorized: false, // Ignorar certificados no verificados
    // });
    // Example fetch request to authenticate the user
    const response = await fetch("http://localhost:8081/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "user", password: "pass" }),
      //   agent,
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    // const data = await response.json();
    // Asegúrate de que el tipo de datos sea AuthResponse
    const data = (await response.json()) as AuthResponse;
    authToken = data.token; // Store the JWT token

    console.log("Authenticated. Token received.");
  } catch (error) {
    console.error("Error during authentication:", error);
  }
}

/**
 * Establishes the WebSocket connection after successful authentication.
 */
async function connectSocket() {
  if (!authToken) {
    console.error("No auth token found. Please authenticate first.");
    return;
  }

  //   const agent = new https.Agent({
  //     rejectUnauthorized: false, // Ignorar certificados no verificados
  //   });

  // Connect to the server only after obtaining the token
  socket = io("ws://localhost:8081", {
    auth: {
      token: authToken, // Send the token as part of the connection
    },
    transports: ["websocket"],
    rejectUnauthorized: false,
    transportOptions: {
      //   websocket: {
      //     agent, // Usar el agente aquí
      //   },
    },
  });

  socket.on("connect", () => {
    console.log("Socket connected with JWT token!");
  });

  socket.on("server_message", (message) => {
    console.log("Server message:", message);
  });

  socket.on("transaction_details", async (data) => {
    console.log("Transaction details received.");
    console.log("Estimated Gas: ", data.estimatedGas);

    const acceptTransaction = readlineSync.keyInYNStrict(
      "Do you want to approve this transaction and execute?"
    );
    if (acceptTransaction) {
      console.log("Signing transaction...");

      const connection = new Connection(clusterApiUrl("devnet"));
      const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();
      console.log("****************");
      console.log("*** Received recentBlockhash: ", blockhash);

      try {
        let transaction;
        console.log("Processing transaction...");
        try {
          transaction = Transaction.from(
            Buffer.from(data.transaction, "base64")
          );
          transaction.recentBlockhash = blockhash;
          transaction.compileMessage();
        } catch (error) {
          transaction = VersionedTransaction.deserialize(
            Buffer.from(data.transaction, "base64")
          );
        }

        if (transaction instanceof VersionedTransaction) {
          console.log("Versioned Transaction.");
          transaction.sign([keypair]);
        } else {
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
      } catch (err) {
        console.error("Error signing transaction in the client: ", err);
      }
    } else {
      console.log("Transaction canceled.");
    }
    console.log("Waiting for server response...");
  });

  socket.on("transaction_result", (result) => {
    if (result.success) {
      console.log("Token created successfully!");
      console.log("Transaction ID:", result.transactionId);
    } else {
      console.error("Error executing the transaction:", result.error);
      console.error("Full Details Error: ", result);
    }
  });

  socket.on("error", (error) => {
    console.error("Error: ", error.message);
    console.error("Error details:", error.error);
  });
}

/**
 * Retrieves the recent blockhash from the Solana network.
 * @returns {Promise<{blockhash: string, lastValidBlockHeight: number}>} The blockhash and the last valid block height.
 */
async function getRecentBlockhash() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("finalized");

  if (!blockhash) {
    throw new Error("Cannot get recentBlockhash.");
  }

  return { blockhash, lastValidBlockHeight };
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
async function handleMenuSelection() {
  const choice = readlineSync.question("Enter your option: ");

  switch (choice) {
    case "1":
      // Generate default values with Faker
      const defaultTokenName = faker.finance.currencyName();
      const defaultTokenSymbol = faker.finance.currencyCode();
      const defaultTokenDescription = faker.lorem.sentence();
      const defaultTokenDecimals = "6";
      const defaultTokenSupply = "1000000";
      const defaulImagePath = "tokenlogo.png";
      const defaultRevokeFreeze = false;
      const defaultRevokeMint = false;

      // Prompt the user for token details
      const tokenName = readlineSync.question(
        `Token Name: (default: ${defaultTokenName}): `,
        { defaultInput: defaultTokenName }
      );
      const tokenSymbol = readlineSync.question(
        `Token Symbol: (default: ${defaultTokenSymbol}): `,
        { defaultInput: defaultTokenSymbol }
      );
      const tokenDescription = readlineSync.question(
        `Token Description: (default: ${defaultTokenDescription}): `,
        { defaultInput: defaultTokenDescription }
      );
      const tokenDecimals = readlineSync.question(
        `Decimals (default: ${defaultTokenDecimals}): `,
        { defaultInput: defaultTokenDecimals }
      );
      const tokenSupply = readlineSync.question(
        `Token Supply: (default: ${defaultTokenSupply}): `,
        { defaultInput: defaultTokenSupply }
      );

      const revokeFreeze = readlineSync.keyInYNStrict(
        `"Revoke Freeze Authority? (Yes/No) (default: ${defaultRevokeFreeze}): "`
      );

      console.log("revokefreeze: ", revokeFreeze);

      const revokeMint = readlineSync.keyInYNStrict(
        "Revoke Mint Authority? (Yes/No): "
      );
      console.log("revokeMint: ", revokeMint);

      // Process the image upload in base64 format
      const tokenImagePath = readlineSync.question(
        `Image token path: (${defaulImagePath}:) `,
        { defaultInput: defaulImagePath }
      );
      let tokenImageData;
      try {
        const imageBuffer = fs.readFileSync(tokenImagePath);
        tokenImageData = `data:image/${tokenImagePath
          .split(".")
          .pop()};base64,${imageBuffer.toString("base64")}`;
      } catch (err) {
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
}

/**
 * Starts the process by authenticating the user, connecting to the socket, and showing the menu.
 */
async function start() {
  await authenticate();
  await connectSocket(); // Connect after authentication
  showMenu();
  await handleMenuSelection();
}

start();
