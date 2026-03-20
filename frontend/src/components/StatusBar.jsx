export default function StatusBar({ message, type }) {
  const className = `status-bar${type ? ` ${type}` : ""}`;
  return <div className={className}>{message}</div>;
}
