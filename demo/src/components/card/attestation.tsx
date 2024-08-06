import { useMemo, useState } from "react"
import { Abis, Addresses, EAS } from "@/constants/contracts"
import { proxyAnonymousAttestation } from "@/services/curia"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import {
  ArrowRight,
  CircleUserRound,
  CornerRightDown,
  EyeOff,
  Loader2,
} from "lucide-react"
import { poseidon2 } from "poseidon-lite"
import { toast } from "sonner"
import {
  concat,
  encodeFunctionData,
  Hex,
  hexToBigInt,
  keccak256,
  pad,
  toHex,
} from "viem"
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi"

import { FormattedAttestation } from "@/types/attestation"
import { ALL_ROLES } from "@/types/role"
import { formatAddress } from "@/lib/address"
import { getBlockExplorer } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { useMainnetEnsName } from "@/hooks/useMainnetEnsName"

import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Input } from "../ui/input"

export const AttestationCard = ({
  attestation,
}: {
  attestation: FormattedAttestation
}) => {
  const queryClient = useQueryClient()

  const account = useAccount()
  const chainId = useChainId()

  const client = usePublicClient()
  const walletClient = useWalletClient()

  const blockExplorer = useMemo(() => getBlockExplorer(chainId), [chainId])

  const senderName = useMainnetEnsName(attestation.attester)
  const recipientName = useMainnetEnsName(attestation.recipient)

  const eas = EAS[chainId]
  const isAnonymous = attestation.attester === eas.anonymousAttester

  const [isRevoking, setIsRevoking] = useState(false)
  const [isRevoked, setIsRevoked] = useState(attestation.revoked)

  const [isRequestingPassword, setIsRequestingPassword] =
    useState<[(b: string) => void, (r?: any) => void]>()

  const revoke = async () => {
    setIsRevoking(true)

    try {
      let hash

      if (isAnonymous) {
        // revoke anonymous attestation

        // wait for password
        const password = await new Promise<string>((resolve, reject) =>
          setIsRequestingPassword([resolve, reject])
        )

        // get revoker hash from contract
        const queryRevokerToastId = toast.loading(
          "Querying on-chain revoker hash",
          {
            description: "Please wait",
          }
        )
        const slot = await client.getStorageAt({
          address: eas.anonymousAttester,
          slot: keccak256(concat([pad(attestation.id), pad("0x4")])),
        })
        toast.dismiss(queryRevokerToastId)

        const modulo =
          21888242871839275222246405745257275088548364400416034343698204186575808495617n
        const revokerSecret = hexToBigInt(keccak256(toHex(password))) % modulo

        const revoker = poseidon2([
          hexToBigInt(attestation.data.ref as Hex),
          revokerSecret,
        ])
        const revokerHash = poseidon2([revoker, revoker])

        if (slot !== pad(toHex(revokerHash))) {
          throw new Error("Invalid revoke password")
        }

        const calldata = encodeFunctionData({
          abi: Abis.ANNOYMOUS_ATTESTER_ABI,
          functionName: "revoke",
          args: [eas.schema, attestation.id, pad(toHex(revoker))],
        })

        hash = await proxyAnonymousAttestation(calldata)
      } else {
        // revoke attestation
        hash = await walletClient.data?.writeContract({
          abi: Abis.EAS_ABI,
          address: Addresses.EAS,
          functionName: "revoke",
          args: [
            {
              schema: eas.schema,
              data: {
                value: 0n,
                uid: attestation.id,
              },
            },
          ],
        })
      }

      if (!hash) {
        toast.error("Error", {
          description: "Transaction failed",
        })
        return
      }

      const waitingToastId = toast.loading(
        "Waiting for transaction to complete",
        {
          description: hash,
        }
      )

      const tx = await client.waitForTransactionReceipt({
        hash,
      })

      toast.dismiss(waitingToastId)

      toast.success("Transaction Completed", {
        description: `Revoke successful. Transaction hash: ${tx.transactionHash}`,
        action: {
          label: "Show",
          onClick: () => {
            window.open(`${blockExplorer}/tx/${tx.transactionHash}`, "_blank")
          },
        },
      })

      queryClient
        .invalidateQueries({
          queryKey: ["attestations", chainId],
        })
        .then(async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          await queryClient.prefetchQuery({
            queryKey: ["attestations", chainId],
          })
        })

      setIsRevoked(true)
    } catch (error: any) {
      if (axios.isAxiosError(error))
        toast.error("Error", {
          description: error.response?.data.message || error.message,
        })
      else
        toast.error("Error", {
          description: error.message,
        })
    } finally {
      setIsRevoking(false)
    }
  }

  const isRevokable =
    isAnonymous ||
    (account.isConnected && attestation.attester === account.address)

  return (
    <Card
      key={attestation.id}
      className="group relative flex w-full flex-col gap-1 p-4"
    >
      {isAnonymous && isRevoking && (
        <Dialog
          onOpenChange={() => {
            isRequestingPassword?.[1]({
              message: "Revoke password dialog closed",
            })
            setIsRequestingPassword(undefined)
          }}
          open={isRequestingPassword !== undefined}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Password</DialogTitle>
              <DialogDescription>
                Enter the correct password to revoke this attestation.
              </DialogDescription>
            </DialogHeader>
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const password = (e as any).target[0].value
                  isRequestingPassword?.[0](password)
                  setIsRequestingPassword(undefined)
                }}
              >
                <Input
                  type="password"
                  autoComplete="revoke"
                  autoCorrect="off"
                  autoCapitalize="off"
                  name="revoke"
                  className="mb-2"
                />
                <DialogFooter>
                  <Button type="reset" variant="outline">
                    Reset
                  </Button>
                  <Button type="submit">Submit</Button>
                </DialogFooter>
              </form>
            </>
          </DialogContent>
        </Dialog>
      )}
      {(isRevoked || attestation.revoked) && (
        <Badge className="absolute right-2 top-2" variant="destructive">
          Revoked
        </Badge>
      )}
      {!(isRevoked || attestation.revoked) && isRevokable && (
        <Button
          variant="destructive"
          className={cn(
            "absolute right-2 top-2 hidden group-hover:inline-flex",
            isRevoking && "inline-flex"
          )}
          disabled={isRevoking}
          onClick={revoke}
          size="sm"
        >
          {isRevoking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Revoking
            </>
          ) : (
            "Revoke"
          )}
        </Button>
      )}
      <p className="line-clamp-2 font-semibold">{attestation.data.title}</p>
      <p className="text-sm text-muted-foreground">
        {attestation.data.message}
      </p>
      <div className="flex flex-col items-start gap-1 text-sm md:flex-row md:gap-2">
        <div className="flex items-center gap-2">
          {isAnonymous ? (
            <>
              <EyeOff className="size-4" />
              <span className="font-medium">Anonymous</span>
            </>
          ) : (
            <>
              <CircleUserRound className="size-4" />
              <a
                className="font-medium"
                href={`${eas.explorer}/address/${attestation.attester}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {senderName.data || formatAddress(attestation.attester)}{" "}
                {attestation.attester === account.address && "(You)"}
              </a>
            </>
          )}
          <Badge className="px-1 py-0 text-xs">
            {ALL_ROLES[attestation.data.role]}
          </Badge>
          <CornerRightDown className="size-4 md:hidden" />
        </div>
        <ArrowRight className="mx-2 hidden size-4 md:block" />
        <div className="flex items-center gap-2">
          <CircleUserRound className="size-4" />
          <a
            className="font-medium"
            href={`${eas.explorer}/address/${attestation.attester}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {recipientName.data || formatAddress(attestation.recipient)}
          </a>
        </div>
      </div>
      <div>
        <a
          className="line-clamp-1 text-sm font-medium"
          href={`${eas.explorer}/attestation/view/${attestation.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {attestation.id.slice(0, 40)}
        </a>
      </div>
    </Card>
  )
}
