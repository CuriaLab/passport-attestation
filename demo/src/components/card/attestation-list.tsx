"use client"

import { useState } from "react"
import { queryAttestations } from "@/services/eas"
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query"
import _ from "lodash"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useChainId } from "wagmi"

import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card"
import { Skeleton } from "../ui/skeleton"
import { AttestationCard } from "./attestation"

export const AttestationListCard = () => {
  const chainId = useChainId()

  const [page, setPage] = useState(0)
  const { data, isFetching, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["attestations", chainId],
    queryFn: async ({ pageParam }) => {
      return queryAttestations(chainId, pageParam, 10)
    },
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, p) => {
      if (lastPage.length < 10) return undefined
      return p + 1
    },
  })

  return (
    <Card className="mx-auto w-full flex-auto">
      <CardHeader>
        <CardTitle>Attestation List</CardTitle>
        <CardDescription>
          List of all the attestations on the platform
        </CardDescription>
        <div className="flex items-center justify-end gap-2 *:size-8 *:p-2">
          <Button
            variant="outline"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            disabled={
              (data?.pages.length === page + 1 && !hasNextPage) || isFetching
            }
            onClick={async () => {
              if (data?.pages.length && data.pages.length < page + 2) {
                await fetchNextPage()
              }
              setPage((p) => p + 1)
            }}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {isFetching
            ? _.range(5).map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            : data?.pages?.[page]?.map((attestation) => (
                <AttestationCard
                  key={attestation.id}
                  attestation={attestation}
                />
              ))}
        </div>
      </CardContent>
    </Card>
  )
}
