export class FormatVersionRange {
	private static readonly REGEX = /^\[(\d+\.\d+\.\d+)-(\d+\.\d+\.\d+|latest)([\])])$/;
	private static readonly KEYWORD = "x-format-version";
	// TODO: Add a way to get the latest game version from the schema instead of hardcoding it here.
	private static readonly LATEST_GAME_VERSION = "1.26.60";

	static parse(annotation: string): FormatVersionRange {
		const match = annotation.replace(/\s/g, "").match(FormatVersionRange.REGEX);
		if (!match) {
			throw new Error(`Invalid ${FormatVersionRange.KEYWORD}: "${annotation}"`);
		}
		const [, minText, maxText, closing] = match;
		const min = minText.split(".").map(Number);
		const writtenMax = maxText === "latest" ? FormatVersionRange.LATEST_GAME_VERSION : maxText;
		let max = writtenMax.split(".").map(Number);
		if (closing === ")") {
			const previousMax = previousParts(max);
			if (!previousMax) {
				throw new Error(`Empty ${FormatVersionRange.KEYWORD}: "${annotation}"`);
			}
			max = previousMax;
		}
		return new FormatVersionRange(min, max);
	}
	static expandSchema(schema: Record<string, unknown>): void {
		const node = schema[FormatVersionRange.KEYWORD];
		if (node === undefined) {
			return;
		}
		if (typeof node !== "string") {
			throw new Error(`Invalid ${FormatVersionRange.KEYWORD}: "${node}"`);
		}
		for (const key of ["anyOf", "enum", "const", "pattern"]) {
			if (key in schema) {
				throw new Error(`Cannot use ${FormatVersionRange.KEYWORD} with "${key}"`);
			}
		}
		delete schema[FormatVersionRange.KEYWORD];
		Object.assign(schema, FormatVersionRange.parse(node).toSchema());
	}

	/**
	 * Inclusive
	 * @param min
	 * @param max
	 */
	constructor(
		readonly min: Parts,
		readonly max: Parts,
	) {}

	toRegex(): string {
		const alternatives = [partsRangeRegex(this.min, this.max)];

		// `major.minor` means `major.minor.0`, so it is in range when that version is.
		const [minMajor, minMinor, minPatch] = this.min;
		const [maxMajor, maxMinor] = this.max;
		const twoPartMin = [minMajor, minPatch === 0 ? minMinor : minMinor + 1];
		const twoPartMax = [maxMajor, maxMinor];
		if (compareParts(twoPartMin, twoPartMax) <= 0) {
			alternatives.push(partsRangeRegex(twoPartMin, twoPartMax));
		}
		return `^${group(alternatives)}$`;
	}
	toSchema() {
		return {
			anyOf: [
				{
					enum: [this.min.join(".")],
				},
				{
					type: "string",
					pattern: this.toRegex(),
				},
			],
		};
	}
}

type Parts = number[];

/**
 * Compares two arrays of numbers lexicographically (like semver).
 * Returns -1 if `a` sorts before `b`, 1 if `a` sorts after `b`, and 0 if they are equal.
 * @param a
 * @param b
 * @returns
 */
function compareParts(a: Parts, b: Parts): -1 | 0 | 1 {
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return a[i] < b[i] ? -1 : 1;
		}
	}
	return 0;
}

/**
 * The largest parts sorting before `parts`, e.g. `1.10.0` → `1.9.∞`. Null for `0.0.0`.
 * @param parts
 * @returns
 */
function previousParts(parts: Parts): Parts | null {
	const last = parts.findLastIndex((part) => part > 0);
	if (last === -1) {
		return null;
	}
	return parts.map((part, i) => (i < last ? part : i === last ? part - 1 : Infinity));
}

/**
 * Regex for dotted versions whose parts sort between `min` and `max` (inclusive).
 *
 * With `min = 1.8.3` and `max = 1.12.4`, the shared `1.` is emitted once, then the minor part
 * splits into three alternatives:
 *   - `8.` followed by anything from `3` up,
 *   - `9` to `11` followed by anything,
 *   - `12.` followed by anything up to `4`.
 * The first and last alternatives fold into the middle one when their rest is unbounded.
 */
function partsRangeRegex(min: Parts, max: Parts): string {
	const [low, ...lowRest] = min;
	const [high, ...highRest] = max;
	if (lowRest.length === 0) {
		return numberRangeRegex(low, high);
	}
	if (low === high) {
		return `${low}\\.${partsRangeRegex(lowRest, highRest)}`;
	}

	const anyRest = {
		min: lowRest.map(() => 0),
		max: lowRest.map(() => Infinity),
	};
	const lowRestIsAny = compareParts(lowRest, anyRest.min) === 0;
	const highRestIsAny = compareParts(highRest, anyRest.max) === 0;

	const alternatives: string[] = [];
	if (!lowRestIsAny) {
		alternatives.push(`${low}\\.${partsRangeRegex(lowRest, anyRest.max)}`);
	}
	const middleLow = lowRestIsAny ? low : low + 1;
	const middleHigh = highRestIsAny ? high : high - 1;
	if (middleLow <= middleHigh) {
		const rest = partsRangeRegex(anyRest.min, anyRest.max);
		alternatives.push(`${numberRangeRegex(middleLow, middleHigh)}\\.${rest}`);
	}
	if (!highRestIsAny) {
		alternatives.push(`${high}\\.${partsRangeRegex(anyRest.min, highRest)}`);
	}
	return group(alternatives);
}

/**
 * Regex for non-negative integers from `low` to `high` (inclusive) without leading zeros.
 * `high` may be `Infinity`.
 */
function numberRangeRegex(min: number, max: number): string {
	const lowDigits = String(min).length;
	if (max === Infinity) {
		const sameLength = numberRangeRegex(min, 10 ** lowDigits - 1);
		return group([sameLength, `\\d{${lowDigits + 1},}`]);
	}

	// Split into ranges whose bounds have the same digit count, e.g. 8-120 → 8-9, 10-99, 100-120.
	const alternatives: string[] = [];
	for (let digits = lowDigits; digits <= String(max).length; digits++) {
		const from = Math.max(min, digits === 1 ? 0 : 10 ** (digits - 1));
		const to = Math.min(max, 10 ** digits - 1);
		alternatives.push(sameLengthRangeRegex(String(from), String(to)));
	}
	return group(alternatives);
}

/**
 * Regex for numbers from `from` to `to` (inclusive) written with the same digit count.
 * Same shape as `partsRangeRegex`, with digits as parts: `183-412` splits into `18[3-9]`,
 * `19\d`, `[23]\d{2}`, `40\d`, `41[0-2]`.
 */
function sameLengthRangeRegex(from: string, to: string): string {
	const [low, lowRest] = [from[0], from.slice(1)];
	const [high, highRest] = [to[0], to.slice(1)];
	if (lowRest === "") {
		return digitRangeRegex(Number(low), Number(high));
	}
	if (low === high) {
		return low + sameLengthRangeRegex(lowRest, highRest);
	}

	const anyRest = {
		min: "0".repeat(lowRest.length),
		max: "9".repeat(lowRest.length),
	};
	const lowRestIsAny = lowRest === anyRest.min;
	const highRestIsAny = highRest === anyRest.max;

	const alternatives: string[] = [];
	if (!lowRestIsAny) {
		alternatives.push(low + sameLengthRangeRegex(lowRest, anyRest.max));
	}
	const middleLow = Number(low) + (lowRestIsAny ? 0 : 1);
	const middleHigh = Number(high) - (highRestIsAny ? 0 : 1);
	if (middleLow <= middleHigh) {
		const rest = lowRest.length === 1 ? "\\d" : `\\d{${lowRest.length}}`;
		alternatives.push(digitRangeRegex(middleLow, middleHigh) + rest);
	}
	if (!highRestIsAny) {
		alternatives.push(high + sameLengthRangeRegex(anyRest.min, highRest));
	}
	return group(alternatives);
}

function digitRangeRegex(min: number, max: number): string {
	if (min === max) {
		return String(min);
	}
	if (min === 0 && max === 9) {
		return "\\d";
	}
	return `[${min}-${max}]`;
}

function group(alternatives: string[]): string {
	if (alternatives.length === 1) {
		return alternatives[0];
	}
	return `(?:${alternatives.join("|")})`;
}
