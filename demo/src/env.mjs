import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1),
    NEXT_PUBLIC_WC_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_BADGEHOLDER_ROUND: z.string().min(1),
    NEXT_PUBLIC_CURIA_API_URL: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WC_PROJECT_ID: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
    NEXT_PUBLIC_BADGEHOLDER_ROUND: process.env.NEXT_PUBLIC_BADGEHOLDER_ROUND,
    NEXT_PUBLIC_CURIA_API_URL: process.env.NEXT_PUBLIC_CURIA_API_URL,
  },
})
