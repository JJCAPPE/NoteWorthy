import { Redis } from "@upstash/redis";

// Load environment variables in development (optional)
require("dotenv").config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL as string,
  token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
});

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    await redis.hset("feedback", { [Date.now().toString()]: body });
    return new Response(JSON.stringify({ message: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ message: err.message || "Error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
