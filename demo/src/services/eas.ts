import { Abis, SCHEMA_ID } from "@/constants/contracts"
import axios from "axios"
import {
  Address,
  checksumAddress,
  decodeAbiParameters,
  Hex,
  parseAbiParameters,
} from "viem"

import { env } from "@/env.mjs"

export const queryBadgeholders = async (forAddress?: Address) => {
  const formatted = forAddress ? checksumAddress(forAddress) : undefined
  return axios
    .post("https://optimism.easscan.org/graphql", {
      query: `
                        query Query($where: SchemaWhereUniqueInput!, $take: Int, $attestationsWhere2: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {
                          schema(where: $where) {
                            attestations(take: $take, where: $attestationsWhere2, orderBy: $orderBy) {
                              id
                              data
                            }
                          }
                        }
                    `,
      variables: {
        where: {
          id: SCHEMA_ID,
        },
        take: 10,
        attestationsWhere2: {
          attester: {
            in: [
              "0x621477dBA416E12df7FF0d48E14c4D20DC85D7D9",
              "0xE4553b743E74dA3424Ac51f8C1E586fd43aE226F",
            ],
          },
          [forAddress ? "recipient" : ""]: {
            equals: forAddress,
          },
          revoked: {
            equals: false,
          },
        },
        orderBy: [
          {
            timeCreated: "desc",
          },
        ],
      },
    })
    .then((res) => {
      const refIDs = (
        res.data.data.schema.attestations as { data: Hex; id: Hex }[]
      )
        .map((a) => {
          const [round, ,] = decodeAbiParameters(
            Abis.BADGEHOLDER_DATA_ABI_PARAMETER,
            a.data
          )
          return {
            round,
            id: a.id,
          }
        })
        .filter((a) => a.round === env.NEXT_PUBLIC_BADGEHOLDER_ROUND)
      return refIDs[0]?.id
    })
}
