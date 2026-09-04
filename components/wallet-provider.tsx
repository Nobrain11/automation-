'use client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

export function SolanaProvider({ children }: { children: React.ReactNode }) { return <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'}><WalletProvider wallets={[]} autoConnect><WalletModalProvider>{children}</WalletModalProvider></WalletProvider></ConnectionProvider> }
