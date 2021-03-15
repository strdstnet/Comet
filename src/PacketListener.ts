import { Callback, PacketHandler } from './PacketHandler'

export class PacketListener {

  constructor(protected event: string, protected cb: Callback, protected handler: PacketHandler, disposable = false) {
    if(disposable) this.handler.emitter.once(event, this.cb)
    else this.handler.emitter.on(event, this.cb)
  }

  public stop(): void {
    this.handler.emitter.off(this.event, this.cb)
  }

}