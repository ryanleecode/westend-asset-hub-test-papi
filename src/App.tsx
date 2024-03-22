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
  XcmV4Junction as XcmV3Junction,
} from "./codegen/assetHub"
import assetHubChainspec from "./asset-hub"

const ASSET_ID = 41

const scProvider = createScClient()
const { relayChains, connectAccounts } = getLegacyProvider(scProvider)

const assetHub = relayChains.westend2.getParachain(assetHubChainspec)
const client = createClient(assetHub.provider).getTypedApi(assetHubTypes)

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
  const [joeBalance, setJoeBalance] = useState<bigint | null>(null)
  const [wndFreeBalance, setWndFreeBalance] = useState<bigint | null>(null)
  const [recipientAddress, setRecipientAddress] = useState(
    "5GiuXSBkukA3tRz2VjTxiexLNsNuuxNkaPcd2u6qWCJoFiep",
  )
  const [amount, setAmount] = useState("")
  useEffect(() => {
    setJoeBalance(null)
    const subscription = client.query.Assets.Account.watchValue(
      ASSET_ID,
      account.address,
    ).subscribe((assetAccount) => {
      setJoeBalance(assetAccount?.balance ?? 0n)
    })

    setWndFreeBalance(null)
    subscription.add(
      client.query.System.Account.watchValue(account.address).subscribe(
        (account) => {
          setWndFreeBalance(account.data.free ?? 0n)
        },
      ),
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [account])

  const handleTransact = () => {
    console.log("amount", amount)
    console.log("recipientAddress", recipientAddress)

    client.tx.Assets.transfer_keep_alive({
      id: ASSET_ID,
      target: MultiAddress.Id(recipientAddress),
      amount: BigInt(amount),
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
          WND Free Balance:{" "}
          {wndFreeBalance === null ? "Loading..." : wndFreeBalance.toString()}
        </label>
      </div>
      <div>
        <label>
          JOE Balance:{" "}
          {joeBalance === null ? "Loading..." : joeBalance.toString()}
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
