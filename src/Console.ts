import { Comet } from './Comet'
import { UI } from './ui/UI'

enum Format {
  RED = '\u001b[31m',
  YELLOW = '\u001b[33m',
  MAGENTA = '\u001b[35m',

  GREY = '\u001b[38;5;8m',
  LAVENDER = '\u001b[38;5;104m',
  ORANGE = '\u001b[38;5;208m',

  RESET = '\u001b[0m',
}

const formatFix = [['§e', Format.YELLOW]]

const CURSOR = `${Format.RESET}${Format.GREY}> ${Format.LAVENDER}`

export class Console {

  public static i: Console

  // public ui = new UI()

  protected isOpen = false
  protected buffer: Buffer[] = []
  protected constructor() {
    process.openStdin().addListener('data', d => this.onData(d))
    this.open()
    // for(let i = 0; i < 16; i++) {
    //   for(let j = 0; j < 16; j++) {
    //     const code = i * 16 + j
    //     process.stdout.write(`${this.colour(code)} ${code}${Format.RESET}`)
    //   }
    // }
  }

  public static init(): Console {
    return Console.i || (Console.i = new Console())
  }

  protected open() {
    this.isOpen = true
    process.stdout.write(CURSOR)

    this.onData(Buffer.concat(this.buffer))
    this.buffer = []
  }

  protected close() {
    this.isOpen = false
  }

  protected colour(i: number) {
    return `\u001b[38;5;${i}m`
  }

  protected async onData(data: Buffer): Promise<void> {
    const str = data.toString().trim()
    if(!str) return

    console.log(this.isOpen, str)
    if(!this.isOpen) {
      this.buffer.push(data)
      return
    }

    this.close()

    const [ trigger, ...args ] = this.parseInput(str)

    switch(trigger.toLowerCase()) {
      case 'ping':
        await this.cmdPing(args)
        break
      case 'connect':
        await this.cmdConnect(args)
        break
      default:
        this.error(`Unknown command '${trigger}'`)
    }

    this.open()
  }

  protected send(message: string): void {
    process.stdout.write(`${Format.RESET}${message}${Format.RESET}\n`)
  }

  protected error(message: string): void {
    this.send(`${Format.RED}${message}`)
  }

  protected parseInput(input: string): string[] {
    const parts = []

    const matches = input.trim().matchAll(/[^\s"]+|"([^"]*)"/g)
    for(const match of matches) {
      parts.push(typeof match[1] === 'undefined' ? match[0] : match[1])
    }

    return parts
  }

  protected async cmdPing(args: any[]): Promise<void> {
    if(args.length !== 1) return this.error('Usage: ping <ip>[:<port>]')

    const parts = args[0].split(':')
    const ip = parts[0]
    const port = parts[1] ? parseInt(parts[1]) : 19132

    this.send(`${Format.YELLOW}Pinging ${ip}:${port}...`)

    const result = await Comet.i.query(ip, port)

    this.sendBox([
      result.line1 || '',
      result.line2 || '',
      `${result.numPlayers} / ${result.maxPlayers} online`,
      `${result.latency}ms latency`,
    ])

    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 10000)
    })
  }

  protected async cmdConnect(args: any[]) {
    if(args.length !== 1) return this.error('Usage: connect <ip>[:<port>]')

    const parts = args[0].split(':')
    const ip = parts[0]
    const port = parts[1] ? parseInt(parts[1]) : 19132

    this.send(`${Format.YELLOW}Connecting to ${ip}:${port}...`)
    await Comet.i.connect(ip, port)
    this.send(`${Format.YELLOW}Connected.`)
  }

  protected sendBox(lines: string[]) {
    const maxLength = lines.reduce((p, c) => c.length > p ? c.length : p, 0)
    const boxWidth = maxLength + 4

    this.send('-'.repeat(boxWidth))
    for(const line of lines) {
      this.send(`| ${line}${' '.repeat(boxWidth - line.length - 3)}|`)
    }
    this.send('-'.repeat(boxWidth))
  }

}