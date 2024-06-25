import { parseAbi, parseAbiParameters, zeroHash } from "viem"
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
    "uint256 role, string message, bytes ref"
  )
  export const BADGEHOLDER_DATA_ABI_PARAMETER = parseAbiParameters(
    "string rpgfRound, address referredBy, string referredMethod"
  )
  export const EAS_ABI = parseAbi([
    "struct AttestationRequest { bytes32 schema; AttestationRequestData data; }",
    "struct AttestationRequestData { address recipient; uint64 expirationTime; bool revocable; bytes32 refUID; bytes data; uint256 value; }",
    "function attest(AttestationRequest calldata request) external payable returns (bytes32)",
  ])
}

export const BADGEHOLDER_SCHEMA_ID =
  "0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b"

export const EAS = {
  [optimism.id]: {
    schema: zeroHash,
    graphql: "https://optimism.easscan.org/graphql",
    explorer: "https://optimism.easscan.org",
  },
  [optimismSepolia.id]: {
    schema:
      "0x1f2ad0b1358e5cc2e4a5a2667f4842a49883edd2dc4f74a05cb1241373b3dd27",
    graphql: "https://optimism-sepolia.easscan.org/graphql",
    explorer: "https://optimism-sepolia.easscan.org",
  },
} as const
