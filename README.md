# GFit

App de acompanhamento entre treinador e aluno: treinos, medidas, dieta e
feedback semanal. Substitui a planilha de Excel que o Treinador usa hoje.

Funciona como PWA (instalável no telemóvel, com os dados em cache para o
ginásio onde a rede é fraca) e está publicada no GitHub Pages.

- **Aluno** — vê a semana de treinos que o treinador marcou e regista cada série
  (carga, repetições, reps em reserva) com o que fez da última vez ao lado; nos
  treinos por tempo a app conduz com temporizador; regista peso, passos, sono,
  energia, fome, stress e perímetros em cartões, um por coisa; consulta a
  dieta; envia o feedback da semana.
- **Treinador** — vê quem precisa de atenção em cartões que abrem a lista ou o
  calendário, escreve o plano de treino a partir da base de exercícios,
  publica-o e marca-o no calendário, monta o plano alimentar a partir da base
  de alimentos, deixa notas e responde ao feedback. E treina: o separador *Eu*
  é o seu lado de aluno, com um lembrete no fim do *Início*.
- **Auto-treino** — quem quer escrever o seu próprio treino escreve-o, tenha
  treinador ou não. Quem tem treinador continua a mostrar-lho.
- **Primeira vez** — quem entra pela primeira vez leva uma apresentação de seis
  cartões a dizer o que faz cada separador. Abre no lado de quem está a ver, e
  o carril em cima deixa espreitar o outro: o treinador vê o que chega ao
  telemóvel dos alunos, o aluno percebe o que o treinador faz com o que ele
  regista. Vê-se uma vez, salta-se a qualquer altura, e fica no *Perfil* para
  quem a quiser rever.

## De onde vêm os dados

`FG_Planilha.xlsx` é a planilha original. Cada folha tem o seu lugar na app:

| Folha do Excel          | Onde ficou                                        |
| ----------------------- | ------------------------------------------------- |
| `Base`                  | Ficha do aluno (objetivo, limitações, metas)      |
| `Controle de medidas`   | Registo diário do aluno                           |
| `Perimetros`            | Ecrã de medidas                                   |
| `Plano treino` (C/F/R)  | Plano de treino e registo de séries               |
| `Base dados Exercicios` | Biblioteca de exercícios (277, 236 com vídeo)     |
| `Feedback semanal`      | Formulário semanal que chega ao treinador         |
| `Dieta 1`               | Plano alimentar                                   |
| `Base dados dieta`      | Base de alimentos (1366)                          |
| `Suplementos`           | Ainda não — fica para uma versão seguinte         |

As duas bases de dados são extraídas da planilha por
`scripts/extract_excel.py`, que gera as migrações SQL e o mesmo conteúdo em
JSON:

```bash
pip install openpyxl
python3 scripts/extract_excel.py
```

> **Nota sobre a planilha.** A folha `Base dados dieta` tem uma célula onde foi
> colada a coluna inteira de nomes da tabela de composição de alimentos. A
> partir dessa linha, os nomes ficaram desalinhados das macros: cerca de 1300
> alimentos mostravam os valores do alimento seguinte — o "Carapau grelhado"
> aparecia com 49,5 g de hidratos. O extrator corrige o desvio, mas convém
> corrigir também a planilha se ela continuar a ser usada.

### Texto vindo da planilha

Os nomes foram escritos à pressa numa folha de Excel: "leg curl", "geral",
"peso morto terra/sumo". A app não lhes toca na base — capitaliza-os ao mostrar,
com `titleCase()` em `src/lib/format.ts`.

A regra tem duas partes. As preposições e artigos ficam em minúsculas no meio do
título ("Biceps Curl **nos** Cabos Cross"), mas sobem se calharem no princípio.
E **só se mexe em palavras que estão todas em minúsculas** — é isso que salva o
`TRX`, o `Z` da barra e o `Scott` de serem achatados: se alguém já escreveu uma
maiúscula, escreveu-a de propósito.

Fica no ecrã e não na base de propósito: é reversível numa linha, não estraga a
pesquisa (que compara em minúsculas sem acentos) e não mexe no que o Treinador
escreveu.

## Arrancar localmente

```bash
npm install
cp .env.example .env     # já traz o projeto Supabase certo
npm run dev
```

`npm run build` compila, `npm run typecheck` e `npm run lint` são o que o CI
corre antes de publicar.

## Supabase

O projeto Supabase é partilhado pelas apps pessoais, uma schema por app. A GFit
vive na schema `gfit`. As migrações estão em `supabase/migrations/` e já foram
aplicadas.

**Passo manual, uma vez:** em *Settings → API → Exposed schemas* do projeto,
acrescentar `gfit` à lista. Sem isso a app arranca mas não lê nada, e mostra uma
mensagem a dizer exactamente isso.

### Quem é treinador

Um email entra como Treinador se estiver na lista `coach_emails`:

```sql
update gfit.app_config
   set value = '["treinador@exemplo.pt", "outro@exemplo.pt"]'::jsonb
 where key = 'coach_emails';
```

A lista é lida a cada login, não só no primeiro: quem já tenha entrado como
aluno passa a treinador assim que o email for acrescentado. O contrário não
acontece — tirar alguém da lista não lhe retira o perfil, para ninguém perder o
acesso aos seus alunos por causa de uma edição distraída.

Atenção ao email que o login devolve: entrar com Google traz o endereço da conta
Google, que pode não ser aquele em que estavas a pensar. Se a app te puser no
ecrã "Falta o convite" quando esperavas o de treinador, é quase sempre isso.

Quem entra sem estar nessa lista fica como aluno. Se houver um convite pendente
para o email, entra com o papel que o convite diz — aluno ou treinador — e, no
caso do aluno, fica logo ligado a quem o convidou. Se não houver convite, vê um
ecrã à espera e pode voltar a verificar depois de o convite ser criado.

Depois do primeiro treinador existir, os seguintes convidam-se pela app, no
separador Perfil. A lista `coach_emails` serve só para o arranque.

A app não envia emails: é estática, não tem servidor. Criar um convite grava-o
na base de dados; avisar a pessoa é um botão que abre a folha de partilha do
telemóvel ou a app de email com o texto já escrito.

### Modelo de dados

```
profiles ─┬─ coach_id → profiles        perfis e a ligação treinador/aluno
          ├─ athlete_profiles           o que não muda: nascimento, sexo,
          │                             altura, profissão
          ├─ athlete_targets            metas, revisão a revisão
          └─ athlete_limitations        lesões e restrições, com início e fim
invites                                 convites por email, de aluno ou treinador

plans ─── plan_days ─── plan_exercises  o plano que o treinador escreve
scheduled_workouts                      o plano marcado no calendário
workout_sessions ─── set_logs           o que o aluno fez (C / R / F)

daily_logs                              peso, passos, sono, energia, fome, stress
measurements                            perímetros
diet_plans ─── diet_meals ─── diet_items  plano alimentar
weekly_feedback                         feedback semanal e resposta do treinador
coach_notes                             notas que aparecem no "Hoje" do aluno

exercises, foods, muscles               bibliotecas partilhadas
```

Quase nada se sobrescreve. As metas são revisões datadas — a vista
`athlete_current_targets` devolve a que está em vigor —, as limitações têm
`started_on` e `resolved_on` em vez de serem apagadas quando saram, e as notas
do treinador ficam todas. Assim consegue ver-se, meses depois, que metas estavam
postas quando o peso começou a descer.

O RLS segue uma regra só: o aluno vê e escreve o que é dele, e o treinador vê os
alunos que tem associados. Escrever um plano é de quem o escreveu — o treinador
para os seus alunos, cada um para si (ver *Auto-treino*). Rascunhos de plano e
de dieta ficam invisíveis a quem não é o autor.

## Publicação

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push
para `main`. Há um único passo manual, e é obrigatório:

*Settings → Pages → Source*: **GitHub Actions**.

Se estiver em *Deploy from a branch*, o GitHub publica a raiz do repositório em
vez da pasta compilada. O `index.html` que fica servido aponta para
`/src/main.tsx`, que só existe em desenvolvimento, e o resultado é uma página em
branco. O workflow também falha, com `Failed to create deployment (status: 404)`.

Não é preciso configurar variáveis nenhumas: a URL e a chave publicável do
Supabase têm valores por omissão em `src/lib/config.ts`. São credenciais de
cliente, que viajam no bundle de qualquer maneira — quem protege os dados é o
RLS. Se quiseres apontar a app a outro projeto, define `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` (num `.env` local, ou em *Settings → Secrets and
variables → Actions → Variables*) e essas ganham.

Na configuração de Auth do Supabase, a URL publicada
(`https://<user>.github.io/GFit/`) tem de estar nas *Redirect URLs*, para o
login com Google voltar ao sítio certo.

## Estrutura

```
src/
  auth/        login, contexto de sessão, ecrã de escolha de quem entra sem
               convite (esperar pelo treinador ou treinar por sua conta)
  athlete/     Hoje (com os cartões de registo), Treino (semana marcada),
               Sessão de treino, Medidas, Dieta, Semana
  coach/       Alunos, Detalhe do aluno, Calendário, Editor de plano (com a
               marcação no calendário), Editor de dieta, Biblioteca de
               exercícios, Eu (a área pessoal do treinador)
  shared/      o que serve os dois lados: Perfil, a apresentação da app, e os
               cartões da ficha — quem é, metas, limitações, notas
  components/  peças partilhadas (steppers, escalas, painel do fundo, gráfico,
               corpo, tab bar)
  lib/         cliente Supabase, tipos, consultas, formatação, cálculos
  assets/      o SVG do corpo
  styles/      tokens e folha de estilo base
brand/         o logótipo em tamanho grande, de onde saem os ícones
public/        ícones da app e do separador, gerados a partir do logótipo
```

Os ícones não se editam à mão: saem todos de `brand/gfit-logo.png` com

```bash
pip install pillow && python3 scripts/make_icons.py
```

O ícone usa só as silhuetas — a palavra *GFit* do logótipo fica ilegível a
192 px. O `favicon.svg` é à parte: aos 16 px do separador nem as silhuetas se
lêem, por isso é um haltere nas cores da marca.

### As cores

Tudo o que é cor vive em `src/styles/tokens.css`, em três famílias, e os ecrãs
só lhes tocam por nome:

| Família | Para quê |
|---|---|
| `--gold`, `--gold-ink`, `--gold-dark`, `--gold-soft`, `--gold-line` | a marca: o botão que inicia, o separador onde se está, o rótulo da semana |
| `--warn`, `--warn-soft`, `--warn-line` | o que corre mal: erros, alunos a precisar do treinador, limitações activas |
| `--good`, `--good-soft`, `--good-line` | o que está feito |

Há duas regras que não se dobram. **O dourado de encher não escreve**: sobre
papel fica em 1,8:1 de contraste, por isso quem preenche é `--gold` (com
`--gold-ink` por cima) e quem escreve é `--gold-dark`. E **a marca não faz de
aviso**: se o dourado também servir para dizer que algo está mal, deixa de
querer dizer o que quer que seja — daí a família `--warn` à parte.

Os protótipos do Claude Design (`FG Coach App.dc.html`,
`FG Coach Protótipo.dc.html`) ficam no repositório como referência do desenho.

## Como os dados chegam ao ecrã

A app não volta a pedir ao servidor o que já sabe. Cada consulta tem uma chave
(`useQuery(['hoje', alunoId, dia], …)`) e o resultado fica em cache: em memória
enquanto a app está aberta, e no `localStorage` para sobreviver a fechá-la.

O que isso muda, em cada toque:

- **Voltar a um separador** mostra logo o que se sabe e confirma com o servidor
  por baixo. Sem spinner.
- **Gravar alguma coisa** relê sem tirar do ecrã o que lá está — o `reload()`
  nunca apaga os dados. O spinner só aparece quando não há mesmo nada para
  mostrar, que é a primeira vez que se abre cada ecrã.
- **Abrir a app** parte do que ficou da última sessão, em vez de esperar pela
  rede — e no ginásio, onde a rede falha, continua a mostrar o que sabe em vez
  de um erro.
- **O que se reordena ou marca** aparece mudado no toque e só depois é gravado;
  se a gravação falhar, relê-se para o ecrã não mentir.

O cache é por utilizador e esvazia-se ao terminar a sessão. As pesquisas
(alimentos, exercícios) ficam só em memória: mudam a cada letra escrita e não
valem disco.

Os ecrãs que vivem em chunks próprios são trazidos enquanto a app está parada,
para o primeiro toque em cada separador não esperar por um download.

## O início do treinador

Os quatro números do topo — alunos, quem precisa de ti, treinos da semana, quem
registou hoje — deixaram de ser só números: cada um é um cartão que leva ao
ecrã que o explica.

| Cartão | Onde vai dar |
| --- | --- |
| Alunos | a lista toda (`/alunos?ver=todos`) |
| A precisar | a lista já filtrada por quem precisa (`/alunos?ver=atencao`) |
| Treinos, esta semana | o calendário |
| Registaram hoje | a lista toda, onde cada linha diz quando foi a última vez |

A vista da lista de alunos passou a viver na barra de endereço (`?ver=atencao`,
`todos`, `pausa`) em vez de em estado local. É o que permite ao cartão apontar
à vista certa — e, de caminho, voltar de uma ficha devolve a lista onde ela
estava.

No fim do ecrã há um banner com o dia do próprio treinador, que abre o separador
*Eu*. Não é um "vai ali" solto: diz o que lhe falta — `por registar: peso, sono`
—, e quando tem treino marcado para hoje é isso que anuncia. Com tudo feito
veste o verde e limita-se a dizê-lo. O treinador passa o dia a olhar para os
números dos alunos; este é o lembrete de que também tem os seus.

## O registo do dia

O *Hoje* é o ecrã que se abre todos os dias, e o que se lhe pede é sempre a
mesma coisa: registar. Por isso não é um formulário — é uma grelha de cartões
grandes, um por cada coisa que há a registar: **peso**, **passos**, **sono**,
**como te sentes** (energia, fome e stress juntos, que são a mesma pergunta
feita de três maneiras) e **medidas**.

Cada cartão diz, sem se lhe tocar, o que já lá está — o número de hoje, a média
de 7 dias, quanto falta para a meta de passos — e veste o verde do que está
feito assim que fica registado. Quem abre a app vê num relance o que falta, que
é a pergunta que se faz à porta do ginásio.

O toque abre o painel que sobe do fundo (`src/components/Sheet.tsx`, o mesmo
dos números do editor de planos), com um valor só e grande. Três coisas que
isto resolve e o formulário anterior não resolvia:

- **Um alvo do tamanho do polegar por cada coisa**, em vez de seis campos
  pequenos a competir pelo mesmo ecrã.
- **Um toque quando nada mudou** — o painel abre no último valor conhecido e
  traz um botão a confirmá-lo ("Registar 77,2 kg"), que é o caso de quem se
  pesa todos os dias.
- **Grava-se à saída**, e não a cada − e +: procurar o número certo não tem de
  ser uma fila de gravações.

O cartão das medidas não abre painel nenhum — leva ao ecrã *Medidas*, com o
formulário de perímetros já aberto (`?registar=1`, que sai da barra de endereço
mal é lido). São nove campos e um histórico: é ecrã, não é painel.

O treinador vê exactamente os mesmos cartões na sua área *Eu*, porque é o mesmo
ecrã (ver *Auto-treino*).

## Calendário de treinos

O plano diz o que se faz; o calendário diz quando. Depois de publicado, o plano
marca-se: no editor escolhe-se o treino e tocam-se os dias em que ele se faz, e
o ⟳ de cada semana repete essas marcações até ao fim do plano. Rascunhos não se
marcam — ainda vão mudar, e o aluno nem os vê.

Cada marcação é uma linha em `scheduled_workouts`: um treino do plano numa data.
O mesmo treino pode ir a várias datas e a mesma data pode levar mais do que um
treino. A sessão que o aluno faz guarda a marcação que a originou
(`workout_sessions.scheduled_id`), e é assim que se sabe o que foi feito no dia,
o que foi feito mais tarde e o que ficou por fazer.

Daí saem as duas vistas de semana:

- **Aluno** (separador *Treino*) — os sete dias com o que está marcado, e o
  treino do dia começa-se ali. Adiantar trabalho faz-se pela lista do plano, que
  fica por baixo; treinos de dias futuros mostram-se mas não se abrem.
- **Treinador** (separador *Calendário*) — a semana dos alunos todos, com filtro
  por aluno e o estado de cada treino: feito, a meio ou em falta.

Sem marcações nenhumas nada disto estorva: o aluno continua a escolher o treino
da lista do plano, como antes.

## Auto-treino

Nem todo o treino vem de um treinador. Um aluno pode querer escrever o seu, e um
treinador treina como toda a gente. As duas coisas são a mesma, e resolvem-se
sem tabela nenhuma nova: **um auto-treino é um plano em que o autor e o dono são
a mesma pessoa** — `plans.coach_id = plans.athlete_id`. Daí para baixo não muda
nada: dias, exercícios, marcações no calendário, sessões e séries são os do
costume, e os ecrãs também.

Para a base de dados, o treinador que se acompanha a si próprio é um aluno que é
o seu próprio treinador. É por isso que o separador *Eu* não tem ecrãs seus: são
o **Hoje**, o **Treino** e as **Medidas** do aluno, com o `athlete_id` dele.

Quem entra sem convite escolhe no arranque: esperar pelo treinador, ou começar
já. A escolha fica no `profiles.status` — `pending` é quem espera, `active` sem
`coach_id` é quem treina por sua conta —, e não fecha porta nenhuma: o convite
que chegar depois liga a conta ao treinador com tudo o que já lá estiver.

### Quem escreve o quê

São duas perguntas diferentes, e têm respostas diferentes:

| | Quem pode |
|---|---|
| Escrever um plano para si | qualquer pessoa, mesmo tendo treinador |
| Definir metas, ficha e limitações de alguém | o treinador dessa pessoa — e a própria, quando não tem treinador |

A segunda linha é o que impede um aluno de reescrever as metas que o treinador
lhe pôs, e é ao mesmo tempo o que dá ao treinador (que nunca tem ninguém por
cima) o seu objectivo, as suas metas, as suas limitações e as suas notas.

O que o aluno já escrevia sobre si — peso, passos, sono, energia, fome, stress,
perímetros, feedback — continua exactamente igual: sempre foi dele.

### O que o treinador vê

Tudo o que o aluno escreveu para si:

- o plano aparece no separador *Planos* do aluno, com a marca **auto-treino**,
  e abre-se inteiro — só de leitura, porque quem o escreveu foi o aluno;
- os treinos que o aluno marcou aparecem no *Calendário*, com a marca **auto**
  para não se confundirem com os que foi ele a prescrever;
- um aluno sem plano prescrito mas a treinar por sua conta deixa de aparecer na
  lista como "Sem plano publicado" — não é um esquecimento do treinador, é uma
  escolha do aluno. O silêncio e os treinos em falta continuam a contar.

Um plano do treinador e um auto-treino podem coexistir. Nesse caso o plano que
manda nos ecrãs do dia a dia é o do treinador, e os treinos do próprio ficam na
lista *Escritos por mim*, no fundo do separador *Treino*. Para um auto-treino
que não seja o plano a correr chegar à semana, marca-se no calendário do plano
— a mesma regra de sempre: o plano diz o que se faz, o calendário diz quando.

## Treinos por repetições e por tempo

Um treino declara em `plan_days.mode` se se conta em repetições ou em tempo, e
um exercício pode fugir à regra do treino onde está — uma prancha de 45s no meio
de um dia de cargas. Quando o treino é todo por tempo, o aluno recebe um
temporizador guiado, com sinal sonoro nas transições e o ecrã mantido aceso.

`plan_days.flow` decide a ordem, e as duas dão sessões diferentes com os mesmos
números:

- `sets` — cada exercício esgota as suas séries antes de se passar ao seguinte.
- `circuit` — percorre-se a lista toda, descansa-se mais, e repete-se a volta.
  As voltas são do treino (`rounds`), não do exercício.

## O corpo dos músculos

Cada exercício da base diz que músculos trabalha e com que peso — série
inteira para o principal, 0,5 ou 0,3 para os auxiliares. Esse volume, que já
se somava em números, passa também a pintar-se num corpo.

O desenho é `src/assets/corpo-gfit.svg`: duas vistas (frente e costas) e 15
regiões, cada uma num `<g data-muscle="…">`. **Os 15 identificadores são,
letra a letra, os slugs da tabela `gfit.muscles`** — não há tabela de conversão
pelo meio, o que o exercício diz é o que o corpo acende.

```
abs · adutores · biceps · dorsal · gemeos · gluteo · lombares · ombro_frontal
ombro_medio · ombro_posterior · peito · posterior_de_coxa · quadriceps
trapezio · triceps
```

`trapezio` e `ombro_medio` aparecem nas duas vistas, de propósito: pintam-se as
duas ao mesmo tempo.

### Como se usa

`<BodyMap>` desenha uma vista; `<MuscleWork>` é o cartão feito — as duas
vistas, a legenda com os números e a escolha de um músculo ao toque.

```tsx
<MuscleWork
  volume={weeklyVolume(exercicios, biblioteca)}  // slug → séries
  names={nomesDosMusculos}                       // da tabela `muscles`
  sex={ficha?.sex}                               // silhueta do aluno
  reference={WEEKLY_FULL_SETS}                   // opcional: escala fixa
/>
```

A intensidade sai de `muscleIntensities()`: sem `reference` a escala é relativa
ao músculo mais trabalhado, que é como se lê um treino; com `reference` é fixa,
que é como se lê uma semana (`WEEKLY_FULL_SETS`, 20 séries, pinta cheio). Há
sempre um piso de 0,2 — um músculo que foi trabalhado tem de se ver, mesmo que
tenha levado uma série contra as vinte de outro.

O SVG tem de ficar inline no DOM, senão o CSS da app não lhe chega: `BodyMap`
importa o ficheiro como texto, parte-o nas duas vistas uma única vez e injecta
a que precisa. A cor vem de `--accent` — a variável do contrato do SVG, que a app
preenche com `--gold-dark` — e a intensidade de cada grupo entra noutra
variável CSS no contentor (`--bm-<slug>`), o que deixa o React fora do DOM do
desenho e mantém a transição de cor a funcionar.

### Onde aparece

| Ecrã | O que mostra |
| --- | --- |
| Editor de plano (treinador) | O volume do treino aberto ou da semana toda, com um botão a trocar entre os dois. Cada exercício do treino leva a sua miniatura |
| Treino (aluno) | O que a semana marcada trabalha — ou o plano inteiro, se ainda não houver marcações |
| Fim da sessão (aluno) | O que acabou de trabalhar, contando só as séries que ficaram registadas |
| Biblioteca e escolha de exercícios (treinador) | Cada exercício da lista leva o seu corpo à esquerda e o que trabalha, com os pesos, à direita. O corpo grande escolhe o filtro: toca-se num músculo para ver só os exercícios que o trabalham |

`MuscleThumb` é a miniatura de um exercício: mostra **uma** vista, a que apanha
mais do que ele trabalha, e vai em todas as linhas — incluindo a lista de 120
da biblioteca. Para lá caber, a miniatura não recebe as linhas anatómicas:
`markup()` entrega-as de fora, e são 46 dos 81 paths de uma vista. Escondê-las
por CSS não servia, porque continuavam a custar a criar. As linhas da lista
levam ainda `content-visibility: auto`, para o browser só desenhar as que estão
à vista.

Juntas, as duas coisas põem a lista de 120 exercícios a aparecer em 284 ms com
a CPU travada 4x, contra 1281 ms sem elas, e o scroll mantém-se nos 60 fps.
Tirar o detalhe também tornou a miniatura mais legível a 52 px, não menos: o
que lá estava a essa escala era ruído.

Um exercício sem músculos atribuídos desenha o corpo neutro em vez de nada —
some-lo desalinhava a coluna da lista.

`MuscleFilter` é o corpo que filtra. Num telemóvel cada vista fica com uns
160 px e um deltóide não chega a 10 px de lado, muito abaixo do que um polegar
acerta, por isso um toque que caia ao lado apanha o músculo mais próximo dentro
de 10 unidades do desenho — medido contra cada lado, não contra a caixa do
grupo, senão pelo esterno o peito perdia para o deltóide. Fora desse raio não
apanha nada: cabeça, mãos e pés continuam mudos.

### Aluno e aluna

A silhueta segue o `sex` da ficha: sem ficha ou com `M` fica a masculina, com
`F` a feminina — ombros e cintura mais estreitos, ancas mais largas, contorno do
peito e cabelo apanhado. É a classe `body-map--fem`, e as duas partilham
exactamente a mesma grelha muscular: não há geometria duplicada nem lógica
diferente por sexo.

O desenho ainda não está no ponto. `docs/corpo-gfit/` guarda o `LEIAME.md` do
ficheiro e um `exemplo.html` que se abre no browser para o ver isolado — é por
aí que se itera sem mexer na app. Substituir o SVG chega, desde que os 15
`data-muscle` e as classes `gfit-*` se mantenham.

## Vídeos

Os 236 vídeos da base são links do YouTube de terceiros. Alojá-los seria violar
direitos de autor, por isso a app embebe o leitor do YouTube numa janela por
cima do treino — o aluno vê a demonstração sem sair da app, que é o que
interessava. Fica com a marca do YouTube e precisa de rede.

## O que falta

- Suplementos (a folha existe na planilha, os ecrãs ainda não).
- Cálculo automático de TMB e macros a partir de peso, altura, idade e
  atividade. Por agora é o treinador que define as metas à mão.
- Fotos de progresso e notas de voz no feedback semanal.
- Notificações push.
