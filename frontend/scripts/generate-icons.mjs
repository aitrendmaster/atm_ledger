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

console.log('\nNext:')
console.log('  npx capacitor-assets generate --android')
console.log('  npx cap sync android')
