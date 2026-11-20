# schemas

Provides JSON Schemas for Minecraft Bedrock Edition add-on development, with `format_version` versioning.

Minecraft version: v1.26.60.29-preview

## compile

Run `bun run compile` to compile the schemas into a single file for each entry point. The compiled schemas are output to the `dist` folder.

### Format Version

Format versions are generated through `x-format-version` keyword in the schema. The `x-format-version` keyword is used to specify the range of format versions that a schema supports. The range is specified using a string in the format `(min-max]`, where `min` and `max` are the minimum and maximum format versions supported by the schema. The `max` value can also be set to `latest`, which indicates that the schema supports all future format versions.

## generator

Used for generating enums for vanilla identifiers and assets such as particle identifiers, sound paths, etc.

Create an env file for `bedrock-samples` and installed bedrock path. Example:

```env
BEDROCK_PATH=C:/bedrock-samples
MINECRAFT_DATA_PATH=C:/XboxGames/Minecraft For Windows/Content/data
```
