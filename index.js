require("dotenv").config(); // Load environment variables
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK with environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to verify Firebase token
async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split("Bearer ")[1]; // Extract token

  if (!token) {
    return res.status(403).json({ error: "Unauthorized - No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Attach user info to request
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Secure API endpoint (requires authentication)
app.post("/api/gemini", verifyToken, async (req, res) => {
  const prompt = req.body.prompt;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY; // Get API key from environment

  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    // Make the API request to Gemini
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const aiResponse = response.data;

    if (aiResponse && aiResponse.candidates && aiResponse.candidates.length > 0) {
      // Send AI response back to client
      res.json({ message: aiResponse.candidates[0].content.parts[0].text });
    } else {
      res.status(500).json({ error: "Invalid response from Gemini API" });
    }
  } catch (error) {
    console.error("Error making API request:", error);
    res.status(500).json({ error: "Failed to communicate with Gemini API" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
