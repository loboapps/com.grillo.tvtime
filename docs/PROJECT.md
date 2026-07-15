# TV Time (interno) — Documentação do produto

> Documento vivo, escrito pra registrar decisões e regras de negócio, não código.
> Para os specs originais e o histórico de tasks, ver `docs/superpowers/`.

## 1. Contexto

O TV Time (app original) foi descontinuado em 15/07/2026 — app removido, site fora do ar, dados apagados. Esse projeto é o substituto pessoal: mesmo conceito central (rastrear o que você assiste, episódio a episódio, série a série), interface inspirada no original, mas construído do zero com as regras redefinidas para o uso real do usuário — não uma cópia 1:1 do comportamento antigo.

**Uso**: pessoal, single-user. Não existe conceito de múltiplas contas — a autenticação existe só pra proteger o acesso, não pra multi-tenancy. Todas as tabelas (`tvtime_*`) vivem num projeto Supabase compartilhado com outros apps do mesmo dono; nada fora do prefixo `tvtime_` é tocado por este projeto.

## 2. Modelo de dados

```
tvtime_shows       — uma linha por série rastreada
  ├── tvtime_seasons   — uma linha por temporada (inclui temporada 0 = specials)
  │     └── tvtime_episodes — uma linha por episódio
```

Metadado de série/temporada/episódio (nome, pôster, sinopse, datas) vem sempre do **TVmaze**, nunca é digitado manualmente. Trocou de TMDB pro TVmaze em 2026-07 — ver `docs/superpowers/specs/2026-07-12-tvmaze-migration-design.md` pro motivo (qualidade de dados, séries antológicas divididas) e `docs/superpowers/plans/2026-07-12-tvmaze-migration.md` pro histórico da migração. O único dado realmente "do usuário" é: quais episódios estão marcados como vistos (`watched` + `watched_at`), e o campo `user_status` da série.

Imagens (pôster, backdrop, still de episódio) são buscadas **ao vivo** do TVmaze toda vez que renderizadas — não há cache de imagem hoje. Decisão deliberada: cache (Vercel Blob) fica pra depois de o histórico completo estar importado, pra não montar infraestrutura em cima de dado ainda incompleto.

O nome de exibição (`name`) é resolvido pra versão internacional/inglesa quando a série não é originalmente em inglês, via o endpoint `/shows/{id}/akas` da própria TVmaze (`tvtime_shows.original_name` guarda o nome original, sem uso na UI). Nome de episódio não tem equivalente — a TVmaze não tem aka por episódio — então usa fallback pro TMDB (casado por data de exibição exata, nunca por posição de temporada/episódio) só quando `language !== "English"`. Ver seção 9 de `docs/superpowers/specs/2026-07-14-tvmaze-international-name-design.md` pro desenho completo.

## 3. O sistema de status (`tvtime_shows.user_status`)

Três valores possíveis: `watching` / `finished` / `dropped`. **Não existe `want_to_see` armazenado** — isso é uma categoria calculada, não um status (seção 4).

| Status | O que significa | Como é definido |
|---|---|---|
| `watching` | Padrão. Série ativa, ou nunca assistida, ou pausada sem intenção declarada de parar | Automático — é o que toda série começa como |
| `finished` | Assistiu **todos** os episódios disponíveis (exceto specials) **e** a série já **encerrou** de verdade (TMDB `status` não é `Returning Series`/`Planned`/`In Production`/`Pilot`) | Automático, recalculado a cada `tvtime_watch_episode` |
| `dropped` | No meio de uma série (já viu alguns episódios, existem episódios não vistos), decisão explícita de parar | Hoje: só via import histórico ou chamada direta da RPC `tvtime_set_show_status`. **Não existe botão na UI ainda** (backlog) |

**Regra importante, corrigida durante o import**: uma série com **zero episódios assistidos nunca pode ser `dropped`** — não dá pra "abandonar no meio" algo que nunca começou. Isso cai automaticamente em `watching` (e vira "Quero ver" na categorização, seção 4).

### Transições automáticas (`tvtime_watch_episode`)

Toda vez que um episódio é marcado como visto/não visto, a função reavalia o status da série na mesma chamada:

- **Marcar episódio como visto** → se a série estava `dropped`, volta pra `watching` (você tá assistindo de novo, não faz sentido continuar "dropped").
- **Depois de marcar**, se não sobrou nenhum episódio não-especial não visto **e** a série já encerrou → vira `finished`.
- **Se sobrar algo não visto** (ex: temporada nova chegou) e o status era `finished` → volta pra `watching`.

Isso significa que `finished`/`dropped` nunca ficam "presos" — sempre existe um caminho de volta pra `watching` através da própria ação de assistir, mesmo sem UI de "desdropar" ainda existir.

## 4. Categorização da Watch List (`tvtime_load_watchlist`)

Três seções, **mutuamente exclusivas por construção** (uma série nunca aparece em duas ao mesmo tempo) — calculadas a partir do comportamento real de assistir, numa janela de **15 dias**, não do `user_status` diretamente (só o exclui se `dropped`):

- **Watch Next** — episódio assistido nos últimos 15 dias, OU a série já tem histórico de assistir e um episódio novo saiu nos últimos 15 dias e ainda não foi visto.
- **Not Seen in a While** — já assistiu episódios dessa série antes, mas nada nos últimos 15 dias, e não tem episódio novo recente pendente.
- **Want to See** — zero episódios assistidos, nunca.

Uma série `finished` (viu tudo) não aparece em nenhuma das três — não por checar o status, mas porque não sobra nenhum "próximo episódio" pra mostrar. Se uma temporada nova for sincronizada depois, ela volta a aparecer sozinha, mesmo que o status ainda diga `finished` até você assistir algo (aí a transição automática da seção 3 corrige o status também).

**Specials (temporada 0) nunca são escolhidos como "próximo episódio"** — mesmo estando salvos no banco como qualquer outro episódio, a temporada 0 é explicitamente excluída do cálculo de "próximo" e da contagem de "restantes". Motivo: temporada 0 é sempre a de número mais baixo, então sem essa exclusão um special nunca visto sempre venceria um episódio real da temporada 1+.

## 5. Specials (temporada 0)

Decisão (2026-07): specials **são salvos no banco como qualquer episódio normal** — não são filtrados na camada de dados. A exclusão é só onde faz sentido (seção 4 — não aparecem como "próximo episódio"). Filtro de exibição na UI (esconder ou mostrar specials na tela de detalhe) é tarefa futura, ainda não implementada.

## 6. Sincronização de dados — três mecanismos, papéis diferentes

O problema que isso resolve: como manter pôster/temporadas/episódios atualizados com o TMDB sem (a) travar a tela toda vez que abre o app, e (b) sem depender de infraestrutura pesada.

### 6.1 Cron diário (`.github/workflows/app_wrk_sync_shows.yml`)

**Único mecanismo que varre a biblioteca inteira, incondicionalmente** — é o único jeito de descobrir uma temporada nova que o TVmaze anunciou sem eu saber previamente que precisava checar.

```
Passo 1 — pra CADA série rastreada (watching, finished ou dropped, sem exceção):
  Verifica: GET /tv/{id} no TVmaze (chamada barata, sem buscar episódios)

  SE número de temporadas do TVmaze > número de temporadas salvo
     OU existe episódio não visto salvo com air_date NULL (TBA que talvez já tenha data agora)
  ENTÃO
     Busca só as temporadas novas/pendentes (não a série toda de novo)
     Grava temporada(s) + episódio(s) via tvtime_sync_show
     Atualiza next_air_date com a data do próximo episódio conhecido
  SENÃO
     Só atualiza status/contagem/next_air_date/synced_at (sem buscar episódio nenhum)
```

Não existe tabela separada de "dados faltando" — um episódio não visto com `air_date IS NULL` **já é** o sinal de que falta descobrir a data. O cron reconsulta exatamente essas séries até a data aparecer.

Roda 1x por dia (5h40 UTC), depois dos crons de outro projeto (`com.grillo.finances`) que têm prioridade maior. Também pode ser disparado manualmente pelo GitHub (`workflow_dispatch`, com opção de dry-run).

### 6.2 Load da Watch List (client, a cada abertura do app)

Não espera o cron. Ao abrir a tela:
1. Mostra a lista imediatamente com o que já está no banco (sem travar a tela).
2. Em background, sincroniza só duas categorias de série, nunca a biblioteca inteira:
   - As que estão **visíveis** na lista agora (poucas, por definição).
   - As que têm `next_air_date <= hoje` — ou seja, o próximo episódio conhecido já devia ter saído. Isso vale pra qualquer status, inclusive `dropped`/`finished` — é como uma revival é percebida sem esperar o cron.
3. Atualiza a tela quando termina.

Como `next_air_date` é preenchido pelo cron (e por qualquer sync individual), a maioria dos dias esse segundo grupo é pequeno ou vazio — a maior parte das séries simplesmente não tem nada agendado pra "hoje".

### 6.3 Página de detalhe da série

Dois mecanismos:
- **Auto-correção passiva**: a página já busca o TMDB ao vivo toda vez que você abre uma série rastreada (pra mostrar pôster/sinopse atualizados). Aproveitando essa mesma chamada (sem custo extra), compara o número de temporadas salvo com o que voltou do TMDB — se diferente, sincroniza sozinha em background.
- **Botão de refresh manual** (ícone no canto superior direito do banner): força a sincronização daquela série específica na hora, pra quando você não quer esperar.

## 7. Import histórico do TV Time (concluído em 2026-07-09)

Nota: essa seção descreve o import original (TV Time → TMDB); depois da migração de 2026-07 pro TVmaze, os IDs de série mudaram de novo — ver o plano de migração citado no §2.

Fonte: export GDPR do TV Time. Depois de limpar os arquivos irrelevantes (reações, comentários, tokens de auth, etc.), sobraram os arquivos com dado real de série/episódio assistido — usados só localmente durante o import, nunca commitados.

**Metodologia de casamento TheTVDB → TMDB** (o export do TV Time usa IDs do TheTVDB, o app usa TMDB):
1. Casamento direto por `episode_id` do TVDB via `/find?external_source=tvdb_id` do TMDB — resolve a maioria dos casos com precisão exata (não é palpite: o endpoint devolve o show/temporada/episódio real do TMDB pra aquele ID).
2. Fallback: casamento direto por número de temporada/episódio, quando o TMDB conhece a série mas não tem aquele `episode_id` específico indexado.
3. Fallback: séries onde o TheTVDB numera "temporada" por ano de exibição (ex: MythBusters, Hard Knocks) — casamento por posição de exibição dentro do ano civil real.
4. Casos residuais sem solução automática: resolvidos manualmente um a um durante a revisão final.

**Descoberta relevante**: o casamento por `episode_id` resolve sozinho séries que o TV Time tratava como uma série só, mas que no TMDB são entradas separadas (antologias como *Crime Scene*, *The Haunting*, a franquia *Monster*) — cada episódio é roteado pro show real correto automaticamente, sem precisar de regra manual por série.

**A heurística automática de "dropped" foi abandonada**: a tentativa inicial de inferir abandono a partir do `followed_tv_show.csv` do TV Time (`archived`/`active`/ausência do registro) gerou muitos falsos positivos — o CSV só cobria ~64% das séries, e o resto virava "dropped" por engano. A fonte de verdade final para `dropped`/`finished`/`watching` foi a revisão manual completa do usuário, linha a linha, sobre as 568 séries — aplicada como override direto, não a heurística.

**Mecanismo final de escrita**: para evitar retransmitir ~1.5MB de dados de episódio através do agente (Claude), o import foi feito por uma action temporária `import_show` na Edge Function `tvtime-tmdb`, que recebia só `{tmdbId, watched[], status}` e fazia o fetch completo na TMDB + gravação no banco inteiramente server-to-server (usando `service_role`). Disparada por uma página `/admin-import` temporária, clicada manualmente pelo usuário. Toda essa infraestrutura (action, página, RPC auxiliar `tvtime_mark_watched_batch`) foi removida do código depois que o import terminou e foi validado — não faz parte do fluxo permanente do app.

Resultado: 566 séries importadas (2 excluídas por matching incorreto — remakes/entradas erradas com zero episódios assistidos), 19.964 episódios, 13.667 marcados como assistidos com data histórica real. Validado 1:1 contra os dados de origem antes da limpeza dos arquivos de import.

## 8. Decisões de arquitetura registradas

- **Sem pg_cron / cron no banco**: Supabase gratuito não facilita isso bem. Usamos GitHub Actions, mesmo padrão já usado em outro projeto do usuário (`com.grillo.finances`).
- **Sem push/notificação**: app é PWA pull-based. "Descobrir" uma novidade acontece na próxima vez que o app é aberto, nunca em tempo real — aceito, dado o uso pessoal.
- **RPCs sempre `SECURITY INVOKER`**, nunca `SECURITY DEFINER` — considerado e descartado; não há necessidade real com um usuário só, e evita a complexidade de elevar privilégio.
- **Nunca duplicar uma RPC pra cobrir um caso novo** — parametrizar a existente, mesmo que isso exija `DROP FUNCTION` (Postgres trata um parâmetro novo, mesmo com default, como uma assinatura diferente — não substitui a função antiga sozinho). Aconteceu duas vezes nesse projeto (`tvtime_watch_episode`, `tvtime_load_watchlist`) e virou regra explícita.
- **`service_role` (usado pelo cron) precisa de grant explícito** em toda RPC que ele chama, direta ou indiretamente — `SECURITY INVOKER` não eleva privilégio em chamadas internas entre funções.

## 9. Limitações conhecidas

Ver `docs/backlog.md` para a lista completa e o raciocínio de cada item. Os mais relevantes hoje:
- Não existe UI para marcar uma série como `dropped` manualmente (só a RPC).
- Filtro de exibição de specials na tela de detalhe ainda não implementado (specials aparecem misturados com episódios normais).
- Aba "Upcoming" (calendário de lançamentos futuros) — planejada, ainda não construída. `next_air_date` e `air_date` por episódio (já salvos) são a base de dados que essa tela vai usar.
