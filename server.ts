import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        headers: {
            'User-Agent': 'aistudio-build',
        }
    }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to generate brand text elements
  app.post("/api/generate-brand", async (req, res) => {
    try {
      const { mission } = req.body;
      if (!mission) {
        return res.status(400).json({ error: "Mission statement is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert brand designer and strategist. A user has provided the following company mission: 
        
        "${mission}"
        
        Please generate a comprehensive Brand Identity JSON. The design should be intentional, avoiding clichÃ©s, and highly specific to the mission.
        - Describe a brand voice/personality
        - Provide a 5-color hex palette, each with a usage note (e.g. background, accent, text, etc) and a human-readable name. 
        - Provide Google Font pairings: one for headers, one for body. Explain why they pair well with the brand.
        - Provide highly descriptive prompts for generating the primary logo and a secondary mark (avatar or sub-logo). Be specific about art style, colors to use from the palette, and composition. The prompt should be ready to directly send to an image generation AI (like Imagen or Gemini).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brandVoice: {
                type: Type.STRING,
                description: "A short, vivid description of the brand's personality."
              },
              colorPalette: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    hex: { type: Type.STRING, description: "Hex code including the #" },
                    name: { type: Type.STRING, description: "Creative name for the color" },
                    usage: { type: Type.STRING, description: "How to use this color (e.g., Primary CTA, Background)" }
                  },
                  required: ["hex", "name", "usage"]
                },
                description: "Exactly 5 colors."
              },
              typography: {
                type: Type.OBJECT,
                properties: {
                  headerFont: { type: Type.STRING, description: "Google Font name for headers" },
                  bodyFont: { type: Type.STRING, description: "Google Font name for body text" },
                  reasoning: { type: Type.STRING, description: "Why these fonts work" }
                },
                required: ["headerFont", "bodyFont", "reasoning"]
              },
              logoPrompt: {
                type: Type.STRING,
                description: "Prompt to generate the primary logo. Avoid text in the logo."
              },
              secondaryMarkPrompt: {
                 type: Type.STRING,
                 description: "Prompt to generate a secondary mark or icon. Avoid text in the mark."
              }
            },
            required: ["brandVoice", "colorPalette", "typography", "logoPrompt", "secondaryMarkPrompt"]
          }
        }
      });

      const brandIdentity = JSON.parse(response.text || '{}');
      res.json(brandIdentity);
    } catch (error) {
      console.error('Error generating brand:', error);
      res.status(500).json({ error: "Failed to generate brand identity." });
    }
  });

  // API Route to generate images
  app.post("/api/generate-image", async (req, res) => {
      try {
          const { prompt, aspectRatio } = req.body;
          if (!prompt) {
              return res.status(400).json({ error: "Image prompt is required" });
          }

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
              config: {
                imageConfig: {
                    aspectRatio: aspectRatio || '1:1'
                }
              }
          });

          let base64String = null;
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              base64String = part.inlineData.data;
              break;
            }
          }

          if (base64String) {
              res.json({ imageBase64: base64String });
          } else {
              res.status(500).json({ error: "Empty image response" });
          }
      } catch (error) {
          console.error("Error generating image:", error);
          res.status(500).json({ error: "Failed to generate image" });
      }
  });

  // API Route to regenerate just the color palette
  app.post("/api/generate-palette", async (req, res) => {
    try {
      const { mission } = req.body;
      if (!mission) {
        return res.status(400).json({ error: "Mission statement is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert brand designer. Generate a new, distinct 5-color hex palette for a company with this mission: "${mission}". Avoid clichés. Provide a human-readable name and usage note for each.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                hex: { type: Type.STRING, description: "Hex code including the #" },
                name: { type: Type.STRING, description: "Creative name for the color" },
                usage: { type: Type.STRING, description: "How to use this color (e.g., Primary CTA, Background)" }
              },
              required: ["hex", "name", "usage"]
            },
            description: "Exactly 5 colors."
          }
        }
      });

      const colorPalette = JSON.parse(response.text || '[]');
      res.json(colorPalette);
    } catch (error) {
      console.error('Error generating palette:', error);
      res.status(500).json({ error: "Failed to generate color palette." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
