import { io, Socket } from "socket.io-client";
import { faker } from "@faker-js/faker";
import readlineSync from "readline-sync";
import {
  Transaction,
  Keypair,
  VersionedTransaction,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import fs from "fs";

let socket = io("http://localhost:3000");

// Cargar la wallet local desde el archivo JSON
const walletPath = "~/wallet-client.json";

let keypair = new Keypair();
try {
  keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(
    "Wallet cargada con éxito. Dirección pública:",
    keypair.publicKey.toString()
  );
} catch (err) {
  console.error("Error al cargar la wallet:", err);
  process.exit(1);
}

socket.on("server_message", (message) => {
  console.log(message);
});

let authToken: string | null = null;
async function authenticate() {
  // Realiza la autenticación (podría ser una llamada HTTP o similar)
  try {
    // Llamada a una función que te devuelve el token (ejemplo con fetch)
    const response = await fetch("http://localhost:3000/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "user", password: "pass" }),
    });
    const data = await response.json();
    authToken = data.token; // Almacena el JWT

    console.log("Authenticated. Token received.");
  } catch (error) {
    console.error("Error during authentication:", error);
  }
}

async function connectSocket() {
  if (!authToken) {
    console.error("No auth token found. Please authenticate first.");
    return;
  }

  socket = io("http://localhost:3000", {
    auth: {
      token: authToken, // Enviar el token como parte de la conexión
    },
  });

  socket.on("connect", () => {
    console.log("Socket connected with JWT token!");
  });

  socket.on("server_message", (message) => {
    console.log("Server message:", message);
  });

  // Otros eventos aquí
}

function showMenu() {
  console.log("\nChoose an option:");
  console.log("1. Create token");
  console.log("2. Exit");
}

async function handleMenuSelection() {
  const choice = readlineSync.question("Enter your option: ");

  switch (choice) {
    case "1":
      // Generar valores por defecto con Faker
      const defaultTokenName = faker.finance.currencyName();
      const defaultTokenSymbol = faker.finance.currencyCode();
      const defaultTokenDescription = faker.lorem.sentence();
      const defaultTokenDecimals = "6";
      const defaultTokenSupply = "1000000";
      const defaulImagePath = "tokenlogo.png";
      const defaultRevokeFreeze = false;
      const defaultRevokeMint = false;

      // Preguntar por detalles del token
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

      // Procesar carga de imagen en base64
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

      console.log(
        "Emiting event 'create_token' with the next data:",
        tokenData
      );

      //   if (socket.connected) {
      //     socket.emit("create_token", tokenData);
      //   } else {
      //     console.error("Error: El socket no está conectado.");
      //   }

      socket.on("connect", () => {
        console.log("Socket connected!");
        // Ahora puedes emitir el evento
        socket.emit("create_token", tokenData);
      });

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

socket.on("transaction_details", async (data) => {
  console.log("Transaction details received.");
  console.log("Estimated Gas: ", data.estimatedGas);

  const acceptTransaction = readlineSync.keyInYNStrict(
    "¿Do you want to approve this transaction and execute?"
  );
  if (acceptTransaction) {
    console.log("Signing transaction...");

    const connection = new Connection(clusterApiUrl("devnet"));

    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();
    console.log("****************");
    console.log("*** Recibido recentBlockhash: ", blockhash);

    try {
      let transaction;
      console.log("Proccessing transaction...");
      try {
        transaction = Transaction.from(Buffer.from(data.transaction, "base64"));
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
  console.log("Waiting answer from server...");
});

socket.on("transaction_result", (result) => {
  if (result.success) {
    console.log("¡Token created successfully!");
    console.log("Transaction ID:", result.transactionId);
  } else {
    console.error("Error executing transaction:", result.error);
    console.error("Full Details Error: ", result);
  }
});

socket.on("error", (error) => {
  console.error(error.message);
  console.error("Error Details:", error.error);
});

async function getRecentBlockhash() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("finalized");

  if (!blockhash) {
    throw new Error("Cannot get recentBlockhash.");
  }

  return { blockhash, lastValidBlockHeight };
}

async function start() {
  await authenticate();
  await connectSocket();
  showMenu();
  await handleMenuSelection();
}

start();
