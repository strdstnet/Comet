import { Worker, isMainThread, parentPort } from 'worker_threads'
import { Comet } from './Comet'
import { Console } from './Console'

const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

if(isMainThread) {
  const addr = process.argv[2]
  const count = parseInt(process.argv[3], 10)

  ;(async() => {
    for(let i = 0; i < count; i++) {
      console.log(i)

      const worker = new Worker(__filename, {
        stdout: true,
      })
      // worker.on('message', (message) => {
      //   console.log(message)
      // })
      // worker.stdout.on('data', data => {
      //   console.log(data)
      // })
      worker.postMessage(`${i}_${addr}`)
      await wait(1000)
    }
  })()
} else {
  if(parentPort) {
    parentPort.on('message', data => {
      const [id, addr] = data.split('_')

      const c = Comet.init(`Comet_${id}`)
      Console.init()

      c.connect(addr)
    })
  }
}
