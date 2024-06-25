import { siteConfig } from "@/config/site"
import { ConnectWalletButton } from "@/components/button/connect-wallet"
import { ModeToggle } from "@/components/button/mode-toggle"
import { Icons } from "@/components/icons"

export default function Home() {
  return (
    <main className="flex h-screen items-center justify-center">
      <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
        <div className="flex w-full flex-col justify-between gap-2 sm:flex-row">
          <div className="flex items-center gap-2">
            <Icons.logo className="h-8 w-8" />
            <text className="text-xl font-semibold md:text-2xl">
              {siteConfig.name}
            </text>
          </div>
          <div className="flex gap-2">
            <ConnectWalletButton />
            <ModeToggle />
          </div>
        </div>
      </div>
    </main>
  )
}
