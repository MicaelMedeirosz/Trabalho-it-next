import { ParseResult, ParsedTable, ParsedColumn } from "./types";

/**
 * Espera TXT estruturado no formato:
 *
 * SCHEMA: vendas
 * TABLE: clientes
 * DESCRIPTION: Cadastro de clientes
 * COLUMN: id | INTEGER | NOT NULL | PK | Identificador único
 * COLUMN: nome | VARCHAR(150) | NOT NULL | | Nome completo
 *
 * TABLE: pedidos
 * ...
 */
export function parseTxt(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const schemasSet = new Set<string>();
  const tables: ParsedTable[] = [];

  let currentSchema: string | undefined;
  let currentTable: ParsedTable | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const schemaMatch = line.match(/^SCHEMA\s*:\s*(.+)$/i);
    if (schemaMatch) {
      currentSchema = schemaMatch[1].trim();
      schemasSet.add(currentSchema);
      continue;
    }

    const tableMatch = line.match(/^TABLE\s*:\s*(.+)$/i);
    if (tableMatch) {
      if (currentTable) tables.push(currentTable);
      currentTable = { name: tableMatch[1].trim(), schema: currentSchema, columns: [], constraints: [] };
      continue;
    }

    const descMatch = line.match(/^DESCRIPTION\s*:\s*(.+)$/i);
    if (descMatch && currentTable) {
      currentTable.description = descMatch[1].trim();
      continue;
    }

    const columnMatch = line.match(/^COLUMN\s*:\s*(.+)$/i);
    if (columnMatch && currentTable) {
      const parts = columnMatch[1].split("|").map((p) => p.trim());
      const column: ParsedColumn = {
        name: parts[0] ?? "",
        dataType: parts[1] || undefined,
        nullable: parts[2] ? !/NOT\s*NULL/i.test(parts[2]) : undefined,
        isPrimaryKey: parts[3] ? /PK/i.test(parts[3]) : false,
        description: parts[4] || undefined,
        ordinalPosition: currentTable.columns.length + 1,
      };
      if (column.name) currentTable.columns.push(column);
      continue;
    }
  }
  if (currentTable) tables.push(currentTable);

  return {
    dbmsGuess: null,
    schemas: Array.from(schemasSet),
    tables,
    views: [],
    procedures: [],
    sequences: [],
    relationships: [],
  };
}
