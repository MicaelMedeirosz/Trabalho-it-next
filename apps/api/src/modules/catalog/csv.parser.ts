import { ParseResult, ParsedTable, ParsedColumn } from "./types";

/**
 * Espera CSV de dicionário de dados com cabeçalho contendo colunas como:
 * schema, table, column, data_type, nullable, primary_key, description
 * Cabeçalhos são identificados por nome (case-insensitive), ordem flexível.
 */
export function parseCsv(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { dbmsGuess: null, schemas: [], tables: [], views: [], procedures: [], sequences: [], relationships: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

  const idx = {
    schema: findIndex(header, ["schema", "esquema"]),
    table: findIndex(header, ["table", "tabela", "table_name"]),
    column: findIndex(header, ["column", "coluna", "column_name"]),
    dataType: findIndex(header, ["data_type", "datatype", "tipo", "type"]),
    nullable: findIndex(header, ["nullable", "null", "permite_nulo"]),
    primaryKey: findIndex(header, ["primary_key", "pk", "chave_primaria"]),
    description: findIndex(header, ["description", "descricao", "descrição"]),
  };

  const schemasSet = new Set<string>();
  const tablesMap = new Map<string, ParsedTable>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const tableName = idx.table >= 0 ? cols[idx.table]?.trim() : undefined;
    if (!tableName) continue;

    const schemaName = idx.schema >= 0 ? cols[idx.schema]?.trim() : undefined;
    if (schemaName) schemasSet.add(schemaName);

    const key = `${schemaName ?? ""}.${tableName}`;
    if (!tablesMap.has(key)) {
      tablesMap.set(key, { name: tableName, schema: schemaName, columns: [], constraints: [] });
    }
    const table = tablesMap.get(key)!;

    const columnName = idx.column >= 0 ? cols[idx.column]?.trim() : undefined;
    if (columnName) {
      const column: ParsedColumn = {
        name: columnName,
        dataType: idx.dataType >= 0 ? cols[idx.dataType]?.trim() : undefined,
        nullable: idx.nullable >= 0 ? /^(sim|yes|true|1|y)$/i.test(cols[idx.nullable]?.trim() ?? "") : undefined,
        isPrimaryKey: idx.primaryKey >= 0 ? /^(sim|yes|true|1|y)$/i.test(cols[idx.primaryKey]?.trim() ?? "") : false,
        description: idx.description >= 0 ? cols[idx.description]?.trim() : undefined,
        ordinalPosition: table.columns.length + 1,
      };
      table.columns.push(column);
    } else if (idx.description >= 0 && cols[idx.description]) {
      table.description = cols[idx.description].trim();
    }
  }

  return {
    dbmsGuess: null,
    schemas: Array.from(schemasSet),
    tables: Array.from(tablesMap.values()),
    views: [],
    procedures: [],
    sequences: [],
    relationships: [],
  };
}

function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const c of candidates) {
    const count = headerLine.split(c).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((c) => c.replace(/^"|"$/g, ""));
}

function findIndex(header: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const i = header.indexOf(candidate);
    if (i >= 0) return i;
  }
  return -1;
}
