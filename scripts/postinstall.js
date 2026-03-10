import { mkdir, readFile, writeFile, copyFile, readdir, symlink, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

function getOpencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "opencode")
  }
  return path.join(os.homedir(), ".config", "opencode")
}

async function ensureCommands(packageDir, configDir) {
  const sourceDir = path.join(packageDir, "commands")
  const targetDir = path.join(configDir, "commands")
  if (!existsSync(sourceDir)) return []

  await mkdir(targetDir, { recursive: true })
  const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".md"))

  for (const file of files) {
    await copyFile(path.join(sourceDir, file), path.join(targetDir, file))
  }

  return files
}

async function ensurePluginSymlink(packageDir, configDir) {
  const pluginDir = path.join(configDir, "plugin")
  const targetLink = path.join(pluginDir, "opencode-linear.js")
  const sourceFile = path.join(packageDir, "dist", "index.js")

  if (!existsSync(sourceFile)) {
    return { created: false, exists: false, error: "dist/index.js not found, run npm run build" }
  }

  await mkdir(pluginDir, { recursive: true })

  if (existsSync(targetLink)) {
    await unlink(targetLink)
  }

  await symlink(sourceFile, targetLink)
  return { created: true, exists: true, path: targetLink, source: sourceFile }
}

async function tryUpdateOpencodeJson(configDir) {
  const configPath = path.join(configDir, "opencode.json")
  
  if (!existsSync(configPath)) {
    const newConfig = {
      $schema: "https://opencode.ai/config.json",
      plugin: ["opencode-linear"],
    }
    await writeFile(configPath, JSON.stringify(newConfig, null, 2) + "\n", "utf8")
    return { updated: true, created: true, path: configPath }
  }

  try {
    const raw = await readFile(configPath, "utf8")
    let config = JSON.parse(raw)
    
    if (!Array.isArray(config.plugin)) {
      config.plugin = []
    }

    const before = config.plugin.length
    if (!config.plugin.includes("opencode-linear")) {
      config.plugin.push("opencode-linear")
    }

    if (config.plugin.length !== before) {
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8")
      return { updated: true, created: false, path: configPath }
    }

    return { updated: false, created: false, path: configPath }
  } catch {
    return { 
      updated: false, 
      created: false, 
      skipped: true, 
      path: configPath,
      hint: "Please manually add 'opencode-linear' to your opencode.json plugin array"
    }
  }
}

async function main() {
  if (process.env.OPENCODE_LINEAR_SKIP_POSTINSTALL === "1") {
    return
  }

  const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const configDir = getOpencodeConfigDir()

  const copied = await ensureCommands(packageDir, configDir)
  const symlinkResult = await ensurePluginSymlink(packageDir, configDir)
  const jsonResult = await tryUpdateOpencodeJson(configDir)

  if (symlinkResult.error) {
    console.log(`[opencode-linear] warning: ${symlinkResult.error}`)
  }

  console.log(`[opencode-linear] installed commands: ${copied.length}`)
  
  if (symlinkResult.created) {
    console.log(`[opencode-linear] linked plugin: ${symlinkResult.path}`)
  }

  if (jsonResult.skipped) {
    console.log(`[opencode-linear] skipped: could not parse opencode.json`)
    console.log(`[opencode-linear] ${jsonResult.hint}`)
  } else if (jsonResult.created) {
    console.log(`[opencode-linear] created: ${jsonResult.path}`)
  } else if (jsonResult.updated) {
    console.log(`[opencode-linear] updated: ${jsonResult.path}`)
  }
}

main().catch((error) => {
  console.log(`[opencode-linear] postinstall warning: ${error instanceof Error ? error.message : String(error)}`)
})
