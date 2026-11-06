// A stand-in for the OpenAI API, for the preview E2E only. The prechecks get answers at once
// (moderation: not flagged; the photo kind: pc_build). The fast read (schema "pc_appearance")
// streams the look after a short pause, with the GPU light read as white; the full read streams
// the whole structured read of a white showcase build after a pause like the model's reasoning,
// with the light as blue, so Studio shows "Adjusted after full read". GET /calls lists the calls in the order they arrived, so a test can check the
// prechecks ran before the read. Nothing here talks to OpenAI; the key the worker sends is a
// placeholder that this server ignores.
//
// FAKE_REPLAY=<a local replay with stream.chunks> sends that recording's chunks instead (1 ms
// apart), so scripts/measure-cpu.mjs can measure a real-length stream. Replays stay local.
import http from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.FAKE_PROVIDER_PORT ?? 8790);
const THINK_MS = 1_200;
const FAST_THINK_MS = 200;
const CHUNK_MS = 40;
const replayChunks = process.env.FAKE_REPLAY
  ? JSON.parse(readFileSync(process.env.FAKE_REPLAY, "utf8")).stream.chunks.map(
      (chunk) => chunk.text,
    )
  : null;

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

const calls = [];
const json = (res, body) =>
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/calls") return json(res, calls.splice(0));
    if (req.method !== "POST") return void res.writeHead(404).end();
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.url?.endsWith("/moderations")) {
      calls.push("moderation");
      return json(res, {
        id: "modr_fake",
        model: "omni-moderation-latest",
        results: [{ flagged: false, categories: {}, category_scores: {} }],
      });
    }
    if (!req.url?.endsWith("/responses")) return void res.writeHead(404).end();
    if (!JSON.parse(body).stream) {
      calls.push("pc-check");
      return json(res, {
        id: "resp_check",
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg_check",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", annotations: [], text: '{"kind":"pc_build"}' }],
          },
        ],
      });
    }
    const fast = JSON.parse(body).text?.format?.name === "pc_appearance";
    calls.push(fast ? "fast" : "read");
    res.writeHead(200, { "content-type": "text/event-stream" });
    const response = { id: "resp_fake", object: "response", status: "in_progress", output: [] };
    sse(res, { type: "response.created", sequence_number: 0, response });
    await sleep(fast ? FAST_THINK_MS : THINK_MS);
    const text = fast
      ? JSON.stringify({
          appearance: { ...read.appearance, gpu: { ...read.appearance.gpu, light: "white" } },
        })
      : JSON.stringify(read);
    const deltas = (!fast && replayChunks) || text.match(/[\s\S]{1,24}/g);
    let sequence = 1;
    for (const delta of deltas) {
      sse(res, {
        type: "response.output_text.delta",
        sequence_number: sequence++,
        item_id: "msg_fake",
        output_index: 0,
        content_index: 0,
        delta,
        logprobs: [],
      });
      await sleep(fast ? 10 : replayChunks ? 1 : CHUNK_MS);
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
