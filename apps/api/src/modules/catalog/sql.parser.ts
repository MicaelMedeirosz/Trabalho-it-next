import {
  ParseResult,
  ParsedTable,
  ParsedColumn,
  ParsedConstraint,
  ParsedView,
  ParsedProcedure,
  ParsedSequence,
  ParsedRelationship,
} from "./types";

function stripComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function detectDbms(sql: string): string | null {
  const s = sql.toUpperCase();
  if (s.includes("ENGINE=") || s.includes("AUTO_INCREMENT")) return "MySQL";
  if (s.includes("SERIAL") || s.includes("RETURNING") || s.includes("::")) return "PostgreSQL";
  if (s.includes("NUMBER(") || s.includes("VARCHAR2") || s.includes("SYSDATE")) return "Oracle";
  if (s.includes("NVARCHAR") || s.includes("IDENTITY(") || s.includes("GO\n")) return "SQLServer";
  return null;
}

function splitNameParts(qualified: string): { schema?: string; name: string } {
  const cleaned = qualified.replace(/[`"\[\]]/g, "").trim();
  const parts = cleaned.split(".");
  if (parts.length === 2) {
    return { schema: parts[0], name: parts[1] };
  }
  return { name: parts[parts.length - 1] };
}

function parseColumnsBlock(block: string): { columns: ParsedColumn[]; constraints: ParsedConstraint[] } {
  const columns: ParsedColumn[] = [];
  const constraints: ParsedConstraint[] = [];

  const lines = splitTopLevelCommas(block);
  let ordinal = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (upper.startsWith("PRIMARY KEY")) {
      const match = line.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
      constraints.push({
        name: `pk_${columns.length}`,
        type: "PK",
        definition: match ? match[1].trim() : line,
      });
      if (match) {
        const pkCols = match[1].split(",").map((c) => c.replace(/[`"\[\]]/g, "").trim());
        pkCols.forEach((pc) => {
          const col = columns.find((c) => c.name.toLowerCase() === pc.toLowerCase());
          if (col) col.isPrimaryKey = true;
        });
      }
      continue;
    }

    if (upper.startsWith("FOREIGN KEY") || upper.startsWith("CONSTRAINT")) {
      const fkMatch = line.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*([^\s(]+)\s*\(([^)]+)\)/i);
      const nameMatch = line.match(/CONSTRAINT\s+([`"[\]\w]+)/i);
      constraints.push({
        name: nameMatch ? nameMatch[1].replace(/[`"\[\]]/g, "") : `fk_${columns.length}`,
        type: fkMatch ? "FK" : "CHECK",
        definition: line,
        referencesTable: fkMatch ? splitNameParts(fkMatch[2]).name : undefined,
      });
      continue;
    }

    if (upper.startsWith("UNIQUE")) {
      const match = line.match(/UNIQUE\s*\(([^)]+)\)/i);
      constraints.push({
        name: `uq_${columns.length}`,
        type: "UNIQUE",
        definition: match ? match[1].trim() : line,
      });
      continue;
    }

    if (upper.startsWith("CHECK")) {
      constraints.push({ name: `chk_${columns.length}`, type: "CHECK", definition: line });
      continue;
    }

    const colMatch = line.match(/^[`"[\]]?([a-zA-Z_][\w]*)[`"[\]]?\s+([a-zA-Z0-9_()., ]+)/);
    if (colMatch) {
      const name = colMatch[1];
      const dataType = colMatch[2].trim().split(/\s{2,}/)[0].split(/\bNOT\b|\bNULL\b|\bDEFAULT\b|\bPRIMARY\b|\bREFERENCES\b/i)[0].trim();
      const nullable = !/NOT\s+NULL/i.test(line);
      const isPrimaryKey = /PRIMARY\s+KEY/i.test(line);
      if (isPrimaryKey) {
        constraints.push({ name: `pk_${name}`, type: "PK", definition: name });
      }
      columns.push({
        name,
        dataType,
        nullable,
        isPrimaryKey,
        ordinalPosition: ordinal++,
      });
    }
  }

  return { columns, constraints };
}

function splitTopLevelCommas(block: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of block) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

export function parseSql(content: string): ParseResult {
  const sql = stripComments(content);
  const dbmsGuess = detectDbms(sql);

  const schemasSet = new Set<string>();
  const tables: ParsedTable[] = [];
  const views: ParsedView[] = [];
  const procedures: ParsedProcedure[] = [];
  const sequences: ParsedSequence[] = [];
  const relationships: ParsedRelationship[] = [];

  const schemaRegex = /CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = schemaRegex.exec(sql))) {
    schemasSet.add(splitNameParts(m[1]).name);
  }

  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)\s*\(([\s\S]*?)\)\s*(?:ENGINE|;|\n\))/gi;
  while ((m = tableRegex.exec(sql))) {
    const { schema, name } = splitNameParts(m[1]);
    if (schema) schemasSet.add(schema);
    const { columns, constraints } = parseColumnsBlock(m[2]);
    tables.push({ name, schema, columns, constraints });

    constraints
      .filter((c) => c.type === "FK" && c.referencesTable)
      .forEach((c) => {
        relationships.push({
          sourceTable: name,
          targetTable: c.referencesTable!,
          constraintName: c.name,
          type: "FOREIGN_KEY",
        });
      });
  }

  const viewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([`"[\]\w.]+)\s+AS\s+([\s\S]*?);/gi;
  while ((m = viewRegex.exec(sql))) {
    const { schema, name } = splitNameParts(m[1]);
    if (schema) schemasSet.add(schema);
    views.push({ name, schema, definition: m[2].trim() });
  }

  const procRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+([`"[\]\w.]+)\s*\(([^)]*)\)/gi;
  while ((m = procRegex.exec(sql))) {
    const { schema, name } = splitNameParts(m[1]);
    if (schema) schemasSet.add(schema);
    procedures.push({
      name,
      schema,
      parameters: m[2]
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  const seqRegex = /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)(?:[\s\S]*?START\s+(?:WITH\s+)?(\d+))?(?:[\s\S]*?INCREMENT\s+(?:BY\s+)?(\d+))?/gi;
  while ((m = seqRegex.exec(sql))) {
    const { schema, name } = splitNameParts(m[1]);
    if (schema) schemasSet.add(schema);
    sequences.push({
      name,
      schema,
      startValue: m[2] ? Number(m[2]) : undefined,
      incrementBy: m[3] ? Number(m[3]) : undefined,
    });
  }

  const alterFkRegex = /ALTER\s+TABLE\s+([`"[\]\w.]+)[\s\S]*?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([`"[\]\w.]+)\s*\(([^)]+)\)/gi;
  while ((m = alterFkRegex.exec(sql))) {
    const source = splitNameParts(m[1]).name;
    const target = splitNameParts(m[3]).name;
    relationships.push({ sourceTable: source, targetTable: target, type: "FOREIGN_KEY" });
  }

  return {
    dbmsGuess,
    schemas: Array.from(schemasSet),
    tables,
    views,
    procedures,
    sequences,
    relationships,
  };
}
