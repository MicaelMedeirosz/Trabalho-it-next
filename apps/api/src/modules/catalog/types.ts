export interface ParsedColumn {
  name: string;
  dataType?: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
  description?: string;
  ordinalPosition?: number;
}

export interface ParsedConstraint {
  name: string;
  type: "PK" | "FK" | "UNIQUE" | "CHECK" | "NOT_NULL";
  definition?: string;
  referencesTable?: string;
}

export interface ParsedTable {
  name: string;
  schema?: string;
  description?: string;
  columns: ParsedColumn[];
  constraints: ParsedConstraint[];
}

export interface ParsedView {
  name: string;
  schema?: string;
  definition?: string;
}

export interface ParsedProcedure {
  name: string;
  schema?: string;
  parameters?: string[];
  body?: string;
}

export interface ParsedSequence {
  name: string;
  schema?: string;
  startValue?: number;
  incrementBy?: number;
}

export interface ParsedRelationship {
  sourceTable: string;
  targetTable: string;
  constraintName?: string;
  type?: string;
}

export interface ParseResult {
  dbmsGuess: string | null;
  schemas: string[];
  tables: ParsedTable[];
  views: ParsedView[];
  procedures: ParsedProcedure[];
  sequences: ParsedSequence[];
  relationships: ParsedRelationship[];
}
