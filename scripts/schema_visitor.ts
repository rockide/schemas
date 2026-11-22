import type { Schema } from "./types";

export class SchemaVisitor {
	private static readonly SCHEMA_MAPS = [
		"$defs",
		"definitions",
		"properties",
		"patternProperties",
		"dependencies",
		"dependentSchemas",
	];
	private static readonly SCHEMA_VALUES = [
		"items",
		"additionalItems",
		"additionalProperties",
		"contains",
		"not",
		"if",
		"then",
		"else",
		"propertyNames",
		"unevaluatedItems",
		"unevaluatedProperties",
		"contentSchema",
		"allOf",
		"anyOf",
		"oneOf",
		"prefixItems",
	];
	visitedSchemas: Set<Schema> = new Set();
	constructor(private visit: (node: Schema, pointer: string) => void) {}

	private isObject(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === "object" && !Array.isArray(value);
	}

	visitSchema(schema: Schema, pointer: string = "") {
		if (this.visitedSchemas.has(schema)) {
			return;
		}
		this.visitedSchemas.add(schema);
		this.visit(schema, pointer);
		for (const key of SchemaVisitor.SCHEMA_MAPS) {
			const schemas = schema[key as keyof Schema];
			if (this.isObject(schemas)) {
				for (const [subKey, subSchema] of Object.entries(schemas)) {
					this.visitSchema(subSchema as Schema, `${pointer}/${key}/${subKey}`);
				}
			}
		}
		for (const key of SchemaVisitor.SCHEMA_VALUES) {
			const subSchema = schema[key as keyof Schema];
			if (this.isObject(subSchema)) {
				this.visitSchema(subSchema as Schema, `${pointer}/${key}`);
			} else if (Array.isArray(subSchema)) {
				subSchema.forEach((item, index) => {
					if (this.isObject(item)) {
						this.visitSchema(item as Schema, `${pointer}/${key}/${index}`);
					}
				});
			}
		}
	}
}

export function resolveJsonPath(json: unknown, pointer: string): unknown {
	const fragments = pointer.split("/");
	let current = json;
	for (let fragment of fragments) {
		if (fragment === "") {
			continue;
		}
		fragment = fragment.replace(/~1/g, "/").replace(/~0/g, "~");
		fragment = decodeURIComponent(fragment);
		if (current === null || typeof current !== "object") {
			throw new Error(`Invalid JSON pointer: ${pointer}`);
		}
		if (Array.isArray(current)) {
			const number = Number(fragment);
			if (isNaN(number) || number < 0 || number >= current.length) {
				throw new Error(`Invalid array index in JSON pointer: ${pointer}`);
			}
			current = current[number];
		} else {
			if (!(fragment in current)) {
				throw new Error(`Property not found in JSON pointer: ${pointer}`);
			}
			current = (current as Record<string, unknown>)[fragment];
		}
	}
	return current;
}
