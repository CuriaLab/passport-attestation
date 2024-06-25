import { PUBLIC_KEY } from "@/constants/contracts"
import { BarretenbergBackend } from "@noir-lang/backend_barretenberg"
import { Noir } from "@noir-lang/noir_js"
import { Address, Hex, hexToBigInt, keccak256, pad, toHex } from "viem"
import { generatePrivateKey } from "viem/accounts"

import { CuriaSignature } from "@/types/signature"

const modulo =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n
export const prove = async (
  address: Address,
  curiaSignature: CuriaSignature,
  msg: string,
  timestamp: number,
  revokerSecret: string
) => {
  const circuit = await import("../../public/circuits.json")
  const backend = new BarretenbergBackend(circuit as any)
  const noir = new Noir(circuit as any, backend)
  const hashedMsg = toHex(hexToBigInt(keccak256(toHex(msg))) % modulo)
  const revokerSecretHash = toHex(
    hexToBigInt(keccak256(toHex(revokerSecret))) % modulo
  )
  const nonce = toHex(hexToBigInt(generatePrivateKey()) % modulo)
  const proof = await noir.generateProof({
    address,
    msg: hashedMsg,
    nonce,
    revoker_secret: revokerSecretHash,
    role: curiaSignature.role,
    sig_s: curiaSignature.sig_s,
    timestamp: timestamp,
    random_nonce: curiaSignature.random_nonce,
    pubkey: PUBLIC_KEY,
    sig_r: {
      x: curiaSignature.sig_rx,
      y: curiaSignature.sig_ry,
    },
  })

  return {
    proof: toHex(proof.proof),
    nonce: pad(nonce),
    timestamp: pad(toHex(timestamp)),
    revokerHash: pad(proof.publicInputs[6] as Hex),
  }
}
