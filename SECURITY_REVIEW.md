# Revisão de segurança — 09/11/2026

Escopo: API Express/Prisma, autenticação JWT, permissões, uploads, homologação,
interface React, dependências npm e configuração Docker do MVP local.
Esta é uma revisão de código com testes de regressão, não uma certificação ou pentest.

## Problemas corrigidos

| Prioridade | Problema | Correção |
| --- | --- | --- |
| Alta | Segredo JWT público no Compose e fallback previsível na API | Segredo obrigatório, validação de tamanho/valores de demonstração e geração aleatória de 256 bits em `.env` ignorado pelo Git. Chave local rotacionada; sessões antigas deixam de valer. |
| Alta | Vulnerabilidades nas dependências | Lockfile atualizado para corrigir `body-parser` e `follow-redirects`, além de `postcss-selector-parser` de desenvolvimento. Multer atualizado da versão 1 para a versão 2. |
| Alta | Autorização baseada no papel antigo do JWT | Cada requisição autenticada consulta o usuário atual no banco; conta removida ou rebaixada perde acesso. JWT aceita somente HS256 e exige subject válido. |
| Média | Proteção incompleta de papéis na API | Listagem e decisões de homologação exigem ADMIN. Upload exige ADMIN ou ANALYST; VIEWER fica sem permissão de escrita. |
| Média | Duas decisões de homologação podiam sobrescrever uma à outra | Transação única com atualização condicional de PENDING; conflito retorna 409. Arquivo, etapas e auditoria participam da mesma transação. |
| Média | Sem limitação de tentativas de autenticação | Login e cadastro compartilham limite de 30 requisições por IP em 15 minutos; uploads têm limite de 30 por minuto. Resposta 429 com Retry-After. |
| Média | Cadastro aceitava tipos inesperados e senhas sem limites | Validação de nome/e-mail/senha na API. Novas senhas exigem 12 caracteres e até 72 bytes, evitando truncamento silencioso do bcrypt. Login de contas existentes é preservado. Papel enviado no cadastro é ignorado. |
| Média | Nome fornecido no upload participava do caminho de gravação | Novos arquivos recebem UUID; armazenamento rejeita caminhos que escapam da raiz configurada. Extensão é validada antes de armazenar o corpo do arquivo. |
| Média | Erros de upload podiam devolver mensagens internas | Apenas erros esperados são apresentados ao cliente; falhas inesperadas ficam nos logs. Limites multipart e JSON retornam erros controlados. |
| Média | Serviços Docker expostos em todas as interfaces | Portas do banco, API e interface vinculadas a 127.0.0.1. |
| Defesa adicional | Cabeçalhos e parser JSON | Helmet na API, sem X-Powered-By; limite JSON de 16 KiB, sem descompressão; CSP, proteção contra iframe e nosniff no nginx. Respostas da API usam no-store. |

O frontend atualiza o perfil em `/auth/me`, não usa os dados do localStorage para
autorizar operações na API e mantém a mensagem de credenciais inválidas na tela de login.
Nenhuma senha, chave JWT local, banco, upload ou mudança de papel de uma conta local
deve fazer parte do commit.

## Validação reproduzível

Resultado atualizado com o perfil: **23 testes passaram**, builds da API e interface
concluídos e **zero vulnerabilidades reportadas** em `npm audit` e
`npm audit --omit=dev`. Verificação local confirmou health, perfil ADMIN,
homologação autorizada, rejeição sem autenticação, interface com CSP e portas
restritas a loopback. A busca por padrões de chaves privadas/tokens nos arquivos
alterados não encontrou ocorrências; `.env` permanece fora do Git.

```bash
npm audit
npm audit --omit=dev
docker build --target security-test -f apps/api/Dockerfile -t trabalho-it-next-security-test .
docker compose up -d --build
```

A suíte em `apps/api/tests/security.test.cjs` inicia um servidor HTTP isolado e
substitui a persistência por mocks que falham quando ocorre acesso não previsto.
Cobre autenticação obrigatória, tokens adulterados/expirados, algoritmo e subject,
contas removidas, promoção/rebaixamento, VIEWER sem upload, cadastro inválido,
hash de senha e ausência de escalada via cadastro, conflito de decisão, limites
multipart/JSON, caminho de armazenamento, cabeçalhos e rate limit.
Não altera o banco ou os arquivos do usuário. O teste de conflito usa persistência
simulada; não é um teste de concorrência com PostgreSQL real.

O perfil tem upload autenticado de foto (máximo 2 MB), limitado a JPG/PNG/WebP
estático e 16 megapixels. A API decodifica e converte a imagem para JPEG de
256 × 256 sem os metadados originais, armazenando somente a versão reduzida no
registro do próprio usuário. SVG, conteúdo inválido e campos extras são rejeitados.
Os testes cobrem envio, remoção, ausência de autenticação, limites e impossibilidade
de alterar outro usuário ou seu papel pelo endpoint de foto.

## Limitações antes de disponibilizar na internet

- O produto continua sendo um workspace compartilhado: usuários autenticados podem
  consultar catálogo, auditoria e relatórios globais. Cadastro continua aberto e cria
  ANALYST. Um ambiente público exige política de convites e isolamento de dados.
- JWT continua em localStorage, com validade de 8 horas e sem lista de revogação
  por sessão. Logout apaga o token do navegador, mas um token copiado ainda vale até
  expirar, salvo exclusão da conta/rotação da chave. Papéis são conferidos no banco.
  Para publicação, avaliar cookies HttpOnly/Secure e proteção CSRF correspondente.
- O MVP usa HTTP local, credenciais de PostgreSQL de demonstração e containers com
  configuração padrão de usuário. Produção precisa de TLS, gestão de segredos,
  usuário de banco com privilégios mínimos e endurecimento dos containers.
- Uploads são processados em memória e os parsers executam no processo da API.
  Os limites por arquivo/requisição e por IP reduzem abuso, mas não substituem fila,
  cotas de memória/CPU e isolamento dos parsers para arquivos grandes ou hostis.
- O rate limit usa memória de um único processo e não sobrevive ao reinício. Antes
  de usar múltiplas réplicas/proxy, configurar armazenamento compartilhado e trust proxy
  estritamente para a infraestrutura conhecida.
- O cadastro informa que um e-mail já existe, por decisão da experiência atual.
  Isso permite enumeração de contas e deve ser revisto em um serviço público.
- `npm audit` verifica avisos conhecidos de pacotes npm; não audita imagens Docker,
  sistema operacional ou falhas ainda não publicadas. Não foram executados testes
  de carga, fuzzing dos parsers nem uma varredura externa de infraestrutura.

## Referências

- [body-parser: GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [follow-redirects: GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
- [express-rate-limit](https://express-rate-limit.mintlify.app/quickstart/usage)
- [Helmet](https://helmet.js.org/)
