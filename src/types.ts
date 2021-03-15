import { IUnconnectedPongMOTD, UnconnectedPong } from '@strdstnet/protocol'

export enum CometState {
  READY,
  CONNECTING,
  CONNECTED,
}

export enum PacketType {
  RAW = 'raw',
  BUNDLED = 'bundled',
}

export interface IPingResult extends IUnconnectedPongMOTD {
  latency: number, // round trip latency in millis
}
