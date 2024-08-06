import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { createPublicClient } from "viem"
import { mainnet, optimism, optimismSepolia } from "viem/chains"
import { cookieStorage, createStorage, http } from "wagmi"

import { env } from "@/env.mjs"

import { siteConfig } from "./site"

export const chains = [optimism, optimismSepolia] as const

export const getConfig = () => {
  return getDefaultConfig({
    appName: siteConfig.name,
    projectId: env.NEXT_PUBLIC_WC_PROJECT_ID,
    //chains: [optimism, optimismSepolia],
    //chains: [
    //{
    //...optimismSepolia,
    //blockExplorers: {
    //default: {
    //name: "Etherscan",
    //url: "https://sepolia-optimism.etherscan.io",
    //apiUrl: "https://api-sepolia-optimism.etherscan.io/api",
    //},
    //},
    //},
    //],
    chains: [optimism],
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [optimism.id]: http(),
      [optimismSepolia.id]: http(),
    },
    batch: {
      multicall: {
        wait: 200,
        batchSize: 2048,
      },
    },
  })
}

export const ethereumClient = createPublicClient({
  transport: http("https://1rpc.io/eth"),
  chain: mainnet,
  batch: {
    multicall: {
      wait: 200,
      batchSize: 2048,
    },
  },
})

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
