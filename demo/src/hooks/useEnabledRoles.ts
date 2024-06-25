import { Abis, Addresses } from "@/constants/contracts"
import { queryBadgeholders } from "@/services/eas"
import { useQuery } from "@tanstack/react-query"
import { Address, Hex, zeroAddress } from "viem"
import { useChainId, usePublicClient } from "wagmi"

import { Role } from "@/types/role"

export const useEnabledRoles = (address?: Address) => {
  const client = usePublicClient()
  const chainId = useChainId()

  const {
    data: { enabledRoles, badgeholderRefId } = {
      enabledRoles: [Role.None],
      badgeholderRefId: null,
    },
    ...query
  } = useQuery<{
    enabledRoles: Role[]
    badgeholderRefId: Hex | null
  }>({
    queryKey: ["roles", address, chainId],
    queryFn: async () => {
      if (!address)
        return {
          enabledRoles: [Role.None],
          badgeholderRefId: null,
        }

      const enabledRoles = [Role.None]
      const [votingPower, balance, delegate, badgeholder] = await Promise.all([
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "getVotes",
          args: [address],
        }),
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "balanceOf",
          args: [address],
        }),
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "delegates",
          args: [address],
        }),
        queryBadgeholders(address),
      ])

      if (badgeholder) {
        enabledRoles.push(Role.Badgeholder)
      }

      if (votingPower > 0) {
        enabledRoles.push(Role.Delegate)
      }

      if (balance > 0 && delegate !== address && delegate !== zeroAddress) {
        enabledRoles.push(Role.Delegator)
      }

      return {
        enabledRoles,
        badgeholderRefId: badgeholder,
      }
    },
  })

  return {
    ...query,
    enabledRoles,
    badgeholderRefId,
  }
}
