import { readFile, readdir, rm, unlink, writeFile } from "node:fs/promises"
import { existsSync, lstatSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

function getOpencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "opencode")
  }
  return path.join(os.homedir(), ".config", "opencode")
}

async function removeCommands(packageDir, configDir) {
  const sourceDir = path.join(packageDir, "commands")
  const targetDir = path.join(configDir, "commands")

  if (!existsSync(sourceDir) || !existsSync(targetDir)) {
    return { removed: 0, attempted: 0 }
  }

  const files = (await readdir(sourceDir)).filter((file) => file.endsWith(".md"))
  let removed = 0

  for (const file of files) {
    const targetFile = path.join(targetDir, file)
    if (!existsSync(targetFile)) continue

    await rm(targetFile, { force: true })
    removed += 1
  }

  return { removed, attempted: files.length }
}

async function removePluginLink(configDir) {
  const pluginDir = path.join(configDir, "plugin")
  const linkPath = path.join(pluginDir, "opencode-linear.js")

  if (!existsSync(linkPath)) {
    return { removed: false, reason: "not-found", path: linkPath }
  }

  let isSymlink = false
  try {
    const st = lstatSync(linkPath)
    isSymlink = st.isSymbolicLink()
  } catch {
    isSymlink = false
  }

  await unlink(linkPath)
  return { removed: true, wasSymlink: isSymlink, path: linkPath }
}

async function removePluginEntry(configDir) {
  const configPath = path.join(configDir, "opencode.json")
  if (!existsSync(configPath)) {
    return { updated: false, reason: "not-found", path: configPath }
  }

  try {
    const raw = await readFile(configPath, "utf8")
    const config = JSON.parse(raw)

    if (!Array.isArray(config.plugin)) {
      return { updated: false, reason: "no-plugin-array", path: configPath }
    }

    const before = config.plugin.length
    config.plugin = config.plugin.filter((item) => item !== "opencode-linear")

    if (config.plugin.length === before) {
      return { updated: false, reason: "entry-not-found", path: configPath }
    }

    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
    return { updated: true, path: configPath }
  } catch {
    return {
      updated: false,
      reason: "parse-failed",
      path: configPath,
      hint: "Please manually remove 'opencode-linear' from opencode.json plugin array",
    }
  }
}

async function main() {
  if (process.env.OPENCODE_LINEAR_SKIP_PREUNINSTALL === "1") {
    return
  }

  const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const configDir = getOpencodeConfigDir()

  const commandResult = await removeCommands(packageDir, configDir)
  const pluginResult = await removePluginLink(configDir)
  const jsonResult = await removePluginEntry(configDir)

  console.log(
    `[opencode-linear] removed commands: ${commandResult.removed}/${commandResult.attempted}`,
  )

  if (pluginResult.removed) {
    console.log(`[opencode-linear] removed plugin link: ${pluginResult.path}`)
  }

  if (jsonResult.updated) {
    console.log(`[opencode-linear] updated: ${jsonResult.path}`)
  } else if (jsonResult.reason === "parse-failed") {
    console.log("[opencode-linear] skipped: could not parse opencode.json")
    console.log(`[opencode-linear] ${jsonResult.hint}`)
  }
}

main().catch((error) => {
  console.log(`[opencode-linear] preuninstall warning: ${error instanceof Error ? error.message : String(error)}`)
})
