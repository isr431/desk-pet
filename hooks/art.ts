// Desk Pet pixel art: five pets, one frame builder per reaction, and the two
// encoders (terminal half-block cells, desktop animated SVG). Pure data and
// math, no engine calls, so it also runs under plain Node for previews.
//
// Pets are authored without outlines; every pet layer, arm layer and prop is
// outlined automatically, which keeps silhouettes crisp at any pose.

export const W = 48
export const H = 24

export type PetId = 'axolotl' | 'quokka' | 'robot' | 'dog' | 'cat'

export type Kind =
  | 'idle'
  | 'still'
  | 'wake'
  | 'read'
  | 'edit'
  | 'shell'
  | 'search'
  | 'pass'
  | 'fail'
  | 'bored'
  | 'wave'
  | 'finish'
  | 'tidy'

export type Frame = Uint32Array

export type Anim = { frames: Frame[]; frameMs: number; loop: boolean }

type Px = readonly [number, number, string]
type Arm = 'rest' | 'up' | 'wave' | 'out' | 'outUp' | 'tap' | 'hold' | 'lift'
type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'left' | 'right' | 'down'
type Mouth = 'none' | 'smile' | 'open' | 'yawn'

type Pose = {
  dx?: number
  dy?: number
  flip?: boolean
  squash?: boolean
  eyes?: Eyes
  mouth?: Mouth
  armL?: Arm
  armR?: Arm
  part?: number
}

type PetDef = {
  name: string
  sprite: readonly string[]
  palette: Readonly<Record<string, number>>
  /** Top-left pixel of each 2x3 eye, in sprite coordinates. */
  eyes: readonly [readonly [number, number], readonly [number, number]]
  /** Which palette entries draw an eye: its dark, its iris and its glint. */
  eyeInk: { readonly k: string; readonly i: string; readonly w: string }
  mouths: Readonly<Record<Exclude<Mouth, 'none'>, readonly Px[]>>
  defaultMouth: Mouth
  /** Two takes of the pet's signature motion (gills, tail, antenna). */
  parts: readonly [readonly Px[], readonly Px[]]
  /** Drawn over the outline (whiskers). */
  decor: readonly Px[]
  edit: 'hammer' | 'knit'
  gift: 'trophy' | 'envelope'
  dance: 'sway' | 'hop' | 'flip'
  book: number
  yarn: readonly [number, number]
}

// Shared prop colors.
const C = {
  white: 0xffffff,
  paper: 0xfff8e8,
  ink: 0x9aa3b0,
  spine: 0xd8cfbd,
  gray: 0x9aa0a6,
  lgray: 0xd0d5db,
  dgray: 0x4a4f57,
  outline: 0x24272c,
  black: 0x111316,
  wood: 0xb07a45,
  lwood: 0xd39b62,
  dwood: 0x6b4423,
  steel: 0x6d7580,
  lsteel: 0xb9c1cb,
  gold: 0xf5c542,
  dgold: 0xa8770c,
  lgold: 0xfff2a8,
  red: 0xe5484d,
  dred: 0x8e1f24,
  rose: 0xf06292,
  green: 0x3ddc84,
  dgreen: 0x23784a,
  grass: 0x4caf50,
  blue: 0x4f9dff,
  lblue: 0xa8d4ff,
  sky: 0x7cc4ff,
  sand: 0xe9c97a,
  dsand: 0xb8934a,
  lsand: 0xf6e2a8,
  box: 0xc8955a,
  lbox: 0xe2b57e,
  tape: 0x8a5a2b,
  dbox: 0x6e4724,
  orange: 0xff9f1c,
  purple: 0xa970ff,
  yellow: 0xffe066,
  rock: 0x8a9099,
  lrock: 0xb9bec6,
  drock: 0x5f656e,
  sweat: 0x7cc4ff,
}

const mirror = (px: readonly Px[]): Px[] => px.map(([x, y, c]) => [17 - x, y, c] as const)

const gills = (fronds: readonly (readonly [number, number])[][]): Px[] => {
  const left: Px[] = fronds.flat().map(([x, y], i) => [x, y, i % 3 === 2 ? 'P' : 'p'] as const)

  return [...left, ...mirror(left)]
}

export const PETS: Readonly<Record<PetId, PetDef>> = {
  axolotl: {
    name: 'Axolotl',
    sprite: [
      '......bbbbbb......',
      '....bbhhhhbbbb....',
      '...bhhhbbbbbbbb...',
      '..bhhbbbbbbbbbbs..',
      '..bhbbbbbbbbbbbs..',
      '.bbbbbbbbbbbbbbbs.',
      '.bbbbbbbbbbbbbbbs.',
      '.bbbbbbbbbbbbbbbs.',
      '.bppbbbbbbbbbppbs.',
      '..bbbbbbbbbbbbbs..',
      '...bbbbbbbbbbbs...',
      '....sbbbbbbbbs....',
      '....bbllllllbb....',
      '...bbllllllllbs...',
      '...bbllllllllbs...',
      '...bbllllllllbs...',
      '....bbllllllbs....',
      '...bbb.....bbb....',
    ],
    palette: {
      o: 0x8a2f55, b: 0xf6a9c7, s: 0xe383aa, h: 0xffd3e4, l: 0xffe8f0,
      p: 0xff6fa5, P: 0xd93c78, m: 0x9b2f57, k: 0x2a1420, w: 0xffffff,
    },
    eyes: [[4, 5], [12, 5]],
    eyeInk: { k: 'k', i: 'k', w: 'w' },
    mouths: {
      smile: [[6, 9, 'm'], [7, 10, 'm'], [8, 10, 'm'], [9, 10, 'm'], [10, 10, 'm'], [11, 9, 'm']],
      open: [[7, 10, 'm'], [8, 10, 'm'], [9, 10, 'm'], [10, 10, 'm'], [8, 11, 'p'], [9, 11, 'p']],
      yawn: [[7, 9, 'm'], [8, 9, 'm'], [9, 9, 'm'], [10, 9, 'm'], [7, 10, 'm'], [8, 10, 'P'], [9, 10, 'P'], [10, 10, 'm'], [8, 11, 'm'], [9, 11, 'm']],
    },
    defaultMouth: 'smile',
    parts: [
      [
        ...gills([[[1, 3], [0, 2], [-1, 1]], [[0, 5], [-1, 5], [-2, 4]], [[0, 7], [-1, 8], [-2, 8]]]),
        [14, 14, 's'], [15, 14, 's'], [16, 13, 's'], [17, 13, 's'], [18, 12, 'h'],
      ],
      [
        ...gills([[[1, 3], [0, 2], [-1, 2]], [[0, 5], [-1, 6], [-2, 6]], [[0, 7], [-1, 7], [-2, 7]]]),
        [14, 14, 's'], [15, 15, 's'], [16, 15, 's'], [17, 15, 's'], [18, 14, 'h'],
      ],
    ],
    decor: [],
    edit: 'knit',
    gift: 'trophy',
    dance: 'sway',
    book: 0x4f9dff,
    yarn: [0x2ec4b6, 0x9be7df],
  },
  quokka: {
    name: 'Quokka',
    sprite: [
      '..bbb........bbb..',
      '.bbpbb......bbpbb.',
      '.bbpbbbbbbbbbbpbb.',
      '..bbbhhbbbbbbbbs..',
      '..bhhbbbbbbbbbbs..',
      '.bbbbbbbbbbbbbbbs.',
      '.bbbbbbbbbbbbbbbs.',
      '.bbbbbbllllbbbbbs.',
      '.bbbbbllllllbbbbs.',
      '..bbblllkklllbbs..',
      '...bbllllllllbs...',
      '....sbbbbbbbbs....',
      '....bbllllllbb....',
      '...bbllllllllbs...',
      '..bbbllllllllbbs..',
      '..bbbllllllllbbs..',
      '...bbbllllllbbs...',
      '...bbb.....bbb....',
    ],
    palette: {
      o: 0x4a321e, b: 0xb98a5c, s: 0x936a43, h: 0xd9b083, l: 0xf0dcbc,
      p: 0xe9a3a3, m: 0x5a3d26, k: 0x22160d, w: 0xffffff,
    },
    eyes: [[4, 5], [12, 5]],
    eyeInk: { k: 'k', i: 'k', w: 'w' },
    mouths: {
      smile: [[6, 9, 'm'], [7, 10, 'm'], [8, 10, 'm'], [9, 10, 'm'], [10, 10, 'm'], [11, 9, 'm']],
      open: [[7, 10, 'm'], [8, 10, 'm'], [9, 10, 'm'], [10, 10, 'm'], [8, 11, 'p'], [9, 11, 'p']],
      yawn: [[7, 10, 'k'], [8, 10, 'k'], [9, 10, 'k'], [10, 10, 'k'], [7, 11, 'k'], [8, 11, 'p'], [9, 11, 'p'], [10, 11, 'k']],
    },
    defaultMouth: 'smile',
    parts: [
      [[15, 15, 's'], [16, 16, 's']],
      [[15, 15, 's'], [16, 15, 's'], [15, 0, '_'], [14, 0, '_'], [16, 1, 'b']],
    ],
    decor: [],
    edit: 'hammer',
    gift: 'trophy',
    dance: 'hop',
    book: 0x3ddc84,
    yarn: [0xe85d8a, 0xf7a1c0],
  },
  robot: {
    name: 'Tiny robot',
    sprite: [
      '..................',
      '........ss........',
      '...ssssssssssss...',
      '..sbbbbbbbbbbbbs..',
      '..sbllllllllllbs..',
      '..sbllllllllllbs..',
      '.ksbllllllllllbsk.',
      '..sbllllllllllbs..',
      '..sbllllllllllbs..',
      '..sbbbbbbbbbbbbs..',
      '..ssssssssssssss..',
      '......ssssss......',
      '....sbbbbbbbbs....',
      '...sbbbqqqqbbbs...',
      '...sbbbqqqqbbbs...',
      '...sbbbbbbbbbbs...',
      '....sbbbbbbbbs....',
      '....ss......ss....',
    ],
    palette: {
      o: 0x2c333c, b: 0xc7d0da, s: 0x8794a3, h: 0xeef3f8, l: 0x18222d,
      e: 0x5ff0e0, r: 0xff5a5a, R: 0x7a2a2a, q: 0x9dff6a, Q: 0x3c6a2a,
      k: 0x3a4250, w: 0xffffff,
    },
    eyes: [[6, 4], [10, 4]],
    eyeInk: { k: 'e', i: 'e', w: 'w' },
    mouths: {
      smile: [[7, 8, 'e'], [8, 8, 'e'], [9, 8, 'e'], [10, 8, 'e']],
      open: [[8, 7, 'e'], [9, 7, 'e'], [7, 8, 'e'], [8, 8, 'e'], [9, 8, 'e'], [10, 8, 'e']],
      yawn: [[7, 7, 'e'], [8, 7, 'e'], [9, 7, 'e'], [10, 7, 'e'], [7, 8, 'e'], [8, 8, 'e'], [9, 8, 'e'], [10, 8, 'e']],
    },
    defaultMouth: 'smile',
    parts: [
      [[8, 0, 'r'], [9, 0, 'r'], [7, 13, 'q'], [8, 13, 'Q'], [9, 14, 'q'], [10, 14, 'Q']],
      [[8, 0, 'R'], [9, 0, 'R'], [7, 13, 'Q'], [8, 13, 'q'], [9, 14, 'Q'], [10, 14, 'q']],
    ],
    decor: [],
    edit: 'hammer',
    gift: 'trophy',
    dance: 'flip',
    book: 0xa970ff,
    yarn: [0xe85d8a, 0xf7a1c0],
  },
  dog: {
    name: 'Dog',
    sprite: [
      '.....bbbbbbbb.....',
      '...bbhhhbbbbbbb...',
      '.ssbhhbbbbbbbbbss.',
      'ssssbbbbbbbbbbssss',
      'ssssbbbbbbbbbbssss',
      'ssssbbbbbbbbbbssss',
      'sssbbbbbbbbbbbbsss',
      '.ssbbbllllllbbbss.',
      '.ss.bbllkkllbb.ss.',
      '.....bllllllb.....',
      '......rryyrr......',
      '.....bbbbbbbb.....',
      '....bbbllllbbb....',
      '...bbbllllllbbb...',
      '...bbbllllllbbb...',
      '...bbbllllllbbb...',
      '....bbbllllbbb....',
      '...bbb.....bbb....',
    ],
    palette: {
      o: 0x5a3a1c, b: 0xe2b26e, s: 0x9a6534, h: 0xf3d09c, l: 0xfdf0dc,
      p: 0xf27c8c, k: 0x2b1e14, m: 0x5a3a1c, r: 0xd9443a, y: 0xf5c542, w: 0xffffff,
    },
    eyes: [[5, 4], [11, 4]],
    eyeInk: { k: 'k', i: 'k', w: 'w' },
    mouths: {
      smile: [[7, 9, 'm'], [10, 9, 'm']],
      open: [[7, 9, 'm'], [8, 9, 'm'], [9, 9, 'm'], [10, 9, 'm'], [8, 10, 'p'], [9, 10, 'p'], [8, 11, 'p']],
      yawn: [[7, 9, 'k'], [8, 9, 'k'], [9, 9, 'k'], [10, 9, 'k'], [8, 10, 'p'], [9, 10, 'p']],
    },
    defaultMouth: 'smile',
    parts: [
      [[15, 13, 'b'], [16, 12, 'b'], [17, 11, 'b'], [17, 10, 'h']],
      [[15, 13, 'b'], [16, 13, 'b'], [17, 14, 'b'], [18, 14, 'h']],
    ],
    decor: [],
    edit: 'hammer',
    gift: 'envelope',
    dance: 'hop',
    book: 0xe5484d,
    yarn: [0x5b7cff, 0xaebcff],
  },
  cat: {
    name: 'Cat',
    sprite: [
      '..b............b..',
      '..bb..........bb..',
      '..bpb........bpb..',
      '..bppbbbbbbbbppb..',
      '..bbbbbbssbbbbbb..',
      '.bsbbbbbbbbbbbbsb.',
      '.bbbbbbbbbbbbbbbb.',
      '.bsbbbbbbbbbbbbsb.',
      '.bbbbbbllllbbbbbb.',
      '..bbbbllppllbbbb..',
      '...bbbllllllbbb...',
      '.....bbbbbbbb.....',
      '....bbbllllbbb....',
      '...bbbllllllbbb...',
      '...bsbllllllbsb...',
      '...bbbllllllbbb...',
      '....bbbllllbbb....',
      '...bbb.....bbb....',
    ],
    palette: {
      o: 0x6a3510, b: 0xf2a154, s: 0xc96f22, h: 0xffc27f, l: 0xfde8cf,
      p: 0xf59fb0, k: 0x2a1a10, m: 0x8a4a1c, g: 0x7ccf4a, W: 0xfff4e6, w: 0xffffff,
    },
    eyes: [[4, 5], [12, 5]],
    eyeInk: { k: 'k', i: 'g', w: 'w' },
    mouths: {
      smile: [[7, 10, 'm'], [8, 11, 'm'], [9, 11, 'm'], [10, 10, 'm']],
      open: [[7, 10, 'm'], [8, 10, 'm'], [9, 10, 'm'], [10, 10, 'm'], [8, 11, 'p'], [9, 11, 'p']],
      yawn: [[7, 10, 'k'], [8, 10, 'k'], [9, 10, 'k'], [10, 10, 'k'], [8, 11, 'p'], [9, 11, 'p']],
    },
    defaultMouth: 'smile',
    parts: [
      [[15, 15, 'b'], [16, 14, 'b'], [17, 13, 'b'], [17, 12, 'b'], [17, 11, 's'], [16, 10, 's']],
      [[15, 15, 'b'], [16, 15, 'b'], [17, 14, 'b'], [18, 13, 'b'], [18, 12, 's'], [18, 11, 's']],
    ],
    decor: [[-1, 9, 'W'], [-2, 9, 'W'], [-1, 11, 'W'], [-2, 12, 'W'], [18, 9, 'W'], [19, 9, 'W'], [18, 11, 'W'], [19, 12, 'W']],
    edit: 'knit',
    gift: 'envelope',
    dance: 'sway',
    book: 0x2ec4b6,
    yarn: [0x5b7cff, 0xaebcff],
  },
}

export const PET_IDS = Object.keys(PETS) as PetId[]

// --- Canvas ---------------------------------------------------------------

const OPAQUE = 0x1000000

class Canvas {
  readonly px = new Uint32Array(W * H)

  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.px[y * W + x]!
  }

  set(x: number, y: number, rgb: number): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    this.px[y * W + x] = rgb < 0 ? 0 : OPAQUE | rgb
  }

  rect(x: number, y: number, w: number, h: number, rgb: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, rgb)
  }

  stamp(x: number, y: number, rows: readonly string[], pal: Readonly<Record<string, number>>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!
        if (ch !== '.' && pal[ch] !== undefined) this.set(x + i, y + j, pal[ch]!)
      }
    })
  }

  /** Rings every filled pixel with `rgb` where it borders empty space. */
  outline(rgb: number): this {
    const ring: number[] = []
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y)) continue
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) ring.push(y * W + x)
      }
    }
    for (const i of ring) this.px[i] = OPAQUE | rgb

    return this
  }

  over(top: Canvas): this {
    top.px.forEach((v, i) => {
      if (v) this.px[i] = v
    })

    return this
  }
}

/** Draws something on its own layer, outlines it, and lays it over `c`. */
function outlined(c: Canvas, rgb: number, draw: (layer: Canvas) => void): void {
  const layer = new Canvas()
  draw(layer)
  c.over(layer.outline(rgb))
}

// --- Pets -----------------------------------------------------------------

const PET_X = 3
const PET_Y = 4
const FEET_ROW = 16
const SHOULDERS: readonly [readonly [number, number], readonly [number, number]] = [[2, 13], [15, 13]]

const ARM_PATHS: Record<Arm, (sx: number, sy: number, d: number) => [number, number][]> = {
  rest: (sx, sy) => [[sx, sy], [sx, sy + 1], [sx, sy + 2]],
  up: (sx, sy, d) => [[sx, sy], [sx + d, sy - 1], [sx + d, sy - 2], [sx + d, sy - 3], [sx + d, sy - 4]],
  wave: (sx, sy, d) => [[sx, sy], [sx + d, sy - 1], [sx + 2 * d, sy - 2], [sx + 3 * d, sy - 3], [sx + 3 * d, sy - 4]],
  out: (sx, sy, d) => [[sx, sy], [sx + d, sy], [sx + 2 * d, sy], [sx + 3 * d, sy]],
  outUp: (sx, sy, d) => [[sx, sy], [sx + d, sy - 1], [sx + 2 * d, sy - 1], [sx + 3 * d, sy - 2]],
  tap: (sx, sy, d) => [[sx, sy], [sx, sy + 1], [sx - d, sy + 2], [sx - 2 * d, sy + 3]],
  hold: (sx, sy, d) => [[sx, sy], [sx - d, sy + 1], [sx - 2 * d, sy + 1], [sx - 3 * d, sy + 1]],
  lift: (sx, sy, d) => [[sx, sy], [sx, sy - 1], [sx - d, sy - 2], [sx - d, sy - 3], [sx - 2 * d, sy - 4]],
}

/** Where a pet's sprite pixel lands on the canvas for a pose. */
function place(pose: Pose, x: number, y: number): [number, number] {
  const sx = pose.flip ? 17 - x : x
  const sy = pose.squash && y < FEET_ROW ? y + 1 : y

  return [PET_X + (pose.dx ?? 0) + sx, PET_Y + (pose.dy ?? 0) + sy]
}

/** The canvas position of an arm's paw. */
function paw(pose: Pose, side: 0 | 1): [number, number] {
  const arm = (side === 0 ? pose.armL : pose.armR) ?? 'rest'
  const [sx, sy] = SHOULDERS[side]!
  const path = ARM_PATHS[arm](sx, sy, side === 0 ? -1 : 1)
  const [x, y] = path[path.length - 1]!

  return place(pose, x, y)
}

function drawEye(put: (x: number, y: number, ch: string) => void, pet: PetDef, ex: number, ey: number, eyes: Eyes, outward: number): void {
  const { k, i, w } = pet.eyeInk
  const open = (x: number) => {
    put(x, ey, k)
    put(x + 1, ey, w)
    put(x, ey + 1, i)
    put(x + 1, ey + 1, k)
    put(x, ey + 2, k)
    put(x + 1, ey + 2, k)
  }
  switch (eyes) {
    case 'open':
      return open(ex)
    case 'left':
      return open(ex - 1)
    case 'right':
      return open(ex + 1)
    case 'closed':
      put(ex - 1, ey + 1, k)
      put(ex, ey + 2, k)
      put(ex + 1, ey + 2, k)
      put(ex + 2, ey + 1, k)
      return
    case 'happy':
      put(ex - 1, ey + 2, k)
      put(ex, ey + 1, k)
      put(ex + 1, ey + 1, k)
      put(ex + 2, ey + 2, k)
      return
    case 'wide':
      put(ex - outward, ey, w)
      open(ex)
      put(ex - outward, ey + 1, w)
      put(ex - outward, ey + 2, w)
      return
    case 'down':
      put(ex, ey + 1, 's')
      put(ex + 1, ey + 1, 's')
      put(ex, ey + 2, k)
      put(ex + 1, ey + 2, k)
      return
  }
}

function drawPet(c: Canvas, pet: PetDef, pose: Pose): void {
  const pal = pet.palette
  const putOn = (layer: Canvas) => (x: number, y: number, ch: string) => {
    const rgb = ch === '_' ? -1 : pal[ch]
    if (rgb === undefined) return
    const [cx, cy] = place(pose, x, y)
    layer.set(cx, cy, rgb)
  }

  outlined(c, pal.o!, body => {
    const put = putOn(body)
    pet.sprite.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') put(x, y, row[x]!)
    })
    for (const [x, y, ch] of pet.parts[(pose.part ?? 0) % 2]!) put(x, y, ch)
  })

  const put = putOn(c)
  for (const [x, y, ch] of pet.decor) put(x, y, ch)
  pet.eyes.forEach(([ex, ey], side) => drawEye(put, pet, ex, ey, pose.eyes ?? 'open', side === 0 ? -1 : 1))
  const mouth = pose.mouth ?? pet.defaultMouth
  if (mouth !== 'none') for (const [x, y, ch] of pet.mouths[mouth]) put(x, y, ch)

  outlined(c, pal.o!, arms => {
    const put = putOn(arms)
    ;([0, 1] as const).forEach(side => {
      const arm = (side === 0 ? pose.armL : pose.armR) ?? 'rest'
      const [sx, sy] = SHOULDERS[side]!
      const path = ARM_PATHS[arm](sx, sy, side === 0 ? -1 : 1)
      path.forEach(([x, y], i) => put(x, y, i === path.length - 1 ? 'h' : 'b'))
    })
  })
}

// --- Props ----------------------------------------------------------------

const BOOK = [
  '.wwwwwddwwwww.',
  'cwgggwddwgggwc',
  'cwwwwwddwwwwwc',
  'cwggwwddwggwwc',
  'cwwwwwddwwwwwc',
  'cwgggwddwggwwc',
  'cccccccccccccc',
]
const BOOK_ALT = [
  '.wwwwwddwwwww.',
  'cwggwwddwgggwc',
  'cwwwwwddwwwwwc',
  'cwgggwddwggwwc',
  'cwwwwwddwwwwwc',
  'cwggwwddwgggwc',
  'cccccccccccccc',
]
const TROPHY = [
  '..yyyyyyy..',
  'yyyhyyyyyyy',
  'y.yhyyyyy.y',
  'y.yhyyyyy.y',
  '.yyyyyyyyy.',
  '...yyyyy...',
  '....yyy....',
  '.....y.....',
  '....ddd....',
  '..ddddddd..',
]
const ENVELOPE = [
  'wwwwwwwwwww',
  'wgwwwwwwwgw',
  'wwgwwwwwgww',
  'wwwgwwwgwww',
  'wwwrrwrrwww',
  'wwwrrrrrwww',
  'wwwwrrrwwww',
  'wwwwwrwwwww',
]
const HEART = ['rr.rr', 'rrrrr', '.rrr.', '..r..']
const BOX = ['CCCCCCC', 'CCCdCCC', 'cccdccc', 'cccdccc', 'ccccccc', 'ccccccc']
const BUBBLE = [
  '.wwwwwww.',
  'wwwwowwww',
  'wwwwowwww',
  'wwwwowwww',
  'wwwwowwww',
  'wwwwwwwww',
  'wwwwowwww',
  '.wwwwwww.',
  '..ww.....',
  '.w.......',
]
const ROCK = [
  '........hhhhhh........',
  '.....hhhhgggggghh.....',
  '...hhhgggggggggggggd..',
  '..hhggggggggggggggggd.',
  '.hggggggggggggggggggdd',
  'hggggggggggggggggggddd',
  'gggggggggggggggggggddd',
  'ggggggggggggggggggdddd',
  'ggggggggggggggggdddddd',
]
const CHECK = ['......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....']
const CROSS = ['r...r', 'rr.rr', '.rrr.', 'rr.rr', 'r...r']
const QUESTION = ['.qqq.', 'q...q', '...q.', '..q..', '.....', '..q..']
const Z_SMALL = ['zzz', '.z.', 'zzz']
const Z_BIG = ['zzzz', '..z.', '.z..', 'zzzz']
const YARN = [
  ['.yyy.', 'yYyyy', 'yyYyy', 'yyyYy', '.yyy.'],
  ['.yyy.', 'yyyYy', 'yyYyy', 'yYyyy', '.yyy.'],
  ['.yYy.', 'yyYyy', 'yyYyy', 'yyYyy', '.yYy.'],
]
const CODE_LINES = [
  [2, 7, 0], [4, 5, 1], [4, 8, 2], [2, 3, 0], [2, 9, 3], [4, 6, 1], [6, 5, 2], [2, 4, 0], [4, 8, 3], [2, 6, 1],
] as const

function sparkle(c: Canvas, x: number, y: number, isBig: boolean, rgb = C.lgold): void {
  c.set(x, y, C.white)
  c.set(x - 1, y, rgb)
  c.set(x + 1, y, rgb)
  c.set(x, y - 1, rgb)
  c.set(x, y + 1, rgb)
  if (isBig) {
    c.set(x - 2, y, rgb)
    c.set(x + 2, y, rgb)
    c.set(x, y - 2, rgb)
    c.set(x, y + 2, rgb)
  }
}

function zzz(c: Canvas, step: number): void {
  const z = { z: C.lblue }
  if (step >= 0) outlined(c, C.outline, l => l.stamp(25, 7, Z_SMALL, z))
  if (step >= 1) outlined(c, C.outline, l => l.stamp(29, 4, Z_SMALL, z))
  if (step >= 2) outlined(c, C.outline, l => l.stamp(33, 0, Z_BIG, z))
}

function badge(c: Canvas, kind: 'check' | 'cross' | 'question' | 'bang', x: number, y: number): void {
  if (kind === 'check') outlined(c, C.dgreen, l => l.stamp(x, y, CHECK, { g: C.green }))
  if (kind === 'cross') outlined(c, C.dred, l => l.stamp(x, y, CROSS, { r: C.red }))
  if (kind === 'question') outlined(c, C.outline, l => l.stamp(x, y, QUESTION, { q: C.yellow }))
}

function confetti(c: Canvas, f: number): void {
  const colors = [C.red, C.gold, C.green, C.blue, C.purple, C.rose, C.orange]
  for (let i = 0; i < 26; i++) {
    const x = (i * 11 + 5) % W
    const speed = 1 + (i % 3)
    const y = ((i * 7 + f * speed) % (H + 6)) - 3
    const rgb = colors[i % colors.length]!
    c.set(x, y, rgb)
    if (i % 2 === 0) c.set(x + ((f + i) % 2 === 0 ? 1 : 0), y + ((f + i) % 2 === 0 ? 0 : 1), rgb)
  }
}

// --- Room -----------------------------------------------------------------

export type DayPhase = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export const DAY_PHASES: readonly DayPhase[] = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night']

/** The part of the day at a local clock time, in hours since midnight. */
export function dayPhase(hours: number): DayPhase {
  if (hours >= 5 && hours < 7) return 'dawn'
  if (hours >= 7 && hours < 11) return 'morning'
  if (hours >= 11 && hours < 14) return 'noon'
  if (hours >= 14 && hours < 17) return 'afternoon'
  if (hours >= 17 && hours < 20) return 'evening'

  return 'night'
}

/** The room's own colors in full daylight; each phase's light tints them. */
const ROOM_COLORS = {
  wallTop: 0x6f88ad,
  wall: 0x7891b5,
  wallLow: 0x809abd,
  dot: 0x93accd,
  frame: 0xd2a878,
  frameDark: 0x9c7650,
  curtain: 0xeee3cf,
  curtainFold: 0xc9b89c,
  rod: 0x6b4a2e,
  cord: 0x2e3340,
  shade: 0x55607a,
  shadeRim: 0x7a86a0,
  baseboard: 0x4d5875,
  floor: 0xb98257,
  floorLight: 0xc68e60,
  seam: 0x8f5e3a,
  rug: 0xd0607a,
  rugEdge: 0xe8889b,
}

type Rgb = readonly [number, number, number]

type Sky = {
  /** Four bands of sky, top to horizon, two rows each. */
  bands: readonly [number, number, number, number]
  hills: readonly [far: number, near: number]
  /** The light falling on the whole room, as a multiplier per channel. */
  ambient: Rgb
  /** How brightly the pendant lamp is lit, 0 for off. */
  lamp: number
  sun?: { x: number; y: number; r: number; core: number; glow: number }
  moon?: { x: number; y: number }
  stars?: { at: readonly (readonly [number, number])[]; rgb: number }
  clouds?: readonly { x: number; y: number; w: number; rgb: number; shade: number }[]
  /** Lit windows of a house on the far hill. */
  houseLights?: number
  /** Sunlight through the window onto the floor: its slant, how deep it reaches and its color. */
  beam?: { skew: number; rows: number; light: Rgb }
}

const SKIES: Readonly<Record<DayPhase, Sky>> = {
  dawn: {
    bands: [0x3c3f7a, 0x8a6fae, 0xe89aa0, 0xffc28a],
    hills: [0x6a5a88, 0x47406c],
    ambient: [0.74, 0.64, 0.74],
    lamp: 0.3,
    sun: { x: 36, y: 8, r: 2, core: 0xffe2a4, glow: 0xffad72 },
    stars: { at: [[35, 3], [43, 4], [41, 3]], rgb: 0xc9c6f0 },
    clouds: [{ x: 40, y: 5, w: 4, rgb: 0xf8b9b0, shade: 0xd48c9c }],
    houseLights: 0xffd58a,
    beam: { skew: 2, rows: 5, light: [0.24, 0.14, 0.12] },
  },
  morning: {
    bands: [0x5aa8ec, 0x7dbcf2, 0xa4d2f6, 0xcfe8f7],
    hills: [0x86bf8e, 0x5f9f6b],
    ambient: [0.98, 0.96, 0.9],
    lamp: 0,
    sun: { x: 35, y: 4, r: 1, core: 0xfff6c2, glow: 0xffe37e },
    clouds: [
      { x: 40, y: 4, w: 5, rgb: 0xffffff, shade: 0xdbe9f5 },
      { x: 34, y: 7, w: 4, rgb: 0xf4f9ff, shade: 0xd2e3f2 },
    ],
    beam: { skew: 1, rows: 4, light: [0.26, 0.24, 0.16] },
  },
  noon: {
    bands: [0x3b8fe0, 0x52a3ea, 0x6fb6f0, 0x93caf4],
    hills: [0x72b77a, 0x4e995b],
    ambient: [1.04, 1.04, 1.02],
    lamp: 0,
    sun: { x: 42, y: 4, r: 1, core: 0xffffe6, glow: 0xfff191 },
    clouds: [{ x: 34, y: 4, w: 4, rgb: 0xffffff, shade: 0xd8e8f6 }],
    beam: { skew: 0, rows: 2, light: [0.3, 0.3, 0.24] },
  },
  afternoon: {
    bands: [0x4f97d8, 0x78b0e0, 0xb2cbd8, 0xf0d6a2],
    hills: [0x93ad62, 0x6f8f4a],
    ambient: [1.0, 0.92, 0.8],
    lamp: 0,
    sun: { x: 43, y: 7, r: 1, core: 0xfff2b4, glow: 0xffcb5c },
    clouds: [{ x: 35, y: 4, w: 4, rgb: 0xfff5e2, shade: 0xe6cfae }],
    beam: { skew: -1, rows: 4, light: [0.36, 0.25, 0.1] },
  },
  evening: {
    bands: [0x4b3a78, 0xa04f7c, 0xec7a58, 0xffb25a],
    hills: [0x5c3559, 0x3b2242],
    ambient: [0.74, 0.54, 0.54],
    lamp: 0.6,
    sun: { x: 37, y: 8, r: 2, core: 0xffd870, glow: 0xff8a3c },
    clouds: [{ x: 40, y: 4, w: 5, rgb: 0xf59aa0, shade: 0xc0688a }],
    houseLights: 0xffcf7a,
    beam: { skew: 2, rows: 5, light: [0.38, 0.16, 0.06] },
  },
  night: {
    bands: [0x131a40, 0x18204a, 0x1d2757, 0x243168],
    hills: [0x1c2448, 0x111733],
    ambient: [0.34, 0.33, 0.44],
    lamp: 0.85,
    moon: { x: 42, y: 4 },
    stars: { at: [[34, 3], [37, 4], [35, 7], [43, 7], [44, 4], [37, 8], [42, 5]], rgb: 0xe8ecff },
    houseLights: 0xffd27a,
  },
}

// The window: its frame, the glass inside it and the bars across it.
const WIN = { x: 33, y: 2, w: 13, h: 10 } as const
const GLASS = { x: WIN.x + 1, y: WIN.y + 1, w: WIN.w - 2, h: WIN.h - 2 } as const
const BAR_X = GLASS.x + 5
const BAR_Y = GLASS.y + 3
const FAR_HILL = [2, 2, 2, 1, 1, 1, 2, 2, 2, 1, 1]
const NEAR_HILL = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
const LAMP = { x: 27, y: 4 } as const
const LAMP_GLOW: Rgb = [1, 0.78, 0.5]

const channels = (rgb: number): Rgb => [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff]
const pack = (r: number, g: number, b: number) => {
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

  return (byte(r) << 16) | (byte(g) << 8) | byte(b)
}

/** `a` moved `t` of the way to `b`. */
function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = channels(a)
  const [br, bg, bb] = channels(b)

  return pack(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

const isGlass = (x: number, y: number) =>
  x >= GLASS.x && x < GLASS.x + GLASS.w && y >= GLASS.y && y < GLASS.y + GLASS.h && x !== BAR_X && y !== BAR_Y

/** The view through the window: sky, sun or moon, clouds and two rows of hills. */
function drawView(c: Canvas, sky: Sky): void {
  const bottom = GLASS.y + GLASS.h - 1
  for (let y = GLASS.y; y <= bottom; y++) c.rect(GLASS.x, y, GLASS.w, 1, sky.bands[Math.min(3, (y - GLASS.y) >> 1)]!)
  const tint = (x: number, y: number, rgb: number, t: number) => c.set(x, y, mix(c.get(x, y) & 0xffffff, rgb, t))

  for (const [x, y] of sky.stars?.at ?? []) c.set(x, y, sky.stars!.rgb)
  if (sky.sun) {
    const { x: sx, y: sy, r, core, glow } = sky.sun
    for (let y = sy - r - 1; y <= sy + r + 1; y++) {
      for (let x = sx - r - 1; x <= sx + r + 1; x++) {
        const d = Math.hypot(x - sx, y - sy)
        if (d <= r + 0.2) c.set(x, y, d < 0.5 || d <= r - 0.8 ? mix(core, 0xffffff, 0.4) : core)
        else if (d <= r + 1.2) tint(x, y, glow, 0.4)
      }
    }
  }
  if (sky.moon) {
    const { x, y } = sky.moon
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) tint(x + dx, y + dy, 0xfff2b0, 0.35)
    for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]] as const) c.set(x + dx, y + dy, 0xfff2b0)
    c.set(x + 1, y, 0xe2d49a)
  }
  for (const cloud of sky.clouds ?? []) {
    c.rect(cloud.x + 1, cloud.y, cloud.w - 2, 1, cloud.rgb)
    c.rect(cloud.x, cloud.y + 1, cloud.w, 1, cloud.rgb)
    c.rect(cloud.x + 1, cloud.y + 2, cloud.w - 1, 1, cloud.shade)
  }
  FAR_HILL.forEach((h, i) => c.rect(GLASS.x + i, bottom - h + 1, 1, h, sky.hills[0]))
  NEAR_HILL.forEach((h, i) => c.rect(GLASS.x + i, bottom - h + 1, 1, h, sky.hills[1]))
  if (sky.houseLights) {
    const x = GLASS.x + 9
    const top = bottom - FAR_HILL[9]! - 1
    c.rect(x, top, 2, 2, mix(sky.hills[0], 0x000000, 0.3))
    c.set(x, top + 1, sky.houseLights)
  }
}

/** Wallpaper, a curtained window, a pendant lamp, a wooden floor and a rug, unlit. */
function drawRoom(c: Canvas): void {
  const R = ROOM_COLORS
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      const tone = y < 6 ? R.wallTop : y < 12 ? R.wall : R.wallLow
      c.set(x, y, x % 6 === 3 && y % 6 === 3 ? R.dot : tone)
    }
  }
  c.rect(WIN.x, WIN.y, WIN.w, WIN.h, R.frame)
  for (let y = GLASS.y; y < GLASS.y + GLASS.h; y++) {
    for (let x = GLASS.x; x < GLASS.x + GLASS.w; x++) if (isGlass(x, y)) c.px[y * W + x] = 0
  }
  c.rect(WIN.x - 1, WIN.y + WIN.h, WIN.w + 2, 1, R.frameDark)
  // Curtains on a rod, gathered a little at the sill.
  c.rect(WIN.x - 3, 1, WIN.w + 6, 1, R.rod)
  for (const x0 of [WIN.x - 2, WIN.x + WIN.w]) {
    const isLeft = x0 < WIN.x
    for (let y = 2; y < WIN.y + WIN.h + 2; y++) {
      c.set(x0, y, isLeft ? R.curtainFold : R.curtain)
      c.set(x0 + 1, y, isLeft ? R.curtain : R.curtainFold)
    }
    c.set(isLeft ? x0 - 1 : x0 + 2, WIN.y + WIN.h + 1, R.curtainFold)
    c.set(isLeft ? x0 + 1 : x0, 2, R.curtainFold)
  }
  // The pendant lamp.
  c.rect(LAMP.x, 0, 1, 2, R.cord)
  c.rect(LAMP.x - 1, 2, 3, 1, R.shade)
  c.rect(LAMP.x - 2, 3, 5, 1, R.shadeRim)
  c.rect(0, 18, W, 1, R.baseboard)
  for (let y = 19; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isSeam = (x + (y % 2) * 6) % 12 === 0
      c.set(x, y, isSeam ? R.seam : y % 2 === 0 ? R.floor : R.floorLight)
    }
  }
  c.rect(6, 21, 13, 1, R.rugEdge)
  c.rect(4, 22, 17, 1, R.rug)
  c.rect(5, 23, 15, 1, R.rug)
}

/**
 * How much light reaches each pixel: the phase's ambient light, the lamp's
 * warm pool and the sunbeam the window throws on the floor.
 */
function lightField(sky: Sky): Float32Array {
  const light = new Float32Array(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      light.set(sky.ambient, i)
      if (sky.lamp > 0) {
        const fall = Math.max(0, 1 - Math.hypot((x - LAMP.x) / 22, (y - LAMP.y) / 20)) ** 1.4
        // The floor under the lamp catches a pool of its own.
        const pool = y >= 19 ? Math.max(0, 1 - Math.hypot((x - LAMP.x) / 15, (y - 21) / 4)) : 0
        for (let k = 0; k < 3; k++) light[i + k]! += LAMP_GLOW[k]! * sky.lamp * (fall * 0.9 + pool * 0.5)
      }
    }
  }
  if (sky.beam) {
    const { skew, rows, light: tint } = sky.beam
    for (let row = 0; row < rows; row++) {
      const y = 19 + row
      const shift = Math.round(skew * (row + 0.5))
      for (let x = GLASS.x + shift; x < GLASS.x + GLASS.w + shift; x++) {
        if (x < 0 || x >= W || x === BAR_X + shift) continue
        // The beam fades toward its far edge.
        const fade = 1 - row / (rows + 1)
        for (let k = 0; k < 3; k++) light[(y * W + x) * 3 + k]! += tint[k]! * fade
      }
    }
  }

  return light
}

/** The pet's room at one part of the day. */
function buildRoom(phase: DayPhase): Frame {
  const sky = SKIES[phase]
  const c = new Canvas()
  drawRoom(c)
  const light = lightField(sky)
  c.px.forEach((v, i) => {
    if (!v) return
    const [r, g, b] = channels(v)
    c.px[i] = OPAQUE | pack(r * light[i * 3]!, g * light[i * 3 + 1]!, b * light[i * 3 + 2]!)
  })
  if (sky.lamp > 0) {
    c.rect(LAMP.x - 1, 4, 3, 1, mix(0xffe7a8, 0xffffff, sky.lamp * 0.4))
    c.set(LAMP.x, 5, mix(0xffcf70, 0xfff0c0, sky.lamp))
  }
  const view = new Canvas()
  drawView(view, sky)
  for (let y = GLASS.y; y < GLASS.y + GLASS.h; y++) {
    for (let x = GLASS.x; x < GLASS.x + GLASS.w; x++) if (isGlass(x, y)) c.px[y * W + x] = view.get(x, y)
  }

  return c.px
}

const rooms = new Map<DayPhase, Frame>()

/** The room every frame is drawn over, lit for the part of the day. */
export function roomFor(phase: DayPhase): Frame {
  let room = rooms.get(phase)
  if (!room) {
    room = buildRoom(phase)
    rooms.set(phase, room)
  }

  return room
}

// --- Animations -----------------------------------------------------------

type Scene = (c: Canvas) => void

function frame(pet: PetDef, pose: Pose, behind?: Scene, front?: Scene): Frame {
  const c = new Canvas()
  behind?.(c)
  drawPet(c, pet, pose)
  front?.(c)

  return c.px
}

function idle(pet: PetDef): Frame[] {
  return Array.from({ length: 16 }, (_, i) =>
    frame(pet, {
      squash: (i >> 2) % 2 === 1,
      eyes: i === 10 ? 'closed' : 'open',
      part: (i >> 2) % 2,
    }),
  )
}

function wake(pet: PetDef): Frame[] {
  const sleepy: Pose = { squash: true, eyes: 'closed', mouth: 'none' }

  return [
    frame(pet, sleepy, undefined, c => zzz(c, 0)),
    frame(pet, { ...sleepy, part: 1 }, undefined, c => zzz(c, 1)),
    frame(pet, sleepy, undefined, c => zzz(c, 2)),
    frame(pet, { eyes: 'down', mouth: 'none', part: 1 }),
    frame(pet, { eyes: 'open' }),
    frame(pet, { eyes: 'closed', part: 1 }),
    frame(pet, { dy: -1, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up' }),
    frame(pet, { dy: -2, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up', part: 1 }),
    frame(pet, { dy: -1, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up' }),
    frame(pet, { eyes: 'happy', mouth: 'open', armL: 'wave', armR: 'wave', part: 1 }, undefined, c => sparkle(c, 27, 6, true)),
    frame(pet, { eyes: 'open' }),
  ]
}

function read(pet: PetDef): Frame[] {
  return [0, 1, 2, 3].map(i => {
    const pose: Pose = { eyes: 'down', armL: 'hold', armR: 'hold', part: i >> 1, dy: i === 2 ? 1 : 0 }
    const [bx, by] = place({ ...pose, squash: false }, 2, 12)

    return frame(pet, pose, undefined, c => {
      outlined(c, C.outline, l => {
        l.stamp(bx, by, i % 2 === 0 ? BOOK : BOOK_ALT, { c: pet.book, w: C.paper, g: C.ink, d: C.spine })
        // The page being turned, lifting from the right and settling on the left.
        if (i === 1) (l.rect(bx + 9, by - 1, 4, 1, C.white), l.rect(bx + 10, by - 2, 2, 1, C.white))
        if (i === 2) l.rect(bx + 6, by - 4, 2, 4, C.white)
        if (i === 3) (l.rect(bx + 1, by - 1, 4, 1, C.white), l.rect(bx + 2, by - 2, 2, 1, C.white))
      })
      // Its paws on the book's edges.
      const [lx, ly] = paw(pose, 0)
      const [rx, ry] = paw(pose, 1)
      c.set(lx, ly, pet.palette.h!)
      c.set(rx, ry, pet.palette.h!)
    })
  })
}

function hammer(pet: PetDef): Frame[] {
  const board = (c: Canvas, nail: number) =>
    outlined(c, C.dwood, l => {
      l.rect(25, 20, 18, 2, C.wood)
      l.rect(25, 20, 18, 1, C.lwood)
      for (let n = 0; n < nail; n++) l.set(33, 19 - n, C.lsteel)
      l.rect(32, 19 - nail, 3, 1, C.lsteel)
    })
  const swing = (angle: 'up' | 'mid' | 'down', pose: Pose, nail: number, isHit: boolean) => (c: Canvas) => {
    board(c, nail)
    const [px, py] = paw(pose, 1)
    outlined(c, C.outline, l => {
      if (angle === 'up') {
        for (let n = 1; n <= 5; n++) l.set(px, py - n, C.wood)
        l.rect(px - 2, py - 8, 5, 3, C.steel)
        l.rect(px - 2, py - 8, 5, 1, C.lsteel)
      }
      if (angle === 'mid') {
        for (let n = 1; n <= 4; n++) l.set(px + n, py - n, C.wood)
        l.rect(px + 4, py - 7, 3, 3, C.steel)
        l.set(px + 4, py - 7, C.lsteel)
      }
      if (angle === 'down') {
        for (let n = 1; n <= 7; n++) l.set(px + n, py, C.wood)
        l.rect(px + 8, py - 2, 3, 5, C.steel)
        l.rect(px + 8, py - 2, 1, 5, C.lsteel)
      }
    })
    if (angle === 'mid') for (let n = 0; n < 4; n++) c.set(px + 6 + n, py - 4 + n, C.lgray)
    if (isHit) {
      sparkle(c, px + 13, py - 1, true, C.yellow)
      c.set(px + 7, py - 3, C.yellow)
      c.set(px + 12, py + 3, C.orange)
    }
  }
  const frames: Frame[] = []
  for (const nail of [3, 2, 1]) {
    const up: Pose = { eyes: 'right', armR: 'up', mouth: 'none' }
    const mid: Pose = { eyes: 'right', armR: 'outUp', part: 1 }
    const hit: Pose = { eyes: 'closed', armR: 'out', mouth: 'open', dy: 1 }
    const rest: Pose = { eyes: 'right', armR: 'out', part: 1 }
    frames.push(
      frame(pet, up, undefined, swing('up', up, nail, false)),
      frame(pet, mid, undefined, swing('mid', mid, nail, false)),
      frame(pet, hit, undefined, swing('down', { ...hit, dy: 0 }, nail - 1, true)),
      frame(pet, rest, undefined, swing('down', rest, nail - 1, false)),
    )
  }

  return frames
}

function knit(pet: PetDef): Frame[] {
  return [0, 1, 2, 3, 4, 5].map(i => {
    const pose: Pose = { eyes: 'down', armL: 'hold', armR: 'hold', part: i % 2 }
    const [cx, cy] = place(pose, 8, 14)
    const shift = i % 2

    return frame(pet, pose, undefined, c => {
      outlined(c, C.outline, l => {
        // A striped scarf that grows a row every other click.
        const rows = 2 + Math.floor(i / 2)
        for (let j = 0; j < rows; j++) l.rect(cx - 1, cy + 1 + j, 4, 1, j % 2 === 0 ? pet.yarn[0] : C.white)
        l.rect(28, 17, 5, 5, pet.yarn[0])
      })
      // Needles crossing in an X, clicking back and forth.
      for (let n = 0; n < 6; n++) {
        c.set(cx - 4 + n + shift, cy - 4 + n, C.lsteel)
        c.set(cx + 5 - n - shift, cy - 4 + n, C.lsteel)
      }
      c.set(cx - 4 + shift, cy - 4, C.gold)
      c.set(cx + 5 - shift, cy - 4, C.gold)
      c.stamp(28, 17, YARN[i % 3]!, { y: pet.yarn[0], Y: pet.yarn[1] })
      for (let x = cx + 3; x < 28; x++) c.set(x, cy + 2 + Math.round(Math.sin((x + i) / 2)), pet.yarn[1])
    })
  })
}

function shell(pet: PetDef): Frame[] {
  return [0, 1, 2, 3, 4, 5].map(i => {
    const isLeft = i % 2 === 0
    const pose: Pose = { eyes: 'right', armL: isLeft ? 'tap' : 'rest', armR: isLeft ? 'rest' : 'tap', mouth: 'none', part: i % 2 }

    return frame(
      pet,
      pose,
      c => {
        // The monitor, its output scrolling up.
        outlined(c, C.outline, l => {
          l.rect(27, 3, 18, 13, C.dgray)
          l.rect(28, 4, 16, 11, C.black)
          l.rect(34, 16, 4, 2, C.dgray)
          l.rect(31, 18, 10, 1, C.gray)
        })
        const tones = [C.green, C.blue, C.purple, C.yellow]
        for (let row = 0; row < 5; row++) {
          const [indent, len, tone] = CODE_LINES[(row + i) % CODE_LINES.length]!
          c.rect(29 + indent, 5 + row * 2, len, 1, tones[tone]!)
        }
        if (isLeft) c.rect(29, 13, 2, 1, C.white)
      },
      c => {
        outlined(c, C.outline, l => {
          l.rect(3, 20, 18, 3, C.dgray)
          for (let x = 4; x < 20; x += 2) {
            l.set(x, 20, C.lgray)
            l.set(x + 1, 21, C.lgray)
          }
        })
        const key = 4 + ((i * 5) % 15)
        c.set(key, 20 + (i % 2), C.green)
        // Keystrokes flying up.
        const [kx, ky] = paw(pose, isLeft ? 0 : 1)
        c.set(kx + (isLeft ? -1 : 1), ky - 3, C.yellow)
        c.set(kx + (isLeft ? -2 : 2), ky - 5, C.white)
      },
    )
  })
}

function search(pet: PetDef): Frame[] {
  const dxs = [0, 1, 2, 2, 1, 0, 0, 0]

  return dxs.map((dx, i) => {
    const pose: Pose = { dx, eyes: 'open', armL: 'lift', armR: 'lift', mouth: 'none', part: i % 2 }
    const isFound = i >= 2 && i <= 4

    return frame(
      pet,
      pose,
      c => {
        // Far away: hills, a sun, and a bird drifting by.
        outlined(c, C.dgreen, l => {
          l.rect(30, 21, 18, 3, C.grass)
          l.rect(33, 19, 10, 2, C.grass)
          l.rect(36, 18, 4, 1, C.grass)
        })
        outlined(c, C.dgold, l => l.rect(42, 3, 3, 3, C.gold))
        const bx = 26 + i * 2
        c.set(bx, 8, C.dgray)
        c.set(bx + 2, 8, C.dgray)
        c.set(bx + 1, i % 2 === 0 ? 9 : 7, C.dgray)
      },
      c => {
        // Binoculars over both eyes.
        const [lx, ly] = place(pose, pet.eyes[0][0] - 1, pet.eyes[0][1])
        const [rx] = place(pose, pet.eyes[1][0] - 1, pet.eyes[1][1])
        outlined(c, C.outline, l => {
          l.rect(lx, ly, 4, 3, C.black)
          l.rect(rx, ly, 4, 3, C.black)
          l.rect(lx + 4, ly + 1, rx - lx - 4, 1, C.dgray)
        })
        for (const x of [lx, rx]) {
          c.rect(x + 1, ly + 1, 2, 1, C.blue)
          c.set(x + 1, ly + 1, i % 3 === 0 ? C.white : C.lblue)
        }
        if (isFound) sparkle(c, 38, 12, i === 3, C.yellow)
        else badge(c, 'question', 22, 0)
      },
    )
  })
}

function pass(pet: PetDef): Frame[] {
  return Array.from({ length: 20 }, (_, i) => {
    const beat = i % 4
    let pose: Pose = { eyes: 'happy', mouth: 'open', part: i % 2 }
    if (pet.dance === 'sway') {
      pose = { ...pose, dx: [0, 2, 0, -2][beat]!, armL: beat < 2 ? 'up' : 'wave', armR: beat < 2 ? 'wave' : 'up' }
    }
    if (pet.dance === 'hop') {
      pose = { ...pose, dy: [0, -2, -3, -1][beat]!, armL: beat === 0 ? 'out' : 'up', armR: beat === 0 ? 'out' : 'up' }
    }
    if (pet.dance === 'flip') {
      pose = { ...pose, flip: (i >> 1) % 2 === 1, dy: beat % 2 === 0 ? 0 : -2, armL: beat < 2 ? 'wave' : 'out', armR: beat < 2 ? 'out' : 'wave' }
    }

    return frame(pet, pose, undefined, c => {
      confetti(c, i)
      if (i % 4 < 3) badge(c, 'check', 30, 4)
    })
  })
}

function fail(pet: PetDef): Frame[] {
  const rock = (c: Canvas) => outlined(c, C.outline, l => l.stamp(1, 15, ROCK, { h: C.lrock, g: C.rock, d: C.drock }))
  const peekDy = 14 - PET_Y - (pet.eyes[0][1] + 2)
  const frames: Frame[] = []
  for (let i = 0; i < 10; i++) {
    frames.push(
      frame(pet, { dy: 9, dx: i % 2, eyes: 'closed', part: i % 2 }, undefined, c => {
        rock(c)
        if (i % 4 < 3) badge(c, 'cross', 32, 3)
        c.set(25, 9 + (i % 5), C.sweat)
        c.set(26, 10 + (i % 5), C.sweat)
      }),
    )
  }
  const peek = (eyes: Eyes, dy = peekDy, dx = 0) =>
    frame(pet, { dy, dx, eyes, mouth: 'none' }, undefined, c => {
      rock(c)
      c.set(24, 12, C.sweat)
    })
  frames.push(peek('closed', peekDy + 3), peek('wide', peekDy + 1))
  frames.push(peek('left', peekDy, -1), peek('left', peekDy, -1), peek('left', peekDy, -1))
  frames.push(peek('right', peekDy, 1), peek('right', peekDy, 1), peek('right', peekDy, 1))
  frames.push(peek('closed'), peek('open'), peek('open'), peek('open'))

  return frames
}

function bored(pet: PetDef, variant: number): Frame[] {
  if (variant === 1) {
    // Batting a ball of yarn back and forth.
    const xs = [24, 27, 30, 33, 36, 38, 36, 33, 30, 27, 24, 23]

    return xs.map((x, i) => {
      const isNear = x <= 24
      const pose: Pose = { eyes: 'right', armR: isNear ? 'out' : 'rest', mouth: isNear ? 'open' : undefined, part: i % 2 }
      const [hx, hy] = paw(pose, 1)

      return frame(pet, pose, c => {
        for (let tx = hx + 1; tx < x; tx++) c.set(tx, 21 + ((tx + i) % 2), pet.yarn[1])
        void hy
        outlined(c, C.outline, l => l.rect(x, 18, 5, 5, pet.yarn[0]))
        c.stamp(x, 18, YARN[i % 3]!, { y: pet.yarn[0], Y: pet.yarn[1] })
      })
    })
  }
  if (variant === 2) {
    // Building a sandcastle, a layer at a time, then planting a flag.
    const layers: [number, number, number][] = [
      [27, 21, 16], [27, 20, 16], [28, 19, 14], [28, 18, 3], [39, 18, 3], [28, 17, 3], [39, 17, 3],
      [33, 18, 4], [33, 17, 4], [33, 16, 4], [33, 15, 4], [28, 16, 1], [30, 16, 1], [39, 16, 1], [41, 16, 1],
    ]

    return Array.from({ length: 17 }, (_, i) => {
      const pose: Pose = { eyes: i % 2 === 0 ? 'right' : 'down', armR: i % 2 === 0 ? 'out' : 'hold', part: i % 2 }
      const built = layers.slice(0, Math.min(i + 1, layers.length))

      return frame(pet, pose, c => {
        outlined(c, C.dsand, l => built.forEach(([x, y, w]) => l.rect(x, y, w, 1, y % 2 === 0 ? C.sand : C.lsand)))
        if (built.length >= 11) c.rect(34, 18, 2, 2, C.dsand)
        if (i >= layers.length) {
          c.rect(35, 11, 1, 4, C.dwood)
          c.rect(36, 11 + (i % 2), 3, 2, C.red)
        }
        outlined(c, C.outline, l => {
          l.rect(22, 19, 3, 3, C.blue)
          l.rect(22, 19, 3, 1, C.lblue)
        })
      })
    })
  }

  // A big, slow yawn.
  return [
    frame(pet, { eyes: 'open' }),
    frame(pet, { eyes: 'down', part: 1 }),
    frame(pet, { dy: -1, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up' }),
    frame(pet, { dy: -2, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up', part: 1 }),
    frame(pet, { dy: -1, eyes: 'closed', mouth: 'yawn', armL: 'up', armR: 'up' }),
    frame(pet, { squash: true, eyes: 'closed', mouth: 'none' }),
    frame(pet, { squash: true, eyes: 'closed', mouth: 'none', part: 1 }, undefined, c => zzz(c, 0)),
    frame(pet, { squash: true, eyes: 'closed', mouth: 'none' }, undefined, c => zzz(c, 1)),
    frame(pet, { squash: true, eyes: 'closed', mouth: 'none', part: 1 }, undefined, c => zzz(c, 2)),
    frame(pet, { eyes: 'down', mouth: 'none' }),
    frame(pet, { eyes: 'open' }),
  ]
}

function wave(pet: PetDef): Frame[] {
  return [0, 1, 2, 3].map(i => {
    const isUp = i % 2 === 0

    return frame(pet, { dy: isUp ? 0 : -1, eyes: 'wide', mouth: 'open', armR: isUp ? 'up' : 'wave', armL: i === 1 ? 'up' : 'rest', part: i % 2 }, undefined, c => {
      outlined(c, C.outline, l => l.stamp(25, 0, BUBBLE, { w: C.white, o: i < 2 ? C.orange : C.red }))
      if (isUp) {
        c.set(23, 2, C.yellow)
        c.set(22, 4, C.yellow)
      }
    })
  })
}

function finish(pet: PetDef): Frame[] {
  const isTrophy = pet.gift === 'trophy'

  return Array.from({ length: 15 }, (_, i) => {
    const rise = Math.max(0, 4 - i)
    const pose: Pose = {
      dy: i > 4 && i % 4 === 1 ? -1 : 0,
      eyes: 'happy',
      mouth: i > 4 ? 'open' : undefined,
      armR: 'outUp',
      part: i % 2,
    }
    const [hx, hy] = paw(pose, 1)

    return frame(pet, pose, undefined, c => {
      if (isTrophy) {
        outlined(c, C.dgold, l => l.stamp(hx + 1, hy - 8 + rise, TROPHY, { y: C.gold, h: C.lgold, d: C.dgold }))
        if (i > 4) {
          sparkle(c, hx + 14, hy - 8, i % 2 === 0)
          sparkle(c, hx + 2, hy - 11, i % 2 === 1)
        }
      } else {
        outlined(c, C.dgray, l => l.stamp(hx + 1, hy - 6 + rise, ENVELOPE, { w: C.white, g: C.lgray, r: C.red }))
        if (i > 4) {
          outlined(c, C.dred, l => l.stamp(hx + 4, hy - 13 - (i % 2), HEART, { r: C.rose }))
          sparkle(c, hx + 14, hy - 6, i % 2 === 0)
        }
      }
    })
  })
}

function tidy(pet: PetDef): Frame[] {
  const frames: Frame[] = []
  const pal = { C: C.lbox, c: C.box, d: C.tape }
  const stack = (c: Canvas, n: number) => {
    if (n > 0) outlined(c, C.dbox, l => {
      for (let j = 0; j < n; j++) l.stamp(36, 17 - 6 * j, BOX, pal)
    })
  }
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let step = 0; step < 8; step += 2) {
      const pose: Pose = { dx: step, eyes: 'right', armL: 'up', armR: 'up', part: (step >> 1) % 2, dy: (step >> 1) % 2 === 1 ? -1 : 0 }
      const [, py] = place(pose, 0, 0)
      const [bx] = place(pose, 5, 0)
      frames.push(
        frame(pet, pose, c => stack(c, cycle), c => outlined(c, C.dbox, l => l.stamp(bx, py - 3, BOX, pal))),
      )
    }
    frames.push(
      frame(pet, { dx: 8, eyes: 'happy', armR: 'out', mouth: 'open' }, c => stack(c, cycle + 1), c => sparkle(c, 35, 16 - 6 * cycle, true, C.white)),
    )
    for (let step = 6; step >= 0; step -= 2) {
      frames.push(frame(pet, { dx: step, eyes: 'left', part: (step >> 1) % 2 }, c => stack(c, cycle + 1)))
    }
  }

  return frames
}

/** The frames of one reaction for one pet. `frameMs` overrides the pace. */
export function buildAnim(petId: PetId, kind: Kind, variant = 0, frameMs?: number): Anim {
  const pet = PETS[petId] ?? PETS.axolotl
  const made = ((): Anim => {
    switch (kind) {
      case 'still':
        return { frames: [frame(pet, {})], frameMs: 1000, loop: true }
      case 'idle':
        return { frames: idle(pet), frameMs: 250, loop: true }
      case 'wake':
        return { frames: wake(pet), frameMs: 260, loop: false }
      case 'read':
        return { frames: read(pet), frameMs: 220, loop: true }
      case 'edit':
        return pet.edit === 'hammer'
          ? { frames: hammer(pet), frameMs: 140, loop: true }
          : { frames: knit(pet), frameMs: 200, loop: true }
      case 'shell':
        return { frames: shell(pet), frameMs: 90, loop: true }
      case 'search':
        return { frames: search(pet), frameMs: 260, loop: true }
      case 'pass':
        return { frames: pass(pet), frameMs: 150, loop: false }
      case 'fail':
        return { frames: fail(pet), frameMs: 170, loop: false }
      case 'bored':
        return { frames: bored(pet, variant % 3), frameMs: variant % 3 === 1 ? 160 : 300, loop: true }
      case 'wave':
        return { frames: wave(pet), frameMs: 220, loop: true }
      case 'finish':
        return { frames: finish(pet), frameMs: 200, loop: false }
      case 'tidy':
        return { frames: tidy(pet), frameMs: 170, loop: true }
    }
  })()

  return frameMs === undefined ? made : { ...made, frameMs }
}

/** How long a one-shot reaction takes to play through, in milliseconds. */
export function animLength(anim: Anim): number {
  return anim.frames.length * anim.frameMs
}

/** Which frame shows `elapsed` milliseconds into an animation. */
export function frameAt(anim: Anim, elapsed: number): number {
  const i = Math.max(0, Math.floor(elapsed / anim.frameMs))

  return anim.loop ? i % anim.frames.length : Math.min(i, anim.frames.length - 1)
}

// --- Encoders -------------------------------------------------------------

const DEFAULT_COLOR = 0x01000000

function toBase64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
  if (typeof native === 'function') return native.call(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }

  return btoa(s)
}

export const RASTER_COLUMNS = W
export const RASTER_ROWS = H / 2

/** One frame as a terminal Raster's cells: two pixels per cell, ▀ and ▄. */
export function rasterCells(f: Frame, backdrop?: Frame): string {
  const view = new DataView(new ArrayBuffer(W * RASTER_ROWS * 12))
  let o = 0
  for (let row = 0; row < RASTER_ROWS; row++) {
    for (let x = 0; x < W; x++) {
      const top = f[2 * row * W + x]! || (backdrop?.[2 * row * W + x] ?? 0)
      const bottom = f[(2 * row + 1) * W + x]! || (backdrop?.[(2 * row + 1) * W + x] ?? 0)
      let cell: [number, number, number] = [0x20, DEFAULT_COLOR, DEFAULT_COLOR]
      if (top && bottom) cell = [0x2580, top & 0xffffff, bottom & 0xffffff]
      else if (top) cell = [0x2580, top & 0xffffff, DEFAULT_COLOR]
      else if (bottom) cell = [0x2584, bottom & 0xffffff, DEFAULT_COLOR]
      for (const word of cell) {
        view.setUint32(o, word, true)
        o += 4
      }
    }
  }

  return toBase64(new Uint8Array(view.buffer))
}

const hex = (rgb: number) => `#${(rgb & 0xffffff).toString(16).padStart(6, '0')}`

function framePaths(f: Frame): string {
  const runs = new Map<number, string[]>()
  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      const v = f[y * W + x]!
      if (!v) {
        x++
        continue
      }
      let w = 1
      while (x + w < W && f[y * W + x + w] === v) w++
      const list = runs.get(v) ?? []
      list.push(`M${x} ${y}h${w}v1h-${w}z`)
      runs.set(v, list)
      x += w
    }
  }

  return [...runs].map(([v, d]) => `<path fill="${hex(v)}" d="${d.join('')}"/>`).join('')
}

const SVG_LIMIT = 120_000

/**
 * The whole animation as one SVG, each distinct frame a group whose
 * visibility SMIL steps through, so the desktop animates it by itself.
 * An animation too big for the element keeps every other frame.
 */
export function animSvg(anim: Anim, scale = 4, backdrop?: Frame): string {
  const groups = new Map<string, { paths: string; slots: number[] }>()
  anim.frames.forEach((f, slot) => {
    const key = f.join(',')
    const group = groups.get(key)
    if (group) group.slots.push(slot)
    else groups.set(key, { paths: framePaths(f), slots: [slot] })
  })

  const n = anim.frames.length
  const dur = `${(n * anim.frameMs) / 1000}s`
  const keyTimes = Array.from({ length: n }, (_, i) => (i / n).toFixed(4)).join(';')
  const repeat = anim.loop ? 'repeatCount="indefinite"' : 'repeatCount="1" fill="freeze"'
  const body =
    groups.size === 1
      ? [...groups.values()][0]!.paths
      : [...groups.values()]
          .map(({ paths, slots }) => {
            const values = Array.from({ length: n }, (_, i) => (slots.includes(i) ? 'visible' : 'hidden')).join(';')
            const initial = slots.includes(0) ? 'visible' : 'hidden'

            return `<g visibility="${initial}"><animate attributeName="visibility" values="${values}" keyTimes="${keyTimes}" dur="${dur}" calcMode="discrete" ${repeat}/>${paths}</g>`
          })
          .join('')

  const base = backdrop ? framePaths(backdrop) : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">${base}${body}</svg>`
  if (svg.length > SVG_LIMIT && n > 2) {
    return animSvg({ ...anim, frames: anim.frames.filter((_, i) => i % 2 === 0), frameMs: anim.frameMs * 2 }, scale, backdrop)
  }

  return svg
}
