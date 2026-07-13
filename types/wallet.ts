export interface Wallet {
  id: string;
  name: string;
  icon?: string; // optional icon name or emoji
  color?: string; // hex or tailwind class
  saldo_awal: number;
  saldo_saat_ini: number;
}

export type WalletTransfer = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  description?: string;
};
