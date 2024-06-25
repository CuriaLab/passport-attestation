import { parseAbi, parseAbiParameters, zeroAddress, zeroHash } from "viem"
import { optimism, optimismSepolia } from "viem/chains"

export namespace Addresses {
  export const EAS = "0x4200000000000000000000000000000000000021"
  export const OP_TOKEN = "0x4200000000000000000000000000000000000042"
}

export namespace Abis {
  export const OP_TOKEN_ABI = parseAbi([
    "function getVotes(address account) external view returns (uint256)",
    "function delegates(address account) external view returns (address)",
    "function balanceOf(address account) external view returns (uint256)",
  ])
  export const SCHEMA_ABI_PARAMETER = parseAbiParameters(
    "uint256 role, string title, string message, bytes ref"
  )
  export const BADGEHOLDER_DATA_ABI_PARAMETER = parseAbiParameters(
    "string rpgfRound, address referredBy, string referredMethod"
  )
  export const EAS_ABI = parseAbi([
    "struct AttestationRequest { bytes32 schema; AttestationRequestData data; }",
    "struct AttestationRequestData { address recipient; uint64 expirationTime; bool revocable; bytes32 refUID; bytes data; uint256 value; }",
    "function attest(AttestationRequest calldata request) external payable returns (bytes32)",
  ])
  export const ANNOYMOUS_ATTESTER_ABI = parseAbi([
    "struct AttestationProof { bytes proof; bytes32 revokerHash; bytes32 nonce; bytes32 timestamp; }",
    "struct Schema { uint256 role; string title; string message; bytes ref; }",
    "function attest(bytes32 schema, address recipient, Schema calldata data, AttestationProof calldata proof) external returns (bytes32)",
    "function revoke(bytes32 schema, bytes32 uid, bytes32 revoker) external",
  ])
}

export const BADGEHOLDER_SCHEMA_ID =
  "0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b"

export const EAS = {
  [optimism.id]: {
    schema: zeroHash,
    graphql: "https://optimism.easscan.org/graphql",
    explorer: "https://optimism.easscan.org",
    anonymousAttester: zeroAddress,
  },
  [optimismSepolia.id]: {
    schema:
      "0xe947c758ac9ae50b478c9bb5ca18fba17d7fbd8cb2953753777ebfcc41aa1412",
    graphql: "https://optimism-sepolia.easscan.org/graphql",
    explorer: "https://optimism-sepolia.easscan.org",
    anonymousAttester: "0x2e313Bc0b6AFB447FB439F784F92A933C15eB277",
  },
} as const

export const PUBLIC_KEY = {
  x: "0x176f151b4a9643d5dbc1023c2f17ea2249aee6205f158bfa7d897997bc70fef7",
  y: "0x10b85b3f732ab327178b7af4e4ef70f67dcfe0adbd8fa2e38fb7d632d2addea5",
}
