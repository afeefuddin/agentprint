import { describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { decompressDeviceRequestBody, readDeviceRequestBody } from "./device-request";

describe("readDeviceRequestBody", () => {
  test("stops reading a request body that crosses the compressed limit", async () => {
    const request = new Request("https://agentprint.tech/v1/sync/batches", {
      method: "POST",
      body: Buffer.alloc(2048)
    });

    await expect(readDeviceRequestBody(request, 1024)).rejects.toThrow(
      /compressed payload exceeded 1024 bytes/i
    );
  });
});

describe("decompressDeviceRequestBody", () => {
  test("decodes a gzip body within the limit", async () => {
    const body = Buffer.from('{"ok":true}');

    expect(await decompressDeviceRequestBody(gzipSync(body), 1024)).toEqual(body);
  });

  test("stops a gzip body that expands past the limit", async () => {
    const compressed = gzipSync(Buffer.alloc(64 * 1024));

    await expect(decompressDeviceRequestBody(compressed, 1024)).rejects.toThrow(
      /decompressed payload exceeded 1024 bytes/i
    );
  });
});
