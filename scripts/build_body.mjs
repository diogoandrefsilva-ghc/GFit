// Gera `src/assets/corpo-gfit.svg`: node scripts/build_body.mjs
//
// O boneco é desenhado por pontos, não por paths escritos à mão. Cada forma é
// uma lista de pontos da metade direita do desenho, em [h, y]: `h` é a
// distância ao eixo do corpo (x = 100 ± h), `y` é o do viewBox. O gerador
// passa uma curva suave pelos pontos, espelha para o outro lado e deforma tudo
// para a silhueta feminina — assim os músculos acompanham sempre o contorno e
// não há geometria desenhada duas vezes.
//
// Marcas num ponto: [h, y, 'c'] é um canto (a curva quebra ali).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/assets/corpo-gfit.svg', import.meta.url))

// ── deformação para a silhueta feminina ─────────────────────────────────────

/** Escala horizontal do tronco e das pernas, por altura. */
const FEM_SCALE = [
  [60, 0.86],
  [92, 0.89],
  [130, 0.89],
  [180, 0.83],
  [224, 1.1],
  [256, 1.1],
  [300, 1.05],
  [336, 1],
  [460, 1],
]

function femScale(y) {
  if (y <= FEM_SCALE[0][0]) return FEM_SCALE[0][1]
  for (let i = 1; i < FEM_SCALE.length; i++) {
    const [y1, s1] = FEM_SCALE[i]
    if (y <= y1) {
      const [y0, s0] = FEM_SCALE[i - 1]
      // suavizado, para a cintura e a anca não fazerem aresta
      const t = (y - y0) / (y1 - y0)
      const e = t * t * (3 - 2 * t)
      return s0 + (s1 - s0) * e
    }
  }
  return 1
}

/** Eixo do braço: do ombro ao pulso. */
const armAxis = (y) => 50 + ((y - 100) * 28) / 158

/**
 * Largura geral do boneco. Os pontos foram tirados de proporções reais, que em
 * desenho pequeno lêem como magreza; isto dá-lhe o corpo de quem treina.
 */
const BUILD = 1.13

function warp([h, y], part, variant) {
  if (part === 'fixed') return [h, y]
  // a cabeça cresce a partir do topo, para o coque não sair do viewBox
  if (part === 'head') return [h * 1.08, 15 + (y - 15) * 1.08]
  if (variant === 'm') return [h * BUILD, y]
  if (part === 'arm') {
    // o braço acompanha o ombro mais estreito e afina um pouco
    const axis = armAxis(y)
    return [(axis + (h - axis) * 0.88 - 4.6) * BUILD, y]
  }
  return [h * femScale(y) * BUILD, y]
}

// ── curvas ──────────────────────────────────────────────────────────────────

const r = (n) => String(Math.round(n * 10) / 10)

/** Catmull-Rom → Bézier cúbicas. Os cantos ficam com tangente nula. */
function spline(pts, closed) {
  const n = pts.length
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const k = 1 / 6
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k]
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k]
    d += ` C ${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`
  }
  return closed ? `${d} Z` : d
}

/** Pontos em [h, y] → pontos em x absoluto, de um dos lados. */
function place(points, part, variant, side) {
  return points.map((p) => {
    const [h, y] = warp(p, part, variant)
    return [100 + side * h, y, p[2] === 'c']
  })
}

/** Uma forma de cada lado do corpo. */
function pair(points, part, variant, closed = true) {
  return [1, -1].map((side) => spline(place(points, part, variant, side), closed))
}

/** Uma forma que atravessa o eixo: dá-se a metade direita, de cima a baixo. */
function whole(points, part, variant) {
  const right = place(points, part, variant, 1)
  const left = place(points, part, variant, -1).reverse()
  return spline([...right, ...left], true)
}

const pick = (shape, variant) => (Array.isArray(shape) ? shape : shape[variant])

// ── contorno ────────────────────────────────────────────────────────────────

const A = 'arm'
const B = 'body'

/**
 * Metade direita do corpo, do pescoço à virilha. O contorno é um só path; os
 * troços do braço levam a deformação do braço, o resto a do tronco.
 */
const OUTLINE = [
  [B, [8.8, 62]],
  [B, [9, 74]],
  [B, [11.5, 81]],
  [B, [19, 86.5]],
  [B, [29, 90.5]],
  [B, [39, 93.5]],
  [A, [49, 96]],
  [A, [58, 102.5]],
  [A, [62.5, 114]],
  [A, [63.5, 130]],
  [A, [64, 146]],
  [A, [65, 162]],
  [A, [66.5, 178]],
  [A, [70, 192]],
  [A, [75.5, 208]],
  [A, [79, 228]],
  [A, [81, 246]],
  [A, [82, 258]],
  [A, [85.5, 268]],
  [A, [88, 280]],
  [A, [88, 292]],
  [A, [86, 302]],
  [A, [82.5, 308.5]],
  [A, [78, 308]],
  [A, [75, 300]],
  [A, [74, 290, 'c']],
  [A, [70, 296]],
  [A, [67, 291]],
  [A, [68, 278]],
  [A, [70.5, 266]],
  [A, [71.5, 258]],
  [A, [69.5, 244]],
  [A, [65, 224]],
  [A, [59.5, 206]],
  [A, [55, 192]],
  [A, [52, 176]],
  [A, [49, 158]],
  [A, [46.5, 142]],
  [B, [42.5, 129, 'c']],
  [B, [42.5, 142]],
  [B, [40.5, 156]],
  [B, [36.5, 169]],
  [B, [34, 182]],
  [B, [34.5, 196]],
  [B, [37, 210]],
  [B, [40, 226]],
  [B, [43, 246]],
  [B, [44, 266]],
  [B, [42.5, 290]],
  [B, [38, 314]],
  [B, [34, 330]],
  [B, [33.5, 342]],
  [B, [37, 358]],
  [B, [37.5, 376]],
  [B, [34, 396]],
  [B, [28.5, 414]],
  [B, [25, 427]],
  [B, [27, 436]],
  [B, [33.5, 442]],
  [B, [34.5, 448]],
  [B, [23, 450.5]],
  [B, [12, 449.5]],
  [B, [9.5, 443]],
  [B, [12, 430]],
  [B, [13, 414]],
  [B, [10, 394]],
  [B, [8, 372]],
  [B, [10, 354]],
  [B, [12.5, 340]],
  [B, [12, 326]],
  [B, [8.5, 300]],
  [B, [4.5, 272]],
  [B, [2, 250]],
  [B, [0, 239, 'c']],
]

function outline(variant) {
  const side = (s) =>
    OUTLINE.map(([part, p]) => {
      const [h, y] = warp(p, part, variant)
      return [100 + s * h, y, p[2] === 'c']
    })
  const right = side(1)
  const left = side(-1).reverse().slice(1) // a virilha é um ponto só
  return spline([...right, ...left], true)
}

const HEAD = [
  [0, 15],
  [10.5, 17.5],
  [16.5, 26],
  [18, 38],
  [17, 50],
  [12.5, 61],
  [5.5, 67.5],
  [0, 69],
]

const EAR = [
  [17.6, 39],
  [20.6, 38.5],
  [21, 45],
  [18.6, 51],
  [17, 50],
]

const HAIR = {
  front: {
    m: [
      [0, 13.5],
      [11.5, 16],
      [18, 25],
      [19, 37],
      [17.6, 42],
      [16.5, 33],
      [12, 27],
      [5, 25],
      [0, 26],
    ],
    f: [
      [0, 13],
      [12, 15.5],
      [18.8, 25],
      [20, 37],
      [19.4, 46],
      [17.6, 41],
      [16, 32],
      [9.5, 26.5],
      [3, 23],
      [0, 22.5],
    ],
  },
  back: {
    m: [
      [0, 13.5],
      [11.5, 16],
      [18, 25],
      [19, 38],
      [17.5, 50],
      [12, 58],
      [5, 60.5],
      [0, 61],
    ],
    f: [
      [0, 13],
      [12, 15.5],
      [18.8, 25],
      [20, 40],
      [18.5, 54],
      [13, 62],
      [5, 65],
      [0, 65.5],
    ],
  },
}

/** Coque, só na silhueta feminina. */
const BUN = [
  [0, 1.5],
  [5.5, 3.2],
  [7.5, 8.5],
  [5.5, 13.5],
  [0, 15],
]

// ── músculos ────────────────────────────────────────────────────────────────
// Cada grupo é uma lista de formas; cada forma, os pontos da metade direita.

/** Um gomo do abdominal: rectângulo de cantos redondos. */
function cell(h0, y0, h1, y1, c = 2.2) {
  return [
    [h0, y0 + c],
    [h0 + c, y0],
    [h1 - c, y0],
    [h1, y0 + c],
    [h1, y1 - c],
    [h1 - c, y1],
    [h0 + c, y1],
    [h0, y1 - c],
  ]
}

const DELT_SIDE = [
  [52, 98.6],
  [56.6, 102.8],
  [60.8, 113],
  [62, 127],
  [60.5, 138],
  [58.4, 141.5],
  [57.4, 134],
  [56.7, 124],
  [55.7, 113],
  [53.6, 104],
]

const FRONT = {
  trapezio: [
    {
      part: B,
      pts: [
        [7.8, 76],
        [9.6, 82.5],
        [18.5, 88.2],
        [29, 92],
        [35.5, 94.4],
        [24, 95.4],
        [12, 94.6],
        [7.6, 88],
      ],
    },
  ],
  ombro_frontal: [
    {
      part: A,
      pts: [
        [39.5, 97.8],
        [47.5, 97.4],
        [51.5, 103],
        [54, 113],
        [55, 127],
        [56, 140],
        [50.5, 132],
        [45.5, 121],
        [41.5, 110],
      ],
    },
  ],
  ombro_medio: [{ part: A, pts: DELT_SIDE }],
  peito: [
    {
      part: B,
      pts: {
        m: [
          [1.6, 101],
          [9, 98.8],
          [24, 98.2],
          [35, 100.2],
          [39.4, 109],
          [41, 120.5],
          [38.6, 129.5],
          [30, 134.6],
          [18, 136],
          [7.5, 134.4],
          [1.6, 129.5],
        ],
        f: [
          [1.6, 101],
          [9, 98.8],
          [24, 98.2],
          [35, 100.2],
          [39.4, 109],
          [41.6, 121],
          [40.6, 132],
          [33, 139.5],
          [20, 141.5],
          [8, 139],
          [1.6, 132],
        ],
      },
    },
  ],
  biceps: [
    {
      part: A,
      pts: [
        [49, 139],
        [52.5, 143],
        [56.5, 143.5],
        [60, 146],
        [62, 156],
        [63, 168],
        [63.5, 180],
        [61, 188],
        [57.5, 186],
        [55, 176],
        [52.2, 160],
        [49.8, 148],
      ],
    },
  ],
  abs: [
    { part: B, pts: { m: cell(1.5, 139.6, 14.8, 150.6), f: cell(1.5, 144.4, 14.8, 150.6) } },
    { part: B, pts: cell(1.5, 153.4, 15.4, 165.6) },
    { part: B, pts: cell(1.5, 168.4, 15.2, 181.4) },
    {
      part: B,
      pts: [
        [1.5, 187],
        [1.5, 185.2],
        [3.4, 184.2],
        [12.6, 184.2],
        [14.6, 185.4],
        [14.8, 196],
        [12.4, 210],
        [7.6, 222],
        [3.6, 229],
        [1.5, 229.5, 'c'],
        [1.5, 222],
      ],
    },
  ],
  adutores: [
    {
      part: B,
      pts: [
        [4, 243],
        [11, 236.4],
        [18.4, 231.6],
        [19.4, 244],
        [18, 262],
        [15.6, 282],
        [13, 298],
        [11.4, 301],
        [9.4, 292],
        [6.6, 272],
        [4, 254],
      ],
    },
  ],
  quadriceps: [
    {
      // recto femoral
      part: B,
      pts: [
        [26.5, 226.5],
        [31, 236],
        [32.6, 256],
        [32.2, 280],
        [30.2, 302],
        [27.6, 318],
        [24.6, 324],
        [21.8, 317],
        [20, 300],
        [20, 278],
        [21, 256],
        [22.4, 238],
      ],
    },
    {
      // vasto lateral
      part: B,
      pts: [
        [35.4, 228],
        [39.4, 235],
        [41.6, 250],
        [42.4, 267],
        [40.8, 290],
        [36.4, 313],
        [33, 326.5],
        [30, 325.5],
        [32, 304],
        [34, 282],
        [34.4, 258],
        [33.6, 238],
      ],
    },
    {
      // vasto medial
      part: B,
      pts: [
        [14.6, 296],
        [18, 301],
        [19.8, 315],
        [19.4, 326],
        [16, 331],
        [13.2, 326.5],
        [11.8, 314],
        [12.4, 303],
      ],
    },
  ],
}

const BACK = {
  trapezio: [
    {
      part: B,
      pts: [
        [1.5, 70],
        [6.4, 72.5],
        [9.6, 81],
        [18.5, 88],
        [29, 92],
        [37.6, 95],
        [30, 99.4],
        [20.6, 105.5],
        [13.4, 118],
        [7.6, 140],
        [1.5, 166, 'c'],
      ],
    },
  ],
  ombro_posterior: [
    {
      part: A,
      pts: [
        [33.6, 100.4],
        [40, 97.6],
        [47.5, 97.4],
        [51.5, 103],
        [54, 113],
        [55, 127],
        [56, 140],
        [49.5, 129],
        [42.6, 114],
      ],
    },
  ],
  ombro_medio: [{ part: A, pts: DELT_SIDE }],
  dorsal: [
    {
      part: B,
      pts: [
        [13.8, 127.6],
        [27, 131],
        [41, 131.6],
        [41, 143],
        [39, 156],
        [35, 169],
        [32, 180],
        [27, 190],
        [20, 196.5],
        [14.5, 186],
        [10.4, 168],
        [8.6, 150],
        [10.2, 136],
      ],
    },
  ],
  triceps: [
    {
      part: A,
      pts: [
        [49, 139],
        [53, 143.5],
        [57, 143.5],
        [60.5, 145.5],
        [62.4, 156],
        [63.6, 168],
        [64.6, 180],
        [62.5, 188],
        [58, 188],
        [55.4, 177],
        [52.4, 160],
        [49.8, 148],
      ],
    },
  ],
  lombares: [
    {
      part: B,
      pts: [
        [1.5, 173],
        [5.5, 172],
        [9.5, 178],
        [12, 192],
        [13, 204],
        [11, 212],
        [1.5, 214],
      ],
    },
  ],
  gluteo: [
    {
      part: B,
      pts: [
        [1.8, 224],
        [8.6, 216.5],
        [22, 212.4],
        [34, 214],
        [38.6, 226],
        [41.4, 242],
        [38.6, 255],
        [28, 260.5],
        [14, 260.5],
        [5.6, 256],
        [2.4, 244],
      ],
    },
  ],
  posterior_de_coxa: [
    {
      // bíceps femoral
      part: B,
      pts: [
        [23.4, 264.4],
        [37, 262.4],
        [41.6, 270],
        [40.4, 292],
        [36, 313],
        [32, 325],
        [28, 320],
        [24.6, 300],
        [23, 280],
      ],
    },
    {
      // semitendinoso e semimembranoso
      part: B,
      pts: [
        [6.6, 265],
        [21, 265],
        [21, 282],
        [21.6, 300],
        [20, 315],
        [15.8, 325],
        [13.2, 315],
        [10.4, 298],
        [7.6, 280],
      ],
    },
  ],
  gemeos: [
    {
      // cabeça medial
      part: B,
      pts: [
        [12, 349],
        [21.6, 346],
        [22.4, 364],
        [22, 384],
        [17.6, 400],
        [12.6, 393],
        [10.2, 376],
        [11, 360],
      ],
    },
    {
      // cabeça lateral
      part: B,
      pts: [
        [24.4, 346],
        [32.6, 348.5],
        [35.5, 360],
        [35.8, 375],
        [32.4, 389],
        [27.2, 396],
        [24.6, 384],
        [24.6, 364],
      ],
    },
  ],
}

// ── linhas anatómicas ───────────────────────────────────────────────────────
// Não se pintam. Abertas por omissão; `closed` fecha a forma.

const FRONT_DETAIL = [
  { part: B, pts: [[3, 98.4], [14, 96.6], [26, 96], [37.6, 95.4]] }, // clavícula
  { part: B, pts: [[7.6, 70], [5.6, 84], [2.6, 96]] }, // esternocleidomastóideo
  { part: B, pts: [[32.6, 139.6], [37.6, 136.4], [40.6, 137.6]] }, // serrátil
  { part: B, pts: [[31.6, 148], [36.6, 144.6], [39.6, 146]] },
  { part: B, pts: [[30.4, 156.4], [35, 153], [38, 154.6]] },
  { part: B, pts: [[19.4, 141], [21.4, 160], [21, 182], [19.4, 200]] }, // oblíquo
  { part: B, pts: [[35.4, 209], [26, 218.5], [14, 229], [5, 237.6]] }, // prega inguinal
  {
    part: B,
    closed: true,
    pts: [[22.6, 329], [27.4, 332.4], [27.6, 339.4], [23, 343.6], [18.6, 340], [18.2, 332.6]],
  }, // rótula
  { part: B, pts: [[25, 348], [23.6, 376], [20.6, 404], [19, 424]] }, // tíbia
  { part: B, pts: [[12.4, 352], [15, 372], [14.4, 394]] }, // gémeo, por dentro
  { part: A, pts: [[58, 193], [63, 197], [68, 194]] }, // dobra do cotovelo
  { part: A, pts: [[62.5, 199], [68.5, 222], [74.5, 250]] }, // antebraço
  { part: A, pts: [[72.6, 260.4], [81.4, 261]] }, // pulso
  { part: A, pts: [[78, 297], [79.4, 307.4]] }, // dedos
  { part: A, pts: [[81.6, 296], [83, 306.6]] },
  { part: A, pts: [[84.6, 293], [85.8, 301]] },
  { part: B, pts: [[17, 447], [17.6, 450]] }, // dedos do pé
  { part: B, pts: [[22.4, 447.6], [22.8, 450.4]] },
  { part: B, pts: [[27.6, 447.4], [28.2, 449.8]] },
]

const BACK_DETAIL = [
  {
    part: B,
    pts: [[21.4, 108], [31, 103.4], [38.4, 112], [44, 126.6], [38, 128.6], [27, 128.4], [15.6, 124.6]],
    closed: true,
  }, // infra-espinhoso e redondos
  { part: B, pts: [[24, 112], [34, 122]] },
  { part: A, pts: [[55, 147], [57, 164], [59.6, 183]] }, // cabeças do tricípite
  { part: A, pts: [[58, 192.6], [62.4, 196], [67, 193]] }, // cotovelo
  { part: A, pts: [[62.5, 201], [69, 223], [75, 250]] }, // antebraço
  { part: A, pts: [[72.6, 260.4], [81.4, 261]] }, // pulso
  { part: A, pts: [[78, 297], [79.4, 307.4]] }, // dedos
  { part: A, pts: [[81.6, 296], [83, 306.6]] },
  { part: A, pts: [[84.6, 293], [85.8, 301]] },
  { part: B, pts: [[24, 218], [31, 232], [31, 248]] }, // glúteo médio
  { part: B, pts: [[15, 334], [22.6, 337], [30.6, 334]] }, // prega do joelho
  { part: B, pts: [[17, 402], [17.6, 416], [17, 428]] }, // tendão de Aquiles
  { part: B, pts: [[26, 399], [22.6, 414], [21.6, 428]] },
  { part: B, pts: [[13.4, 440], [20, 436.6], [27.6, 440]] }, // calcanhar
]

// ── montagem ────────────────────────────────────────────────────────────────

const VARIANTS = ['m', 'f']
const pad = '      '

function muscleGroup(slug, shapes) {
  const paths = []
  for (const variant of VARIANTS) {
    for (const shape of shapes) {
      for (const d of pair(pick(shape.pts, variant), shape.part, variant)) {
        paths.push(`${pad}  <path class="gfit-v-${variant}" d="${d}"/>`)
      }
    }
  }
  return [
    `${pad}<g class="gfit-muscle" data-muscle="${slug}" fill="currentColor" fill-opacity="0">`,
    ...paths,
    `${pad}</g>`,
  ].join('\n')
}

function detailGroup(details) {
  // Um path por silhueta, com todos os traços lá dentro: são linhas, não alvos.
  const lines = VARIANTS.map((variant) => {
    const d = details
      .flatMap((detail) => pair(detail.pts, detail.part, variant, Boolean(detail.closed)))
      .join(' ')
    return `${pad}  <path class="gfit-v-${variant}" d="${d}"/>`
  })
  return [`${pad}<g class="gfit-detail">`, ...lines, `${pad}</g>`].join('\n')
}

function hairGroup(view, variant) {
  const paths = [whole(HAIR[view][variant], 'head', 'm')]
  if (variant === 'f') paths.unshift(whole(BUN, 'head', 'm'))
  return [
    `${pad}<g class="gfit-hair gfit-hair--${variant}">`,
    ...paths.map((d) => `${pad}  <path d="${d}"/>`),
    `${pad}</g>`,
  ].join('\n')
}

function view(id, title, desc, muscles, details, hairView) {
  const head = whole(HEAD, 'head', 'm')
  const ears = pair(EAR, 'head', 'm')
  const out = [
    `    <g id="${id}">`,
    `${pad}<title>${title}</title>`,
    `${pad}<desc>${desc}</desc>`,
  ]
  for (const variant of VARIANTS) {
    out.push(`${pad}<path class="gfit-shape gfit-v-${variant}" d="${outline(variant)}"/>`)
  }
  for (const [slug, shapes] of Object.entries(muscles)) out.push(muscleGroup(slug, shapes))
  for (const variant of VARIANTS) {
    out.push(`${pad}<path class="gfit-line gfit-v-${variant}" d="${outline(variant)}"/>`)
  }
  out.push(detailGroup(details))
  // A cabeça vai por cima do pescoço, com as orelhas por baixo dela.
  for (const d of ears) out.push(`${pad}<path class="gfit-shape gfit-line" d="${d}"/>`)
  out.push(`${pad}<path class="gfit-shape gfit-line" d="${head}"/>`)
  for (const variant of VARIANTS) out.push(hairGroup(hairView, variant))
  out.push('    </g>')
  return out.join('\n')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 0 440 460" class="gfit-body" role="img" aria-label="Corpo humano de frente e de costas com os grupos musculares delimitados">
  <title>Corpo humano — vista de frente e vista de costas</title>
  <desc>Silhueta anatómica em duas vistas. Cada região muscular é um grupo identificado pelo atributo data-muscle e é pintada por CSS; contorno, cabeça, mãos e pés mantêm-se neutros. Gerado por scripts/build_body.mjs — não editar à mão.</desc>
  <style>
    .gfit-body{color:var(--accent,#8a5c12)}
    .gfit-shape{fill:var(--gfit-skin,#fcfbf8)}
    .gfit-muscle{fill-opacity:var(--i,0);stroke:var(--line-2,#c9c4b8);stroke-width:.9;
      stroke-linejoin:round;transition:fill-opacity .25s ease}
    .gfit-line{fill:none;stroke:var(--line-2,#c9c4b8);stroke-width:1.5;
      stroke-linejoin:round;stroke-linecap:round}
    .gfit-shape.gfit-line{fill:var(--gfit-skin,#fcfbf8)}
    .gfit-detail{fill:none;stroke:var(--line-2,#c9c4b8);stroke-width:1;
      stroke-linecap:round;stroke-linejoin:round;opacity:.7}
    .gfit-hair{fill:var(--gfit-hair,#e7e3d9);stroke:var(--line-2,#c9c4b8);
      stroke-width:1.2;stroke-linejoin:round}
    .gfit-v-f{display:none}
    .gfit-body--fem .gfit-v-m{display:none}
    .gfit-body--fem .gfit-v-f{display:inline}
    .gfit-hair--f{display:none}
    .gfit-body--fem .gfit-hair--m{display:none}
    .gfit-body--fem .gfit-hair--f{display:inline}
    .gfit-body--nohair .gfit-hair{display:none}
    .gfit-body--sm .gfit-muscle{stroke-width:1.4}
    .gfit-body--sm .gfit-line{stroke-width:2.4}
    .gfit-body--sm .gfit-detail{display:none}
    .gfit-body--sm .gfit-hair{stroke-width:1.8}
  </style>
  <g transform="translate(0 0)">
${view(
  'body-front',
  'Vista de frente',
  'Peito, abdominais, bíceps, deltoides anterior e lateral, trapézio, quadríceps e adutores.',
  FRONT,
  FRONT_DETAIL,
  'front',
)}
  </g>
  <g transform="translate(220 0)">
${view(
  'body-back',
  'Vista de costas',
  'Dorsal, trapézio, deltoides posterior e lateral, tríceps, lombares, glúteo, posterior de coxa e gémeos.',
  BACK,
  BACK_DETAIL,
  'back',
)}
  </g>
</svg>
`

writeFileSync(OUT, svg)
console.log(`${OUT}: ${svg.length} bytes`)
