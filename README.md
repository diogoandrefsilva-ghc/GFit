# GFit

App de acompanhamento entre treinador e aluno: treinos, medidas, dieta e
feedback semanal. Substitui a planilha de Excel que o Treinador usa hoje.

Funciona como PWA (instalável no telemóvel, com os dados em cache para o
ginásio onde a rede é fraca) e está publicada no GitHub Pages.

- **Aluno** — vê a semana de treinos que o treinador marcou e regista cada série
  (carga, repetições, reps em reserva) com o que fez da última vez ao lado; nos
  treinos por tempo a app conduz com temporizador; regista peso, passos, sono,
  energia, fome e stress; consulta a dieta; envia o feedback da semana.
- **Treinador** — vê quem precisa de atenção, escreve o plano de treino a partir
  da base de exercícios, publica-o e marca-o no calendário, monta o plano
  alimentar a partir da base de alimentos, deixa notas e responde ao feedback.

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

O RLS segue uma regra só: o aluno vê e escreve o que é dele, o treinador vê os
alunos que tem associados e é o único que escreve planos. Rascunhos de plano e
de dieta ficam invisíveis ao aluno até serem publicados.

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
  auth/        login, contexto de sessão, ecrã de espera por convite
  athlete/     Hoje, Treino (semana marcada), Sessão de treino, Medidas,
               Dieta, Semana
  coach/       Alunos, Detalhe do aluno, Calendário, Editor de plano (com a
               marcação no calendário), Editor de dieta, Biblioteca de
               exercícios
  components/  peças partilhadas (steppers, escalas, gráfico, tab bar)
  lib/         cliente Supabase, tipos, consultas, formatação, cálculos
  styles/      tokens e folha de estilo base
```

Os protótipos do Claude Design (`FG Coach App.dc.html`,
`FG Coach Protótipo.dc.html`) ficam no repositório como referência do desenho.

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
