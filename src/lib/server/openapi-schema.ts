import type { ContractSpec, FieldSpec } from "@/lib/registry";

type JsonSchema = Record<string, unknown>;

function fieldSchema(field: FieldSpec): JsonSchema {
  const description = [field.label, field.unit ? `(${field.unit})` : "", field.description ? `. ${field.description}` : ""].join(" ").replace(/ \./, ".").trim();
  const base = { description };
  switch (field.type) {
    case "string":
      return { type: "string", ...base };
    case "number":
    case "money":
    case "percent":
      return { type: "number", ...base };
    case "integer":
      return { type: "integer", ...base };
    case "boolean":
      return { type: "boolean", ...base };
    case "timestamp":
      return { type: "string", format: "date-time", ...base };
    case "date":
      return { type: "string", format: "date", ...base };
    case "url":
      return { type: "string", format: "uri", ...base };
    case "enum":
      return { type: "string", ...(field.values ? { enum: [...field.values] } : {}), ...base };
    case "list":
      return { type: "array", ...base };
    case "object":
      return { type: "object", ...base };
  }
}

interface Node {
  properties: Record<string, JsonSchema | Node>;
  required: string[];
}

const isNode = (value: JsonSchema | Node): value is Node => "properties" in value && "required" in value && !("type" in value);

function toSchema(node: Node): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, value] of Object.entries(node.properties)) properties[key] = isNode(value) ? toSchema(value) : value;
  return { type: "object", properties, ...(node.required.length ? { required: node.required } : {}) };
}

/** JSON Schema of a contract's result (`output` fields; dotted keys become nested objects). */
export function outputSchema(contract: ContractSpec): JsonSchema {
  const root: Node = { properties: {}, required: [] };
  for (const field of contract.output) {
    const parts = field.key.split(".");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const existing = node.properties[part];
      const child: Node = existing && isNode(existing) ? existing : { properties: {}, required: [] };
      node.properties[part] = child;
      // A parent object is required when any required field lives under it.
      if (!field.optional && !node.required.includes(part)) node.required.push(part);
      node = child;
    }
    const leaf = parts[parts.length - 1];
    node.properties[leaf] = fieldSchema(field);
    if (!field.optional) node.required.push(leaf);
  }
  return toSchema(root);
}
