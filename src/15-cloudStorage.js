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
exports.main = main;
const uuid_1 = require("uuid");
const storage_1 = require("@google-cloud/storage");
const storage = new storage_1.Storage();
const bucketName = "dev-aktyvo-assets";
const bucket = storage.bucket(bucketName);
function createTokenStorage(tokenId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tokenUid = tokenId || (0, uuid_1.v4)();
        const baseTokenPath = `tokens/${tokenUid}`;
        const imagePath = `${baseTokenPath}/image`;
        const dataPath = `${baseTokenPath}/data`;
        return { imagePath, dataPath };
    });
}
function uploadImage(filePath, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const [file, apiResponse] = yield bucket.upload(filePath, {
                destination,
                contentType: "image/jpeg", // or the appropriate content type
            });
            return file.publicUrl();
        }
        catch (error) {
            console.error("Error uploading image:", error);
        }
    });
}
function uploadJson(filePath, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // bucket.upload returns [File, ApiResponse]
            const [file, apiResponse] = yield bucket.upload(filePath, {
                destination,
                contentType: "application/json",
            });
            return file.publicUrl();
        }
        catch (error) {
            console.error("Error uploading JSON:", error);
            throw error;
        }
    });
}
function uploadTokenFiles(imageFile, jsonFile) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { imagePath, dataPath } = yield createTokenStorage();
            // Upload image to tokens/[uid]/image/
            yield uploadImage(imageFile, `${imagePath}/token.png`);
            // Upload metadata to tokens/[uid]/data/
            yield uploadJson(jsonFile, `${dataPath}/metadata.json`);
            console.log(`Token files uploaded successfully to ${imagePath} and ${dataPath}`);
            return { imagePath, dataPath };
        }
        catch (error) {
            console.error("Error uploading token files:", error);
            throw error;
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const baseDir = __dirname;
            const imageFilePath = "c:\\temp\\kangaroo.png";
            const jsonFilePath = "c:\\temp\\metadata.json";
            yield uploadTokenFiles(imageFilePath, jsonFilePath);
            console.log("File uploads completed successfully");
        }
        catch (error) {
            console.error("Error in main execution:", error);
            process.exit(1);
        }
    });
}
// Execute if called directly
if (require.main === module) {
    main().catch(console.error);
}
