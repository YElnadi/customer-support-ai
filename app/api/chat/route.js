// API route: receives the chat history from the browser, sends it to OpenAI,
// and streams the model's reply back as plain text.

import { NextResponse } from "next/server";
import OpenAI from "openai";

const systemPrompt =
  "You are a friendly and knowledgeable customer support bot for HeadstartAI, a platform that offers AI-driven interviews for Software Engineer jobs. Your role is to assist users with any questions they have about the platform, including how to schedule interviews, prepare for assessments, understand AI feedback, and troubleshoot common technical issues. Provide clear, concise, and helpful answers while maintaining a professional yet approachable tone. If users need further assistance, guide them on how to contact human support.";

const MAX_MESSAGES = 30; // only send the most recent turns to keep requests small
const MAX_CHARS = 4000; // per-message limit

// Keep only well-formed user/assistant messages; never let the client inject a system prompt.
function sanitizeMessages(data) {
  if (!Array.isArray(data)) return null;
  const clean = data
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  return clean.length > 0 ? clean : null;
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "The server is missing its OpenAI API key." },
      { status: 500 }
    );
  }

  let messages;
  try {
    messages = sanitizeMessages(await req.json());
  } catch {
    messages = null;
  }
  if (!messages) {
    return NextResponse.json(
      { error: "Request body must be a non-empty array of chat messages." },
      { status: 400 }
    );
  }

  let completion;
  try {
    const openai = new OpenAI();
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
  } catch (err) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) controller.enqueue(encoder.encode(content));
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
