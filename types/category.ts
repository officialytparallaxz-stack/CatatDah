import type { TransactionType } from "@/types/transaction";

export type CategoryType = TransactionType;

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}
