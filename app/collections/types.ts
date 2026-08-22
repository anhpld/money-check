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

export type CollectionEditorData = {
  id: string;
  title: string;
  playedAt: string;
  note: string;
  totalAmount: number;
  defaultWaterAmount: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  members: Array<CollectionMemberInput & {
    id: string;
    amountPaid: number;
    manualPaidAt: string | null;
  }>;
};

export type SaveCollectionInput = {
  id?: string;
  title: string;
  playedAt: string;
  note: string;
  totalAmount: number;
  defaultWaterAmount: number;
  status: "DRAFT" | "PUBLISHED";
  members: CollectionMemberInput[];
};

export type CollectionActionResult = {
  status: "success" | "error";
  message: string;
  id?: string;
};
