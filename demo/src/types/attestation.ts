import { Address, Hex } from "viem"

export type Attestation = {
  id: Hex
  data: Hex
  revocationTime: number
  attester: Address
  recipient: Address
  time: number
  txid: string
}

export type FormattedAttestation = Omit<Attestation, "data"> & {
  data: {
    role: number
    title: string
    message: string
    ref: string
  }
}
