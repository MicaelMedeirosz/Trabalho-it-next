export const VALIDATION_RULES = [
  { code: "RV001", description: "Arquivo legível e íntegro", severity: "BLOCKER" },
  { code: "RV002", description: "Estrutura válida conforme o padrão suportado", severity: "BLOCKER" },
  { code: "RV003", description: "Presença obrigatória de Schemas identificáveis", severity: "WARNING" },
  { code: "RV004", description: "Presença obrigatória de Tabelas identificáveis", severity: "BLOCKER" },
  { code: "RV005", description: "Presença obrigatória de Colunas identificáveis", severity: "BLOCKER" },
  { code: "RV006", description: "Presença obrigatória de Views identificáveis", severity: "INFO" },
  { code: "RV007", description: "Presença obrigatória de Procedures identificáveis", severity: "INFO" },
  { code: "RV008", description: "Presença obrigatória de Relacionamentos identificáveis", severity: "WARNING" },
  { code: "RV009", description: "Presença obrigatória de Constraints identificáveis", severity: "WARNING" },
  { code: "RV010", description: "Identificação de duplicidade de objetos", severity: "WARNING" },
  { code: "RV011", description: "Validação de campos obrigatórios", severity: "BLOCKER" },
  { code: "RV012", description: "Regras de nomenclatura corporativa", severity: "WARNING" },
  { code: "RV013", description: "Detecção de caracteres inválidos", severity: "WARNING" },
  { code: "RV014", description: "Limite de tamanho de nomes", severity: "WARNING" },
  { code: "RV015", description: "Verificação da qualidade dos metadados (descrições obrigatórias)", severity: "INFO" },
  { code: "RV016", description: "Rastreabilidade integral da carga em log", severity: "BLOCKER" },
] as const;

export type RuleCode = typeof VALIDATION_RULES[number]["code"];
export type RuleSeverity = "BLOCKER" | "WARNING" | "INFO";
