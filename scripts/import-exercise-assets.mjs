import fs from 'node:fs/promises'
import path from 'node:path'

const manifestPath = path.resolve('scripts/exercise-asset-manifest.json')
const outputDir = path.resolve('public/exercise-reference/imported')

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  await fs.mkdir(outputDir, { recursive: true })

  for (const item of manifest.exercises) {
    if (!item.sourceUrl) {
      console.warn(`Skipping ${item.slug}: missing sourceUrl`)
      continue
    }

    const response = await fetch(item.sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to download ${item.slug} from ${item.sourceUrl}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const ext = path.extname(new URL(item.sourceUrl).pathname) || '.png'
    const outputPath = path.join(outputDir, `${item.slug}${ext}`)
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer))
    console.log(`Saved ${outputPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
