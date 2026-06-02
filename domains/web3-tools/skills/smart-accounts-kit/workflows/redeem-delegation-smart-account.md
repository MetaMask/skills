---
name: Redeem delegation with a smart account delegate
description: Redeem delegations when the delegate is a smart account
---

# Redeem delegation with a smart account delegate

Use this workflow when the delegate is a smart account. If the delegate is an EOA, use [Redeem delegation — EOA](./redeem-delegation-eoa.md) instead.

## Create the delegate smart account

Create a MetaMask smart account for the delegate that will redeem the delegation:

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'

const delegateSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [delegateOwner.address, [], [], []],
  deploySalt: '0x',
  signer: { account: delegateOwner },
})
```

## Set up the bundler client

Configure the bundler client with a paymaster to sponsor gas fees for the user operation:

```typescript
import { createBundlerClient, createPaymasterClient } from 'viem/account-abstraction'
import { http } from 'viem'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://api.pimlico.io/v2/<CHAIN_ID>/rpc?apikey=<PIMLICO_API_KEY>'),
  paymaster: createPaymasterClient({
    transport: http('https://api.pimlico.io/v2/<CHAIN_ID>/rpc?apikey=<PIMLICO_API_KEY>'),
  }),
  chain,
})
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

## Prepare and encode the execution

Encode the function call you want to execute on behalf of the delegator. This example transfers 1 USDC to a recipient:

```typescript
import { createExecution, ExecutionMode } from '@metamask/smart-accounts-kit'
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts'
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem'

const callData = encodeFunctionData({
  abi: erc20Abi,
  args: [recipient, parseUnits('1', 6)],
  functionName: 'transfer',
})

const execution = createExecution({ target: tokenAddress, callData })

const redeemCalldata = DelegationManager.encode.redeemDelegations({
  delegations: [[signedDelegation]],
  modes: [ExecutionMode.SingleDefault],
  executions: [[execution]],
})
```

## Send the user operation

Submit the user operation to the bundler. The delegate smart account calls itself with the redeem calldata:

```typescript
const userOpHash = await bundlerClient.sendUserOperation({
  account: delegateSmartAccount,
  calls: [{ to: delegateSmartAccount.address, data: redeemCalldata }],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```
