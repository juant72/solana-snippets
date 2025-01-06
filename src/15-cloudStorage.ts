import { v4 as uuidv4 } from "uuid";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const bucketName = "dev-aktyvo-assets";
const bucket = storage.bucket(bucketName);

async function createTokenStorage(
  tokenId?: string
): Promise<{ imagePath: string; dataPath: string }> {
  const tokenUid = tokenId || uuidv4();
  const baseTokenPath = `tokens/${tokenUid}`;
  const imagePath = `${baseTokenPath}/image`;
  const dataPath = `${baseTokenPath}/data`;

  return { imagePath, dataPath };
}

async function uploadImage(filePath: string, destination: string) {
  try {
    const [file, apiResponse] = await bucket.upload(filePath, {
      destination,
      contentType: "image/jpeg", // or the appropriate content type
    });
    return file.publicUrl();
  } catch (error) {
    console.error("Error uploading image:", error);
  }
}

async function uploadJson(filePath: string, destination: string) {
  try {
    // bucket.upload returns [File, ApiResponse]
    const [file, apiResponse] = await bucket.upload(filePath, {
      destination,
      contentType: "application/json",
    });
    return file.publicUrl();
  } catch (error) {
    console.error("Error uploading JSON:", error);
    throw error;
  }
}

async function uploadTokenFiles(imageFile: string, jsonFile: string) {
  try {
    const { imagePath, dataPath } = await createTokenStorage();

    // Upload image to tokens/[uid]/image/
    await uploadImage(imageFile, `${imagePath}/token.png`);

    // Upload metadata to tokens/[uid]/data/
    await uploadJson(jsonFile, `${dataPath}/metadata.json`);

    console.log(
      `Token files uploaded successfully to ${imagePath} and ${dataPath}`
    );
    return { imagePath, dataPath };
  } catch (error) {
    console.error("Error uploading token files:", error);
    throw error;
  }
}

async function main() {
  try {
    const baseDir = __dirname;

    const imageFilePath = "c:\\temp\\kangaroo.png";
    const jsonFilePath = "c:\\temp\\metadata.json";

    await uploadTokenFiles(imageFilePath, jsonFilePath);

    console.log("File uploads completed successfully");
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for module usage
export { main };
