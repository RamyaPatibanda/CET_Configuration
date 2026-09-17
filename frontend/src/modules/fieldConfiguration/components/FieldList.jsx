function Icon({ name }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trash: <><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m9 7 1-3h4l1 3M6 7l1 14h10l1-14"/></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function FieldList({ fields, loading, onEdit, onDelete }) {
  if (loading) return <div className="field-list-message">Loading fields…</div>;
  if (!fields.length) return <div className="field-list-message">No fields configured yet.</div>;
  return (
    <div className="field-table-wrapper"><table className="field-table"><thead><tr><th>Field Name</th><th>Display Name</th><th>Field Type</th><th>Required</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead>
      <tbody>{fields.map((field) => <tr key={field.fieldId}>
        <td><strong>{field.fieldName}</strong></td><td>{field.displayName}</td><td>{field.fieldType}</td>
        <td><span className="required-chip">{field.isRequired ? "Required" : "Optional"}</span></td>
        <td><span className={`status-chip ${field.isActive ? "active" : "inactive"}`}><span>●</span>{field.isActive ? "Active" : "Inactive"}</span></td>
        <td>{field.displayOrder}</td><td className="field-actions">
          <button type="button" className="icon-button" title={`Edit ${field.displayName}`} aria-label={`Edit ${field.displayName}`} onClick={() => onEdit(field)}><Icon name="edit"/></button>
          <button type="button" className="icon-button delete-icon" title={`Delete ${field.displayName}`} aria-label={`Delete ${field.displayName}`} onClick={() => onDelete(field)}><Icon name="trash"/></button>
        </td>
      </tr>)}</tbody>
    </table></div>
  );
}
export default FieldList;
