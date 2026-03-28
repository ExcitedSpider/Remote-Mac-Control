interface ServiceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function ServiceToggle({ label, description, checked, disabled, onChange }: ServiceToggleProps) {
  return (
    <div className="service">
      <div className="service-info">
        <h2>{label}</h2>
        <p>{description}</p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="slider" />
      </label>
    </div>
  );
}
