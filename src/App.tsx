import { createClient } from "@polkadot-api/client"
import {
  Account,
  getInjectedExtensions,
  getLegacyProvider,
} from "@polkadot-api/legacy-polkadot-provider"
import { createScClient } from "@substrate/connect"
import React, { useEffect, useState } from "react"
import assetHubTypes, {
  MultiAddress,
  XcmV3Junctions,
  XcmV3Junction,
} from "./codegen/assetHub"
import assetHubChainspec from "./asset-hub"

const ASSET_ID = 8

const scProvider = createScClient()
const { relayChains, connectAccounts } = getLegacyProvider(scProvider)

const assetHub = await relayChains.westend2.getParachain(assetHubChainspec)
const client = createClient(assetHub.connect, { assets: assetHubTypes })

const ExtensionSelector: React.FC = () => {
  const [availableExtensions, setAvailableExtensions] = useState<string[]>([])
  const [selectedExtension, setSelectedExtension] = useState<string | null>(
    null,
  )
  const [accounts, setAccounts] = useState<Array<Account>>([])

  useEffect(() => {
    getInjectedExtensions().then((newExtensions) => {
      setAvailableExtensions(newExtensions)
      setSelectedExtension(newExtensions[0] ?? null)
    })
  }, [])

  useEffect(() => {
    connectAccounts(selectedExtension)
  }, [selectedExtension])

  useEffect(() => assetHub.onAccountsChange(setAccounts), [])

  if (!availableExtensions.length)
    return <div>No Account Providers detected</div>

  return (
    <div>
      <div>
        <label>Select Account Provider: </label>
        <select
          value={selectedExtension ?? ""}
          onChange={(e) => {
            setSelectedExtension(e.target.value)
          }}
        >
          {availableExtensions.map((wallet) => (
            <option key={wallet} value={wallet}>
              {wallet}
            </option>
          ))}
        </select>
      </div>
      {accounts.length ? (
        <App accounts={accounts} />
      ) : (
        <div>No connected accounts :(</div>
      )}
    </div>
  )
}

const App: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  const [account, setAccount] = useState(accounts[0])
  const [balance, setBalance] = useState<bigint | null>(null)
  const [recipientAddress, setRecipientAddress] = useState(
    "5ELXt7N4gPpN4d1E5c4wKyYhZFCaSDiH5zUxuWsgY4SNrPW5",
  )
  const [amount, setAmount] = useState("")
  useEffect(() => {
    setBalance(null)
    const subscription = client.assets.query.Assets.Account.watchValue(
      ASSET_ID,
      account.address,
    ).subscribe((assetAccount) => {
      setBalance(assetAccount?.balance ?? 0n)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [account])

  const handleTransact = () => {
    client.assets.tx.Assets.transfer_keep_alive({
      id: ASSET_ID,
      amount: BigInt(amount),
      target: MultiAddress.Id(recipientAddress),
    })
      .submit$(account.address, {
        asset: {
          parents: 0,
          interior: XcmV3Junctions.X2([
            XcmV3Junction.PalletInstance(50),
            XcmV3Junction.GeneralIndex(BigInt(ASSET_ID)),
          ]),
        },
      })
      .subscribe({ next: console.log, error: console.error })
  }

  return (
    <>
      <div>
        <label>
          JOE's Balance: {balance === null ? "Loading..." : balance.toString()}
        </label>
      </div>

      <div>
        <label>From: </label>
        <select
          value={account.address}
          onChange={(e) => {
            setAccount(accounts.find((a) => a.address === e.target.value)!)
          }}
        >
          {accounts.map((elm) => (
            <option key={elm.address} value={elm.address}>
              {elm.address}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>To: </label>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => {
            setRecipientAddress(e.target.value)
          }}
          placeholder="To address"
        />
      </div>
      <div>
        <label>Amount: </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
          }}
          placeholder="Enter amount to send"
        />
      </div>

      <button onClick={handleTransact}>Transact</button>
    </>
  )
}

export default ExtensionSelector
