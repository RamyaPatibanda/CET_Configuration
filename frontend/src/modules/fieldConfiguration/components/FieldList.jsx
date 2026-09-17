import { useState } from "react";
import { FiEdit2, FiMenu, FiTrash2 } from "react-icons/fi";

function FieldList({ fields, loading, onEdit, onDelete, onReorder }) {
  const [draggedId, setDraggedId] = useState(null);

  if (loading) return <div className="field-list-message">Loading fields…</div>;
  if (!fields.length) return <div className="field-list-message">No fields configured yet.</div>;

  const handleDrop = (targetId) => {
    if (draggedId === null || draggedId === targetId) return;
    const reordered = [...fields];
    const fromIndex = reordered.findIndex((field) => field.fieldId === draggedId);
    const toIndex = reordered.findIndex((field) => field.fieldId === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [movedField] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedField);
    setDraggedId(null);
    onReorder?.(reordered);
  };

  return (
    <div className="field-table-wrapper">
      <div className="field-reorder-hint"><FiMenu size={15} /> Drag the handle to rearrange field order.</div>
      <table className="field-table">
        <thead>
          <tr><th className="field-order-column" aria-label="Reorder" /><th>Field Name</th><th>Display Name</th><th>Field Type</th><th>Required</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr
              key={field.fieldId}
              draggable
              className={draggedId === field.fieldId ? "field-row-dragging" : ""}
              onDragStart={(event) => {
                setDraggedId(field.fieldId);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(field.fieldId)}
              onDragEnd={() => setDraggedId(null)}
            >
              <td className="field-order-column">
                <button
                  type="button"
                  className="field-drag-handle"
                  title="Drag to rearrange"
                  aria-label={`Reorder ${field.displayName}`}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    setDraggedId(field.fieldId);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <FiMenu size={17} />
                </button>
              </td>
              <td><strong>{field.fieldName}</strong></td>
              <td>{field.displayName}</td>
              <td>{field.fieldType}</td>
              <td><span className="required-chip">{field.isRequired ? "Required" : "Optional"}</span></td>
              <td><span className={`status-chip ${field.isActive ? "active" : "inactive"}`}><span>●</span>{field.isActive ? "Active" : "Inactive"}</span></td>
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
