# Família Ferreira e familiares · Ano Novo 2027

Site React + TypeScript + Tailwind com cadastro por nome/código, roleta e painel administrativo. Roxo, vermelho e branco. Presentes de **R$ 40,00 a R$ 70,00**.

Repositório único: https://github.com/Novaesweb/Sorteio-.git.

## Publicação atual: Vercel + Supabase Sites demo

O site foi conectado ao novo projeto **Sites demo**, em São Paulo:

- [Painel do Supabase](https://supabase.com/dashboard/project/abkzgepigxfottjblgyf)
- Projeto: `abkzgepigxfottjblgyf`.
- Dados do sorteio: schema privado `familia_ferreira_2027`.
- Backend: Edge Function `familia-ferreira`.
- Vercel: a função `api/[...path].mjs` encaminha somente as operações do site.

**Não precisa de `BACKEND_URL`, Blob, Render nem chave privada na Vercel.** As informações públicas de destino estão em `shared/supabase.json`. A única chave no repositório é uma chave **publishable**, sem permissão para ler tabelas nem executar a RPC privada. As credenciais privilegiadas são as variáveis internas da Edge Function e nunca saem do Supabase.

O projeto Supabase anterior não foi alterado. Futuras landing pages podem usar o **Sites demo** com tabelas, funções, políticas e dados próprios, separados do schema da família. Compartilhar o projeto compartilha os limites e o plano, mas não deve compartilhar acesso aos dados privados.

### Na Vercel

1. Mantenha o projeto conectado à branch `main` deste repositório.
2. Framework **Vite**, Node **24.x**, build `npm run build`, saída `dist`.
3. Aguarde a publicação automática após o push ou use **Deployments → Redeploy** na versão mais recente.
4. Abra a URL principal publicada e entre em `/adm` com o código de **seis dígitos** combinado com o organizador.

Previews da Vercel não aceitam alterações no banco de produção. Para cadastrar, girar ou administrar, use a URL principal de produção. Desenvolvimento local usa um banco de demonstração separado.

O código real do administrador foi configurado diretamente no banco e não aparece em texto no frontend, nos arquivos SQL ou nos testes. O código anterior foi invalidado. Na reinstalação em outro projeto, o bootstrap cria um segredo aleatório; configure o código administrativo privadamente no novo ambiente antes de usar.

## Como usar

1. Entre em `/adm` e clique em **Gerar códigos pendentes**.
2. Copie a lista de códigos e guarde em local privado. Cada código só é mostrado nessa geração.
3. Compartilhe cada código apenas com o dono do nome; não envie a lista completa ao grupo.
4. Cada familiar seleciona o próprio nome e confirma usando o código individual. Não precisa de e-mail nem senha própria.
5. No painel, use os filtros **Todos**, **Pendentes** e **Confirmados**. Os estados atualizam a cada cinco segundos.
6. Clique em **Iniciar sorteio**. Todos os 12 nomes entram, inclusive quem ainda não confirmou. Eles poderão confirmar depois.
7. Cada participante gira a roleta para revelar apenas seu resultado. Atualizar, entrar de outro celular ou consultar novamente não troca o destinatário.

O código administrativo é separado dos códigos individuais. O acesso do organizador dura oito horas; o do participante, sete dias. O código individual permite entrar novamente e deve ser mantido privado.

O painel permite substituir códigos perdidos, consultar pares em área restrita e reiniciar com o código administrativo e a frase `INVALIDAR RESULTADOS`. O reinício invalida pares e sessões dos participantes, mas preserva códigos e confirmações. Resultados já vistos ou baixados não podem ser apagados dos celulares: avise a família.

Os lembretes abrem o WhatsApp com a mensagem pronta. O organizador escolhe o contato e confirma o envio. Não há envio automático.

## Os 12 nomes fixos

1. Caíque Eduardo
2. Estephane
3. Jéssica Rafaela
4. Igor
5. Caio
6. Rafael
7. Iris Ferreira
8. Augusto
9. Lucas Rodrigo
10. Camila Dias
11. Jenifer
12. Erick

Não é possível adicionar nem remover pessoas pelo site. `shared/participants.json` guarda a lista pública e os nomes aparecem antes da resposta da API. Ao confirmar, o servidor valida o nome e o código.

## Páginas

- `/`: apresentação, faixa dos presentes e cadastro.
- `/sorteio`: roleta e revelação.
- `/meu-resultado`: consulta protegida e download pessoal.
- `/adm`: login com código de seis dígitos e painel do organizador.

A roleta só anima um resultado já atribuído no servidor. Há pétalas, confetes, som opcional e opção de reduzir animações.

## Segurança e dados

- Todas as tabelas da família ficam no schema privado `familia_ferreira_2027`, sem acesso para `anon` e `authenticated`.
- RLS habilitado com políticas explícitas que negam acesso direto. Não há tabelas da família expostas publicamente.
- A RPC `public.familia_ferreira_api` usa **SECURITY INVOKER** e `search_path` vazio. Apenas `service_role` pode executá-la. Não há função `SECURITY DEFINER` pública.
- A Edge Function usa as credenciais internas do próprio Supabase para chamar a RPC. Toda operação restrita verifica a sessão do participante ou do administrador no banco.
- A verificação JWT padrão da Edge Function está desativada porque a aplicação utiliza autenticação própria por códigos e sessões. Isso não libera resultados: os endpoints privados exigem as sessões conferidas no banco. Nenhuma decisão de autorização depende de `user_metadata`.
- Códigos aleatórios de 48 bits protegidos por bcrypt com sal individual; o código administrativo também fica como hash.
- Tokens de sessão aleatórios de 256 bits; apenas SHA-256 dos tokens persistem no banco.
- O proxy da Vercel grava o token em cookie HttpOnly/SameSite=Strict/Secure e remove os metadados de sessão do JSON enviado à página.
- Sessão do participante só retorna seu resultado. A lista completa dos pares exige sessão administrativa.
- SQL parametrizado, chaves estrangeiras e restrições `UNIQUE`/`CHECK` impedem destinatários duplicados e autoatribuição.
- O sorteio usa Fisher–Yates com bytes criptográficos e amostragem por rejeição, sem `random()` do Postgres. Todas as combinações são inseridas na mesma transação.
- Um bloqueio na linha do evento serializa as operações e impede sorteios simultâneos conflitantes.
- Limite persistente de 60 tentativas em 15 minutos por nome/código administrativo. Tentativas incorretas também são contadas. O código administrativo é fixo e deve permanecer restrito ao organizador.
- Logs administrativos registram ações, nunca códigos individuais nem pares. O histórico é privado.

O schema não deve ser incluído nas listas de schemas expostos da Data API. Futuras demos devem ter suas próprias permissões, sem conceder acesso a este schema. Não reutilize a Edge Function da família como API genérica de outros sites.

## Verificação

```bash
npm install
npm test
npm run build
npm run check:live
```

- Testes locais: 1.000 sorteios, autenticação, cadastro, privacidade, estabilidade de resultado, reinício e proteção do proxy/cookies.
- `tests/family-supabase.sql`: testes do Postgres real, incluindo os 12 cadastros, sessões, resultados individuais, revogação de códigos, reinício e 100 sorteios. Executa tudo dentro de uma transação e faz **ROLLBACK**. O código administrativo usado pelo arquivo é exclusivo do teste; a configuração real não é alterada permanentemente.
- `npm run check:live`: verifica a Edge Function publicada, os 12 nomes, bloqueio administrativo sem sessão, negação da RPC com chave pública e o handler da Vercel. Não muda registros nem conhece o código administrativo.
- GitHub Actions instala dependências, testa, compila e executa a verificação pública do backend real.

O schema foi aplicado no novo Supabase, os testes de transação passaram e os dados de teste foram revertidos. A revisão de segurança do Supabase não apontou avisos. A publicação na sua URL Vercel depende do redeploy da atualização.

## Desenvolvimento local separado

Node 24:

```bash
git clone https://github.com/Novaesweb/Sorteio-.git
cd Sorteio-
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:5173. O Vite usa o backend local SQLite em `server/app.mjs`. Os dados locais ficam em `data/`, ignorados pelo Git, e não são enviados ao Supabase. A implementação local existe para desenvolvimento e testes; Vercel usa a Edge Function.

## Arquivos do backend Supabase

- `supabase/schema.sql`: schema, dados iniciais, políticas e RPC reproduzíveis, sem o código administrativo real.
- `supabase/functions/familia-ferreira/index.ts`: Edge Function usando `fetch` nativo, sem bibliotecas externas.
- `supabase/functions/familia-ferreira/deno.json`: configuração do runtime.
- `supabase/config.toml`: configuração da função com autenticação própria.
- `shared/supabase.json`: URL, identificação e chave pública do novo projeto.
- `server/supabase-proxy.mjs`: encaminhamento, origem e cookies seguros.

Nenhuma biblioteca Supabase foi adicionada ao frontend. Não publique `.env`, chaves secretas, tokens de sessão ou bancos locais. Não crie outro repositório e não use push forçado.
