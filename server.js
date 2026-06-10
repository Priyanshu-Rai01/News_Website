const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

if (!API_KEY) {
  console.log("API KEY NOT FOUND");
}

if (!GEMINI_KEY) {
  console.log("GEMINI API KEY NOT FOUND");
}

const BASE_URL = "https://gnews.io/api/v4";

app.get("/news", async (req, res) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/top-headlines`,
      {
        params: {
          country: "in",
          lang: "en",
          max: 10,
          token: API_KEY,
        },
      }
    );

    res.json({
      status: "ok",
      articles: response.data.articles,
    });

  } catch (error) {
    console.log("HEADLINES ERROR:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch headlines",
    });
  }
});

app.get("/news/:category", async (req, res) => {
  try {
    const category = req.params.category;

    const response = await axios.get(
      `${BASE_URL}/top-headlines`,
      {
        params: {
          category,
          country: "in",
          lang: "en",
          max: 10,
          token: API_KEY,
        },
      }
    );

    res.json({
      status: "ok",
      articles: response.data.articles,
    });

  } catch (error) {
    console.log("CATEGORY ERROR:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch category news",
    });
  }
});

app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;

    const response = await axios.get(
      `${BASE_URL}/search`,
      {
        params: {
          q: query,
          lang: "en",
          max: 10,
          token: API_KEY,
        },
      }
    );

    res.json({
      status: "ok",
      articles: response.data.articles,
    });

  } catch (error) {
    console.log("SEARCH ERROR:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to search news",
    });
  }
});

app.post("/claude", async (req, res) => {
  try {
    const userMessage = req.body.messages.at(-1).content;
    const systemPrompt = req.body.system || "";

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }]
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;

    res.json({ content: [{ type: "text", text }] });

  } catch (error) {
    console.log("GEMINI ERROR:", error.message);
    res.status(500).json({ status: "error", message: "Failed to reach Gemini API" });
  }
});

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});