# GFit

App de acompanhamento entre treinador e aluno: treinos, medidas, dieta e
feedback semanal. Substitui a planilha de Excel que o Treinador usa hoje.

Funciona como PWA (instalável no telemóvel, com os dados em cache para o
ginásio onde a rede é fraca) e está publicada no GitHub Pages.

- **Aluno** — vê o treino do dia e regista cada série (carga, repetições, reps
  em reserva) com o que fez da última vez ao lado; regista peso, passos, sono,
  energia, fome e stress; consulta a dieta; envia o feedback da semana.
- **Treinador** — vê quem precisa de atenção, escreve o plano de treino a partir
  da base de exercícios e publica-o, monta o plano alimentar a partir da base de
  alimentos, deixa notas e responde ao feedback.

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

Quem entra sem estar nessa lista fica como aluno. Se houver um convite pendente
para o email, fica logo ligado ao treinador que o convidou; se não, vê um ecrã à
espera e pode voltar a verificar depois de o convite ser criado.

### Modelo de dados

```
profiles ─┬─ coach_id → profiles        perfis e a ligação treinador/aluno
          └─ athlete_profiles           ficha: objetivo, limitações, metas
invites                                 convites por email

plans ─── plan_days ─── plan_exercises  o plano que o treinador escreve
workout_sessions ─── set_logs           o que o aluno fez (C / R / F)

daily_logs                              peso, passos, sono, energia, fome, stress
measurements                            perímetros
diet_plans ─── diet_meals ─── diet_items  plano alimentar
weekly_feedback                         feedback semanal e resposta do treinador
coach_notes                             notas que aparecem no "Hoje" do aluno

exercises, foods, muscles               bibliotecas partilhadas
```

O RLS segue uma regra só: o aluno vê e escreve o que é dele, o treinador vê os
alunos que tem associados e é o único que escreve planos. Rascunhos de plano e
de dieta ficam invisíveis ao aluno até serem publicados.

## Publicação

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push
para `main`. Antes do primeiro deploy é preciso, no repositório:

1. *Settings → Pages → Source*: **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables*: criar
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores de
   `.env.example`. São chaves públicas, de cliente — quem protege os dados é o
   RLS, não elas.

E, na configuração de Auth do Supabase, acrescentar a URL publicada
(`https://<user>.github.io/GFit/`) às *Redirect URLs*, para o login com Google
voltar ao sítio certo.

## Estrutura

```
src/
  auth/        login, contexto de sessão, ecrã de espera por convite
  athlete/     Hoje, Treino, Sessão de treino, Medidas, Dieta, Semana
  coach/       Alunos, Detalhe do aluno, Editor de plano, Editor de dieta,
               Biblioteca de exercícios
  components/  peças partilhadas (steppers, escalas, gráfico, tab bar)
  lib/         cliente Supabase, tipos, consultas, formatação, cálculos
  styles/      tokens e folha de estilo base
```

Os protótipos do Claude Design (`FG Coach App.dc.html`,
`FG Coach Protótipo.dc.html`) ficam no repositório como referência do desenho.

## O que falta

- Suplementos (a folha existe na planilha, os ecrãs ainda não).
- Cálculo automático de TMB e macros a partir de peso, altura, idade e
  atividade. Por agora é o treinador que define as metas à mão.
- Fotos de progresso e notas de voz no feedback semanal.
- Notificações push.
