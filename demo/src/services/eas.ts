import { Abis, BADGEHOLDER_SCHEMA_ID, EAS } from "@/constants/contracts"
import axios from "axios"
import _ from "lodash"
import { Address, checksumAddress, decodeAbiParameters, Hex } from "viem"

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
          id: BADGEHOLDER_SCHEMA_ID,
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
            equals: formatted,
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

export const queryAttestations = async (
  chainId: keyof typeof EAS,
  page: number = 0,
  size: number = 10
) => {
  const eas = EAS[chainId]
  const skip = page * size
  return axios
    .post(eas.graphql, {
      query: `
                        query Query($where: SchemaWhereUniqueInput!, $take: Int, $skip: Int, $attestationsWhere2: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {
                          schema(where: $where) {
                            attestations(take: $take, skip: $skip, where: $attestationsWhere2, orderBy: $orderBy) {
                              id
                              data
                              revocationTime
                              attester
                              recipient
                              time
                              txid
                            }
                          }
                        }
                    `,
      variables: {
        where: {
          id: eas.schema,
        },
        take: size,
        skip,
        attestationsWhere2: {},
        orderBy: [
          {
            timeCreated: "desc",
          },
        ],
      },
    })
    .then((res) =>
      _.chain(
        res.data.data.schema.attestations as {
          id: Hex
          data: Hex
          revocationTime: number
          attester: Address
          recipient: Address
          time: number
          txid: string
        }[]
      )
        .map((a) => {
          try {
            const data = decodeAbiParameters(Abis.SCHEMA_ABI_PARAMETER, a.data)
            return {
              ...a,
              data: {
                role: Number(data[0]),
                title: data[1],
                message: data[2],
                ref: data[3],
              },
            }
          } catch (e) {
            console.error(e)
            return undefined
          }
        })
        .compact()
        .value()
    )
}
