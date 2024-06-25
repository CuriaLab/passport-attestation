import { SiteConfig } from "@/types"

import { env } from "@/env.mjs"

export const siteConfig: SiteConfig = {
  name: "Curia Attestation Demo",
  author: "Curia Lab",
  description:
    "Demo site for Curia public and private/anonymous endorsement attesation",
  keywords: [],
  url: {
    base: env.NEXT_PUBLIC_APP_URL,
    author: "https://www.curialab.xyz/",
  },
  links: {
    github: "https://github.com/CuriaLab/passport-attestation",
  },
  ogImage: `${env.NEXT_PUBLIC_APP_URL}/og.jpg`,
}
