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
  isFeeExempt: boolean;
  exemptionReason: string;
  goals: number;
  assists: number;
};

export type CollectionOpponent = {
  id: string;
  name: string;
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
  kind: "MATCH" | "GENERAL";
  title: string;
  playedAt: string;
  opponentId: string | null;
  ourScore: number | null;
  opponentScore: number | null;
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
  kind: "MATCH" | "GENERAL";
  title: string;
  playedAt: string;
  opponentId: string;
  newOpponentName: string;
  ourScore: number | null;
  opponentScore: number | null;
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
