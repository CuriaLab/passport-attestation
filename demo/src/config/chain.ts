import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { optimism, optimismSepolia } from "viem/chains"
import { cookieStorage, createConfig, createStorage, http } from "wagmi"

import { env } from "@/env.mjs"

import { siteConfig } from "./site"

export const getConfig = () => {
  return getDefaultConfig({
    appName: siteConfig.name,
    projectId: env.NEXT_PUBLIC_WC_PROJECT_ID,
    chains: [optimism, optimismSepolia],
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [optimism.id]: http(),
      [optimismSepolia.id]: http(),
    },
  })
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
