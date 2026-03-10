/**
 * Project ID generation for linear-workflow plugin.
 *
 * Generates a stable, unique identifier for a project based on its git history.
 * Used for cross-worktree consistency in session storage databases.
 *
 * @module utils/project-id
 */

import * as crypto from "node:crypto"
import { stat } from "node:fs/promises"
import * as path from "node:path"

/**
 * Generate a short hash from a path for project ID fallback.
 *
 * Used when git root commit is unavailable (non-git repos, empty repos).
 * Produces a 16-character hex string for reasonable uniqueness.
 *
 * @param projectRoot - Absolute path to hash
 * @returns 16-char hex hash
 */
function hashPath(projectRoot: string): string {
	const hash = crypto.createHash("sha256").update(projectRoot).digest("hex")
	return hash.slice(0, 16)
}

/**
 * Generate a unique project ID from the project root path.
 *
 * **Strategy:**
 * 1. Uses the first root commit SHA for stability across renames/moves
 * 2. Falls back to path hash for non-git repos or empty repos
 * 3. Caches result in .git/opencode for performance
 *
 * **Git Worktree Support:**
 * When .git is a file (worktree), resolves the actual .git directory
 * and uses the shared cache. This ensures all worktrees share the same
 * project ID and associated data.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns 40-char hex SHA (git root) or 16-char hash (fallback)
 * @throws {Error} When projectRoot is invalid or .git file has invalid format
 *
 * @example
 * ```ts
 * const projectId = await getProjectId("/home/user/my-repo")
 * // Returns: "abc123..." (40-char git hash)
 *
 * const projectId = await getProjectId("/home/user/non-git-folder")
 * // Returns: "def456..." (16-char path hash)
 * ```
 */
export async function getProjectId(projectRoot: string): Promise<string> {
	// Guard: Validate projectRoot
	if (!projectRoot || typeof projectRoot !== "string") {
		throw new Error("getProjectId: projectRoot is required and must be a string")
	}

	const gitPath = path.join(projectRoot, ".git")

	// Check if .git exists and what type it is
	const gitStat = await stat(gitPath).catch(() => null)

	// Guard: No .git directory - not a git repo
	if (!gitStat) {
		return hashPath(projectRoot)
	}

	let gitDir = gitPath

	// Handle worktree case: .git is a file containing gitdir reference
	if (gitStat.isFile()) {
		const content = await Bun.file(gitPath).text()
		const match = content.match(/^gitdir:\s*(.+)$/m)

		// Guard: Invalid .git file format
		if (!match) {
			throw new Error(`getProjectId: .git file exists but has invalid format at ${gitPath}`)
		}

		// Resolve path (handles both relative and absolute)
		const gitdirPath = match[1].trim()
		const resolvedGitdir = path.resolve(projectRoot, gitdirPath)

		// The gitdir contains a 'commondir' file pointing to shared .git
		const commondirPath = path.join(resolvedGitdir, "commondir")
		const commondirFile = Bun.file(commondirPath)

		if (await commondirFile.exists()) {
			const commondirContent = (await commondirFile.text()).trim()
			gitDir = path.resolve(resolvedGitdir, commondirContent)
		} else {
			// Fallback to ../.. assumption for older git or unusual setups
			gitDir = path.resolve(resolvedGitdir, "../..")
		}

		// Guard: Resolved gitdir must be a directory
		const gitDirStat = await stat(gitDir).catch(() => null)
		if (!gitDirStat?.isDirectory()) {
			throw new Error(`getProjectId: Resolved gitdir ${gitDir} is not a directory`)
		}
	}

	// Check cache in .git/opencode
	const cacheFile = path.join(gitDir, "opencode")
	const cache = Bun.file(cacheFile)

	if (await cache.exists()) {
		const cached = (await cache.text()).trim()
		// Validate cache content (40-char hex for git hash, or 16-char for path hash)
		if (/^[a-f0-9]{40}$/i.test(cached) || /^[a-f0-9]{16}$/i.test(cached)) {
			return cached
		}
	}

	// Generate project ID from git root commit
	try {
		const proc = Bun.spawn(["git", "rev-list", "--max-parents=0", "--all"], {
			cwd: projectRoot,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
		})

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error("git rev-list timed out")), 5000)
		})

		const exitCode = await Promise.race([proc.exited, timeoutPromise]).catch(() => 1)

		if (exitCode === 0) {
			const output = await new Response(proc.stdout).text()
			const roots = output
				.split("\n")
				.filter(Boolean)
				.map((x) => x.trim())
				.sort()

			if (roots.length > 0 && /^[a-f0-9]{40}$/i.test(roots[0])) {
				const projectId = roots[0]
				// Cache the result
				try {
					await Bun.write(cacheFile, projectId)
				} catch {
					// Ignore cache write failures
				}
				return projectId
			}
		}
	} catch {
		// Fall through to path hash
	}

	// Fallback to path hash
	return hashPath(projectRoot)
}
