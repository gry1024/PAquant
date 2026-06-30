const { handleRequest } = require("./api.js");

async function main(event = {}, context = {}, options = {}) {
  const response = await handleRequest({
    method: readMethod(event),
    url: readUrl(event, context),
    body: readBody(event),
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false
  };
}

function readMethod(event) {
  return (
    event.httpMethod ??
    event.requestContext?.http?.method ??
    event.requestContext?.httpMethod ??
    event.method ??
    "GET"
  ).toUpperCase();
}

function readUrl(event, context) {
  const path =
    event.path ??
    event.rawPath ??
    event.requestContext?.path ??
    event.requestContext?.http?.path ??
    context.httpContext?.path ??
    context.httpContext?.url ??
    "/";
  const query = readQuery(event);
  return query ? `${path}?${query}` : path;
}

function readQuery(event) {
  if (typeof event.rawQueryString === "string") {
    return event.rawQueryString;
  }
  const params = event.queryStringParameters ?? event.query ?? {};
  return new URLSearchParams(params).toString();
}

function readBody(event) {
  if (event.body == null) {
    return "";
  }
  if (typeof event.body !== "string") {
    return JSON.stringify(event.body);
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

module.exports = { main };
