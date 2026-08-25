import { createGunzip } from "node:zlib";

export class PayloadTooLargeError extends Error {
  constructor(stage: "compressed" | "decompressed", maxBytes: number) {
    super(`The ${stage} payload exceeded ${maxBytes} bytes.`);
  }
}

export function decompressDeviceRequestBody(compressed: Buffer, maxBytes: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const decoder = createGunzip();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    decoder.on("data", (chunk: Buffer) => {
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        decoder.destroy(new PayloadTooLargeError("decompressed", maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    decoder.once("error", reject);
    decoder.once("end", () => resolve(Buffer.concat(chunks, totalBytes)));
    decoder.end(compressed);
  });
}
