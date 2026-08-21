export type CollectionUser = {
  id: string;
  name: string;
};

export type CollectionMemberInput = {
  userId: string;
  slots: number;
  amountDue: number;
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
  adjustmentReason?: string;
};

export type CollectionActionResult = {
  status: "success" | "error";
  message: string;
  id?: string;
};
