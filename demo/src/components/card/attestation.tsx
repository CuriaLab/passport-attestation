import { EAS } from "@/constants/contracts"
import {
  ArrowRight,
  CircleUserRound,
  CornerRightDown,
  EyeOff,
} from "lucide-react"
import { useChainId } from "wagmi"

import { FormattedAttestation } from "@/types/attestation"
import { ALL_ROLES } from "@/types/role"
import { formatAddress } from "@/lib/address"
import { useMainnetEnsName } from "@/hooks/useMainnetEnsName"

import { Badge } from "../ui/badge"
import { Card } from "../ui/card"

export const AttestationCard = ({
  attestation,
}: {
  attestation: FormattedAttestation
}) => {
  const chainId = useChainId()
  const senderName = useMainnetEnsName(attestation.attester)
  const recipientName = useMainnetEnsName(attestation.recipient)

  const eas = EAS[chainId]
  const isAnonymous = attestation.attester === eas.anonymousAttester

  return (
    <Card key={attestation.id} className="flex w-full flex-col gap-1 p-4">
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
                {senderName.data || formatAddress(attestation.attester)}
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
