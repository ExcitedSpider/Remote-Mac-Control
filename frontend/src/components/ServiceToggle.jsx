export default function ServiceToggle({ label, description, checked, disabled, onChange }) {
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
