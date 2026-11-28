import { getBedrockJSON } from "../../utils";

type POIBlocks = {
	"minecraft:poi_block": {
		tags: string[];
	};
};

function isPoiBlock(json: unknown): json is POIBlocks {
	return typeof json === "object" && json !== null && "minecraft:poi_block" in json;
}

export async function generateServerPOITags() {
	const tags = await getBedrockJSON<unknown, string[]>({
		source: "data",
		type: "bp",
		brarchive: true,
		pattern: "*/__brarchive/poi/**/*.brarchive",
		transform: (content) => {
			return isPoiBlock(content) ? content["minecraft:poi_block"].tags : [];
		},
	}).then((arrays) => Array.from(new Set(arrays.flat())).sort());
	return tags;
}
