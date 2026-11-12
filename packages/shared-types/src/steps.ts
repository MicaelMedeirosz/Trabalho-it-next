export const PROCESSING_STEPS = [
  { code: "ETP-001", name: "Recebimento do arquivo" },
  { code: "ETP-002", name: "Validação de extensão (.csv, .txt, .sql)" },
  { code: "ETP-003", name: "Validação de tamanho do arquivo" },
  { code: "ETP-004", name: "Verificação de integridade/legibilidade" },
  { code: "ETP-005", name: "Identificação da codificação de caracteres" },
  { code: "ETP-006", name: "Geração de Hash SHA-256" },
  { code: "ETP-007", name: "Registro de metadados iniciais" },
  { code: "ETP-008", name: "Criação da sessão de processamento" },
  { code: "ETP-009", name: "Análise estrutural do conteúdo" },
  { code: "ETP-010", name: "Identificação automática de objetos" },
  { code: "ETP-011", name: "Quantificação estatística dos objetos" },
  { code: "ETP-012", name: "Classificação do SGBD de origem" },
  { code: "ETP-013", name: "Persistência de logs detalhados" },
  { code: "ETP-014", name: "Atualização do dashboard em tempo real" },
  { code: "ETP-015", name: "Aplicação das regras de aprovação (RV001-RV016)" },
  { code: "ETP-016", name: "Direcionamento para fila de homologação" },
  { code: "ETP-017", name: "Aprovação ou rejeição formal do arquivo" },
  { code: "ETP-018", name: "Exigência de justificativa em caso de rejeição" },
  { code: "ETP-019", name: "Registro de auditoria da decisão" },
  { code: "ETP-020", name: "Liberação dos dados aprovados para consulta" },
] as const;

export type StepCode = typeof PROCESSING_STEPS[number]["code"];
