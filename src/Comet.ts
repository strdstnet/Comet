import { CometState, IPingResult } from './types'
import dgram from 'dgram'
import { ACK, BatchedPacket, BundledPacket, bundlePackets, ConnectionRequest, ConnectionRequestAccepted, Login, MovePlayer, OpenConnectionReplyOne, OpenConnectionReplyTwo, OpenConnectionRequestOne, OpenConnectionRequestTwo, Packet, PacketBatch, PlayStatus, Protocol, ResourcePackResponseStatus, ResourcePacksInfo, ResourcePacksResponse, SetLocalPlayerInitialized, StartGame, UnconnectedPing, UnconnectedPong } from '@strdstnet/protocol'
import { BinaryData, IAddress, UUID } from '@strdstnet/utils.binary'
import { PacketHandler } from './PacketHandler'

export class Comet extends PacketHandler {

  public static i: Comet

  public static TPS = 20

  protected clientId = 252852802120n
  protected mtuSize = 1350

  protected lastPingId = 0n

  protected state = CometState.READY

  protected socket = dgram.createSocket('udp4')

  protected serverAddr: IAddress = {
    ip: '',
    port: 19132,
    family: 4,
  }

  protected sendQueue: BundledPacket<any>[] = []
  protected sequenceNumber = -1
  protected lastSplitId = -1

  protected constructor(protected username: string, protected uuid = UUID.randomStr()) {
    super()

    this.socket.on('message', (msg, remote) => this.handle(new BinaryData(msg), {
      ip: remote.address,
      port: remote.port,
      family: remote.family === 'IPv4' ? 4 : 6,
    }))

    this.on('sendACK', seq => this.send(new ACK(seq)))

    setInterval(() => this.onTick(), 1000 / Comet.TPS)
  }

  public static init(username = 'Comet'): Comet {
    return Comet.i || (Comet.i = new Comet(username))
  }

  protected onTick() {
    this.processSendQueue()
  }

  protected processSendQueue() {
    if(!this.sendQueue.length) return

    const [bundles, sequenceNumber, lastSplitId] = bundlePackets(this.sendQueue, this.sequenceNumber, this.lastSplitId, this.mtuSize)

    for(const packet of bundles) {
      this.send(packet)
    }

    this.sendQueue = []
    this.sequenceNumber = sequenceNumber
    this.lastSplitId = lastSplitId
  }

  protected send(packet: Packet<any, never>, ip: string = this.serverAddr.ip, port = this.serverAddr.port) {
    if(packet instanceof BundledPacket) {
      this.sendQueue.push(packet)
    } else if(packet instanceof BatchedPacket) {
      this.send(new PacketBatch({
        packets: [packet],
      }), ip, port)
    } else {
      this.socket.send(packet.encode().toBuffer(), port, ip)
    }
  }

  public async query(ip: string, port = 19132): Promise<IPingResult> {
    return new Promise(resolve => {
      const start = Date.now()

      const pingId = ++this.lastPingId
      this.send(new UnconnectedPing({
        pingId,
        clientId: this.clientId,
      }), ip, port)

      const listener = this.on('UnconnectedPong', (pong: UnconnectedPong) => {
        if(pong.props.pingId !== pingId) return

        listener.stop()

        resolve({
          ...UnconnectedPong.parseMOTD(pong.props.motd),
          latency: Date.now() - start,
        })
      })
    })
  }

  public async connect(ip: string, port = 19132): Promise<void> {
    if(this.connecting) throw new Error('Already connecting')
    if(this.connected) throw new Error('Already connected, disconnect first')

    return new Promise(resolve => {
      this.state = CometState.CONNECTING

      this.serverAddr = {
        ip,
        port,
        family: 4,
      }

      this.send(new OpenConnectionRequestOne({
        protocol: Protocol.PROTOCOL_VERSION,
        mtuSize: 1350,
      }))

      this.once('OpenConnectionReplyOne', (reply1: OpenConnectionReplyOne) => {
        this.send(new OpenConnectionRequestTwo({
          address: this.serverAddr,
          mtuSize: this.mtuSize,
          clientId: this.clientId,
        }))

        this.once('OpenConnectionReplyTwo', (reply2: OpenConnectionReplyTwo) => {
          this.state = CometState.CONNECTED

          this.send(new ConnectionRequest({
            clientId: this.clientId,
            sendPingTime: BigInt(Date.now()),
            hasSecurity: false,
          }))

          this.once('ConnectionRequestAccepted', (reply: ConnectionRequestAccepted) => {
            this.send(new Login({
              protocol: Protocol.PROTOCOL_VERSION,
              chainData: JSON.stringify({
                chain: [
                  `ff.${Buffer.from(JSON.stringify({
                    extraData: {
                      identity: this.uuid,
                      XUID: this.uuid,
                      displayName: this.username,
                    },
                  })).toString('base64')}`
                ]
              }),
              clientData: `ff.${Buffer.from(JSON.stringify({
                ClientRandomId: 132152,
                ServerAddress: '',
                SkinId: '',
                ArmSize: '',
                SkinColor: '',
                SkinResourcePatch: '',
                SkinImageHeight: 5,
                SkinImageWidth: 5,
                SkinData: '',
                CapeId: '',
                CapeImageHeight: 5,
                CapeImageWidth: 5,
                CapeData: '',
                SkinGeometryData: '',
                SkinAnimationData: '',
                PremiumSkin: false,
                PersonaSkin: false,
                CapeOnClassicSkin: false,
                PersonaPieces: [],
                PieceTintColors: [],
              })).toString('base64')}`,
            }))

            this.once('PacketBatch', (batch: PacketBatch) => {
              for(const packet of batch.props.packets) {
                if(packet instanceof PlayStatus) {
                  console.log('Got play status', packet.props.status)
                } else if (packet instanceof ResourcePacksInfo) {
                  this.send(new ResourcePacksResponse({
                    packIds: [],
                    status: ResourcePackResponseStatus.COMPLETED,
                  }))
                } else if(packet instanceof StartGame) {
                  const rid = packet.props.entityRuntimeId
                  const pos = packet.props.position
                  console.log('GOT START GAME')

                  this.send(new SetLocalPlayerInitialized({
                    entityRuntimeId: rid,
                  }))

                  const fn = () => {
                    pos.x += 1
                    pos.y += 1
                    pos.z += 1
                    this.send(new MovePlayer({
                      runtimeEntityId: rid,
                      positionX: pos.x,
                      positionY: pos.y,
                      positionZ: pos.z,
                      pitch: 0,
                      yaw: 0,
                      headYaw: 0,
                      onGround: true,
                      ridingEntityRuntimeId: rid,
                      teleportCause: -1,
                      teleportItemId: -1,
                    }))
                  }

                  setInterval(fn, 150)
                }
              }
            })

            // this.once('PlayStatus', (status: PlayStatus) => {
            //   console.log('Got play status', status.props.status)
            // })
          })
        })
      })
    })
  }

  public get ready(): boolean {
    return this.state === CometState.READY
  }

  public get connecting(): boolean {
    return this.state === CometState.CONNECTING
  }

  public get connected(): boolean {
    return this.state === CometState.CONNECTED
  }

  /* Packet Handlers */
  public handleUnconnectedPong(pk: UnconnectedPong) {}

}