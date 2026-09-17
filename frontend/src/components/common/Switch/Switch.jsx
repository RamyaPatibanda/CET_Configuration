function Switch({ name, label, checked = false, onChange, disabled = false }) {
  return (
    <label className={`common-switch ${disabled ? "common-switch-disabled" : ""}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="common-switch-track" aria-hidden="true">
        <span className="common-switch-thumb" />
      </span>
      <span className="common-switch-label">{label}</span>
    </label>
  );
}

export default Switch;
