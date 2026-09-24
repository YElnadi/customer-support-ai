// API route: receives the chat history from the browser, sends it to Google Gemini,
// and streams the model's reply back as plain text.

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const systemPrompt =
  "You are a friendly and knowledgeable customer support bot for HeadstartAI, a platform that offers AI-driven interviews for Software Engineer jobs. Your role is to assist users with any questions they have about the platform, including how to schedule interviews, prepare for assessments, understand AI feedback, and troubleshoot common technical issues. Provide clear, concise, and helpful answers while maintaining a professional yet approachable tone. If users need further assistance, guide them on how to contact human support. Do not invent specific URLs, phone numbers, prices, or product features; if you are not sure of a detail, say so and suggest contacting human support.";

// Override in .env.local with GEMINI_MODEL=... if Google retires this model.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || ""; // optional backup model
const RETRIES = 2; // extra attempts when Gemini is busy (429/503)
const MAX_MESSAGES = 30; // only send the most recent turns to keep requests small
const MAX_CHARS = 4000; // per-message limit

// Keep only well-formed user/assistant messages (a client can never inject its own
// system prompt), then convert them to Gemini's format: "assistant" becomes "model".
function toGeminiContents(data) {
  if (!Array.isArray(data)) return null;
  const clean = data
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, MAX_CHARS) }],
    }));

  // Gemini expects the conversation to start with a user turn, so drop the greeting.
  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean.length > 0 ? clean : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isBusy = (err) => err?.status === 429 || err?.status === 503;

// Start a streaming request, retrying with a short backoff if the model is overloaded,
// then trying the optional fallback model once.
async function startStream(ai, contents) {
  const request = (model) =>
    ai.models.generateContentStream({
      model,
      contents,
      config: { systemInstruction: systemPrompt },
    });

  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await request(MODEL);
    } catch (err) {
      lastErr = err;
      if (!isBusy(err)) throw err;
      console.warn(`Gemini busy (${err.status}), attempt ${attempt + 1}/${RETRIES + 1}`);
      if (attempt < RETRIES) await sleep(800 * 2 ** attempt); // 0.8s, then 1.6s
    }
  }
  if (FALLBACK_MODEL) {
    console.warn(`Trying fallback model ${FALLBACK_MODEL}`);
    return await request(FALLBACK_MODEL);
  }
  throw lastErr;
}

function friendlyError(err) {
  const status = err?.status;
  if (status === 503) return "The assistant is very busy right now. Please try again in a minute.";
  if (status === 429) return "The assistant is getting too many requests right now. Please wait a minute and try again.";
  if (status === 400 || status === 401 || status === 403) return "The server's Gemini API key is missing or invalid.";
  return "The AI service is unavailable right now. Please try again.";
}

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The server is missing its Gemini API key." },
      { status: 500 }
    );
  }

  let contents;
  try {
    contents = toGeminiContents(await req.json());
  } catch {
    contents = null;
  }
  if (!contents) {
    return NextResponse.json(
      { error: "Request body must include at least one user message." },
      { status: 400 }
    );
  }

  let response;
  try {
    const ai = new GoogleGenAI({ apiKey });
    response = await startStream(ai, contents);
  } catch (err) {
    console.error("Gemini request failed:", err);
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        console.error("Streaming failed:", err);
        controller.error(err); // ends the stream; the client shows an error message
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}