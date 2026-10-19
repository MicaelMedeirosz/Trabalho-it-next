import { prisma } from "../../config/prisma";
import { ParseResult } from "./types";

export async function persistCatalog(sessionId: string, parsed: ParseResult) {
  const schemaIdMap = new Map<string, string>();

  for (const schemaName of parsed.schemas) {
    const schema = await prisma.catalogSchema.create({
      data: { sessionId, name: schemaName },
    });
    schemaIdMap.set(schemaName, schema.id);
  }

  const tableIdMap = new Map<string, string>();

  for (const t of parsed.tables) {
    const schemaId = t.schema ? schemaIdMap.get(t.schema) : undefined;
    const table = await prisma.catalogTable.create({
      data: {
        sessionId,
        schemaId,
        name: t.name,
        description: t.description,
      },
    });
    tableIdMap.set(t.name, table.id);

    if (t.columns.length > 0) {
      await prisma.catalogColumn.createMany({
        data: t.columns.map((c) => ({
          tableId: table.id,
          name: c.name,
          dataType: c.dataType,
          nullable: c.nullable,
          isPrimaryKey: c.isPrimaryKey ?? false,
          description: c.description,
          ordinalPosition: c.ordinalPosition,
        })),
      });
    }

    for (const c of t.constraints) {
      await prisma.catalogConstraint.create({
        data: {
          tableId: table.id,
          name: c.name,
          type: c.type,
          definition: c.definition,
        },
      });
    }
  }

  for (const v of parsed.views) {
    const schemaId = v.schema ? schemaIdMap.get(v.schema) : undefined;
    await prisma.catalogView.create({
      data: { sessionId, schemaId, name: v.name, definition: v.definition },
    });
  }

  for (const p of parsed.procedures) {
    const schemaId = p.schema ? schemaIdMap.get(p.schema) : undefined;
    await prisma.catalogProcedure.create({
      data: { sessionId, schemaId, name: p.name, parameters: p.parameters ?? [] },
    });
  }

  for (const s of parsed.sequences) {
    const schemaId = s.schema ? schemaIdMap.get(s.schema) : undefined;
    await prisma.catalogSequence.create({
      data: {
        sessionId,
        schemaId,
        name: s.name,
        startValue: s.startValue ? BigInt(s.startValue) : undefined,
        incrementBy: s.incrementBy ? BigInt(s.incrementBy) : undefined,
      },
    });
  }

  for (const r of parsed.relationships) {
    const sourceId = tableIdMap.get(r.sourceTable);
    const targetId = tableIdMap.get(r.targetTable);
    if (sourceId && targetId) {
      await prisma.catalogRelationship.create({
        data: {
          sourceTableId: sourceId,
          targetTableId: targetId,
          relationshipType: r.type,
        },
      });
    }
  }

  const objectCount =
    parsed.schemas.length +
    parsed.tables.length +
    parsed.tables.reduce((acc, t) => acc + t.columns.length, 0) +
    parsed.views.length +
    parsed.procedures.length +
    parsed.sequences.length +
    parsed.relationships.length;

  return { objectCount };
}
