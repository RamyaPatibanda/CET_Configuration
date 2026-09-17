import Button from "../../../components/common/Button/Button";

function FieldList({ fields, loading, onEdit, onDelete }) {
  if (loading) return <div className="field-list-message">Loading fields...</div>;
  if (!fields.length) return <div className="field-list-message">No fields found.</div>;

  return (
    <div className="field-table-wrapper">
      <table className="field-table">
        <thead>
          <tr>
            <th>Field Name</th>
            <th>Display Name</th>
            <th>Field Type</th>
            <th>Required</th>
            <th>Status</th>
            <th>Order</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.fieldId}>
              <td>{field.fieldName}</td>
              <td>{field.displayName}</td>
              <td>{field.fieldType}</td>
              <td>{field.isRequired ? "Yes" : "No"}</td>
              <td>{field.isActive ? "Active" : "Inactive"}</td>
              <td>{field.displayOrder}</td>
              <td className="field-actions">
                <Button variant="secondary" onClick={() => onEdit(field)}>Edit</Button>
                <Button variant="danger" onClick={() => onDelete(field)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FieldList;
