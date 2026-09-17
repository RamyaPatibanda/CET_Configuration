function Button({ children, type = "button", variant = "primary", disabled = false, onClick, className = "" }) {
  return (
    <button
      type={type}
      className={`common-button common-button-${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default Button;
