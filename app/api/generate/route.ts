import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API key is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert web developer. Given a user prompt, generate clean, modern, responsive HTML, CSS, and JavaScript code.

Return a JSON object with exactly three string keys: "html", "css", "javascript".
- "html": only the content inside <body>. No <html>, <head>, <body>, <style>, or <script> tags.
- "css": all styles.
- "javascript": all JS code, no <script> tags.
Make the design modern, visually appealing, and fully responsive.`,
          },
          {
            role: "user",
            content: prompt.trim(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Groq API error:", JSON.stringify(errorData));
      return NextResponse.json(
        { error: "Failed to contact Groq API." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content ?? "";

    let parsed: { html: string; css: string; javascript: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Groq response:", rawText);
      return NextResponse.json(
        { error: "AI returned an unexpected response format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      html: typeof parsed.html === "string" ? parsed.html : "",
      css: typeof parsed.css === "string" ? parsed.css : "",
      javascript: typeof parsed.javascript === "string" ? parsed.javascript : "",
    });

  } catch (err) {
    console.error("Unexpected error in /api/generate:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}