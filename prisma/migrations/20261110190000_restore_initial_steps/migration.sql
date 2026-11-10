-- These guards ran before session creation in the original pipeline.
-- Recover outcomes only when persisted metadata and ETP-008 prove that point was reached.
-- Original execution times are unknown and are intentionally left null.
UPDATE processing_steps AS step
SET status = 'SUCCESS',
    message = 'Resultado recuperado: verificação inicial concluída antes da criação da sessão; horário e duração originais não registrados.'
FROM processing_sessions AS session
JOIN files AS file ON file.id = session.file_id
WHERE step.session_id = session.id
  AND step.status = 'PENDING'
  AND step.step_code IN ('ETP-001', 'ETP-002', 'ETP-003', 'ETP-004', 'ETP-005', 'ETP-006')
  AND file.size_bytes > 0
  AND file.encoding IS NOT NULL
  AND file.sha256_hash <> ''
  AND EXISTS (SELECT 1 FROM processing_steps AS created
              WHERE created.session_id = session.id AND created.step_code = 'ETP-008' AND created.status = 'SUCCESS');
