"use client"

import { useMemo } from "react"
import { EAS } from "@/constants/contracts"
import { queryAttestations } from "@/services/eas"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  CircleUser,
  CircleUserRound,
  User,
  UserRound,
} from "lucide-react"
import { useChainId } from "wagmi"

import { ALL_ROLES } from "@/types/role"
import { formatAddress } from "@/lib/address"
import { getBlockExplorer } from "@/lib/chain"

import { Badge } from "../ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card"

export const AttestationListCard = () => {
  const chainId = useChainId()
  const { data } = useInfiniteQuery({
    queryKey: ["attestations", chainId],
    queryFn: async ({ pageParam = 0 }) => {
      return queryAttestations(chainId, pageParam, 10)
    },
    getNextPageParam: (_, __, i) => i + 1,
    initialPageParam: 0,
  })

  const attestations = useMemo(
    () => data?.pages?.flatMap((page) => page) ?? [],
    [data]
  )

  const [blockExplorer, attestationExplorer] = useMemo(() => {
    return [getBlockExplorer(chainId)!, EAS[chainId].explorer] as const
  }, [chainId])

  return (
    <Card className="mx-auto w-full flex-auto">
      <CardHeader>
        <CardTitle>Attestation List</CardTitle>
        <CardDescription>
          List of all the attestations on the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {attestations.map((attestation) => (
            <Card
              key={attestation.id}
              className="flex w-full flex-col gap-1 p-4"
            >
              <a
                className="line-clamp-1 font-semibold"
                href={`${attestationExplorer}/attestation/view/${attestation.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {attestation.id.slice(0, 40)}
              </a>
              <div className="flex items-center gap-2 text-sm">
                <CircleUserRound className="size-4" />
                <a
                  className="font-medium"
                  href={`${attestationExplorer}/address/${attestation.attester}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatAddress(attestation.attester)}
                </a>
                <Badge className="px-1 py-0 text-xs">
                  {ALL_ROLES[attestation.data.role]}
                </Badge>
                <ArrowRight className="mx-2 size-4" />
                <CircleUserRound className="size-4" />
                <a
                  className="font-medium"
                  href={`${attestationExplorer}/address/${attestation.attester}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatAddress(attestation.recipient)}
                </a>
              </div>
              <p className="text-sm text-muted-foreground">
                {attestation.data.message}
              </p>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
