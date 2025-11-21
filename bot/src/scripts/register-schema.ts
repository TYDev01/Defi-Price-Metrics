import { SDK, zeroBytes32 } from '@somnia-chain/streams'
import { createWalletClient, createPublicClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import dotenv from 'dotenv'
import path from 'path'
import { existsSync } from 'fs'
import { waitForTransactionReceipt } from 'viem/actions'


const baseDir = __dirname
const envPaths = [
  path.resolve(baseDir, '../../../.env'),
  path.resolve(baseDir, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
]

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`Loading .env from: ${envPath}`)
    dotenv.config({ path: envPath })
    break
  }
}


const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'],
    },
  },
})


const PRICE_SCHEMA =
  'uint64 timestamp, string pair, string chain, uint256 priceUsd, uint256 liquidity, uint256 volume24h, int32 priceChange1h, int32 priceChange24h'

async function registerSchema() {
  console.log('\n🔵 Registering Somnia Data Streams Schema...\n')

  const rpcUrl = process.env.SOMNIA_RPC_URL
  const privateKey = process.env.SOMNIA_PRIVATE_KEY

  if (!rpcUrl || !privateKey) {
    throw new Error('Missing SOMNIA_RPC_URL or SOMNIA_PRIVATE_KEY')
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)

  const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: somniaChain,
    transport: http(rpcUrl),
  })

  const sdk = new SDK({
    public: publicClient,
    wallet: walletClient,
  })

  console.log(`Schema Publisher: ${account.address}`)

  // Compute schema ID
  console.log('\n Computing Schema ID...')
  const schemaId = await sdk.streams.computeSchemaId(PRICE_SCHEMA)
  
  if (schemaId instanceof Error) {
    throw new Error(`Failed to compute schema ID: ${schemaId.message}`)
  }
  
  console.log(`Schema ID: ${schemaId}`)

  // Check if already registered
  console.log('\n Checking if schema is already registered...')
  const isRegistered = await sdk.streams.isDataSchemaRegistered(schemaId)

  if (isRegistered) {
    console.log(' Schema already registered\n')
  } else {
    console.log('Registering schema...')

    const tx = await sdk.streams.registerDataSchemas(
      [
        {
          schemaName: 'CryptoPriceData',
          schema: PRICE_SCHEMA,
          parentSchemaId: zeroBytes32 as `0x${string}`,
        },
      ],
      true // ignoreIfAlreadyRegistered
    )

    if (tx instanceof Error) {
      throw new Error(`Failed to register schema: ${tx.message}`)
    }

    console.log(` Waiting for confirmation: ${tx}`)
    await waitForTransactionReceipt(publicClient, { hash: tx })

    console.log(` Schema registered successfully! Tx: ${tx}\n`)
  }

  console.log(' Add these to your .env:')
  console.log(`SOMNIA_SCHEMA_ID=${schemaId}`)
  console.log(`PUBLISHER_ADDRESS=${account.address}`)

  console.log('\n Done!')
}

registerSchema().catch((err) => {
  console.error(' Error:', err)
  process.exit(1)
})
