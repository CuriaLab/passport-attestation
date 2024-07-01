"use client"

import { useMemo, useState } from "react"
import { Abis, Addresses, EAS } from "@/constants/contracts"
import { getCuriaSignature, proxyAnonymousAttestation } from "@/services/curia"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { cx } from "class-variance-authority"
import _ from "lodash"
import { useForm } from "react-hook-form"
import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  zeroHash,
} from "viem"
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi"
import { z } from "zod"

import { ALL_ROLES, Role } from "@/types/role"
import { ethereumClient } from "@/config/chain"
import { getBlockExplorer } from "@/lib/chain"
import { prove } from "@/lib/prover"
import { useEnabledRoles } from "@/hooks/useEnabledRoles"

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

const AnonymousEnabledSchema = z.object({
  enabled: z.literal(true),
  password: z.string().min(1, "Password is required for anonymous endorsement"),
})

const AnonymousDisabledSchema = z.object({
  enabled: z.literal(false),
  password: z.string().optional(),
})

const FormSchema = z.object({
  anonymous: z.discriminatedUnion("enabled", [
    AnonymousEnabledSchema,
    AnonymousDisabledSchema,
  ]),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .or(z.string().regex(/^[a-zA-Z0-9-]+\.eth$/, "Invalid ENS address")),
  role: z.nativeEnum(Role),
  title: z.string().min(1, "Title is too short").max(50, "Title is too long"),
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

  const { enabledRoles, badgeholderRefId } = useEnabledRoles(account.address)

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      anonymous: {
        enabled: false,
      },
      address: "",
      title: "",
      role: Role.None,
      message: "",
    },
  })

  const blockExplorer = useMemo(() => getBlockExplorer(chainId), [chainId])

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

      let tx
      if (data.anonymous.enabled) {
        if (!account.address) return
        if (!data.anonymous.password) return

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
        const { proof, nonce, revokerHash, timestamp } = await prove(
          account.address,
          signatureForThisRole,
          data.title + data.message,
          curiaSignature.timestamp,
          data.anonymous.password
        )

        const schema = EAS[chainId].schema

        const calldata = encodeFunctionData({
          abi: Abis.ANNOYMOUS_ATTESTER_ABI,
          functionName: "attest",
          args: [
            schema,
            recipient as Address,
            {
              ref: zeroHash,
              message: data.message,
              title: data.title,
              role: BigInt(signatureForThisRole.role),
            },
            {
              proof,
              nonce,
              revokerHash,
              timestamp,
            },
          ],
        })

        console.log([
          schema,
          recipient as Address,
          {
            ref: zeroHash,
            message: data.message,
            title: data.title,
            role: BigInt(signatureForThisRole.role),
          },
          {
            proof,
            nonce,
            revokerHash,
            timestamp,
          },
        ])

        const hash = await proxyAnonymousAttestation(
          calldata,
          true
        )

        tx = await client.waitForTransactionReceipt({
          hash,
        })
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
                  data.title,
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

        tx = await client.waitForTransactionReceipt({
          hash,
        })
      }

      toast({
        title: "Transaction Completed",
        description: `Endorsement successful. Transaction hash: ${tx.transactionHash}`,
        action: (
          <ToastAction
            altText="Show"
            className="max-w-[60%]"
            onClick={() => {
              window.open(`${blockExplorer}/tx/${tx.transactionHash}`, "_blank")
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
      })
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mx-auto w-full max-w-full md:max-w-[500px]">
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
                name="anonymous.enabled"
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your message title here..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The title you want to show when endorse.
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
              {form.watch("anonymous.enabled") && (
                <FormField
                  control={form.control}
                  name="anonymous.password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormDescription>
                        The password to revoke the endorsement, must be kept
                        secret.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
