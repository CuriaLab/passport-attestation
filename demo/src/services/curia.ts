import axios from "axios"
import { Address, fromHex, Hex } from "viem"

import { env } from "@/env.mjs"
import { CuriaSignature } from "@/types/signature"

export const getCuriaSignature = async (
  address: Address,
  signature: Hex,
  type: "ECDSA" | "EDDSA"
) => {
  const body = {
    address,
    signature: {
      [type]: {
        r: `0x${signature.slice(2, 66)}`,
        s: `0x${signature.slice(66, 130)}`,
        v: fromHex(`0x${signature.slice(130, 132)}`, "number"),
      },
    },
  }

  const response = await axios.post(
    `${env.NEXT_PUBLIC_CURIA_API_URL}/signature`,
    body
  )

  return response.data as {
    signatures: CuriaSignature[]
    timestamp: number
  }
}

export const proxyAnonymousAttestation = async (
  callData: Hex,
  isTestnet: boolean
) => {
  const response = await axios.post(`${env.NEXT_PUBLIC_CURIA_API_URL}/proxy`, {
    input: callData,
    is_testnet: isTestnet,
  })
  return response.data.tx_hash as Hex
}
