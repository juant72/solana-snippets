import * as Client from "@web3-storage/w3up-client";
import { StoreMemory } from "@web3-storage/w3up-client/stores/memory";
import * as Proof from "@web3-storage/w3up-client/proof";
import { Signer } from "@web3-storage/w3up-client/principal/ed25519";
import * as DID from "@ipld/dag-ucan/did";
import { Readable } from "stream";
import { create } from "@web3-storage/w3up-client";
import { blob } from "stream/consumers";

export async function uploadJsonToStoracha(
  metadataJson: Readable
): Promise<string> {
  try {
    // Load client with specific private key
    const principal = Signer.parse(process.env.STORACHA_AUTH!);
    const store = new StoreMemory();
    const client = await Client.create({ principal, store });
    // Add proof that this agent has been delegated capabilities on the space
    const proof = await Proof.parse(process.env.STORACHA_UCAN!);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Crear el contenido del archivo
    const content = "Hola, este es un archivo de prueba para Web3.Storage";
    const fileStream = new Readable();
    fileStream.push(content);
    fileStream.push(null); // Finaliza el stream

    // Crear un Blob con contenido de ejemplo
    const contenido = new Blob(["Contenido de ejemplo"], {
      type: "text/plain",
    });

    // Subir el archivo
    const cid = await client.uploadFile(contenido);
    console.log(`Archivo subido con éxito. CID: ${cid}`);
    console.log(`Archivo subido con éxito. CID: ${cid}`);
  } catch (error) {
    console.error("Error subiendo archivo:", error);
  }

  // {
  //     "did": "did:key:z6Mkg5Ju8uGgEYCEruu3jZdqv2GT6tDSPRticT6wii2pdqaU",
  //     "key": "MgCZGt63i4loLOxJkVBb1fzccGcunaaV8DHEHGqJqwZTGO+0BGBfSxw7ShRdXUAcCHcq/nP9/ysDZqXA2gvbjDc6T/kU="
  //   }
  return "";
}

export function stringToReadableStream(text: string): Readable {
  return new Readable({
    read() {
      this.push(text);
      this.push(null); // Señala el final del stream
    },
  });
}

async function main() {
  const imageStream = stringToReadableStream("prueba");

  const retorno = uploadJsonToStoracha(imageStream);
  console.log("Retorno:", retorno);
}

main().catch(console.log);
