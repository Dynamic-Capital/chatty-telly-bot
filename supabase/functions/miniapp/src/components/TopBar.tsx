import SecondaryButton from "./SecondaryButton";

interface Props {
  title: string;
  onLogout?: () => void;
}

export default function TopBar({ title, onLogout }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold">{title}</h1>
      {onLogout && (
        <SecondaryButton label="Log out" onClick={onLogout} />
      )}
    </div>
  );
}
