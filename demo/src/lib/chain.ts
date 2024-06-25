import { chains } from "@/config/chain"

export const getBlockExplorer = (chainId: number) => {
  return chains.find((chain) => chain.id === chainId)?.blockExplorers.default
    .url
}
