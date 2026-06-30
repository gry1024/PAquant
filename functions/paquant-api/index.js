const { createServer } = require("node:http");
const { handleRequest } = require("./api.js");

const server = createServer(async (req, res) => {
  const body = await readBody(req);
  const response = await handleRequest({
    method: req.method ?? "GET",
    url: req.url ?? "/",
    body,
    fetchImpl: globalThis.fetch
  });
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
});

server.listen(9000, "0.0.0.0", () => {
  console.log("PAquant API HTTP function listening on 0.0.0.0:9000");
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
