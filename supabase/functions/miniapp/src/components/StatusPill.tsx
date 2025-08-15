const variants = {
  AWAITING: "dc-pill--awaiting",
  VERIFIED: "dc-pill--verified",
  REJECTED: "dc-pill--rejected",
  REVIEW: "dc-pill--review",
} as const;

type Status = keyof typeof variants;

interface Props {
  status: Status;
}

export default function StatusPill({ status }: Props) {
  return <span className={`dc-chip ${variants[status]}`}>{status}</span>;
}
