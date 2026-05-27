import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowDown,
  Download,
  Grid3X3,
  Heart,
  ImageUp,
  Layers3,
  LogIn,
  Mail,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Users,
  Wand2,
} from 'lucide-react'
import heroImage from './assets/bead-hero.png'
import sourceAstronaut from './assets/community/source-astronaut.png'
import sourceCafe from './assets/community/source-cafe.png'
import sourceFox from './assets/community/source-fox.png'
import './App.css'
import {
  BRAND_LABELS,
  BRAND_REFERENCE_COLORS,
  MARD_144_COLORS,
  MARD_221_COLORS,
  NAMING_BRANDS,
  PALETTE_MODES,
  type NamingBrand,
  type PaletteMode,
  type RawBeadColor,
} from './beadPalettes'

gsap.registerPlugin(ScrollTrigger)

type SizePreset = {
  label: string
  width: number
  height: number
}

type PaletteColor = {
  code: string
  displayCode: string
  displayBrand: NamingBrand
  name: string
  hex: string
  rgb: [number, number, number]
}

type BeadCell = {
  code: string
  displayCode: string
  hex: string
}

type ColorCount = PaletteColor & {
  count: number
}

type ConversionResult = {
  width: number
  height: number
  cells: BeadCell[]
  paletteMode: PaletteMode
  namingBrand: NamingBrand
  imageUrl: string
  counts: ColorCount[]
}

type CommunityPattern = {
  title: string
  author: string
  size: SizePreset
  paletteMode: PaletteMode
  namingBrand: NamingBrand
  downloads: string
  sourceImage: string
  tags: string[]
}

type DownloadResolutionId = 'compact' | 'original' | 'print'

type AuthMode = 'login' | 'register'

type AuthNotice = {
  type: 'idle' | 'success' | 'error'
  message: string
}

type Status = 'idle' | 'processing' | 'ready' | 'error'

type AppView = 'studio' | 'community' | 'login' | 'contact'

const sizePresets: SizePreset[] = [
  { label: '32×32', width: 32, height: 32 },
  { label: '48×48', width: 48, height: 48 },
  { label: '64×64', width: 64, height: 64 },
  { label: '96×96', width: 96, height: 96 },
  { label: '128×128', width: 128, height: 128 },
]

const downloadResolutions: Array<{
  id: DownloadResolutionId
  label: string
  scale: number
  description: string
}> = [
  { id: 'compact', label: '小图 50%', scale: 0.5, description: '适合聊天预览' },
  { id: 'original', label: '原始 100%', scale: 1, description: '按图纸默认尺寸' },
  { id: 'print', label: '高清 200%', scale: 2, description: '适合打印放大' },
]

const authAttemptWindowMs = 60_000
const authMaxAttempts = 5
const authLockMs = 30_000
const contactEmail = '2072719218@qq.com'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const suspiciousSqlPattern = /('|--|;|\/\*|\*\/|\b(select|insert|update|delete|drop|union|alter|exec|truncate)\b)/i

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function colorDistance([r1, g1, b1]: [number, number, number], [r2, g2, b2]: [number, number, number]) {
  const rMean = (r1 + r2) / 2
  const r = r1 - r2
  const g = g1 - g2
  const b = b1 - b2

  return Math.sqrt((2 + rMean / 256) * r * r + 4 * g * g + (2 + (255 - rMean) / 256) * b * b)
}

function buildPalette(rawColors: RawBeadColor[], namingBrand: NamingBrand): PaletteColor[] {
  const referenceColors = BRAND_REFERENCE_COLORS[namingBrand].map((color) => ({
    ...color,
    rgb: hexToRgb(color.hex),
  }))

  return rawColors.map((color) => {
    const rgb = hexToRgb(color.hex)
    let displayCode = color.code
    let bestDistance = Number.POSITIVE_INFINITY

    if (namingBrand !== 'mard') {
      for (const reference of referenceColors) {
        const distance = colorDistance(rgb, reference.rgb)
        if (distance < bestDistance) {
          bestDistance = distance
          displayCode = reference.code
        }
      }
    }

    return {
      code: color.code,
      displayCode,
      displayBrand: namingBrand,
      name: `${BRAND_LABELS[namingBrand]} ${displayCode}`,
      hex: color.hex,
      rgb,
    }
  })
}

function getPaletteByMode(paletteMode: PaletteMode, namingBrand: NamingBrand) {
  return buildPalette(paletteMode === 144 ? MARD_144_COLORS : MARD_221_COLORS, namingBrand)
}

const fallbackPalette = getPaletteByMode(144, 'mard')

const fallbackCells = Array.from({ length: 144 }, (_, index) => {
  const row = Math.floor(index / 12)
  const col = index % 12
  const center = Math.abs(row - 5.5) + Math.abs(col - 5.5)

  if (center < 2.7) return fallbackPalette[13].hex
  if ((row + col) % 7 === 0) return fallbackPalette[25].hex
  if (row > 7 && col > 2 && col < 9) return fallbackPalette[38].hex
  if (row === 3 || col === 8) return fallbackPalette[121].hex
  return fallbackPalette[0].hex
})

const processSteps = [
  {
    title: '上传',
    text: '拖入照片，读取方向和透明背景，先在浏览器中生成安全预览。',
    icon: ImageUp,
  },
  {
    title: '定格',
    text: '裁剪为固定拼豆尺寸，支持正方形头像、横幅和自定义网格。',
    icon: Grid3X3,
  },
  {
    title: '配色',
    text: '使用色彩距离映射真实拼豆色号，保留明暗层次。',
    icon: Palette,
  },
  {
    title: '导出',
    text: '输出 PNG 图纸、CSV 用量表和后续可打印 PDF。',
    icon: Download,
  },
]

const communityPatterns: CommunityPattern[] = [
  {
    title: '星际宇航员',
    author: 'Mika Studio',
    size: sizePresets[2],
    paletteMode: 221,
    namingBrand: 'mard',
    downloads: '1.8k',
    sourceImage: sourceAstronaut,
    tags: ['头像', '科幻', 'MARD 221'],
  },
  {
    title: '甜点咖啡馆',
    author: '豆豆日记',
    size: sizePresets[3],
    paletteMode: 221,
    namingBrand: 'coco',
    downloads: '2.4k',
    sourceImage: sourceCafe,
    tags: ['礼物', '甜点', 'COCO 命名'],
  },
  {
    title: '森林狐狸',
    author: 'Orange Craft',
    size: sizePresets[2],
    paletteMode: 144,
    namingBrand: 'manman',
    downloads: '3.1k',
    sourceImage: sourceFox,
    tags: ['动物', '自然', '漫漫命名'],
  },
]

const adSlots = [
  {
    id: 'studio-export',
    label: '导出区横幅',
    size: '728 x 90 / 320 x 100',
    channel: 'Google AdSense 或百度联盟',
    note: '展示在导出区下方，适合程序化广告，移动端改为横幅。',
  },
  {
    id: 'community-feed',
    label: '社区信息流',
    size: '336 x 280',
    channel: '直投赞助或联盟广告',
    note: '插入社区卡片流，优先卖给拼豆、收纳盒、打印服务商。',
  },
  {
    id: 'supply-affiliate',
    label: '材料推荐',
    size: '原生卡片',
    channel: '淘宝联盟 / 京东联盟 / Amazon Associates',
    note: '按图纸尺寸推荐拼豆套装、底板、镊子和补充色号。',
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getNearestPaletteColor(rgb: [number, number, number], palette: PaletteColor[]) {
  let nearest = palette[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const color of palette) {
    const distance = colorDistance(rgb, color.rgb)
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = color
    }
  }

  return nearest
}

function applyTinyDither(
  rgb: [number, number, number],
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number, number] {
  const grain = ((x * 17 + y * 31) % 9) - 4
  const edgeBoost = Math.abs(x / Math.max(1, width - 1) - 0.5) + Math.abs(y / Math.max(1, height - 1) - 0.5)
  const amount = grain * 2 + edgeBoost * 5

  return [
    clamp(rgb[0] + amount, 0, 255),
    clamp(rgb[1] + amount, 0, 255),
    clamp(rgb[2] + amount, 0, 255),
  ]
}

async function readImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，请换一张 PNG、JPG 或 WebP。'))
    }
    image.src = url
  })
}

async function readImageUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('社区示例图读取失败，请刷新页面重试。'))
    image.src = src
  })
}

function getReadableTextColor([r, g, b]: [number, number, number]) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.56 ? '#17202a' : '#ffffff'
}

function sanitizeAuthInput(value: string) {
  return value.trim().replace(/[<>"`\\]/g, '').slice(0, 120)
}

function validateEmail(email: string) {
  return email.length <= 120 && emailPattern.test(email) && !suspiciousSqlPattern.test(email)
}

function canSubmitAuth(attempts: number[], now = Date.now()) {
  const recentAttempts = attempts.filter((time) => now - time < authAttemptWindowMs)
  return {
    allowed: recentAttempts.length < authMaxAttempts,
    recentAttempts,
  }
}

function resizeDataUrl(dataUrl: string, scale: number): Promise<string> {
  if (scale === 1) return Promise.resolve(dataUrl)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('当前浏览器不支持 Canvas 图片缩放。'))
        return
      }

      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('下载图片生成失败，请重试。'))
    image.src = dataUrl
  })
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + nextRadius, y)
  context.arcTo(x + width, y, x + width, y + height, nextRadius)
  context.arcTo(x + width, y + height, x, y + height, nextRadius)
  context.arcTo(x, y + height, x, y, nextRadius)
  context.arcTo(x, y, x + width, y, nextRadius)
  context.closePath()
}

function drawPatternSheet(
  cells: BeadCell[],
  width: number,
  height: number,
  counts: ColorCount[],
  paletteMode: PaletteMode,
  namingBrand: NamingBrand,
) {
  const cellSize = width >= 128 ? 34 : width >= 96 ? 40 : width >= 64 ? 48 : 58
  const rowHeaderWidth = 56
  const columnHeaderHeight = 54
  const legendHeight = Math.min(300, Math.max(132, Math.ceil(counts.length / 4) * 42 + 72))
  const padding = 28
  const titleHeight = 70
  const boardWidth = rowHeaderWidth + width * cellSize
  const boardHeight = columnHeaderHeight + height * cellSize
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前浏览器不支持 Canvas 图纸绘制。')
  }

  canvas.width = boardWidth + padding * 2
  canvas.height = titleHeight + boardHeight + legendHeight + padding * 2
  context.fillStyle = '#f5f1e9'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const paperPatternSize = 24
  context.fillStyle = 'rgba(255,255,255,0.48)'
  for (let y = 0; y < canvas.height; y += paperPatternSize) {
    for (let x = (y / paperPatternSize) % 2 === 0 ? 0 : paperPatternSize / 2; x < canvas.width; x += paperPatternSize) {
      context.fillRect(x, y, 1, 1)
    }
  }

  const boardX = padding
  const boardY = padding + titleHeight
  const gridX = boardX + rowHeaderWidth
  const gridY = boardY + columnHeaderHeight

  context.fillStyle = '#1d1a17'
  context.font = '700 28px Arial, sans-serif'
  context.fillText(`${width} x ${height} ${BRAND_LABELS[namingBrand]} ${paletteMode} 色拼豆图纸`, padding, padding + 30)
  context.font = '15px Arial, sans-serif'
  context.fillStyle = '#6e675f'
  context.fillText(`每格显示色号，左侧和顶部为坐标。总豆数 ${Number(width * height).toLocaleString()} 颗。`, padding, padding + 56)

  context.fillStyle = 'rgba(255,255,255,0.82)'
  context.strokeStyle = 'rgba(38,33,29,0.18)'
  context.lineWidth = 1
  drawRoundedRect(context, boardX, boardY, boardWidth, boardHeight, 14)
  context.fill()
  context.stroke()

  context.save()
  context.beginPath()
  context.rect(gridX, gridY, width * cellSize, height * cellSize)
  context.clip()

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = cells[y * width + x]
      const cellX = gridX + x * cellSize
      const cellY = gridY + y * cellSize
      const rgb = hexToRgb(cell.hex)
      context.fillStyle = cell.hex
      context.fillRect(cellX, cellY, cellSize, cellSize)

      if (cellSize >= 34) {
        context.fillStyle = getReadableTextColor(rgb)
        context.font = `700 ${Math.max(8, Math.floor(cellSize * 0.32))}px Arial, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(cell.displayCode, cellX + cellSize / 2, cellY + cellSize / 2, cellSize - 4)
      }
    }
  }

  context.restore()

  context.strokeStyle = 'rgba(32,28,24,0.17)'
  context.lineWidth = 1
  for (let x = 0; x <= width; x += 1) {
    const positionX = gridX + x * cellSize
    context.beginPath()
    context.moveTo(positionX, gridY)
    context.lineTo(positionX, gridY + height * cellSize)
    context.stroke()
  }
  for (let y = 0; y <= height; y += 1) {
    const positionY = gridY + y * cellSize
    context.beginPath()
    context.moveTo(gridX, positionY)
    context.lineTo(gridX + width * cellSize, positionY)
    context.stroke()
  }

  context.strokeStyle = 'rgba(32,28,24,0.35)'
  context.lineWidth = 2
  for (let x = 0; x <= width; x += 10) {
    const positionX = gridX + x * cellSize
    context.beginPath()
    context.moveTo(positionX, gridY)
    context.lineTo(positionX, gridY + height * cellSize)
    context.stroke()
  }
  for (let y = 0; y <= height; y += 10) {
    const positionY = gridY + y * cellSize
    context.beginPath()
    context.moveTo(gridX, positionY)
    context.lineTo(gridX + width * cellSize, positionY)
    context.stroke()
  }

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 16px Arial, sans-serif'
  context.fillStyle = '#1d1a17'
  for (let x = 0; x < width; x += 1) {
    if (x < 30 || (x + 1) % 5 === 0 || x === width - 1) {
      context.fillText(String(x + 1), gridX + x * cellSize + cellSize / 2, boardY + columnHeaderHeight / 2)
    }
  }
  for (let y = 0; y < height; y += 1) {
    if (y < 30 || (y + 1) % 5 === 0 || y === height - 1) {
      context.fillText(String(y + 1), boardX + rowHeaderWidth / 2, gridY + y * cellSize + cellSize / 2)
    }
  }

  const legendX = padding
  const legendY = boardY + boardHeight + 34
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillStyle = '#1d1a17'
  context.font = '700 22px Arial, sans-serif'
  context.fillText('颜色用量', legendX, legendY)
  context.font = '14px Arial, sans-serif'
  context.fillStyle = '#6e675f'
  context.fillText(`命名规则：${BRAND_LABELS[namingBrand]}，匹配范围：MARD ${paletteMode} 色`, legendX + 112, legendY)

  const legendTop = legendY + 26
  const columnWidth = Math.floor((canvas.width - padding * 2) / 4)
  counts.slice(0, 56).forEach((color, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = legendX + col * columnWidth
    const y = legendTop + row * 38
    context.fillStyle = color.hex
    context.fillRect(x, y, 24, 24)
    context.strokeStyle = 'rgba(32,28,24,0.16)'
    context.strokeRect(x, y, 24, 24)
    context.fillStyle = '#1d1a17'
    context.font = '700 14px Arial, sans-serif'
    context.fillText(`${color.displayCode}`, x + 32, y + 16)
    context.fillStyle = '#6e675f'
    context.font = '13px Arial, sans-serif'
    context.fillText(`${color.count} 颗`, x + 86, y + 16)
  })

  return canvas.toDataURL('image/png')
}

async function convertImageToBeads(
  file: File,
  size: SizePreset,
  shouldDither: boolean,
  paletteMode: PaletteMode,
  namingBrand: NamingBrand,
): Promise<ConversionResult> {
  const image = await readImageFile(file)
  return convertLoadedImageToBeads(image, size, shouldDither, paletteMode, namingBrand)
}

async function convertImageUrlToBeads(
  src: string,
  size: SizePreset,
  shouldDither: boolean,
  paletteMode: PaletteMode,
  namingBrand: NamingBrand,
): Promise<ConversionResult> {
  const image = await readImageUrl(src)
  return convertLoadedImageToBeads(image, size, shouldDither, paletteMode, namingBrand)
}

function convertLoadedImageToBeads(
  image: HTMLImageElement,
  size: SizePreset,
  shouldDither: boolean,
  paletteMode: PaletteMode,
  namingBrand: NamingBrand,
): ConversionResult {
  const activePalette = getPaletteByMode(paletteMode, namingBrand)
  const sampleCanvas = document.createElement('canvas')
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })

  if (!sampleContext) {
    throw new Error('当前浏览器不支持 Canvas 图片处理。')
  }

  sampleCanvas.width = size.width
  sampleCanvas.height = size.height

  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = size.width / size.height
  let sourceWidth = image.naturalWidth
  let sourceHeight = image.naturalHeight
  let sourceX = 0
  let sourceY = 0

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio
    sourceX = (image.naturalWidth - sourceWidth) / 2
  } else {
    sourceHeight = image.naturalWidth / targetRatio
    sourceY = (image.naturalHeight - sourceHeight) / 2
  }

  sampleContext.imageSmoothingEnabled = true
  sampleContext.imageSmoothingQuality = 'high'
  sampleContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size.width, size.height)

  const sourceData = sampleContext.getImageData(0, 0, size.width, size.height).data
  const previewScale = Math.max(4, Math.floor(860 / Math.max(size.width, size.height)))
  const outputCanvas = document.createElement('canvas')
  const outputContext = outputCanvas.getContext('2d')

  if (!outputContext) {
    throw new Error('当前浏览器不支持 Canvas 图片绘制。')
  }

  outputCanvas.width = size.width * previewScale
  outputCanvas.height = size.height * previewScale
  outputContext.fillStyle = '#f5f1e9'
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

  const cells: BeadCell[] = []
  const countMap = new Map<string, ColorCount>()

  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      const index = (y * size.width + x) * 4
      const alpha = sourceData[index + 3] / 255
      const rgb: [number, number, number] = [
        Math.round(sourceData[index] * alpha + 255 * (1 - alpha)),
        Math.round(sourceData[index + 1] * alpha + 255 * (1 - alpha)),
        Math.round(sourceData[index + 2] * alpha + 255 * (1 - alpha)),
      ]
      const matched = getNearestPaletteColor(
        shouldDither ? applyTinyDither(rgb, x, y, size.width, size.height) : rgb,
        activePalette,
      )
      const countKey = `${matched.displayBrand}-${matched.displayCode}-${matched.hex}`
      const count = countMap.get(countKey)

      cells.push({ code: matched.code, displayCode: matched.displayCode, hex: matched.hex })
      countMap.set(countKey, {
        ...matched,
        count: count ? count.count + 1 : 1,
      })

      const cellX = x * previewScale
      const cellY = y * previewScale
      const centerX = cellX + previewScale / 2
      const centerY = cellY + previewScale / 2
      const radius = Math.max(1.6, previewScale * 0.4)

      outputContext.beginPath()
      outputContext.arc(centerX, centerY, radius, 0, Math.PI * 2)
      outputContext.fillStyle = matched.hex
      outputContext.fill()
      outputContext.lineWidth = Math.max(0.6, previewScale * 0.055)
      outputContext.strokeStyle = 'rgba(22, 18, 14, 0.16)'
      outputContext.stroke()

      const gradient = outputContext.createRadialGradient(
        centerX - radius * 0.42,
        centerY - radius * 0.45,
        radius * 0.08,
        centerX,
        centerY,
        radius,
      )
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.72)')
      gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.08)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.13)')
      outputContext.fillStyle = gradient
      outputContext.fill()

      if (previewScale >= 10) {
        outputContext.fillStyle = getReadableTextColor(matched.rgb)
        outputContext.font = `700 ${Math.floor(previewScale * 0.28)}px Arial, sans-serif`
        outputContext.textAlign = 'center'
        outputContext.textBaseline = 'middle'
        outputContext.fillText(matched.displayCode, centerX, centerY, previewScale * 0.88)
      }
    }
  }

  const counts = Array.from(countMap.values()).sort((a, b) => b.count - a.count)

  return {
    width: size.width,
    height: size.height,
    cells,
    paletteMode,
    namingBrand,
    imageUrl: drawPatternSheet(cells, size.width, size.height, counts, paletteMode, namingBrand),
    counts,
  }
}

function App() {
  const [view, setView] = useState<AppView>('studio')
  const [selectedSize, setSelectedSize] = useState(sizePresets[2])
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(221)
  const [namingBrand, setNamingBrand] = useState<NamingBrand>('mard')
  const [dither, setDither] = useState(true)
  const [uploadedName, setUploadedName] = useState('等待上传图片')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [communityConversions, setCommunityConversions] = useState<Record<string, ConversionResult>>({})
  const [studioDownloadResolution, setStudioDownloadResolution] = useState<DownloadResolutionId>('original')
  const [communityDownloadResolution, setCommunityDownloadResolution] = useState<DownloadResolutionId>('original')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authNotice, setAuthNotice] = useState<AuthNotice>({ type: 'idle', message: '' })
  const [authLocked, setAuthLocked] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactBrand, setContactBrand] = useState('')
  const [contactReplyEmail, setContactReplyEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactNotice, setContactNotice] = useState<AuthNotice>({ type: 'idle', message: '' })
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const appRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const conversionRunIdRef = useRef(0)
  const communityConversionStartedRef = useRef(false)
  const authAttemptsRef = useRef<number[]>([])

  const totalBeads = selectedSize.width * selectedSize.height
  const selectedCommunityDownloadResolution = downloadResolutions.find(
    (resolution) => resolution.id === communityDownloadResolution,
  ) ?? downloadResolutions[1]
  const selectedStudioDownloadResolution = downloadResolutions.find(
    (resolution) => resolution.id === studioDownloadResolution,
  ) ?? downloadResolutions[1]
  const displayPalette = useMemo(() => getPaletteByMode(paletteMode, namingBrand), [paletteMode, namingBrand])
  const displayedCounts = conversion?.counts.slice(0, 5) ?? [
    { ...displayPalette[0], count: 418 },
    { ...displayPalette[13], count: 286 },
    { ...displayPalette[38], count: 244 },
    { ...displayPalette[25], count: 198 },
    { ...displayPalette[121], count: 136 },
  ]

  const fallbackPreviewCells = useMemo(
    () =>
      fallbackCells.map((color, index) => (
        <span
          className="pixel-cell"
          key={`${color}-${index}`}
          style={{
            backgroundColor: color,
            animationDelay: `${(index % 5) * 0.04}s`,
          }}
        />
      )),
    [],
  )

  useLayoutEffect(() => {
    if (!appRef.current) return

    const context = gsap.context(() => {
      window.history.scrollRestoration = 'manual'
      window.scrollTo(0, 0)
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill())

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.site-nav', { y: -18, duration: 0.8 })
        .from('.hero-copy > *', { y: 34, stagger: 0.09, duration: 0.9 }, '-=0.45')
        .from('.studio-panel', { y: 54, rotateX: 6, duration: 1 }, '-=0.65')
        .from('.pixel-board', { scale: 0.88, rotate: -4, duration: 0.65 }, '-=0.35')

      gsap.to('.hero-background img', {
        yPercent: 18,
        scale: 1.12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.parallax-bead.is-coral', {
        y: -210,
        x: 70,
        rotate: 26,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.parallax-bead.is-teal', {
        y: -145,
        x: -60,
        rotate: -18,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.parallax-bead.is-yellow', {
        y: -280,
        x: -30,
        rotate: 34,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.studio-panel', {
        yPercent: -22,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.hero-copy', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.scroll-cue', {
        y: 42,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: '35% top',
          scrub: true,
        },
      })

      gsap.to('.spec-card:first-child', {
        y: -140,
        x: -36,
        ease: 'none',
        scrollTrigger: {
          trigger: '.white-space-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.spec-card:last-child', {
        y: 160,
        x: 42,
        ease: 'none',
        scrollTrigger: {
          trigger: '.white-space-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })

      ScrollTrigger.refresh()
    }, appRef)

    return () => context.revert()
  }, [])

  useEffect(() => {
    if (view !== 'community' || communityConversionStartedRef.current) return

    communityConversionStartedRef.current = true

    let cancelled = false

    Promise.all(
      communityPatterns.map((pattern) =>
        convertImageUrlToBeads(pattern.sourceImage, pattern.size, true, pattern.paletteMode, pattern.namingBrand).then(
          (result) => [pattern.title, result] as const,
        ),
      ),
    )
      .then((entries) => {
        if (cancelled) return
        setCommunityConversions(Object.fromEntries(entries))
      })
      .catch(() => {
        if (cancelled) return
        setCommunityConversions({})
      })

    return () => {
      cancelled = true
    }
  }, [view])

  const startConversion = useCallback((
    file: File,
    size: SizePreset,
    shouldDither: boolean,
    nextPaletteMode: PaletteMode,
    nextNamingBrand: NamingBrand,
  ) => {
    const runId = conversionRunIdRef.current + 1
    conversionRunIdRef.current = runId
    setStatus('processing')
    setErrorMessage('')

    convertImageToBeads(file, size, shouldDither, nextPaletteMode, nextNamingBrand)
      .then((result) => {
        if (conversionRunIdRef.current !== runId) return
        setConversion(result)
        setStatus('ready')
        requestAnimationFrame(() => {
          if (!previewRef.current) return
          gsap.fromTo(
            previewRef.current,
            { scale: 0.94, rotate: -1 },
            { scale: 1, rotate: 0, duration: 0.55, ease: 'power3.out' },
          )
        })
      })
      .catch((error: unknown) => {
        if (conversionRunIdRef.current !== runId) return
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : '图片转换失败，请重试。')
      })
  }, [])

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setStatus('error')
      setErrorMessage('请上传 PNG、JPG 或 WebP 图片。')
      return
    }

    setUploadedName(file.name)
    setUploadedFile(file)
    startConversion(file, selectedSize, dither, paletteMode, namingBrand)
  }, [dither, namingBrand, paletteMode, selectedSize, startConversion])

  const handleSizeChange = useCallback((preset: SizePreset) => {
    setSelectedSize(preset)
    if (uploadedFile) startConversion(uploadedFile, preset, dither, paletteMode, namingBrand)
  }, [dither, namingBrand, paletteMode, startConversion, uploadedFile])

  const handlePaletteModeChange = useCallback((nextPaletteMode: PaletteMode) => {
    setPaletteMode(nextPaletteMode)
    if (uploadedFile) startConversion(uploadedFile, selectedSize, dither, nextPaletteMode, namingBrand)
  }, [dither, namingBrand, selectedSize, startConversion, uploadedFile])

  const handleNamingBrandChange = useCallback((nextNamingBrand: NamingBrand) => {
    setNamingBrand(nextNamingBrand)
    if (uploadedFile) startConversion(uploadedFile, selectedSize, dither, paletteMode, nextNamingBrand)
  }, [dither, paletteMode, selectedSize, startConversion, uploadedFile])

  const handleDitherChange = useCallback(() => {
    const nextDither = !dither
    setDither(nextDither)
    if (uploadedFile) startConversion(uploadedFile, selectedSize, nextDither, paletteMode, namingBrand)
  }, [dither, namingBrand, paletteMode, selectedSize, startConversion, uploadedFile])

  const downloadPng = useCallback(async () => {
    if (!conversion) return

    const imageUrl = await resizeDataUrl(conversion.imageUrl, selectedStudioDownloadResolution.scale)
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `${uploadedName.replace(/\.[^.]+$/, '') || 'bead-pattern'}-${BRAND_LABELS[conversion.namingBrand]}-${conversion.paletteMode}-${conversion.width}x${conversion.height}-${selectedStudioDownloadResolution.id}-codes.png`
    link.click()
  }, [conversion, selectedStudioDownloadResolution, uploadedName])

  const downloadCsv = useCallback(() => {
    if (!conversion) return

    const usageRows = conversion.counts.map((color) => [
      'usage',
      color.displayCode,
      color.code,
      color.hex,
      String(color.count),
      '',
      '',
    ])
    const gridRows = conversion.cells.map((cell, index) => [
      'cell',
      cell.displayCode,
      cell.code,
      cell.hex,
      '1',
      String((index % conversion.width) + 1),
      String(Math.floor(index / conversion.width) + 1),
    ])
    const rows = [
      ['type', 'display_code', 'mard_code', 'hex', 'count', 'x', 'y'],
      ...usageRows,
      ...gridRows,
    ]
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `${uploadedName.replace(/\.[^.]+$/, '') || 'bead-pattern'}-${BRAND_LABELS[conversion.namingBrand]}-${conversion.paletteMode}-${conversion.width}x${conversion.height}.csv`
    link.click()
    URL.revokeObjectURL(objectUrl)
  }, [conversion, uploadedName])

  const openStudio = useCallback(() => {
    setView('studio')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [])

  const openCommunity = useCallback(() => {
    setView('community')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [])

  const openLogin = useCallback(() => {
    setView('login')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [])

  const openContact = useCallback(() => {
    setView('contact')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [])

  const downloadCommunityPattern = useCallback(async (
    pattern: CommunityPattern,
    result: ConversionResult | undefined,
    resolution: DownloadResolutionId,
  ) => {
    if (!result) return

    const targetResolution = downloadResolutions.find((item) => item.id === resolution) ?? downloadResolutions[1]
    const imageUrl = await resizeDataUrl(result.imageUrl, targetResolution.scale)
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `${pattern.title.replace(/\s+/g, '-')}-${BRAND_LABELS[pattern.namingBrand]}-${pattern.paletteMode}-${pattern.size.width}x${pattern.size.height}-${targetResolution.id}-pattern-sheet.png`
    link.click()
  }, [])

  const handleAuthSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const now = Date.now()
    if (authLocked) {
      setAuthNotice({ type: 'error', message: '提交过于频繁，请稍后再试。' })
      return
    }

    const { allowed, recentAttempts } = canSubmitAuth(authAttemptsRef.current, now)
    if (!allowed) {
      authAttemptsRef.current = recentAttempts
      setAuthLocked(true)
      setAuthNotice({ type: 'error', message: '尝试次数过多，已临时锁定 30 秒。' })
      window.setTimeout(() => {
        authAttemptsRef.current = []
        setAuthLocked(false)
      }, authLockMs)
      return
    }

    authAttemptsRef.current = [...recentAttempts, now]

    const email = sanitizeAuthInput(authEmail).toLowerCase()
    const password = authPassword.slice(0, 128)
    const confirmPassword = authConfirmPassword.slice(0, 128)

    if (!validateEmail(email)) {
      setAuthNotice({ type: 'error', message: '请输入有效邮箱地址。' })
      return
    }

    if (suspiciousSqlPattern.test(password)) {
      setAuthNotice({ type: 'error', message: '输入包含不允许的特殊片段，请修改后重试。' })
      return
    }

    if (password.length < 8) {
      setAuthNotice({ type: 'error', message: '密码至少需要 8 位。' })
      return
    }

    if (authMode === 'register' && password !== confirmPassword) {
      setAuthNotice({ type: 'error', message: '两次输入的密码不一致。' })
      return
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: authMode,
          email,
          password,
          confirmPassword,
        }),
      })
      const data = await response.json() as { message?: string }

      if (!response.ok) {
        setAuthNotice({ type: 'error', message: data.message ?? '认证请求失败，请稍后重试。' })
        return
      }

      setAuthEmail(email)
      setAuthNotice({
        type: 'success',
        message: data.message ?? (authMode === 'register' ? '注册信息已通过后端校验。' : '登录信息已通过后端校验。'),
      })
    } catch {
      setAuthNotice({ type: 'error', message: '无法连接后端接口，请检查 Vercel API 或本地服务。' })
    }
  }, [authConfirmPassword, authEmail, authLocked, authMode, authPassword])

  const handleContactSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = sanitizeAuthInput(contactName)
    const brand = sanitizeAuthInput(contactBrand)
    const email = sanitizeAuthInput(contactReplyEmail).toLowerCase()
    const message = contactMessage.trim().replace(/[<>"`\\]/g, '').slice(0, 1_000)

    if (!name || !brand || message.length < 8) {
      setContactNotice({ type: 'error', message: '请补充姓名、品牌和合作需求。' })
      return
    }

    if (!validateEmail(email)) {
      setContactNotice({ type: 'error', message: '请输入有效联系邮箱。' })
      return
    }

    setContactSubmitting(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, brand, email, message }),
      })
      const data = await response.json() as { message?: string; salesEmail?: string }

      if (!response.ok) {
        setContactNotice({ type: 'error', message: data.message ?? '提交失败，请稍后重试。' })
        return
      }

      setContactName(name)
      setContactBrand(brand)
      setContactReplyEmail(email)
      setContactMessage(message)
      setContactNotice({
        type: 'success',
        message: data.message ?? `合作咨询已校验，请同时发送邮件到 ${data.salesEmail ?? contactEmail}。`,
      })
    } catch {
      setContactNotice({ type: 'error', message: '无法连接后端接口，请直接发送邮件联系。' })
    } finally {
      setContactSubmitting(false)
    }
  }, [contactBrand, contactMessage, contactName, contactReplyEmail])

  return (
    <main className={view === 'studio' ? 'app-shell' : 'app-shell app-shell-simple'} ref={appRef}>
      <section className={view === 'studio' ? 'hero-section' : 'hero-section hero-section-simple'} aria-labelledby="page-title">
        <div className="hero-background" aria-hidden="true">
          <img src={heroImage} alt="" />
        </div>
        <div className="parallax-beads" aria-hidden="true">
          <span className="parallax-bead is-coral" />
          <span className="parallax-bead is-teal" />
          <span className="parallax-bead is-yellow" />
        </div>

        <nav className="site-nav" aria-label="Primary navigation">
          <button className="brand brand-button" type="button" onClick={openStudio} aria-label="PixelBeads home">
            <span className="brand-mark">
              <Sparkles size={18} strokeWidth={2.2} />
            </span>
            PixelBeads
          </button>
          <div className="nav-actions">
            <button className={view === 'studio' ? 'is-active' : ''} type="button" onClick={openStudio}>
              <Wand2 size={16} />
              工作台
            </button>
            <button className={view === 'community' ? 'is-active' : ''} type="button" onClick={openCommunity}>
              <Users size={16} />
              社区
            </button>
            <button className={view === 'login' ? 'is-active' : ''} type="button" onClick={openLogin}>
              <UserRound size={16} />
              登录
            </button>
            <button className={view === 'contact' ? 'is-active' : ''} type="button" onClick={openContact}>
              <Mail size={16} />
              联系我们
            </button>
            <button type="button" onClick={() => (view === 'studio' ? fileInputRef.current?.click() : openStudio())}>
              <Upload size={17} />
              上传图片
            </button>
          </div>
        </nav>

        {view === 'studio' ? (
        <>
        <div className="hero-content view-panel" id="top">
          <div className="hero-copy">
            <p className="eyebrow">Image to bead pattern studio</p>
            <h1 id="page-title">上传图片，生成固定像素拼豆图。</h1>
            <p className="hero-lede">
              为头像、角色图、纪念照片和手作礼物设计的在线转换工具。控制尺寸、色板和抖动效果，在一个干净的编辑台里完成从图片到拼豆图纸的第一步。
            </p>
            <div className="hero-buttons" aria-label="Primary actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <ImageUp size={18} />
                选择图片
              </button>
              <a href="#studio">
                查看工作台
                <ArrowDown size={18} />
              </a>
            </div>
          </div>

          <section className="glass-panel studio-panel" id="studio" aria-label="拼豆图生成工作台">
            <div className="panel-header">
              <div>
                <p>当前任务</p>
                <h2>{uploadedName}</h2>
              </div>
              <span className={`status-pill status-${status}`}>
                <span />
                {status === 'processing' ? '转换中' : status === 'ready' ? '已生成' : status === 'error' ? '需重试' : '待上传'}
              </span>
            </div>

            <div
              className="upload-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                event.currentTarget.classList.add('is-dragging')
              }}
              onDragLeave={(event) => {
                event.currentTarget.classList.remove('is-dragging')
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.currentTarget.classList.remove('is-dragging')
                handleFile(event.dataTransfer.files[0])
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <span className="upload-icon">
                <Upload size={24} />
              </span>
              <div>
                <strong>拖拽或点击上传图片</strong>
                <small>{status === 'processing' ? '正在转换为拼豆图...' : 'PNG、JPG、WebP，建议主体清晰。'}</small>
              </div>
            </div>

            {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

            <div className="control-group" aria-label="选择固定像素尺寸">
              {sizePresets.map((preset) => (
                <button
                  className={preset.label === selectedSize.label ? 'is-active' : ''}
                  key={preset.label}
                  type="button"
                  onClick={() => handleSizeChange(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="option-stack" aria-label="拼豆色卡和命名设置">
              <div className="option-block">
                <div className="option-heading">
                  <span>匹配色卡</span>
                  <strong>MARD {paletteMode} 色</strong>
                </div>
                <div className="segmented-control">
                  {PALETTE_MODES.map((mode) => (
                    <button
                      className={mode === paletteMode ? 'is-active' : ''}
                      key={mode}
                      type="button"
                      onClick={() => handlePaletteModeChange(mode)}
                    >
                      {mode} 色
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-block">
                <div className="option-heading">
                  <span>格内命名</span>
                  <strong>{BRAND_LABELS[namingBrand]}</strong>
                </div>
                <div className="brand-control">
                  {NAMING_BRANDS.map((brand) => (
                    <button
                      className={brand.id === namingBrand ? 'is-active' : ''}
                      key={brand.id}
                      type="button"
                      title={brand.description}
                      onClick={() => handleNamingBrandChange(brand.id)}
                    >
                      {brand.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="studio-grid">
              <div className="pixel-preview" aria-label="拼豆预览" ref={previewRef}>
                {conversion ? (
                  <img className="converted-image" src={conversion.imageUrl} alt="转换后的拼豆图预览" />
                ) : (
                  <div className="pixel-board">{fallbackPreviewCells}</div>
                )}
                {status === 'processing' ? (
                  <div className="processing-mask">
                    <Wand2 size={20} />
                    转换中
                  </div>
                ) : null}
              </div>

              <div className="summary-card">
                <div>
                  <span>目标格数</span>
                  <strong>{totalBeads.toLocaleString()}</strong>
                </div>
                <div>
                  <span>图纸命名</span>
                  <strong>{BRAND_LABELS[namingBrand]}</strong>
                  <small>{paletteMode} 色</small>
                </div>
                <label className="toggle-row">
                  <span>
                    <strong>智能抖动</strong>
                    <small>保留渐变和阴影</small>
                  </span>
                  <input checked={dither} onChange={handleDitherChange} type="checkbox" />
                </label>
              </div>
            </div>

            <div className="palette-list" aria-label="颜色用量">
              {displayedCounts.map((color) => (
                <div className="palette-row" key={`${color.displayBrand}-${color.displayCode}-${color.hex}`}>
                  <span className="swatch" style={{ backgroundColor: color.hex }} />
                  <span>{color.displayCode}</span>
                  <strong>{color.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
        <a className="scroll-cue" href="#workflow" aria-label="继续下滑查看流程">
          <span />
          Scroll
        </a>
        </>
        ) : null}
        {view === 'community' ? (
          <section className="community-page view-panel" aria-labelledby="page-title">
            <div className="community-hero">
              <p className="eyebrow">Community patterns</p>
              <h1 id="page-title">下载社区分享的拼豆图纸。</h1>
              <p>
                示例作品会先用普通插画作为源图，再通过网页内同一套转换逻辑生成带坐标、格线、每格色号和颜色用量的 PNG 图纸。
              </p>
              <div className="community-toolbar" aria-label="社区筛选">
                <label>
                  <Search size={17} />
                  <input placeholder="搜索图纸、作者或标签" type="search" />
                </label>
                <div className="download-resolution-control" aria-label="下载分辨率">
                  {downloadResolutions.map((resolution) => (
                    <button
                      className={resolution.id === communityDownloadResolution ? 'is-active' : ''}
                      key={resolution.id}
                      type="button"
                      title={resolution.description}
                      onClick={() => setCommunityDownloadResolution(resolution.id)}
                    >
                      {resolution.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={openStudio}>
                  <ImageUp size={17} />
                  上传并生成
                </button>
              </div>
              <p className="download-resolution-note">
                当前下载：{selectedCommunityDownloadResolution.label}。卡片仍按作者发布尺寸展示，不会改变社区预览尺寸。
              </p>
            </div>

            <div className="community-grid">
              {communityPatterns.map((pattern) => {
                const patternResult = communityConversions[pattern.title]

                return (
                  <article className="pattern-card" key={pattern.title}>
                    <div className="pattern-image">
                      {patternResult ? (
                        <img src={patternResult.imageUrl} alt={`${pattern.title} 拼豆图纸预览`} />
                      ) : (
                        <div className="pattern-generating">
                          <Wand2 size={22} />
                          正在生成图纸
                        </div>
                      )}
                    </div>
                    <div className="pattern-body">
                      <div>
                        <p>{pattern.author}</p>
                        <h2>{pattern.title}</h2>
                      </div>
                      <div className="pattern-meta" aria-label="图纸信息">
                        <span>{pattern.size.label}</span>
                        <span>{patternResult ? `${patternResult.counts.length} 色` : `${pattern.paletteMode} 色卡`}</span>
                        <span>{pattern.downloads} 下载</span>
                      </div>
                      <div className="pattern-tags">
                        {pattern.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <div className="pattern-actions">
                        <button
                          type="button"
                          disabled={!patternResult}
                          onClick={() => downloadCommunityPattern(pattern, patternResult, communityDownloadResolution)}
                        >
                          <Download size={17} />
                          下载图纸
                        </button>
                        <button aria-label={`收藏 ${pattern.title}`} type="button">
                          <Heart size={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <aside className="community-contact-strip">
              <span>广告合作开放中</span>
              <strong>社区广告招商、材料包合作和品牌赞助请前往联系我们。</strong>
              <button type="button" onClick={openContact}>查看合作方式</button>
            </aside>
          </section>
        ) : null}
        {view === 'login' ? (
          <section className="login-page view-panel" aria-labelledby="page-title">
            <div className="login-copy">
              <p className="eyebrow">Member account</p>
              <h1 id="page-title">{authMode === 'register' ? '注册后发布图纸和管理下载。' : '登录后保存图纸和发布作品。'}</h1>
              <p>
                当前为前端模拟账户流程，注册不会创建真实账户；已加入邮箱格式校验、输入清洗和提交频率限制，真实抗 DoS、DDoS 和 SQL 注入仍需后端、数据库参数化查询、CDN 与 WAF 配合。
              </p>
              <div className="login-highlights">
                <span>
                  <ShieldCheck size={18} />
                  频率限制
                </span>
                <span>
                  <Users size={18} />
                  邮箱校验
                </span>
                <span>
                  <Download size={18} />
                  输入清洗
                </span>
              </div>
            </div>

            <form className="glass-panel login-card" onSubmit={handleAuthSubmit}>
              <div className="login-card-header">
                <span className="brand-mark">
                  <LogIn size={18} />
                </span>
                <div>
                  <p>PixelBeads Account</p>
                  <h2>{authMode === 'register' ? '创建账户' : '欢迎回来'}</h2>
                </div>
              </div>
              <div className="auth-mode-toggle" aria-label="登录或注册">
                <button
                  className={authMode === 'login' ? 'is-active' : ''}
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthNotice({ type: 'idle', message: '' })
                  }}
                >
                  登录
                </button>
                <button
                  className={authMode === 'register' ? 'is-active' : ''}
                  type="button"
                  onClick={() => {
                    setAuthMode('register')
                    setAuthNotice({ type: 'idle', message: '' })
                  }}
                >
                  注册
                </button>
              </div>
              <label>
                <span>邮箱</span>
                <div className="input-shell">
                  <Mail size={18} />
                  <input
                    autoComplete="email"
                    inputMode="email"
                    maxLength={120}
                    onChange={(event) => setAuthEmail(sanitizeAuthInput(event.target.value))}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={authEmail}
                  />
                </div>
              </label>
              <label>
                <span>密码</span>
                <div className="input-shell">
                  <ShieldCheck size={18} />
                  <input
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="至少 8 位"
                    required
                    type="password"
                    value={authPassword}
                  />
                </div>
              </label>
              {authMode === 'register' ? (
                <label>
                  <span>确认密码</span>
                  <div className="input-shell">
                    <ShieldCheck size={18} />
                    <input
                      autoComplete="new-password"
                      maxLength={128}
                      minLength={8}
                      onChange={(event) => setAuthConfirmPassword(event.target.value)}
                      placeholder="再次输入密码"
                      required
                      type="password"
                      value={authConfirmPassword}
                    />
                  </div>
                </label>
              ) : null}
              {authNotice.message ? (
                <p className={`auth-notice auth-${authNotice.type}`}>{authNotice.message}</p>
              ) : null}
              <button type="submit" disabled={authLocked}>
                {authMode === 'register' ? '注册' : '登录'}
              </button>
              <p>
                前端限制只能减少误操作和低频滥用；上线时必须在后端做限流、验证码、密码哈希、参数化查询、CSRF 防护、日志审计和 WAF/CDN 防护。
              </p>
            </form>
          </section>
        ) : null}
        {view === 'contact' ? (
          <section className="contact-page view-panel" aria-labelledby="page-title">
            <div className="contact-hero">
              <p className="eyebrow">Advertise with PixelBeads</p>
              <h1 id="page-title">联系我们，预定拼豆社区广告位。</h1>
              <p>
                面向拼豆材料、底板工具、收纳、打印、手作课程和 IP 授权合作预留招商入口。可提交合作需求，也可以直接发送邮件到：
              </p>
              <a className="contact-mail" href={`mailto:${contactEmail}?subject=PixelBeads 广告合作咨询`}>
                <Mail size={20} />
                {contactEmail}
              </a>
            </div>

            <form className="glass-panel contact-form" onSubmit={handleContactSubmit}>
              <label>
                <span>联系人</span>
                <input
                  maxLength={80}
                  onChange={(event) => setContactName(sanitizeAuthInput(event.target.value))}
                  placeholder="姓名或称呼"
                  required
                  value={contactName}
                />
              </label>
              <label>
                <span>品牌 / 店铺</span>
                <input
                  maxLength={120}
                  onChange={(event) => setContactBrand(sanitizeAuthInput(event.target.value))}
                  placeholder="品牌、店铺或机构名称"
                  required
                  value={contactBrand}
                />
              </label>
              <label>
                <span>联系邮箱</span>
                <input
                  inputMode="email"
                  maxLength={120}
                  onChange={(event) => setContactReplyEmail(sanitizeAuthInput(event.target.value))}
                  placeholder="brand@example.com"
                  required
                  type="email"
                  value={contactReplyEmail}
                />
              </label>
              <label>
                <span>合作需求</span>
                <textarea
                  maxLength={1000}
                  onChange={(event) => setContactMessage(event.target.value)}
                  placeholder="希望投放的位置、预算区间、周期或材料包合作方式"
                  required
                  rows={5}
                  value={contactMessage}
                />
              </label>
              {contactNotice.message ? (
                <p className={`auth-notice auth-${contactNotice.type}`}>{contactNotice.message}</p>
              ) : null}
              <button type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? '提交中' : '提交合作需求'}
              </button>
            </form>

            <div className="contact-grid">
              {adSlots.map((slot) => (
                <article className="ad-plan-card" key={slot.id}>
                  <span>招商位</span>
                  <h2>{slot.label}</h2>
                  <dl>
                    <div>
                      <dt>建议尺寸</dt>
                      <dd>{slot.size}</dd>
                    </div>
                    <div>
                      <dt>适合渠道</dt>
                      <dd>{slot.channel}</dd>
                    </div>
                  </dl>
                  <p>{slot.note}</p>
                </article>
              ))}
            </div>

            <div className="channel-steps contact-steps">
              <h2>广告接入和风控预留</h2>
              <ol>
                <li>程序化广告位用 AdSlot 组件承载，后续接 Google AdSense、百度联盟或 Google Ad Manager。</li>
                <li>直投招商只展示已审核的图片、链接和落地页，后台需要配置素材白名单与下线开关。</li>
                <li>联盟广告适合材料包推荐，链接需增加 rel="sponsored noopener" 并标注广告或赞助。</li>
                <li>广告请求应延迟加载，配合频控、曝光统计、点击异常检测和服务端日志。</li>
              </ol>
            </div>
          </section>
        ) : null}
      </section>

      {view === 'studio' ? (
      <>
      <section className="white-space-section" id="workflow" aria-labelledby="workflow-title">
        <div className="floating-spec" aria-hidden="true">
          <div className="spec-card">
            <Layers3 size={20} />
            <span>Color match</span>
          </div>
          <div className="spec-card">
            <Wand2 size={20} />
            <span>Canvas pixel</span>
          </div>
        </div>

        <div className="section-heading">
          <p className="eyebrow">Workflow</p>
          <h2 id="workflow-title">留出大量空白，让复杂处理变得清楚。</h2>
          <p>
            页面不把用户推向说明文，而是把上传、定格、配色和导出拆成清晰的操作区。玻璃面板只用于关键工具，其他内容保持轻量和可扫描。
          </p>
        </div>

        <div className="step-grid">
          {processSteps.map((step) => {
            const Icon = step.icon
            return (
              <article className="step-card" key={step.title}>
                <div className="step-icon">
                  <Icon size={21} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="export-section" id="exports" aria-labelledby="exports-title">
        <div className="export-copy">
          <p className="eyebrow">Output</p>
          <h2 id="exports-title">上传后即可查看转换结果。</h2>
          <p>
            当前版本已在浏览器内完成固定尺寸裁剪、像素化、144/221 色卡匹配，以及带坐标、格线和每格色号的 PNG 图纸生成。
          </p>
        </div>
        <div className="glass-panel export-panel">
          <div className="download-resolution-block">
            <div>
              <span>PNG 下载分辨率</span>
              <strong>{selectedStudioDownloadResolution.label}</strong>
            </div>
            <div className="download-resolution-control" aria-label="工作台 PNG 下载分辨率">
              {downloadResolutions.map((resolution) => (
                <button
                  className={resolution.id === studioDownloadResolution ? 'is-active' : ''}
                  key={resolution.id}
                  type="button"
                  title={resolution.description}
                  onClick={() => setStudioDownloadResolution(resolution.id)}
                >
                  {resolution.label}
                </button>
              ))}
            </div>
          </div>
          <div className="export-row">
            <span>PNG 色号图纸</span>
            <button type="button" aria-label="导出 PNG" disabled={!conversion} onClick={downloadPng}>
              <Download size={18} />
            </button>
          </div>
          <div className="export-row">
            <span>CSV 用量表</span>
            <button type="button" aria-label="导出 CSV" disabled={!conversion} onClick={downloadCsv}>
              <Download size={18} />
            </button>
          </div>
          <div className="export-row">
            <span>PDF 打印图纸</span>
            <button type="button" aria-label="导出 PDF" disabled>
              <Download size={18} />
            </button>
          </div>
        </div>
        <aside className="ad-slot ad-slot-export" aria-label="导出页广告位">
          <span>广告</span>
          <strong>导出完成后的横幅广告位</strong>
          <p>适合接入 AdSense 自动广告、百度联盟横幅，或直接售卖给拼豆材料店。</p>
        </aside>
      </section>
      </>
      ) : null}
    </main>
  )
}

export default App
