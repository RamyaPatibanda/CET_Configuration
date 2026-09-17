function Select({ label, value, options = [], onChange, required = false, disabled = false, name, error = "" }) {
  return (
    <div className="common-form-control">
      {label && <label htmlFor={name}>{label}{required && <span className="common-required"> *</span>}</label>}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={error ? "common-input common-input-error" : "common-input"}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="common-field-error">{error}</div>}
    </div>
  );
}

export default Select;
