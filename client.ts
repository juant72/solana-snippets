import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as fs from "fs"; // Importar fs para leer archivos JSON

// Configura la conexión con la red Devnet de Solana
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Program ID de tu contrato
const programId = new PublicKey("BiJpcMpjq2RpGnEuCQwbC6PX5abeHWg2BsCn4y4LHjSC");

// Cargar el IDL desde el archivo token_creator.json
const idl = JSON.parse(fs.readFileSync("./idl/token_creator.json", "utf8"));

// Definir el cliente del programa usando Anchor
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(Keypair.generate()),
  {
    preflightCommitment: "processed",
  }
);
const program = new anchor.Program(idl, programId, provider);

// Función para crear un token
async function createToken(
  payer: Keypair,
  tokenName: string,
  symbol: string,
  decimals: number,
  supply: number,
  description: string,
  uriToken: string
) {
  try {
    // Generar las cuentas necesarias para el mint y el token_account
    const mintAccount = Keypair.generate();
    const tokenAccount = Keypair.generate();

    // Crear la transacción
    const tx = await program.methods
      .createToken(tokenName, symbol, decimals, supply, description, uriToken)
      .accounts({
        payer: payer.publicKey,
        mint: mintAccount.publicKey,
        tokenAccount: tokenAccount.publicKey,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbN2bBpfDzV2dy3CtcYow2yAzzqX"
        ), // Token Program
        systemProgram: SystemProgram.programId,
      })
      .signers([payer, mintAccount, tokenAccount])
      .rpc(); // Ejecuta la transacción

    console.log("Token creado:", tx);
  } catch (err) {
    console.error("Error al crear el token:", err);
  }
}

// Ejecutar el proceso de creación del token
async function main() {
  // Crea una cuenta para el pagador (en un escenario real, esta cuenta estaría conectada a un wallet)
  const payer = Keypair.generate();

  // Parámetros de la creación del token
  const tokenName = "MyToken";
  const symbol = "MTK";
  const decimals = 8; // Típico en tokens
  const supply = 1000000; // Suministro del token
  const description = "Token para pruebas";
  const uriToken = "http://example.com/token_metadata";

  // Llamamos a la función para crear el token
  await createToken(
    payer,
    tokenName,
    symbol,
    decimals,
    supply,
    description,
    uriToken
  );
}

main().catch(console.error);
