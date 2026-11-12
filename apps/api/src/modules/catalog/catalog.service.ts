import { prisma } from "../../config/prisma";
import { ParseResult } from "./types";

// Persistência paralelizada: cada create() precisa rodar individualmente
// (não em createMany) sempre que o ID retornado é necessário para montar
// relações filhas, mas chamadas independentes entre si rodam em paralelo
// via Promise.all para reduzir drasticamente o tempo total (latência de
// rede do pooler Supabase é o gargalo, não o processamento local).
export async function persistCatalog(sessionId: string, parsed: ParseResult) {
  const schemaIdMap = new Map<string, string>();

  const createdSchemas = await Promise.all(
    parsed.schemas.map((schemaName) => prisma.catalogSchema.create({ data: { sessionId, name: schemaName } }))
  );
  createdSchemas.forEach((schema, i) => schemaIdMap.set(parsed.schemas[i], schema.id));

  const tableIdMap = new Map<string, string>();

  const createdTables = await Promise.all(
    parsed.tables.map((t) => {
      const schemaId = t.schema ? schemaIdMap.get(t.schema) : undefined;
      return prisma.catalogTable.create({
        data: { sessionId, schemaId, name: t.name, description: t.description },
      });
    })
  );
  createdTables.forEach((table, i) => tableIdMap.set(parsed.tables[i].name, table.id));

  const allColumns = parsed.tables.flatMap((t, i) =>
    t.columns.map((c) => ({
      tableId: createdTables[i].id,
      name: c.name,
      dataType: c.dataType,
      nullable: c.nullable,
      isPrimaryKey: c.isPrimaryKey ?? false,
      description: c.description,
      ordinalPosition: c.ordinalPosition,
    }))
  );

  const allConstraints = parsed.tables.flatMap((t, i) =>
    t.constraints.map((c) => ({
      tableId: createdTables[i].id,
      name: c.name,
      type: c.type,
      definition: c.definition,
    }))
  );

  const relationshipsToCreate: { sourceTableId: string; targetTableId: string; relationshipType?: string }[] = [];
  for (const r of parsed.relationships) {
    const sourceTableId = tableIdMap.get(r.sourceTable);
    const targetTableId = tableIdMap.get(r.targetTable);
    if (sourceTableId && targetTableId) {
      relationshipsToCreate.push({ sourceTableId, targetTableId, relationshipType: r.type });
    }
  }

  await Promise.all([
    allColumns.length > 0 ? prisma.catalogColumn.createMany({ data: allColumns }) : Promise.resolve(),
    allConstraints.length > 0 ? prisma.catalogConstraint.createMany({ data: allConstraints }) : Promise.resolve(),
    relationshipsToCreate.length > 0
      ? prisma.catalogRelationship.createMany({ data: relationshipsToCreate })
      : Promise.resolve(),
    ...parsed.views.map((v) => {
      const schemaId = v.schema ? schemaIdMap.get(v.schema) : undefined;
      return prisma.catalogView.create({ data: { sessionId, schemaId, name: v.name, definition: v.definition } });
    }),
    ...parsed.procedures.map((p) => {
      const schemaId = p.schema ? schemaIdMap.get(p.schema) : undefined;
      return prisma.catalogProcedure.create({
        data: { sessionId, schemaId, name: p.name, parameters: p.parameters ?? [] },
      });
    }),
    ...parsed.sequences.map((s) => {
      const schemaId = s.schema ? schemaIdMap.get(s.schema) : undefined;
      return prisma.catalogSequence.create({
        data: {
          sessionId,
          schemaId,
          name: s.name,
          startValue: s.startValue ? BigInt(s.startValue) : undefined,
          incrementBy: s.incrementBy ? BigInt(s.incrementBy) : undefined,
        },
      });
    }),
  ]);

  const objectCount =
    parsed.schemas.length +
    parsed.tables.length +
    allColumns.length +
    parsed.views.length +
    parsed.procedures.length +
    parsed.sequences.length +
    relationshipsToCreate.length;

  return { objectCount };
}
