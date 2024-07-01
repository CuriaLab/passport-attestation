import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1),
    NEXT_PUBLIC_WC_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_BADGEHOLDER_ROUND: z.string().min(1),
    NEXT_PUBLIC_CURIA_API_URL: z.string().min(1),
    NEXT_PUBLIC_SCHEMA_ID: z.string().min(1),
    NEXT_PUBLIC_TESTNET_SCHEMA_ID: z.string().min(1),
    NEXT_PUBLIC_ANONYMOUS_ATTESTER: z.string().min(1),
    NEXT_PUBLIC_TESTNET_ANONYMOUS_ATTESTER: z.string().min(1),
    NEXT_PUBLIC_CURIA_PUBLIC_KEY: z
      .string()
      .length(133)
      .transform((v) => {
        const splitted = v.split(",")
        return {
          x: splitted[0],
          y: splitted[1],
        }
      }),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WC_PROJECT_ID: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
    NEXT_PUBLIC_BADGEHOLDER_ROUND: process.env.NEXT_PUBLIC_BADGEHOLDER_ROUND,
    NEXT_PUBLIC_CURIA_API_URL: process.env.NEXT_PUBLIC_CURIA_API_URL,
    NEXT_PUBLIC_SCHEMA_ID: process.env.NEXT_PUBLIC_SCHEMA_ID,
    NEXT_PUBLIC_TESTNET_SCHEMA_ID: process.env.NEXT_PUBLIC_TESTNET_SCHEMA_ID,
    NEXT_PUBLIC_ANONYMOUS_ATTESTER: process.env.NEXT_PUBLIC_ANONYMOUS_ATTESTER,
    NEXT_PUBLIC_TESTNET_ANONYMOUS_ATTESTER:
      process.env.NEXT_PUBLIC_TESTNET_ANONYMOUS_ATTESTER,
    NEXT_PUBLIC_CURIA_PUBLIC_KEY: process.env.NEXT_PUBLIC_CURIA_PUBLIC_KEY,
  },
})
