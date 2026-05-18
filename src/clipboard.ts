import { spawn } from "child_process"

export function writeClipboard(text: string): void {
  try {
    const proc = spawn("pbcopy")
    proc.stdin.write(text)
    proc.stdin.end()
  } catch {
    /* clipboard unavailable */
  }
}

export function readClipboard(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const proc = spawn("pbpaste")
      let out = ""
      proc.stdout.on("data", (chunk: Buffer) => { out += chunk.toString() })
      proc.on("close", () => resolve(out))
      proc.on("error", () => resolve(""))
    } catch {
      resolve("")
    }
  })
}
