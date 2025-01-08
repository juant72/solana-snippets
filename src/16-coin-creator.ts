import express, { Request, Response, RequestHandler } from "express";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import cors from "cors";

interface CoinRequest {
  logoUrl: string;
  tokenName: string;
}

const app = express();
const PORT = 3100;

app.use(cors());

const generateCoinHandler: RequestHandler<{}, any, never, CoinRequest> = async (
  req,
  res
) => {
  try {
    const { logoUrl, tokenName } = req.query;

    if (!logoUrl || !tokenName) {
      res.status(400).json({
        error: "Missing parameters: logoUrl and tokenName are required.",
      });
      return;
    }

    const width = 300;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width * 0.45;

    // Clear for transparency
    ctx.clearRect(0, 0, width, height);

    // Background color (less bright bronze)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#CD7F32"; // Bronze background
    ctx.fill();

    // Enhanced metallic gradient for 3D effect (bright bronze)
    const coinGradient = ctx.createRadialGradient(
      centerX - 50,
      centerY - 50,
      0,
      centerX,
      centerY,
      radius
    );
    coinGradient.addColorStop(0, "#FFD700"); // Bright gold
    coinGradient.addColorStop(0.5, "#CD7F32"); // Medium bronze
    coinGradient.addColorStop(1, "#8B4513"); // Dark bronze

    // Main coin body with rim effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = coinGradient;
    ctx.fill();

    // Add highly visible circular texture pattern
    for (let i = 0; i < 360; i += 5) {
      const radian = (i * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius - 20,
        radian,
        radian + (Math.PI / 180) * 2
      );
      ctx.strokeStyle = "rgba(255, 215, 0, 0.5)"; // Bright gold, more visible
      ctx.lineWidth = 4; // Thicker lines
      ctx.stroke();
    }

    // Add highly visible linear texture pattern
    for (let i = 0; i < radius; i += 5) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, i, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(205, 127, 50, 0.4)"; // Bronze, more visible
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Add rim details with 3D effect (bright bronze)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFD700"; // Bright gold for rim
    ctx.lineWidth = 10;
    ctx.stroke();

    // Inner rim for 3D effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#CD7F32"; // Medium bronze for inner rim
    ctx.lineWidth = 5;
    ctx.stroke();

    try {
      // Process and draw logo
      const logo = await loadImage(logoUrl);
      const logoSize = width * 0.35;
      const logoX = (width - logoSize) / 2;
      const logoY = (height - logoSize) / 2;

      // Create temporary canvas for logo processing
      const tempCanvas = createCanvas(logoSize, logoSize);
      const tempCtx = tempCanvas.getContext("2d");

      // Draw and process logo
      tempCtx.drawImage(logo, 0, 0, logoSize, logoSize);

      // Color matching
      tempCtx.globalCompositeOperation = "source-atop";
      const logoGradient = tempCtx.createRadialGradient(
        logoSize / 2 - 20,
        logoSize / 2 - 20,
        0,
        logoSize / 2,
        logoSize / 2,
        logoSize / 2
      );
      logoGradient.addColorStop(0, "rgba(255, 215, 0, 0.7)");
      logoGradient.addColorStop(0.5, "rgba(205, 127, 50, 0.7)");
      logoGradient.addColorStop(1, "rgba(139, 69, 19, 0.7)");
      tempCtx.fillStyle = logoGradient;
      tempCtx.fillRect(0, 0, logoSize, logoSize);

      // Draw processed logo
      ctx.drawImage(tempCanvas, logoX, logoY);

      // Draw circular token name
      ctx.save();
      ctx.font = "bold 18px Arial";
      const text = tokenName.toUpperCase();
      const textRadius = radius * 0.85;

      // Circular text around the top of the coin
      for (let i = 0; i < text.length; i++) {
        const angle = Math.PI + (i - text.length / 2) * 0.2;
        ctx.save();
        ctx.translate(
          centerX + textRadius * Math.cos(angle),
          centerY + textRadius * Math.sin(angle)
        );
        ctx.rotate(angle + Math.PI / 2);

        // Text shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "#FFD700"; // Bright gold text
        ctx.fillText(text[i], 0, 0);

        ctx.restore();
      }
      ctx.restore();

      // Add shine effects
      ctx.beginPath();
      ctx.ellipse(
        centerX - 60,
        centerY - 60,
        80,
        20,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; // More visible shine
      ctx.fill();

      // Second highlight
      ctx.beginPath();
      ctx.ellipse(
        centerX + 30,
        centerY + 30,
        40,
        10,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; // More visible shine
      ctx.fill();

      const buffer = canvas.toBuffer("image/png");
      res.type("image/png");
      res.send(buffer);
    } catch (imageError) {
      res.status(400).json({ error: "Failed to load logo image" });
    }
  } catch (error) {
    console.error("Error generating coin:", error);
    res
      .status(500)
      .json({ error: "Internal server error while generating coin" });
  }
};

app.get("/generate-coin", generateCoinHandler);

app.listen(PORT, () => {
  console.log(`Coin generator server running on port ${PORT}`);
});

export default app;
