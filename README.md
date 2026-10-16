# 🌸 Família Ferreira e familiares — Ano Novo 2027

Site React + TypeScript + Tailwind com roleta, cadastro por código e painel administrativo. Roxo, vermelho e branco. **Sem Supabase e sem servidor externo obrigatório.**

Repositório único: https://github.com/Novaesweb/Sorteio-.git.

## Publicar somente na Vercel

A API agora roda em uma Vercel Function. **Não configure `BACKEND_URL`**: essa variável não é mais utilizada.

O armazenamento precisa ser ativado uma vez na sua conta para que cadastros e resultados permaneçam salvos entre celulares e publicações:

1. Abra o projeto na Vercel.
2. Em **Storage**, escolha **Create Storage → Blob**.
3. Escolha acesso **Private** e dê um nome exclusivo, por exemplo `familia-ferreira-2027`.
4. Conecte o Blob **somente a este projeto**, ao ambiente **Production**. Mantenha o prefixo padrão da variável (`BLOB_READ_WRITE_TOKEN`). Se quiser testar Preview, também pode conectar esse ambiente; o código separa seus dados dos de produção.
5. Em **Deployments**, faça **Redeploy** da versão mais recente de `main`.
6. Abra `/adm` e entre com o código administrativo definido pelo organizador. Gere e distribua os códigos individuais.

Se o Blob já existe, abra a aba **Projects** do armazenamento e use **Connect to Project**. Use um store privado; um store público não serve para guardar códigos e resultados.

A Vercel adiciona as credenciais na configuração de servidor automaticamente. Não cole tokens no código, no GitHub ou em variáveis com prefixo `VITE_`. SDKs atuais também podem usar a conexão OIDC gerenciada pela Vercel.

Referência: [criar e conectar um Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk#getting-started). O armazenamento segue os limites e condições de uso do seu plano da Vercel; nenhuma assinatura ou contratação foi feita automaticamente por este projeto.

Configurações do projeto:

- Framework: **Vite**.
- Node: **24.x**.
- Build: `npm run build`.
- Output: `dist`.
- Root directory: raiz do repositório.
- Não use `npm start` como build ou startup na Vercel; a função em `api/` é publicada automaticamente.

Até conectar o Blob, os 12 nomes aparecem normalmente, mas o site informa que os cadastros ainda não estão liberados. Ele não finge salvar dados.

## Família: lista fixa

Somente estes nomes participam; não há opção de adicionar ou remover:

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

A lista única fica em `shared/participants.json`, usada no frontend e no servidor. Os nomes aparecem no cadastro antes de qualquer resposta da API. Na confirmação, o servidor confere o nome e o código.

## Como organizar

1. Entre em `/adm` com o código administrativo combinado. O hash do código é validado no servidor, não no navegador.
2. Clique em **Gerar códigos pendentes**. Copie e guarde a lista: cada código individual aparece apenas nessa geração.
3. Envie cada código somente ao dono do respectivo nome. Não compartilhe a lista completa com o grupo.
4. Os familiares escolhem o nome, informam o código e confirmam o cadastro. Não precisam de e-mail nem senha própria.
5. Acompanhe os filtros **Todos**, **Pendentes** e **Confirmados** no painel. A atualização ocorre a cada cinco segundos.
6. Clique em **Iniciar sorteio** para gerar os 12 pares juntos. Todos os nomes entram, mesmo os que ainda não confirmaram; eles poderão entrar depois.
7. Cada pessoa gira a roleta para revelar somente seu resultado. Girar ou consultar novamente não muda o destinatário.

Os presentes têm o mesmo intervalo para todos: **R$ 40,00 a R$ 70,00**.

O painel mostra quem confirmou, quem falta, quem já girou e quem revelou o resultado. Também permite:

- Substituir um código perdido: invalida o código e as sessões anteriores, preservando o resultado.
- Consultar pares completos em área restrita.
- Abrir WhatsApp com mensagem pronta para os pendentes. O organizador escolhe o contato e confirma o envio.
- Reiniciar com o código administrativo e a frase `INVALIDAR RESULTADOS`. Isso remove resultados e sessões dos participantes, preservando códigos e confirmações. Avise a família: resultados já vistos ou baixados não podem ser apagados dos celulares.

## Páginas

- `/`: apresentação, regras e cadastro.
- `/sorteio`: revelação pela roleta.
- `/meu-resultado`: consulta protegida e download pessoal.
- `/adm`: acesso e painel do organizador.

Há som opcional, pétalas, confetes e opção de reduzir animações. As preferências de movimento do dispositivo são respeitadas.

## Persistência e privacidade na Vercel

A função carrega uma cópia SQLite temporária em `/tmp`, processa a operação e salva uma **cópia completa em Blob privado** quando há alterações. `/tmp` é apenas uma área de trabalho; a fonte persistente é o Blob, não o disco da função.

Esse formato atende o evento de 12 pessoas. Não é uma arquitetura indicada para um sistema grande com muitos escritores. Cada alteração usa o ETag da versão lida: se outra pessoa salvou antes, o servidor relê o estado e repete a operação, sem sobrescrever o cadastro anterior. A primeira criação também é exclusiva. Leituras usam `useCache: false` para enxergar as alterações já salvas.

A resposta de sucesso, códigos e cookies só saem **depois** que a gravação persistente termina. Falhas de armazenamento não são apresentadas como confirmação de cadastro. Consultas não regravam o arquivo. Se muitas operações disputarem a mesma versão, a API pede que a pessoa tente novamente, preservando o estado.

Arquivos de produção e preview são separados. Production usa `familia-ferreira/2027/production.sqlite`; Preview usa um caminho separado por branch. Não conecte outro projeto ao mesmo store. Ao mudar de conta, projeto ou store, migre os dados explicitamente; redeploy sozinho não migra arquivos entre stores diferentes.

- Códigos individuais aleatórios de 48 bits, com hash scrypt e sal.
- Sessões de 256 bits; apenas hashes no banco. Cookies HttpOnly/SameSite=Strict e Secure na Vercel.
- Sessão administrativa: oito horas. Participante: sete dias; o código permite entrar em outro celular.
- Limite de 60 tentativas por endereço em 15 minutos, persistido inclusive entre execuções independentes.
- SQL parametrizado, transações, chaves estrangeiras e restrições de unicidade.
- Fisher–Yates com `crypto.randomInt` e rejeição de autoatribuições.
- `/api/event` retorna somente nomes e estado do evento; `/api/me` não inclui destinatário.
- `/api/reveal` e `/api/result` retornam apenas o par da sessão autenticada. Os pares completos exigem sessão administrativa.
- O arquivo Blob e os tokens nunca são retornados aos participantes. Não há rota pública de download do banco.

O administrador usa um código fixo de quatro dígitos conforme solicitado pelo organizador. Ele permite acesso a todos os resultados; mantenha-o restrito. Os códigos dos familiares são separados desse código administrativo.

As tabelas e alterações de esquema são inicializadas em `server/db.mjs`. Não existem integração, banco ou políticas Supabase neste projeto.

## Desenvolvimento local

Node.js 24:

```bash
git clone https://github.com/Novaesweb/Sorteio-.git
cd Sorteio-
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:5173. O Vite encaminha `/api` ao backend local, porta 3001. Localmente o SQLite é salvo em `data/`, ignorado pelo Git, sem precisar de Blob nem credenciais externas.

```bash
npm test
npm run build
```

Os testes cobrem 1.000 sorteios, códigos, sessões, pares privados, reinício, lista fixa, persistência entre execuções, 12 cadastros e revelações simultâneos, tentativas de login, falha no armazenamento e controle de versão. O store é simulado nos testes: não exige conta nem grava em serviços reais. O GitHub Actions também instala o SDK, valida a importação da função Vercel e compila o frontend.

A publicação real precisa da conexão do Blob na sua conta. Os testes locais não substituem a verificação dessa configuração.

## Hospedagem Node opcional

Se preferir um servidor tradicional, `npm run build && npm start` serve tudo junto. Configure `DATABASE_PATH` em disco persistente, `APP_ORIGIN=https://seu-dominio`, `NODE_ENV=production` e uma única instância. `render.yaml` permanece como opção; não é necessário para publicar na Vercel. O blueprint do Render requer plano com disco persistente; não foi ativado automaticamente.

Faça backups privados do banco. Ao copiar SQLite de um servidor tradicional, pare o serviço ou use a API de backup do SQLite, pois o arquivo WAL pode conter alterações ainda não incorporadas ao arquivo principal.

## Estrutura

```text
src/                         React, visual e cliente da API
shared/participants.json     Os 12 nomes, uma única fonte
api/[...path].mjs             Vercel Function, sem servidor externo
server/serverless.mjs        Execução e persistência com controle de versão
server/blob-store.mjs        Leitura privada e escrita condicional
server/app.mjs               Regras, autenticação e endpoints
server/db.mjs                Esquema SQLite
server/draw.mjs              Sorteio seguro
scripts/dev.mjs              Ambiente local
tests/                       Regras, integração e acessos simultâneos
vercel.json                  Build, função e rotas
.env.example                 Configuração local
```

Não publique `.env`, bancos locais ou credenciais. Não crie outro repositório e não use push forçado.
