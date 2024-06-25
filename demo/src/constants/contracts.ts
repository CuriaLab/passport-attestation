import { parseAbi, parseAbiParameters } from "viem"

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

export const SCHEMA_ID =
  "0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b"
