// A stand-in for the OpenAI Responses API, for the preview E2E only: it answers every request
// with a streamed structured read of a white showcase build, a few characters at a time, after a
// pause like the model's reasoning. Nothing here talks to OpenAI; the key the worker sends is a
// placeholder that this server ignores.
import http from "node:http";

const PORT = Number(process.env.FAKE_PROVIDER_PORT ?? 8790);
const THINK_MS = 1_200;
const CHUNK_MS = 40;

const read = {
  appearance: {
    case: { type: "dual-chamber", color: "white", glass: "both", orientation: "upright" },
    gpu: { fanCount: "3", length: "long", color: "white", mount: "horizontal", light: "blue" },
    cooler: {
      type: "aio",
      radiatorSize: "360",
      radiatorPosition: "top",
      pumpStyle: "round",
      color: "white",
    },
    fans: {
      front: "unknown",
      top: "0",
      side: "3",
      bottom: "2",
      rear: "unknown",
      ringColor: "blue",
    },
    memory: { sticks: "2", lightBar: "yes", color: "white" },
    motherboard: { color: "white" },
  },
  absentParts: [],
  quality: "clear",
  qualityIssues: [],
  summary: "A white dual-chamber showcase build with a top 360 AIO.",
  observations: [],
  modelGuesses: [],
  visibleText: [],
};

const sse = (res, data) => res.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/responses")) {
      res.writeHead(404).end();
      return;
    }
    for await (const _ of req);
    res.writeHead(200, { "content-type": "text/event-stream" });
    const response = { id: "resp_fake", object: "response", status: "in_progress", output: [] };
    sse(res, { type: "response.created", sequence_number: 0, response });
    await sleep(THINK_MS);
    const text = JSON.stringify(read);
    let sequence = 1;
    for (let i = 0; i < text.length; i += 24) {
      sse(res, {
        type: "response.output_text.delta",
        sequence_number: sequence++,
        item_id: "msg_fake",
        output_index: 0,
        content_index: 0,
        delta: text.slice(i, i + 24),
        logprobs: [],
      });
      await sleep(CHUNK_MS);
    }
    sse(res, {
      type: "response.completed",
      sequence_number: sequence,
      response: {
        ...response,
        status: "completed",
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    });
    res.end();
  })
  .listen(PORT, "127.0.0.1");
