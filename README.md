# schemas

Provides JSON Schemas for Minecraft Bedrock Edition add-on development, with `format_version` versioning.

Minecraft version: v1.26.60

## compile

Run `bun run compile` to compile the schemas into a single file for each entry point. The compiled schemas are output to the `dist` folder.

### Format Version

Format versions are generated through `x-format-version` keyword in the schema.

```json
{
	"x-format-version": "[1.0.0-1.20.10)", // for versions 1.0.0 to 1.20.10 (exclusive)
	"x-format-version": "[1.20.10-latest]", // for versions 1.20.10 and above
	"x-format-version": ["[1.0.0-1.20.10)", "[1.20.10-latest]"] // can be an array of ranges
}
```

`x-format-version-enums` is used to collect all the format versions in the schema and generate an enum for the `format_version` property (root only).

## generator

Used for generating enums for vanilla identifiers and assets such as particle identifiers, sound paths, etc.

Create an env file for `bedrock-samples` and installed bedrock path. Example:

```env
BEDROCK_PATH=C:/bedrock-samples
MINECRAFT_DATA_PATH=C:/XboxGames/Minecraft For Windows/Content/data
```
