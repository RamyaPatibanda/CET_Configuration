function Checkbox({ label, checked, onChange, disabled = false, name }) {
  return (
    <label className="common-checkbox">
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

export default Checkbox;
