"use client"

import { useState } from "react"
import { Abis, Addresses, EAS } from "@/constants/contracts"
import { getCuriaSignature } from "@/services/curia"
import { queryBadgeholders } from "@/services/eas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cx } from "class-variance-authority"
import _ from "lodash"
import { useForm } from "react-hook-form"
import { Address, encodeAbiParameters, Hex, zeroAddress, zeroHash } from "viem"
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useWalletClient,
} from "wagmi"
import { z } from "zod"

import { ALL_ROLES, Role } from "@/types/role"
import { ethereumClient } from "@/config/chain"
import { prove } from "@/lib/prover"

import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Input } from "../ui/input"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Switch } from "../ui/switch"
import { Textarea } from "../ui/textarea"
import { ToastAction } from "../ui/toast"
import { useToast } from "../ui/use-toast"

const FormSchema = z.object({
  anonymous: z.boolean(),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .or(z.string().regex(/^[a-zA-Z0-9-]+\.eth$/, "Invalid ENS address")),
  role: z.nativeEnum(Role),
  message: z
    .string()
    .min(1, "Message is too short")
    .max(1000, "Message is too long"),
})

export const EndorsePublicCard = () => {
  const { toast } = useToast()

  const account = useAccount()
  const client = usePublicClient()
  const walletClient = useWalletClient()
  const queryClient = useQueryClient()

  const chainId = useChainId()
  const chains = useChains()

  const {
    data: { enabledRoles, badgeholderRefId } = {
      enabledRoles: [Role.None],
      badgeholderRefId: null,
    },
  } = useQuery<{
    enabledRoles: Role[]
    badgeholderRefId: Hex | null
  }>({
    queryKey: ["roles", account.address, chainId],
    queryFn: async () => {
      if (!account.address)
        return {
          enabledRoles: [Role.None],
          badgeholderRefId: null,
        }

      const enabledRoles = [Role.None]
      const [votingPower, balance, delegate, badgeholder] = await Promise.all([
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "getVotes",
          args: [account.address],
        }),
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "balanceOf",
          args: [account.address],
        }),
        client.readContract({
          abi: Abis.OP_TOKEN_ABI,
          address: Addresses.OP_TOKEN,
          functionName: "delegates",
          args: [account.address],
        }),
        queryBadgeholders(account.address),
      ])

      if (badgeholder) {
        enabledRoles.push(Role.Badgeholder)
      }

      if (votingPower > 0) {
        enabledRoles.push(Role.Delegate)
      }

      if (
        balance > 0 &&
        delegate !== account.address &&
        delegate !== zeroAddress
      ) {
        enabledRoles.push(Role.Delegator)
      }

      return {
        enabledRoles,
        badgeholderRefId: badgeholder,
      }
    },
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      anonymous: false,
      address: "",
      role: Role.None,
      message: "",
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      setSubmitting(true)

      const recipient = data.address.startsWith("0x")
        ? data.address
        : await ethereumClient.getEnsAddress({
            name: data.address,
          })
      if (!recipient) {
        form.setError("address", { message: "Address not found" })
        return
      }

      if (data.anonymous) {
        if (!account.address) return
        // get verfication signature
        const signature = await walletClient.data?.signMessage({
          message: `CURIA VERIFY ACCOUNT OWNERSHIP ${account.address}`,
        })
        if (!signature) return
        // get curia signature
        const curiaSignature = await getCuriaSignature(
          account.address,
          signature,
          "ECDSA"
        )
        // get signature for this role
        const signatureForThisRole = curiaSignature.signatures.find(
          (s) => ALL_ROLES[s.role] === data.role
        )
        // if no signature for this role, throw error
        if (!signatureForThisRole) {
          throw new Error(
            "You need to verify your account ownership for this role"
          )
        }

        // generate zk proof
        await prove(
          account.address,
          signatureForThisRole,
          data.message,
          curiaSignature.timestamp
        )
      } else {
        const hash = await walletClient.data?.writeContract({
          abi: Abis.EAS_ABI,
          address: Addresses.EAS,
          functionName: "attest",
          args: [
            {
              schema: EAS[chainId].schema,
              data: {
                expirationTime: 0n,
                recipient: recipient as Address,
                refUID: zeroHash,
                revocable: true,
                value: 0n,
                data: encodeAbiParameters(Abis.SCHEMA_ABI_PARAMETER, [
                  BigInt(ALL_ROLES.indexOf(data.role)),
                  data.message,
                  data.role === Role.Badgeholder ? badgeholderRefId! : "0x",
                ]),
              },
            },
          ],
        })

        if (!hash) {
          return
        }

        const tx = await client.waitForTransactionReceipt({
          hash,
        })

        const blockExplorer = chains.find((c) => c.id === chainId)
          ?.blockExplorers?.default.url
        toast({
          title: "Transaction Completed",
          description: `Endorsement successful. Transaction hash: ${tx.transactionHash}`,
          action: (
            <ToastAction
              altText="Show"
              onClick={() => {
                window.open(
                  `${blockExplorer}/tx/${tx.transactionHash}`,
                  "_blank"
                )
              }}
            >
              Show
            </ToastAction>
          ),
        })

        queryClient
          .invalidateQueries({
            queryKey: ["attestations", chainId],
          })
          .then(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            await queryClient.prefetchQuery({
              queryKey: ["attestations", chainId],
            })
          })

        form.reset()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        action: <ToastAction altText="Show">Show</ToastAction>,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mx-auto w-full max-w-full md:max-w-[400px]">
          <CardHeader>
            <CardTitle>Endorse</CardTitle>
            <CardDescription>
              Endorse to any address with your chosen message and role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="anonymous"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between ">
                    <div className="w-[75%] space-y-0.5">
                      <FormLabel className="text-base">
                        Anonymous Endorsement
                      </FormLabel>
                      <FormDescription>
                        Endorse anonymously without revealing your address.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      The address or ENS you want to endorse.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {ALL_ROLES.map((role) => {
                          const disabled = !enabledRoles.includes(role)
                          return (
                            <FormItem
                              className="flex items-center space-x-3 space-y-0"
                              key={role}
                            >
                              <FormControl>
                                <RadioGroupItem
                                  value={role}
                                  disabled={disabled}
                                />
                              </FormControl>
                              <FormLabel
                                className={cx(
                                  "font-normal",
                                  disabled && "opacity-50"
                                )}
                              >
                                {_.startCase(Role[role])}
                              </FormLabel>
                            </FormItem>
                          )
                        })}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      The role you want to show when endorse.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Your message here..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The message you want to show when endorse.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={!account.isConnected}
              loading={submitting}
            >
              {account.isConnected ? "Endorse" : "Connect Wallet"}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                form.reset()
              }}
            >
              Reset
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
