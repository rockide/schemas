type AllOfSchema = Array<{
	if?: {
		properties?: {
			format_version?: {
				anyOf?: [{ enum?: string[] }];
			};
		};
	};
}>;

type VersionedSchema = {
	properties?: {
		format_version?: {
			anyOf?: [{ enum?: string[] }];
		};
	};
};

export class FormatVersionEnums {
	private static KEYWORD = "x-format-version-enums";

	static expandSchema(schema: Record<string, unknown>): void {
		const x = schema[FormatVersionEnums.KEYWORD];
		if (x === undefined) {
			return;
		}
		if (typeof x !== "boolean" || x !== true) {
			throw new Error(`Invalid ${FormatVersionEnums.KEYWORD}: "${x}"`);
		}
		const node = (schema as VersionedSchema).properties?.format_version?.anyOf?.[0];
		if (!node) {
			throw new Error(`Missing format_version property in schema: ${JSON.stringify(schema)}`);
		}
		delete schema[FormatVersionEnums.KEYWORD];
		const enums = FormatVersionEnums.collectEnums(schema);
		node.enum = enums;
	}

	static collectEnums(schema: Record<string, unknown>): string[] {
		const allOfItems = schema.allOf as AllOfSchema | undefined;
		if (!allOfItems) {
			return [];
		}
		return allOfItems
			.map((item) => {
				const enumValues = item.if?.properties?.format_version?.anyOf?.[0]?.enum;
				if (!Array.isArray(enumValues)) {
					throw new Error(`Invalid format_version enum in schema: ${JSON.stringify(item)}`);
				}
				return enumValues;
			})
			.flat();
	}
}
