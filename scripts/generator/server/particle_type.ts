import type { Schema } from "../../types";
import { getBedrockJSON } from "../../utils";

// TODO: Move to client.

export async function generateServerParticleType() {
	const particleType = await getBedrockJSON<Schema, string[]>({
		type: "metadata",
		pattern: "json_schemas/client/**/ParticleType.json",
		transform: (content) => content.enum ?? [],
	}).then((arrays) => Array.from(new Set(arrays.flat())).sort());
	return particleType;
}
