---
name: Redeem Advanced Permissions with a smart account session
description: Redeem ERC-7715 Advanced Permissions when the session account is a smart account
---

# Redeem Advanced Permissions with a smart account session

Use this workflow when the session account is a smart account. If the session account is an EOA, use [Redeem permissions — EOA](./redeem-permissions-eoa.md) instead.

## Extend the bundler client

Create a bundler client and extend it with `erc7710BundlerActions` to enable `sendUserOperationWithDelegation`:

```typescript
import { createBundlerClient } from 'viem/account-abstraction'
import { http } from 'viem'
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://api.pimlico.io/v2/<CHAIN_ID>/rpc?apikey=<PIMLICO_API_KEY>'),
  paymaster: true,
}).extend(erc7710BundlerActions())
```

## Estimate gas fees

Calculate `maxFeePerGas` and `maxPriorityFeePerGas` using the bundler client:

```typescript
import { createClient, http } from 'viem'
import { pimlicoBundlerActions } from 'permissionless/actions/pimlico'

const pimlicoClient = createClient({
  transport: http('https://api.pimlico.io/v2/<CHAIN_ID>/rpc?apikey=<PIMLICO_API_KEY>'),
  chain,
}).extend(pimlicoBundlerActions)

const { fast: { maxFeePerGas, maxPriorityFeePerGas } } = await pimlicoClient.getUserOperationGasPrice()
```

## Extract the permission context

Extract the `context` and `delegationManager` from the stored `grantedPermissions` response:

```typescript
const permissionContext = grantedPermissions[0].context
const delegationManager = grantedPermissions[0].delegationManager
```

## Prepare the calldata

Encode the function call you want to execute on behalf of the user. This example transfers 1 USDC to a recipient:

```typescript
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem'

const callData = encodeFunctionData({
  abi: erc20Abi,
  args: [recipient, parseUnits('1', 6)],
  functionName: 'transfer',
})
```

## Send the user operation with delegation

For more details, see the [ERC-7710 bundler client reference](https://docs.metamask.io/smart-accounts-kit/reference/erc7710/bundler-client.md).

```typescript
const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
  publicClient,
  account: sessionAccount,
  calls: [
    {
      to: tokenAddress,
      data: callData,
      permissionContext,
      delegationManager,
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```
