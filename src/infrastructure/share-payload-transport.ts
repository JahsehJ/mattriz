export const MAX_SHARE_FRAGMENT_LENGTH = 32_768;
const MAX_DECODED_BYTES = 262_144;

export async function encodeSharePayload(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	const plain = `1j${toBase64Url(bytes)}`;
	if (typeof CompressionStream === "undefined") return assertFits(plain);

	const compressed = await transformBytes(
		bytes,
		new CompressionStream("gzip"),
	);
	const gzip = `1g${toBase64Url(compressed)}`;
	return assertFits(gzip.length < plain.length ? gzip : plain);
}

export async function decodeSharePayload(fragment: string): Promise<unknown> {
	if (fragment.length > MAX_SHARE_FRAGMENT_LENGTH)
		throw new Error("Share payload is too large");
	if (!fragment.startsWith("1j") && !fragment.startsWith("1g"))
		throw new Error("Unsupported share payload");

	const source = fromBase64Url(fragment.slice(2));
	const bytes =
		fragment[1] === "g" ? await decompressBounded(source) : source;
	if (bytes.byteLength > MAX_DECODED_BYTES)
		throw new Error("Share payload is too large");

	try {
		return JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(bytes),
		);
	} catch {
		throw new Error("Malformed share payload");
	}
}

function assertFits(payload: string): string {
	if (payload.length > MAX_SHARE_FRAGMENT_LENGTH)
		throw new Error("Share payload is too large");
	return payload;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]+$/.test(value))
		throw new Error("Malformed share payload");
	try {
		const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
		const binary = atob(
			base64.padEnd(Math.ceil(base64.length / 4) * 4, "="),
		);
		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	} catch {
		throw new Error("Malformed share payload");
	}
}

async function transformBytes(
	bytes: Uint8Array,
	transform: CompressionStream,
): Promise<Uint8Array> {
	const writer = transform.writable.getWriter();
	const writing = writer
		.write(new Uint8Array(bytes))
		.then(() => writer.close());
	const [result] = await Promise.all([
		readBounded(transform.readable, MAX_DECODED_BYTES),
		writing,
	]);
	return result;
}

async function decompressBounded(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === "undefined")
		throw new Error("Compressed share payload is unsupported");
	const transform = new DecompressionStream("gzip");
	const writer = transform.writable.getWriter();
	const writing = writer
		.write(new Uint8Array(bytes))
		.then(() => writer.close());
	try {
		const [result] = await Promise.all([
			readBounded(transform.readable, MAX_DECODED_BYTES),
			writing,
		]);
		return result;
	} catch (error) {
		await Promise.allSettled([writing]);
		if (isPayloadTooLargeError(error)) throw error;
		throw malformedPayloadError(error);
	}
}

async function readBounded(
	stream: ReadableStream<Uint8Array>,
	limit: number,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw new Error("Share payload is too large");
			}
			chunks.push(value);
		}
	} catch (error) {
		if (isPayloadTooLargeError(error)) throw error;
		throw malformedPayloadError(error);
	}
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

function isPayloadTooLargeError(error: unknown): error is Error {
	return (
		error instanceof Error && error.message === "Share payload is too large"
	);
}

function malformedPayloadError(cause: unknown): Error {
	const error = new Error("Malformed share payload");
	(error as Error & { cause: unknown }).cause = cause;
	return error;
}
