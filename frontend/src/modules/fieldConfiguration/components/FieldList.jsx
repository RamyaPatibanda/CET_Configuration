import { FiEdit2, FiTrash2 } from "react-icons/fi";

function FieldList({ fields, loading, onEdit, onDelete }) {
  if (loading) return <div className="field-list-message">Loading fields…</div>;
  if (!fields.length) return <div className="field-list-message">No fields configured yet.</div>;

  return (
    <div className="field-table-wrapper">
      <table className="field-table">
        <thead>
          <tr><th>Field Name</th><th>Display Name</th><th>Field Type</th><th>Required</th><th>Status</th><th>Order</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.fieldId}>
              <td><strong>{field.fieldName}</strong></td>
              <td>{field.displayName}</td>
              <td>{field.fieldType}</td>
              <td><span className="required-chip">{field.isRequired ? "Required" : "Optional"}</span></td>
              <td><span className={`status-chip ${field.isActive ? "active" : "inactive"}`}><span>●</span>{field.isActive ? "Active" : "Inactive"}</span></td>
              <td>{field.displayOrder}</td>
              <td className="field-actions">
                <button type="button" className="icon-button" title={`Edit ${field.displayName}`} aria-label={`Edit ${field.displayName}`} onClick={() => onEdit(field)}><FiEdit2 size={16} /></button>
                <button type="button" className="icon-button delete-icon" title={`Delete ${field.displayName}`} aria-label={`Delete ${field.displayName}`} onClick={() => onDelete(field)}><FiTrash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FieldList;
