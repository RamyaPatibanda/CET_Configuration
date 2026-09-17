function TextBox({ label, value, onChange, placeholder = "", required = false, disabled = false, type = "text", error = "", name }) {
  return (
    <div className="common-form-control">
      {label && <label htmlFor={name}>{label}{required && <span className="common-required"> *</span>}</label>}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
        className={error ? "common-input common-input-error" : "common-input"}
      />
      {error && <div className="common-field-error">{error}</div>}
    </div>
  );
}

export default TextBox;
