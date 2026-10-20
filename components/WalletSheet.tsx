"use client";

import type { Wallet } from "@mysten/wallet-standard";
import type { Ecosystem } from "@/src/networks";
import type { EvmWalletOption } from "@/src/wallets/evm";
import type { NearWalletOption } from "@/src/wallets/near";
import { Icon, LinkButton, Modal, Spinner } from "./ui";

function Row({ name, icon, meta, onClick }: { name: string; icon?: string; meta?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-hover focus-visible:bg-hover">
      {icon && <img src={icon} alt="" className="size-5 rounded-[4px]" />}
      <span className="flex-1 text-[13.5px] font-medium text-text">{name}</span>
      {meta && <span className="text-[12px] text-muted">{meta}</span>}
      <Icon name="chevron-right" className="size-3.5 text-faint transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-text" />
    </button>
  );
}

function MissingRow({ name, href }: { name: string; href: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="flex-1">
        <span className="block text-[13.5px] font-medium text-text">{name}</span>
        <span className="block text-[12px] text-muted">Not installed</span>
      </span>
      <LinkButton href={href} size="xs">
        Install
        <Icon name="external" className="size-3 text-muted" />
      </LinkButton>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-medium text-muted">{label}</div>
      <div className="divide-y divide-hairline overflow-hidden rounded-[var(--radius-md)] border border-border">{children}</div>
    </div>
  );
}

export function WalletSheet({
  open,
  onClose,
  ecosystem,
  networkName,
  evmOptions,
  suiOptions,
  freighterInstalled,
  nearOptions,
  nearLoading,
  onEvm,
  onSui,
  onFreighter,
  onNear,
}: {
  open: boolean;
  onClose: () => void;
  ecosystem: Ecosystem;
  networkName: string;
  evmOptions: EvmWalletOption[];
  suiOptions: Wallet[];
  freighterInstalled: boolean | null;
  nearOptions: NearWalletOption[];
  nearLoading: boolean;
  onEvm: (o: EvmWalletOption) => void;
  onSui: (w: Wallet) => void;
  onFreighter: () => void;
  onNear: (o: NearWalletOption) => void;
}) {
  const title = ecosystem === "evm" ? "Connect wallet" : ecosystem === "sui" ? "Connect Sui wallet" : ecosystem === "near" ? "Connect NEAR wallet" : "Connect Stellar wallet";
  const nearAvailable = nearOptions.filter((o) => o.available);
  return (
    <Modal open={open} onClose={onClose} title={title} description={`For payments on ${networkName}.`} width={400}>
      <div className="space-y-5">
        {ecosystem === "evm" && (
          <Group label={evmOptions.length ? "Available wallets" : "No wallet detected"}>
            {evmOptions.length ? evmOptions.map((o) => <Row key={o.id} name={o.name} icon={o.icon} meta="Detected" onClick={() => onEvm(o)} />) : (
              <>
                <MissingRow name="MetaMask" href="https://metamask.io/download/" />
                <MissingRow name="Rabby" href="https://rabby.io" />
              </>
            )}
          </Group>
        )}
        {ecosystem === "sui" && (
          <Group label={suiOptions.length ? "Available wallets" : "No Sui wallet detected"}>
            {suiOptions.length ? suiOptions.map((w) => <Row key={w.name} name={w.name} icon={w.icon} meta="Detected" onClick={() => onSui(w)} />) : <MissingRow name="Slush" href="https://slush.app" />}
          </Group>
        )}
        {ecosystem === "stellar" && (
          <Group label="Stellar wallets">
            {freighterInstalled === false ? (
              <MissingRow name="Freighter" href="https://www.freighter.app" />
            ) : freighterInstalled === null ? (
              <div className="flex items-center gap-3 px-3 py-3 text-[13px] text-muted">
                <Spinner />
                Looking for Freighter
              </div>
            ) : (
              <Row name="Freighter" meta="Installed" onClick={onFreighter} />
            )}
          </Group>
        )}
        {ecosystem === "near" && (
          <Group label="NEAR wallets">
            {nearLoading && !nearOptions.length ? (
              <div className="flex items-center gap-3 px-3 py-3 text-[13px] text-muted">
                <Spinner />
                Loading NEAR wallets
              </div>
            ) : nearAvailable.length ? (
              nearAvailable.map((o) => <Row key={o.id} name={o.name} icon={o.icon} meta={o.type === "injected" ? "Extension" : "Web"} onClick={() => onNear(o)} />)
            ) : (
              <>
                <MissingRow name="Meteor Wallet" href="https://meteorwallet.app" />
                <MissingRow name="Sender" href="https://sender.org" />
              </>
            )}
          </Group>
        )}
        <p className="text-[12px] leading-[1.5] text-muted">Your wallet signs every transaction. KwesPay never asks for your recovery phrase or private key.{(ecosystem === "stellar" ? freighterInstalled === false : ecosystem === "sui" ? !suiOptions.length : ecosystem === "near" ? !nearAvailable.length && !nearLoading : !evmOptions.length) && " Refresh this page after installing."}</p>
      </div>
    </Modal>
  );
}
