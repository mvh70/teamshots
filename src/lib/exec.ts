import { exec, spawn, SpawnOptionsWithoutStdio } from 'child_process'
import { promisify } from 'util'

export const execAsync = promisify(exec)

/**
 * SECURITY: Safe command execution using spawn with argument array
 * This prevents command injection by separating command from arguments
 * and avoiding shell interpretation of metacharacters.
 */
export function spawnAsync(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      shell: false, // SECURITY: Never use shell to prevent injection
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 })
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

