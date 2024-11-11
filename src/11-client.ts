import { io } from "socket.io-client";
import readlineSync from "readline-sync";
import {
  Transaction,
  Keypair,
  VersionedTransaction,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import fs from "fs";

const socket = io("http://localhost:3000"); // Asegúrate de que el puerto sea correcto

// Cargar la wallet local desde el archivo JSON
const walletPath = "~/wallet-client.json"; // Ruta de tu wallet creada

let keypair: Keypair;
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
  process.exit(1); // Salir si no se puede cargar la wallet
}

socket.on("server_message", (message: string) => {
  console.log(message);
});

function showMenu() {
  console.log("\nSelecciona una opción:");
  console.log("1. Crear token");
  console.log("2. Salir");
}

async function handleMenuSelection() {
  const choice = readlineSync.question("Ingresa tu opción: ");

  switch (choice) {
    case "1":
      const tokenName = readlineSync.question("Ingrese el nombre del token: ");
      const tokenSymbol = readlineSync.question(
        "Ingrese el símbolo del token: "
      );
      const tokenDescription = readlineSync.question(
        "Ingrese una descripción del token: "
      );
      const tokenImageURI = readlineSync.question(
        "Ingrese la URL de la imagen del token: "
      );

      const tokenData = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        imageURI: tokenImageURI,
        publicKey: keypair.publicKey.toString(),
      };

      console.log("Solicitando la creación del token...");
      socket.emit("create_token", tokenData);
      break;
    case "2":
      console.log("Saliendo...");
      socket.disconnect();
      process.exit(0);
      break;
    default:
      console.log("Opción no válida. Intenta de nuevo.");
      break;
  }
}

socket.on("transaction_details", async (data: any) => {
  console.log("Detalles de la transacción recibidos.");

  const acceptTransaction = readlineSync.keyInYNStrict(
    "¿Deseas firmar esta transacción y proceder?"
  );
  if (acceptTransaction) {
    console.log("Signing trx start!:");

    const connection = new Connection(clusterApiUrl("devnet"));

    // Obtener el `recentBlockhash`
    // const { blockhash } = await connection.getLatestBlockhash();
    // Obtener el recentBlockhash y el lastValidBlockHeight
    const { blockhash, lastValidBlockHeight } = await getRecentBlockhash();
    console.log("****************");
    console.log("*** Recibido recentBlockhash: ", blockhash);

    try {
      let transaction: Transaction | VersionedTransaction;
      console.log("Settin let!:");
      try {
        console.log(
          "transaction = Transaction.from(Buffer.from(data.transaction))"
        );
        transaction = Transaction.from(Buffer.from(data.transaction, "base64"));
        transaction.recentBlockhash = blockhash;
        transaction.compileMessage();
      } catch (error) {
        transaction = VersionedTransaction.deserialize(
          Buffer.from(data.transaction, "base64")
        );
      }

      if (transaction instanceof VersionedTransaction) {
        console.log("Versioned TRX");
        transaction.sign([keypair]);
      } else {
        console.log("Normal TRX");
        transaction.partialSign(keypair);
      }
      //   const txnSignature = await connection.sendRawTransaction(
      //     transaction.serialize(),
      //   );

      // Convertir la transacción serializada de base64 a un objeto de transacción
      //   const transaction = Transaction.from(
      //     Buffer.from(data.serializedTransaction, "base64")
      //   );

      console.log("TRX as object: ", transaction);

      // Firmar la transacción con el Keypair
      //   transaction.sign(keypair);

      console.log("Transacción firmada");

      // Enviar la transacción firmada al servidor
      console.log("Enviando TRX signed to the server  >>>>>>");
      socket.emit("signed_transaction", {
        signedTransactionData: transaction
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
      });
    } catch (err) {
      console.error("Error al firmar la transacción en el cliente:", err);
    }
  } else {
    console.log("Transacción cancelada.");
  }
});

socket.on("transaction_result", (result: any) => {
  if (result.success) {
    console.log("¡Token creado con éxito!");
    console.log("Transaction ID:", result.transactionId);
  } else {
    console.error("Error al ejecutar la transacción:", result.error);
    console.error("Detalles completos del error:", result);
  }
});

socket.on("error", (error: { message: string; error: string }) => {
  console.error(error.message);
  console.error("Detalles del error:", error.error);
});

// Función para obtener el recentBlockhash
async function getRecentBlockhash() {
  const connection = new Connection(clusterApiUrl("devnet"));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("finalized");

  if (!blockhash) {
    throw new Error("No se pudo obtener el recentBlockhash.");
  }

  return { blockhash, lastValidBlockHeight };
}

async function start() {
  showMenu();
  await handleMenuSelection();
}

start();
