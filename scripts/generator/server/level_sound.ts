import type { Schema } from "../../types";
import { getBedrockJSON } from "../../utils";

export async function generateServerLevelSound() {
	const particleType = await getBedrockJSON<Schema, string[]>({
		type: "metadata",
		pattern: "json_schemas/server/**/LevelSoundEvent.json",
		transform: (content) => content.enum ?? [],
	}).then((arrays) => Array.from(new Set(arrays.flat())).sort());
	return particleType;
}
