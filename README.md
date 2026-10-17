# Família Ferreira e familiares · Ano Novo 2027

Site da família com visual roxo, vermelho e branco, roleta, cadastro por nome e **ID individual**, e painel que acompanha apenas a participação. Presentes: **R$ 40,00 a R$ 70,00**.

Repositório: https://github.com/Novaesweb/Sorteio-.git.

## Entrada dos familiares

1. O organizador entra em `/adm` e clica em **Gerar IDs pendentes** para criar os IDs de quem ainda não tem acesso.
2. A lista aparece uma vez para copiar. Cada ID deve ser entregue somente ao dono do nome correspondente.
3. O familiar clica em **Quero participar do sorteio**, informa seu **ID individual** e seleciona o próprio nome.
4. O servidor aceita o cadastro somente se o ID pertencer ao nome selecionado.
5. Depois do início global, a roleta revela o resultado. O mesmo ID permite voltar de outro celular sem mudar o destinatário.

Cada pessoa recebe um ID diferente, aleatório e persistente. O ID de uma pessoa não funciona no nome de outra. O ID compartilhado anterior foi desativado.

Quem perder o ID pode receber outro pelo botão **Gerar novo ID** na sua linha. Isso invalida o ID e as sessões anteriores, preservando o cadastro e o resultado. Não existe recuperação do ID em texto a partir do hash: guarde a lista no momento da geração.

## Painel do organizador

Em `/adm`, use o **ID do administrador de seis dígitos**, separado dos IDs individuais dos familiares.

O painel permite gerar os IDs e mostra:

- Quem confirmou o cadastro e quem ainda não confirmou.
- Quem já girou e quem ainda falta girar.
- Contadores e estados, atualizados a cada cinco segundos.
- Filtros **Falta girar** (aberto por padrão), **Já giraram** e **Todos**.

**O painel não exibe quem cada pessoa tirou.** Não há consulta da lista de pares: `/api/admin/results` é bloqueado inclusive para sessões administrativas. A API do dashboard retorna somente estados e datas. Isso se refere ao painel do site; um proprietário com acesso direto ao banco Supabase ainda tem os poderes de administração do banco.

O organizador pode iniciar o sorteio global, abrir lembretes no WhatsApp e reiniciar com confirmação reforçada. O WhatsApp abre com o texto pronto; o organizador escolhe o contato e confirma o envio. O site não afirma ter enviado uma mensagem automaticamente.

Reiniciar exige a frase `INVALIDAR RESULTADOS` e o ID administrativo. Remove os pares e sessões dos familiares, preservando confirmações e os IDs individuais. Resultados já vistos ou baixados não podem ser removidos dos celulares: avise a família sobre a invalidação.

Os IDs reais foram configurados privadamente no servidor. Os arquivos SQL de instalação inicializam hashes aleatórios, e os testes usam IDs próprios, sem conter o ID administrativo real em texto.

## Lista fixa

Somente estes nomes participam, sem inclusão ou remoção pelo site:

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

A lista pública fica em `shared/participants.json` e aparece no cadastro antes da resposta da API. A confirmação depende do servidor disponível e do ID correto.

## Páginas e roleta

- `/`: apresentação, regras e cadastro.
- `/sorteio`: roleta e revelação individual do nome escolhido.
- `/meu-resultado`: consulta do resultado do nome da sessão e download pessoal.
- `/adm`: acompanhamento de participação.

As combinações são geradas juntas no servidor. Todos dão e recebem exatamente um presente; ninguém tira a si mesmo. O giro apenas anima o resultado já atribuído. Há som opcional, pétalas, confetes e preferência para reduzir animações.

## Hospedagem e Supabase

A versão publicada usa **Vercel + Supabase Sites demo**:

- [Supabase Sites demo](https://supabase.com/dashboard/project/abkzgepigxfottjblgyf), região de São Paulo.
- Schema privado: `familia_ferreira_2027`.
- Edge Function: `familia-ferreira`.
- Proxy da Vercel: `api/[...path].mjs`.

Não são necessários `BACKEND_URL`, Blob, Render ou chaves privadas na Vercel. A configuração pública está em `shared/supabase.json`. A chave publishable não tem acesso às tabelas nem à RPC privada. As credenciais internas da Edge Function permanecem no Supabase.

O projeto Supabase anterior não foi alterado. Futuras landing pages podem usar o **Sites demo** com schemas, tabelas e permissões próprios. Elas não devem reutilizar a API nem receber acesso ao schema da família. Os limites e o plano são compartilhados dentro do projeto.

Na Vercel, use Vite, Node 24.x, build `npm run build` e saída `dist`. A branch de produção é `main`. Aguarde a publicação automática após o push ou faça Redeploy da versão mais recente. Preview não altera os dados de produção: para participar ou administrar, use o endereço principal publicado.

## Proteção do backend

- Schema privado com RLS habilitado e políticas que negam acesso direto a `anon` e `authenticated`.
- RPC `SECURITY INVOKER`, `search_path` vazio e execução exclusiva para `service_role`.
- A Edge Function chama a RPC com suas credenciais de servidor. A própria RPC confere o ID de entrada ou a sessão, e o ID administrativo em ações de organização.
- `verify_jwt=false` na Edge Function porque a autenticação é própria por IDs e sessões. Operações privadas continuam protegidas na RPC.
- IDs armazenados como hashes bcrypt com sal, nunca em texto no banco.
- Tokens de sessão aleatórios de 256 bits, somente SHA-256 no banco. O proxy grava cookies HttpOnly/SameSite=Strict/Secure e não envia metadados internos de sessão à página.
- Limite persistente de 60 tentativas por nome ou acesso administrativo em 15 minutos.
- Cada consulta de resultado retorna apenas o resultado do nome autenticado pela sessão, nunca a lista completa. A entrada valida o ID individual vinculado ao nome.
- Não há acesso a pares pela API administrativa.
- Sorteio criptográfico Fisher–Yates com rejeição de autoatribuições. Restrições SQL impedem pares duplicados e autoatribuição.
- O bloqueio da linha do evento e transações impedem sorteios globais conflitantes.
- Histórico administrativo não contém IDs em texto nem nomes dos destinatários.

## Verificação

```bash
npm install
npm test
npm run build
npm run check:live
```

Os testes locais cobrem 1.000 sorteios, IDs individuais, rejeição de ID de outra pessoa, confirmações sem duplicação, consulta em outro celular, resultado estável, reinício e bloqueio de pares no painel e na API.

`tests/family-supabase.sql` verifica o Postgres real, inclusive os 12 logins com seus próprios IDs e a rejeição de ID cruzado, a negação da lista de pares ao administrador e 100 sorteios. Todas as alterações de teste ficam em uma transação com **ROLLBACK**. Os IDs desse arquivo são apenas de teste.

`npm run check:live` verifica a Edge Function publicada, nomes públicos, autenticação administrativa, bloqueio da RPC direta com chave pública e o handler Vercel, sem mudar dados. O GitHub Actions executa testes, compilação e verificação da API real.

## Desenvolvimento local

```bash
git clone https://github.com/Novaesweb/Sorteio-.git
cd Sorteio-
npm install
cp .env.example .env
npm run dev
```

Node 24. Abra http://localhost:5173. O ambiente local usa SQLite em `data/`, separado do Supabase. A implementação local segue o mesmo modo de IDs individuais e painel sem pares.

Arquivos principais:

- `src/`: interface React e estilos.
- `shared/`: participantes e destino público do Supabase.
- `server/supabase-proxy.mjs`: proxy e cookies da Vercel.
- `supabase/schema.sql`: schema, funções e políticas reproduzíveis.
- `supabase/functions/familia-ferreira/`: backend publicado.
- `server/app.mjs`: backend de desenvolvimento local.
- `tests/`: testes locais e do Postgres.

Não publique `.env`, chaves privadas, tokens de sessão ou bancos locais. Na reinstalação em outro projeto, configure os IDs privadamente no novo servidor; os valores reais não são incluídos nos arquivos de bootstrap.
