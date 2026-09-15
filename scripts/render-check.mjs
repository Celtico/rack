// Drive headless Chrome over CDP: open the check page, stream its console until DONE.
import { spawn } from "node:child_process"

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PORT = Number(process.env.CDP_PORT ?? 9333)
const url = process.argv[2]
const limit = Number(process.argv[3] ?? 300) * 1000

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/rack-cdp-${process.pid}`,
    "about:blank",
  ],
  { stdio: "ignore" },
)
const bye = (code) => {
  chrome.kill()
  process.exit(code)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50; i++) {
  await sleep(200)
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    const list = await res.json()
    target = list.find((t) => t.type === "page")
    if (target) break
  } catch {}
}
if (!target) {
  console.error("no page target")
  bye(2)
}

const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const me = ++id
    const onMessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id === me) {
        ws.removeEventListener("message", onMessage)
        resolve(msg.result)
      }
    }
    ws.addEventListener("message", onMessage)
    ws.send(JSON.stringify({ id: me, method, params }))
  })

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")
    if (/^\[vite\]|Download the React|Tone.js v/.test(text)) return
    console.log(text)
    if (text.startsWith("DONE")) bye(0)
  }
  if (msg.method === "Runtime.exceptionThrown") {
    console.log(
      "EXCEPTION",
      msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text,
    )
  }
})
ws.addEventListener("open", async () => {
  await send("Runtime.enable")
  await send("Page.enable")
  await send("Page.navigate", { url })
  setTimeout(() => {
    console.log("TIMEOUT")
    bye(1)
  }, limit)
})
