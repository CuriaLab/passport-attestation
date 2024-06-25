import { BarretenbergBackend } from "@noir-lang/backend_barretenberg"
import { Noir } from "@noir-lang/noir_js"
import { Address, keccak256, toHex } from "viem"

import { CuriaSignature } from "@/types/signature"

import circuit from "../../public/circuits.json"

export const prove = async (
  address: Address,
  curiaSignature: CuriaSignature,
  msg: string,
  timestamp: number
) => {
  const backend = new BarretenbergBackend(circuit as any)
  const noir = new Noir(circuit as any, backend)
  const hashedMsg = keccak256(toHex(msg))
  const proof = await noir.generateProof({
    address,
    sig_r: {
      x: curiaSignature.sig_rx,
      y: curiaSignature.sig_ry,
    },
    sig_s: curiaSignature.sig_s,
    role: curiaSignature.role,
    pubkey: {
      x: "0x26b7fcabdd999eb3259d397bc660e0fec848b73e99dca8755dadc3f47e54adde",
      y: "0x234de9f873dce1536cb1a86ae5db8a588b973b17546db327f6170205f2f0bf71",
    },
    msg: hashedMsg,
  })
}
