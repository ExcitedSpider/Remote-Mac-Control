interface StatusBarProps {
  message: string;
  type: string;
}

export default function StatusBar({ message, type }: StatusBarProps) {
  const className = `status-bar${type ? ` ${type}` : ""}`;
  return <div className={className}>{message}</div>;
}
