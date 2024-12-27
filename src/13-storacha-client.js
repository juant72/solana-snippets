"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.uploadJsonToStoracha = uploadJsonToStoracha;
exports.stringToReadableStream = stringToReadableStream;
const Client = __importStar(require("@web3-storage/w3up-client"));
const memory_1 = require("@web3-storage/w3up-client/stores/memory");
const Proof = __importStar(require("@web3-storage/w3up-client/proof"));
const ed25519_1 = require("@web3-storage/w3up-client/principal/ed25519");
const stream_1 = require("stream");
function uploadJsonToStoracha(metadataJson) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Load client with specific private key
            const principal = ed25519_1.Signer.parse(process.env.STORACHA_AUTH);
            const store = new memory_1.StoreMemory();
            const client = yield Client.create({ principal, store });
            // Add proof that this agent has been delegated capabilities on the space
            const proof = yield Proof.parse(process.env.STORACHA_UCAN);
            const space = yield client.addSpace(proof);
            yield client.setCurrentSpace(space.did());
            // Crear el contenido del archivo
            const content = "Hola, este es un archivo de prueba para Web3.Storage";
            const fileStream = new stream_1.Readable();
            fileStream.push(content);
            fileStream.push(null); // Finaliza el stream
            // Crear un Blob con contenido de ejemplo
            const contenido = new Blob(["Contenido de ejemplo"], {
                type: "text/plain",
            });
            // Subir el archivo
            const cid = yield client.uploadFile(contenido);
            console.log(`Archivo subido con éxito. CID: ${cid}`);
            console.log(`Archivo subido con éxito. CID: ${cid}`);
        }
        catch (error) {
            console.error("Error subiendo archivo:", error);
        }
        // {
        //     "did": "did:key:z6Mkg5Ju8uGgEYCEruu3jZdqv2GT6tDSPRticT6wii2pdqaU",
        //     "key": "MgCZGt63i4loLOxJkVBb1fzccGcunaaV8DHEHGqJqwZTGO+0BGBfSxw7ShRdXUAcCHcq/nP9/ysDZqXA2gvbjDc6T/kU="
        //   }
        return "";
    });
}
function stringToReadableStream(text) {
    return new stream_1.Readable({
        read() {
            this.push(text);
            this.push(null); // Señala el final del stream
        },
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const imageStream = stringToReadableStream("prueba");
        const retorno = uploadJsonToStoracha(imageStream);
        console.log("Retorno:", retorno);
    });
}
main().catch(console.log);
