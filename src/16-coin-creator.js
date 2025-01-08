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
const express_1 = __importDefault(require("express"));
const canvas_1 = require("@napi-rs/canvas");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const PORT = 3100;
app.use((0, cors_1.default)());
const generateCoinHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const canvas = (0, canvas_1.createCanvas)(width, height);
        const ctx = canvas.getContext("2d");
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width * 0.45;
        // Clear for transparency
        ctx.clearRect(0, 0, width, height);
        // Enhanced metallic gradient
        const coinGradient = ctx.createRadialGradient(centerX - 50, centerY - 50, 0, centerX, centerY, radius);
        coinGradient.addColorStop(0, "#FFF5D4"); // Highlight
        coinGradient.addColorStop(0.2, "#FFD700"); // Bright gold
        coinGradient.addColorStop(0.5, "#FDB931"); // Medium gold
        coinGradient.addColorStop(0.8, "#D4AF37"); // Dark gold
        coinGradient.addColorStop(1, "#B8860B"); // Darker gold
        // Main coin body with rim effect
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = coinGradient;
        ctx.fill();
        // Add texture pattern
        for (let i = 0; i < 360; i += 2) {
            const radian = (i * Math.PI) / 180;
            ctx.beginPath();
            ctx.moveTo(centerX + (radius - 10) * Math.cos(radian), centerY + (radius - 10) * Math.sin(radian));
            ctx.lineTo(centerX + (radius - 30) * Math.cos(radian), centerY + (radius - 30) * Math.sin(radian));
            ctx.strokeStyle = "rgba(218, 165, 32, 0.1)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // Add rim details
        for (let i = 0; i < 72; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, (i * Math.PI) / 36, ((i + 1) * Math.PI) / 36);
            ctx.lineWidth = 8;
            ctx.strokeStyle = i % 2 ? "#B8860B" : "#DAA520";
            ctx.stroke();
        }
        try {
            // Process and draw logo
            const logo = yield (0, canvas_1.loadImage)(logoUrl);
            const logoSize = width * 0.35;
            const logoX = (width - logoSize) / 2;
            const logoY = (height - logoSize) / 2;
            // Create temporary canvas for logo processing
            const tempCanvas = (0, canvas_1.createCanvas)(logoSize, logoSize);
            const tempCtx = tempCanvas.getContext("2d");
            // Draw and process logo
            tempCtx.drawImage(logo, 0, 0, logoSize, logoSize);
            // Color matching
            tempCtx.globalCompositeOperation = "source-atop";
            const logoGradient = tempCtx.createRadialGradient(logoSize / 2 - 20, logoSize / 2 - 20, 0, logoSize / 2, logoSize / 2, logoSize / 2);
            logoGradient.addColorStop(0, "rgba(255, 215, 0, 0.7)");
            logoGradient.addColorStop(0.5, "rgba(218, 165, 32, 0.7)");
            logoGradient.addColorStop(1, "rgba(184, 134, 11, 0.7)");
            tempCtx.fillStyle = logoGradient;
            tempCtx.fillRect(0, 0, logoSize, logoSize);
            // Draw processed logo
            ctx.drawImage(tempCanvas, logoX, logoY);
            // Draw circular text
            ctx.save();
            ctx.font = "bold 18px Arial";
            const text = tokenName.toUpperCase();
            const textRadius = radius * 0.85;
            // Top arc text
            for (let i = 0; i < text.length; i++) {
                const angle = Math.PI + (i - text.length / 2) * 0.2;
                ctx.save();
                ctx.translate(centerX + textRadius * Math.cos(angle), centerY + textRadius * Math.sin(angle));
                ctx.rotate(angle + Math.PI / 2);
                // Text shadow
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 4;
                ctx.fillStyle = "#FFE87C";
                ctx.fillText(text[i], 0, 0);
                ctx.restore();
            }
            ctx.restore();
            // Add shine effects
            ctx.beginPath();
            ctx.ellipse(centerX - 60, centerY - 60, 80, 20, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fill();
            // Second highlight
            ctx.beginPath();
            ctx.ellipse(centerX + 30, centerY + 30, 40, 10, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.fill();
            const buffer = canvas.toBuffer("image/png");
            res.type("image/png");
            res.send(buffer);
        }
        catch (imageError) {
            res.status(400).json({ error: "Failed to load logo image" });
        }
    }
    catch (error) {
        console.error("Error generating coin:", error);
        res
            .status(500)
            .json({ error: "Internal server error while generating coin" });
    }
});
app.get("/generate-coin", generateCoinHandler);
app.listen(PORT, () => {
    console.log(`Coin generator server running on port ${PORT}`);
});
exports.default = app;
