type Bytes = Uint8Array<ArrayBuffer>;

const WRAPPERS: { variant: string; stream: CompressionFormat }[] = [
  { variant: "zlib", stream: "deflate" },
  { variant: "gzip", stream: "gzip" },
  { variant: "raw", stream: "deflate-raw" },
];

export async function deflate(bytes: Bytes, variant: string): Promise<Uint8Array> {
  return through(bytes, new CompressionStream(wrapper(variant).stream));
}

export async function inflate(bytes: Bytes, variant: string): Promise<Uint8Array> {
  const chosen = wrapper(variant);
  for (const { stream } of [chosen, ...WRAPPERS.filter((entry) => entry !== chosen)]) {
    try {
      return await through(bytes, new DecompressionStream(stream));
    } catch {
    }
  }
  throw new Error("Input is not zlib, gzip or raw deflate data");
}

function wrapper(variant: string): { variant: string; stream: CompressionFormat } {
  return WRAPPERS.find((entry) => entry.variant === variant) ?? WRAPPERS[0];
}

async function through(bytes: Bytes, transform: TransformStream<BufferSource, Uint8Array>): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const reader = source.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }

  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
