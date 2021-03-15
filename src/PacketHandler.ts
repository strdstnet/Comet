import { BitFlag, BundledPacket, ConnectionRequestAccepted, OpenConnectionReplyOne, OpenConnectionReplyTwo, Packet, PacketBundle, Packets, UnconnectedPong } from '@strdstnet/protocol'
import { BinaryData, IAddress } from '@strdstnet/utils.binary'
import { EventEmitter } from 'events'
import { PacketListener } from './PacketListener'
import { PacketType } from './types'

type PacketConstructor = { new(): Packet<any> }

export type Callback = (...args: any[]) => void

export class PacketHandler {

  public emitter = new EventEmitter()

  private splitQueue: {
    [splitId: number]: BundledPacket[],
  } = {}

  protected packets: {
    [k in PacketType]: {
      [k: number]: PacketConstructor,
    }
  } = {
    raw: {},
    bundled: {},
  }

  constructor(protected debugMode: boolean = false) {
    this.register(PacketType.RAW, Packets.UNCONNECTED_PONG, UnconnectedPong)
    this.register(PacketType.RAW, Packets.OPEN_CONNECTION_REPLY_ONE, OpenConnectionReplyOne)
    this.register(PacketType.RAW, Packets.OPEN_CONNECTION_REPLY_TWO, OpenConnectionReplyTwo)

    this.register(PacketType.BUNDLED, Packets.CONNECTION_REQUEST_ACCEPTED, ConnectionRequestAccepted)
  }

  public register(type: PacketType, id: number, packet: PacketConstructor) {
    this.packets[type][id] = packet
  }

  public handle(data: BinaryData, addr: IAddress): void {
    try {
      const flags = data.readByte(false)

      this.log(`Got ${flags} from`, addr)

      if(flags & BitFlag.Valid) {
        // Bundled Packet
        console.log(`BUNDLED ${flags}`)
        this.handleBundle(data)
      } else {
        this.handlePacket(PacketType.RAW, data)
      }
    } catch(e) {
      // console.log(e)
    }
  }

  private handlePacket(type: PacketType, data: Packet<any> | BinaryData) {
    let packet: Packet<any>
    if(data instanceof BinaryData) {
      const flags = data.readByte(false)

      const pk = this.packets[type][flags]
      if(!pk) return this.log(`No mapping for ${type.toUpperCase()}:${flags}`)

      packet = new pk().parse(data)
    } else {
      packet = data
    }

    const name = packet.constructor.name

    const handler = (this as any)[`handle${name}`] as Function
    this.log(`No handler for '${name}'`)

    this.emit(name, packet)
    if(handler) handler.call(this, packet)
  }

  private handleBundle(data: BinaryData) {
    const { packets, sequenceNumber } = new PacketBundle().decode(data)

    this.emit('sendACK', [sequenceNumber])


    for(const packet of packets) {
      this.handleBundledPacket(packet)
    }
  }

  private handleBundledPacket(packet: BundledPacket) {
    const props = packet.props
    if(props.hasSplit && !packet.hasBeenProcessed) {
      // this.logger.debug(`Split #${props.splitId} (${props.splitIndex + 1}/${props.splitCount})`)
      let queue = this.splitQueue[props.splitId]

      if(!queue) queue = this.splitQueue[props.splitId] = []

      queue[props.splitIndex] = packet

      if(queue.filter(Boolean).length >= props.splitCount) {
        const pk = queue[0]
        for(const part of queue) {
          pk.append(part.data)
        }
        pk.data.pos = 0
        pk.hasBeenProcessed = true
        pk.decode()

        delete this.splitQueue[props.splitId]
        this.handleBundledPacket(pk)
      }
    } else {
      this.handlePacket(PacketType.BUNDLED, packet)
    }
  }

  private log(...args: any[]): void {
    if(this.debugMode) console.log(...args)
  }

  protected emit(event: string, ...args: any[]) {
    this.emitter.emit(event, ...args)
  }

  protected on(event: string, cb: Callback): PacketListener {
    return new PacketListener(event, cb, this)
  }

  protected once(event: string, cb: Callback): PacketListener {
    return new PacketListener(event, cb, this)
  }

}