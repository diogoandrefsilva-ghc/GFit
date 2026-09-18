# Corpo GFit — SVG dos grupos musculares

Ficheiros nesta pasta:

| Ficheiro | O que é |
|---|---|
| `corpo-gfit.svg` | O ficheiro a integrar. SVG puro, sem dependências. |
| `exemplo.html` | Página de demonstração com os três contextos, as duas silhuetas e o markup. Abre no browser. |
| `LEIAME.md` | Isto. |

---

## O essencial

Um só ficheiro com **duas vistas** e **15 regiões musculares**. Nenhuma região tem cor
fixa: a cor vem do contentor e a intensidade de uma variável CSS por músculo.

```
viewBox do ficheiro     -10 0 440 460
só a frente             -10 0 220 460
só as costas            210 0 220 460
```

As duas vistas estão em `<g id="body-front">` e `<g id="body-back">`, ambas em
coordenadas locais iguais (0 a 200 no eixo horizontal, centro em 100). Para usar
uma vista isolada basta trocar o `viewBox`; não é preciso partir o ficheiro.

> Se a mesma vista for injetada várias vezes na mesma página (ex.: uma lista de
> miniaturas), retira os atributos `id` nas cópias — ids repetidos são HTML inválido.
> Nada no ficheiro depende deles.

## Pintar um músculo

O SVG tem de ser **inline** no DOM (não `<img src>`), senão o CSS de fora não lhe chega.

```html
<div class="gfit-body" style="--accent:#ff4a1c">
  <!-- conteúdo de corpo-gfit.svg -->
</div>
```

```js
// intensidade de 0 a 1
function pintar(svg, intensidades) {
  for (const [slug, i] of Object.entries(intensidades)) {
    svg.querySelectorAll(`[data-muscle="${slug}"]`)
       .forEach(g => g.style.setProperty('--i', i));
  }
}

pintar(svg, { peito: 1, quadriceps: 0.79, dorsal: 0.71, gemeos: 0 });
```

Regras:

- **Usa `--i` (ou `fill-opacity`), nunca `opacity`.** Com `opacity` o traço da região
  desaparece junto com o preenchimento e deixa de se ver onde *não* houve volume.
- Cada `<g data-muscle>` contém os paths dos dois lados (e, quando aplicável, os das duas
  silhuetas). Pinta-se o grupo, nunca os paths lá dentro.
- Cada músculo aparece **uma vez por vista**. `trapezio` e `ombro_medio` aparecem nas
  duas vistas com o mesmo identificador, de propósito — um `querySelectorAll` apanha
  as duas e pinta ambas.

## Os 15 identificadores

Frente: `peito` · `abs` · `biceps` · `ombro_frontal` · `ombro_medio` · `trapezio` ·
`quadriceps` · `adutores`

Costas: `dorsal` · `trapezio` · `ombro_posterior` · `ombro_medio` · `triceps` ·
`lombares` · `gluteo` · `posterior_de_coxa` · `gemeos`

## Classes do contentor

| Classe | Efeito |
|---|---|
| *(nenhuma)* | Silhueta masculina, cabelo curto. |
| `gfit-body--fem` | Boneco feminino: ombros, pescoço e braços mais estreitos, cintura mais fina, ancas mais largas, contorno do peito, e cabelo apanhado com coque. |
| `gfit-body--nohair` | Sem cabelo. |
| `gfit-body--sm` | Modo miniatura: engrossa os traços e esconde as linhas de detalhe. Usar abaixo de ~140 px de largura. |

Combinação típica: aluno → sem classe; aluna → `gfit-body--fem`.

As duas silhuetas partilham exatamente a mesma grelha muscular — os 15 grupos cabem
dentro das duas, não há geometria duplicada nem lógica diferente por género.

## Variáveis CSS

| Variável | Uso | Omissão |
|---|---|---|
| `--accent` | Cor da intensidade | `#ff4a1c` |
| `--line-2` | Traço do contorno e das divisões | `#c9c4b8` |
| `--gfit-skin` | Preenchimento neutro do corpo | `#fcfbf8` |
| `--gfit-hair` | Cabelo | `#e7e3d9` |
| `--i` | Intensidade do grupo, 0 a 1 | `0` |

O bloco `<style>` dentro do SVG traz os valores por omissão e usa seletores com
prefixo `gfit-`. Podes apagá-lo e passar as regras para a folha de estilos da app —
mantém o que está lá, o comportamento é o mesmo.

## Camadas, por ordem de desenho

1. `.gfit-shape` — massa neutra do corpo, mãos e pés
2. `[data-muscle]` — as 15 regiões, `fill="currentColor"`
3. `.gfit-line` — contorno, desenhado **por cima** das regiões para que a silhueta
   fique sempre nítida mesmo com o músculo a encostar ao limite
4. `.gfit-detail` — linhas anatómicas (serrátil, prega inguinal, rótula, antebraço…)
5. `.gfit-hair` — cabelo

Nada fora do ponto 2 é pintado, por construção. Cabeça, mãos, pés e cabelo
não têm `data-muscle` e ficam sempre neutros.

## Verificações já feitas

- Nenhuma região sai de nenhuma das duas silhuetas.
- Nenhuma região se sobrepõe a outra; entre vizinhas há sempre um canal neutro
  de 2 a 4 unidades, com traço fino.
- Legível a 110 px por vista (com `gfit-body--sm`), 320 px e 260 px.
- Sem `<image>`, sem fontes externas, sem JavaScript, sem gradientes nem filtros.
