import path from "node:path/posix";
import { FormatVersionEnums } from "./format_version_enum";
import { FormatVersionRange } from "./format_version_range";
import { resolveJsonPath, SchemaVisitor } from "./schema_visitor";
import type { Schema } from "./types";
import { normalizePath, readJson } from "./utils";

function stripSchemaKeys(schema: Schema | boolean) {
	if (typeof schema !== "object" || schema === null) {
		return;
	}
	const keys = ["$schema"];
	for (const key of keys) {
		if (key in schema) {
			delete schema[key as keyof Schema];
		}
	}
}

export async function bundleSchema(entryPoint: string): Promise<Schema> {
	entryPoint = path.join(normalizePath(entryPoint));
	const documents = new Map<string, Schema>();

	const loadSchema = async (filepath: string): Promise<Schema> => {
		if (documents.has(filepath)) {
			return documents.get(filepath)!;
		}
		const schema = await readJson<Schema>(filepath);
		new SchemaVisitor((node, pointer) => {
			try {
				FormatVersionRange.expandSchema(node as Record<string, unknown>);
			} catch (error) {
				throw new Error(`${filepath}#${pointer}: ${(error as Error).message}`);
			}
		}).visitSchema(schema);
		FormatVersionEnums.expandSchema(schema);
		documents.set(filepath, schema);
		return schema;
	};

	type BundledReference = {
		key: string;
		content: unknown;
	};
	const hashedRefs: Map<string, BundledReference> = new Map();
	const setRefs = new Set<string>();
	const rootSchema = await loadSchema(entryPoint);
	rootSchema.$defs = rootSchema.$defs || {};

	for (const [filepath, schema] of documents) {
		const references: Schema[] = [];
		const visitor = new SchemaVisitor((node) => {
			if (typeof node.$ref === "string") {
				references.push(node);
			}
		});
		visitor.visitSchema(schema);

		for (const node of references) {
			const ref = node.$ref!;
			const hash = ref.indexOf("#");
			const pathname = hash === -1 ? ref : ref.slice(0, hash);
			const fragment = hash === -1 ? "" : ref.slice(hash + 1);
			const targetPath = pathname ? path.join(path.dirname(filepath), pathname) : filepath;
			const fullRef = targetPath + fragment;
			if (hashedRefs.has(fullRef)) {
				node.$ref = `#/$defs/${hashedRefs.get(fullRef)!.key}`;
				continue;
			}

			const targetSchema = await loadSchema(targetPath);
			// References back to the entry document must remain references rather
			// than inserting the root object into its own bundled $defs.
			if (targetPath === entryPoint && fragment === "") {
				node.$ref = "#";
				continue;
			}

			const pointer = fragment ? `#${fragment}` : "";
			const key = Bun.hash(fullRef).toString(36);
			if (pointer) {
				const json = resolveJsonPath(targetSchema, pointer.slice(1));
				hashedRefs.set(fullRef, { key, content: json });
			} else {
				hashedRefs.set(fullRef, { key, content: targetSchema });
			}
			node.$ref = `#/$defs/${key}`;
			setRefs.add(key);
		}
	}

	rootSchema.$defs = {};
	for (const [, { key, content }] of hashedRefs) {
		stripSchemaKeys(content as Schema);
		rootSchema.$defs![key] = content as Schema;
	}

	// Unoptimized cleanup?
	const visitor = new SchemaVisitor((node) => {
		if (node.$defs) {
			for (const key of Object.keys(node.$defs)) {
				if (!setRefs.has(key)) {
					delete node.$defs[key];
				}
			}
			if (Object.keys(node.$defs).length === 0) {
				delete node.$defs;
			}
		}
	});
	visitor.visitSchema(rootSchema);

	return rootSchema;
}
