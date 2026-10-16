# 🌸 Amigo Secreto da Família — Ano Novo 2027

Site React + TypeScript + Tailwind, com backend Node.js e SQLite **exclusivo deste projeto**. Sem Supabase, sem e-mail, sem serviços ou bancos compartilhados com outros sistemas.

Repositório oficial e único: **https://github.com/Novaesweb/Sorteio-.git**.

## O que está implementado

- Página inicial floral em roxo, vermelho e branco, mobile-first, roleta com nomes, pétalas, brilhos e faixa de presentes de **R$ 40,00 a R$ 70,00** para todos.
- Cadastro por nome e código individual, sem senha de participante. O código confirma o cadastro e permite consultar de outro celular.
- Lista fixa com somente os 12 nomes solicitados, criada automaticamente no primeiro uso. Não é possível adicionar ou remover participantes.

  Caíque Eduardo, Estephane, Jéssica Rafaela, Igor, Caio, Rafael, Iris Ferreira, Augusto, Lucas Rodrigo, Camila Dias, Jenifer e Erick.

- `/sorteio`: roleta com desaceleração, resultado definitivo, comemoração e som opcional sintetizado no navegador.
- `/meu-resultado`: consulta protegida e download de um arquivo de texto pessoal.
- `/adm`: painel protegido pelo código fixo do administrador, contadores, filtros de pendentes/confirmados e atualização automática a cada **5 segundos**.
- Geração de códigos, substituição de códigos perdidos, sorteio global, consulta restrita de resultados e histórico administrativo.
- Lembretes abrem o WhatsApp com a mensagem pronta. O organizador escolhe o contato e confirma o envio; o site não envia mensagens automaticamente.
- Reinício exige o código administrativo e a frase `INVALIDAR RESULTADOS`.
- Opção de reduzir animações e respeito à preferência de movimento do dispositivo.

## Instalação local

É necessário **Node.js 24 ou superior** (SQLite integrado ao Node, sem instalação de banco separada).

```bash
git clone https://github.com/Novaesweb/Sorteio-.git
cd Sorteio-
npm install
cp .env.example .env
```

O painel usa o código fixo escolhido pelo organizador, validado somente no backend. Não há necessidade de configurar senha nas variáveis de ambiente. O cadastro sempre exibe os 12 nomes, inclusive antes de o servidor responder. Para confirmar e salvar os dados, o backend precisa estar disponível.

```bash
npm run dev
```

Abra http://localhost:5173. O backend usa a porta 3001; o Vite encaminha `/api` automaticamente. Em `/adm`, entre com o código administrativo combinado. Nenhuma senha fixa é fornecida no código.

### Uso em família

1. Antes de compartilhar o site, entre em `/adm` e confira os nomes.
2. Clique em **Gerar códigos pendentes**. Copie e guarde a lista em local privado: cada código aparece em texto somente na geração.
3. Distribua **cada código apenas ao dono do nome**, pelo canal que preferir. Não envie a lista completa ao grupo.
4. Cada familiar escolhe o nome, digita o código e confirma o cadastro. O painel indica quem ainda não confirmou.
5. Quando quiser liberar as revelações, clique em **Iniciar sorteio**. Não é necessário que todos já tenham se cadastrado; todos os nomes da lista entram no sorteio e podem confirmar depois.
6. Os pares são criados juntos no servidor. Cada pessoa gira a roleta uma vez para revelar apenas seu próprio resultado.
7. Quem perdeu o código pode receber um **Novo código** pelo painel. Isso invalida o código e as sessões anteriores, preservando cadastro e resultado.

O acesso do participante dura sete dias; o do organizador, oito horas. O código permite entrar novamente. Compartilhar o código permite acesso ao resultado; ele deve ser mantido privado.

## Dados e proteção

- SQLite em `DATABASE_PATH`, com transações, chaves estrangeiras e restrições `UNIQUE`/`CHECK` para impedir destinatários duplicados e autoatribuição.
- Sorteio uniforme por Fisher–Yates com `crypto.randomInt` e rejeição de permutações com autoatribuição.
- Códigos aleatórios de 48 bits protegidos por scrypt com sal individual; somente hashes persistem.
- Sessões aleatórias de 256 bits, hashes no banco, cookies HttpOnly/SameSite=Strict; em produção, Secure e prefixo `__Host-`.
- Código administrativo fixo validado por hash no backend; tentativas de login limitadas por endereço de conexão. Se usar proxy, o limite será compartilhado pelas pessoas que saírem pelo mesmo proxy. Para 12 familiares isso é suficiente; aguarde 15 minutos após exceder 60 tentativas.
- `/api/event` retorna somente os nomes públicos e o estado do evento. O navegador participante nunca recebe os pares completos.
- `/api/me` não revela destinatário. `/api/reveal` marca e retorna exclusivamente o resultado da sessão; repetir a chamada retorna o mesmo resultado. `/api/result` só funciona após a revelação.
- Painel e pares completos exigem sessão administrativa. Histórico não registra códigos, senhas nem pares.
- Reiniciar remove os pares, datas de revelação e sessões dos participantes; preserva os códigos e cadastros. Arquivos já baixados e resultados já vistos não podem ser apagados dos celulares: avise a família sobre a invalidação.
- O arquivo do banco é privado e fica fora de `dist`. `.env` e `data/` são ignorados pelo Git.

O banco é criado e migrado automaticamente em `server/db.mjs`; não existem migrations, Auth ou RLS do Supabase nesta versão, por solicitação de simplificação. Use **uma única instância** do backend com disco persistente. Não execute cópias independentes com bancos diferentes.

## Verificação

```bash
npm test
npm run build
```

Os testes não dependem de rede, contas externas nem dependências npm. Verificam 1.000 sorteios em tamanhos diferentes, autenticação, isolamento, repetição da revelação, acesso em outro celular, rotação do código, lista fixa com os 12 nomes originais, reinício e persistência ao reabrir o banco. A API é testada pelo handler HTTP real em memória, sem abrir portas.

A ação `.github/workflows/check.yml` instala dependências, executa os testes e compila o frontend no GitHub.

## Publicação recomendada: um único servidor

A opção mais simples é servir frontend e backend juntos em uma hospedagem Node com disco persistente. `render.yaml` prepara essa configuração no Render, com uma instância e disco em `/var/data`. **Essa configuração usa plano com disco pago**; não ativa cobrança automaticamente neste projeto.

1. Conecte **o repositório existente** `Novaesweb/Sorteio-` à hospedagem.
2. Use Node 24, build `npm install && npm run build && npm test` e inicialização `npm start`.
3. Monte um disco persistente e defina `DATABASE_PATH=/var/data/familia.sqlite`.
4. Defina `NODE_ENV=production`, `APP_ORIGIN=https://seu-dominio` (sem barra final). `PORT` é fornecido pela hospedagem.
5. Publique com HTTPS e abra `/adm` para gerar os códigos. Em produção, o servidor se recusa a iniciar sem origem HTTPS configurada.

Nunca use um diretório temporário para os dados em produção. Faça backups privados e regulares. Para copiar o banco com segurança, pare o serviço antes de copiar o arquivo ou utilize a API de backup do SQLite. A cópia isolada de um banco aberto em WAL pode perder alterações recentes.

### Vercel (opcional, para o frontend)

O `vercel.json` configura build e rotas. **Vercel sozinha não mantém o arquivo SQLite entre execuções.** Para usar Vercel, mantenha o backend acima em uma hospedagem com disco persistente:

- Importe o mesmo repositório na Vercel, preset Vite, build `npm run build`, saída `dist`, Node 24.
- Configure `BACKEND_URL=https://seu-backend` nas variáveis de servidor da Vercel (sem caminho `/api`, sem prefixo `VITE_`).
- No backend, defina `APP_ORIGIN` com a URL pública da **Vercel**. Use um domínio estável para que a origem continue válida.
- `api/[...path].mjs` encaminha chamadas e cookies ao backend. O banco continua somente no servidor persistente.

A hospedagem em um único servidor dispensa esse proxy e é mais simples para este evento.

## Enviar os arquivos ao GitHub existente

Se o código foi entregue por arquivo ZIP em vez de push, extraia para uma pasta temporária. Clone o repositório existente e copie **o conteúdo do projeto** para dentro dele, preservando o `.git` do clone e conferindo arquivos preexistentes antes de substituir.

```bash
git clone https://github.com/Novaesweb/Sorteio-.git
cd Sorteio-
# Copie os arquivos entregues para esta pasta, sem .env, data/, node_modules/ ou .git.
npm install
npm test
npm run build
git status
git add .
git commit -m "Implementa amigo secreto da família 2027 sem Supabase"
git push origin HEAD
```

Não crie outro repositório e não use push forçado. Revise `git diff --cached` antes do commit. O ZIP não contém credenciais, banco, códigos individuais nem resultados.

## Estrutura

```text
src/                  React, componentes, estilos e cliente da API
server/               HTTP, autenticação, SQLite e sorteio seguro
scripts/              Inicialização do ambiente de desenvolvimento
api/                  Proxy opcional para Vercel
tests/               Testes de regras e integração (sem dependências)
render.yaml           Servidor único com disco persistente
vercel.json           Frontend opcional na Vercel
.env.example          Modelo de configuração privada
```

## Validação da entrega

Os cinco testes de backend passaram localmente, incluindo 1.000 sorteios aleatórios, controle de acesso, lista fixa de 12 participantes e persistência. A compilação do frontend e os testes da versão anterior também passaram no GitHub Actions. O workflow repete essas verificações a cada push. A validação visual em navegador não foi realizada neste ambiente. Nenhuma hospedagem foi criada ou publicada e nenhum Supabase foi acessado.
