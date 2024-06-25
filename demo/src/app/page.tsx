import { siteConfig } from "@/config/site"
import { ConnectWalletButton } from "@/components/button/connect-wallet"
import { ModeToggle } from "@/components/button/mode-toggle"
import { EndorsePublicCard } from "@/components/card/endorse-public"
import { Icons } from "@/components/icons"

export default function Home() {
  return (
    <main className="flex h-screen justify-center py-8 md:py-16">
      <div className="container flex max-w-[64rem] flex-col items-center gap-4">
        <div className="flex w-full flex-col justify-between gap-2 sm:flex-row">
          <div className="flex items-center gap-2">
            <Icons.logo className="h-8 w-8" />
            <h1 className="text-xl font-semibold md:text-2xl">
              {siteConfig.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <ConnectWalletButton />
            <ModeToggle />
          </div>
        </div>
        <EndorsePublicCard />
      </div>
    </main>
  )
}
