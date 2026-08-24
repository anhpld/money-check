export type CollectionUser = {
  id: string;
  name: string;
  avatarKey: string | null;
};

export type CollectionMemberInput = {
  userId: string;
  slots: number;
  amountDue: number;
  note: string;
};

export type CollectionChargeOption = {
  id: string;
  name: string;
  defaultAmount: number;
  autoSelected: boolean;
  allowCustomAmount: boolean;
};

export type PaidBreakdown = {
  footballAmount: number;
  options: Array<{ name: string; amount: number }>;
};

export type CollectionEditorData = {
  id: string;
  title: string;
  playedAt: string;
  note: string;
  totalAmount: number;
  chargeOptions: CollectionChargeOption[];
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  members: Array<CollectionMemberInput & {
    id: string;
    amountPaid: number;
    manualPaidAt: string | null;
    paidOptionIds: string[];
    paidBreakdown: PaidBreakdown;
  }>;
};

export type SaveCollectionInput = {
  id?: string;
  title: string;
  playedAt: string;
  note: string;
  totalAmount: number;
  chargeOptions: CollectionChargeOption[];
  status: "DRAFT" | "PUBLISHED";
  members: CollectionMemberInput[];
};

export type CollectionActionResult = {
  status: "success" | "error";
  message: string;
  id?: string;
};
