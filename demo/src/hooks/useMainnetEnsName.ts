import { useQuery } from "@tanstack/react-query"
import { Address } from "viem"

import { ethereumClient } from "@/config/chain"

export const useMainnetEnsName = (address?: Address) => {
  const { data, isLoading } = useQuery({
    queryKey: ["mainnetEnsName", address],
    queryFn: async () => {
      if (!address) return null
      return ethereumClient.getEnsName({
        address,
      })
    },
  })

  return {
    data,
    isLoading,
  }
}
