const MAGIC = new Uint8Array([0x7f, 0x4d, 0x43, 0x42]);
const HEADER_SIZE = 12;

export function isMcb(bytes: Uint8Array): boolean {
	return bytes.length >= MAGIC.length && MAGIC.every((byte, index) => bytes[index] === byte);
}

export function decodeMcb(bytes: Uint8Array): Record<string, unknown> {
	if (!isMcb(bytes)) {
		throw new Error("Invalid MCB: unexpected magic");
	}
	const cursor = new Cursor(bytes);
	cursor.offset = MAGIC.length;
	const formatVersion = [cursor.uint16(), cursor.uint16(), cursor.uint16()].join(".");
	cursor.offset = HEADER_SIZE;

	const rootKey = cursor.string();
	const readRoot = ROOT_LAYOUTS[rootKey];
	if (!readRoot) {
		throw new Error(`Unsupported MCB root key "${rootKey}"; add its layout to ROOT_LAYOUTS`);
	}
	const root = readRoot(cursor);
	if (cursor.offset !== bytes.length) {
		throw new Error(
			`Invalid MCB: ${bytes.length - cursor.offset} trailing bytes after "${rootKey}"; its layout is out of date`,
		);
	}
	return { format_version: formatVersion, [rootKey]: root };
}

class Cursor {
	offset = 0;
	private readonly view: DataView;
	private readonly decoder = new TextDecoder("utf-8", { fatal: true });

	constructor(private readonly bytes: Uint8Array) {
		this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}

	uint8(): number {
		this.ensure(1);
		return this.bytes[this.offset++];
	}

	uint16(): number {
		this.ensure(2);
		const value = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}

	/** Unsigned LEB128. */
	varint(): number {
		let value = 0;
		let scale = 1;
		let byte: number;
		do {
			byte = this.uint8();
			value += (byte & 0x7f) * scale;
			scale *= 0x80;
		} while (byte & 0x80);
		return value;
	}

	string(): string {
		const length = this.varint();
		this.ensure(length);
		const text = this.decoder.decode(this.bytes.subarray(this.offset, this.offset + length));
		this.offset += length;
		return text;
	}

	private ensure(length: number): void {
		if (this.offset + length > this.bytes.length) {
			throw new Error(`Invalid MCB: read of ${length} bytes at ${this.offset} is out of bounds`);
		}
	}
}

type Layout = (cursor: Cursor) => unknown;

const string: Layout = (cursor) => cursor.string();
const uint8: Layout = (cursor) => cursor.uint8();

function array(item: Layout): Layout {
	return (cursor) => Array.from({ length: cursor.varint() }, () => item(cursor));
}

function object(members: Record<string, Layout>): Layout {
	return (cursor) => {
		const result: Record<string, unknown> = {};
		for (const [name, read] of Object.entries(members)) {
			result[name] = read(cursor);
		}
		return result;
	};
}

const ROOT_LAYOUTS: Record<string, Layout> = {
	"minecraft:poi_block": object({
		description: object({ identifier: string }),
		tickets: uint8,
		usable_distance: uint8,
		blocks: array(string),
		tags: array(string),
	}),
	"minecraft:poi_tag": object({
		description: object({ identifier: string }),
		children: array(string),
		parents: array(string),
	}),
};
