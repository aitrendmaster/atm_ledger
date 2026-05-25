/**
 * Capacitor 아이콘/스플래시 자산 생성 스크립트.
 *
 * public/logo-square.svg 를 기반으로:
 *   resources/icon.png        (1024x1024)    — @capacitor/assets 의 입력
 *   resources/icon-only.png   (1024x1024)    — Android 적응형 아이콘 foreground
 *   resources/icon-background.png (1024x1024) — 단색 베이지 배경
 *   resources/splash.png      (2732x2732)    — light 테마 스플래시
 *
 * 사용:
 *   npm install -D sharp @capacitor/assets
 *   node scripts/generate-icons.mjs
 *   npx capacitor-assets generate --android
 *
 * 그 다음:
 *   npm run build:mobile && npx cap sync android
 *   Android Studio Rebuild + Run → 새 아이콘 적용
 */
import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'logo-square.svg')
const OUT = path.join(ROOT, 'resources')

const CREAM = { r: 251, g: 248, b: 243, alpha: 1 } // #FBF8F3 (앱 배경)

await fs.mkdir(OUT, { recursive: true })

const svgBuffer = await fs.readFile(SRC)
console.log(`✓ Source loaded: ${SRC}`)

// 1) 일반 아이콘 (배경 포함 전체 1024x1024 로고)
await sharp(svgBuffer, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: CREAM })
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, 'icon.png'))
console.log('✓ resources/icon.png (1024x1024)')

// 2) Android 적응형 아이콘 foreground (안전 영역 안에 로고만, 외곽 투명)
//    실제 안드로이드 launcher 는 이걸 마스크해서 표시. 외곽 ~25% 영역은 잘릴 수 있음.
//    그래서 원본을 64% 크기로 축소해서 가운데 배치.
const foregroundOnly = await sharp(svgBuffer, { density: 384 })
  .resize(660, 660, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: foregroundOnly, gravity: 'center' }])
  .png()
  .toFile(path.join(OUT, 'icon-only.png'))
console.log('✓ resources/icon-only.png (1024x1024, foreground)')

// 3) Android 적응형 아이콘 background (단색 베이지)
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: CREAM,
  },
})
  .png()
  .toFile(path.join(OUT, 'icon-background.png'))
console.log('✓ resources/icon-background.png (1024x1024, solid cream)')

// 4) 스플래시 (정사각 2732x2732, 가운데 로고)
const splashLogo = await sharp(svgBuffer, { density: 768 })
  .resize(800, 800, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: CREAM,
  },
})
  .composite([{ input: splashLogo, gravity: 'center' }])
  .png()
  .toFile(path.join(OUT, 'splash.png'))
console.log('✓ resources/splash.png (2732x2732, light)')

// 5) Play Store 앱 아이콘 512x512 (정확한 크기 요구사항)
await sharp(svgBuffer, { density: 256 })
  .resize(512, 512, { fit: 'contain', background: CREAM })
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, 'play-icon-512.png'))
console.log('✓ resources/play-icon-512.png (Play Store 앱 아이콘)')

// 6) Play Store 피처 그래픽 1024x500 (스토어 상단 배너)
const featureLogo = await sharp(svgBuffer, { density: 192 })
  .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
// 좌측에 로고, 우측에 텍스트 — 단색 배경 (브랜드 컬러)
const featureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="#FBF8F3"/>
  <rect x="0" y="0" width="1024" height="500" fill="url(#g)" opacity="0.08"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E07856"/>
      <stop offset="1" stop-color="#FBF8F3"/>
    </linearGradient>
  </defs>
  <text x="430" y="200" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="56" font-weight="700" fill="#7A6B5F" letter-spacing="-1">대화하듯 기록하는</text>
  <text x="430" y="300" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="108" font-weight="900" fill="#E07856" letter-spacing="-4">Moa365</text>
  <text x="430" y="370" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="40" font-weight="700" fill="#2A1F1A" letter-spacing="-1">AI 가계부 · 매일 1분</text>
  <text x="430" y="420" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="26" font-weight="500" fill="#7A6B5F" letter-spacing="-0.5">한 줄 던지면, Moa가 분류해줘요</text>
</svg>
`
await sharp(Buffer.from(featureSvg))
  .composite([{ input: featureLogo, left: 50, top: 70 }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, 'feature-graphic.png'))
console.log('✓ resources/feature-graphic.png (1024x500, Play Store 피처 그래픽)')

// 7) PWA manifest 아이콘 (public/icons/)
const ICONS_OUT = path.join(ROOT, 'public', 'icons')
await fs.mkdir(ICONS_OUT, { recursive: true })

// any-purpose 192x192 (Android home screen, browser tab fallback)
await sharp(svgBuffer, { density: 192 })
  .resize(192, 192, { fit: 'contain', background: CREAM })
  .png({ compressionLevel: 9 })
  .toFile(path.join(ICONS_OUT, 'icon-192.png'))
console.log('✓ public/icons/icon-192.png')

// any-purpose 512x512 (PWA install, splash fallback)
await sharp(svgBuffer, { density: 384 })
  .resize(512, 512, { fit: 'contain', background: CREAM })
  .png({ compressionLevel: 9 })
  .toFile(path.join(ICONS_OUT, 'icon-512.png'))
console.log('✓ public/icons/icon-512.png')

// maskable 512x512 (safe zone = inner ~80%, OS crops outer ring)
// → 로고를 80% 크기로 축소해 가운데 배치, 외곽은 cream으로 채움
const maskableInner = await sharp(svgBuffer, { density: 384 })
  .resize(410, 410, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: CREAM },
})
  .composite([{ input: maskableInner, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(ICONS_OUT, 'maskable-512.png'))
console.log('✓ public/icons/maskable-512.png')

console.log('\nNext:')
console.log('  npx capacitor-assets generate --android   # 앱 안 아이콘/스플래시 적용')
console.log('  → resources/play-icon-512.png 와 feature-graphic.png 는 Play Console 직접 업로드')
