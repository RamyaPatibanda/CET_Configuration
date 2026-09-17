import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import fieldConfigurationService from "../services/fieldConfigurationService";
import FieldForm from "../components/FieldForm";
import FieldList from "../components/FieldList";
import "../fieldConfiguration.css";

function FieldConfiguration() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);

  const loadFields = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fieldConfigurationService.getFields();
      const loadedFields = Array.isArray(response) ? response : response?.data || [];
      setFields([...loadedFields].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
    } catch (loadError) {
      setError(loadError.message || "Unable to load fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFields(); }, []);

  const openCreate = () => { setSelectedField(null); setFormOpen(true); };
  const openEdit = (field) => { setSelectedField(field); setFormOpen(true); };

  const handleSave = async (field) => {
    try {
      setSaving(true);
      setError("");
      if (selectedField) {
        await fieldConfigurationService.updateField(selectedField.fieldId, field);
      } else {
        const nextDisplayOrder = fields.length ? Math.max(...fields.map((item) => item.displayOrder ?? 0)) + 1 : 1;
        await fieldConfigurationService.createField({ ...field, displayOrder: nextDisplayOrder });
      }
      setFormOpen(false);
      setSelectedField(null);
      await loadFields();
    } catch (saveError) {
      setError(saveError.message || "Unable to save field.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field) => {
    if (!window.confirm(`Delete field "${field.displayName}"?`)) return;
    try {
      setError("");
      await fieldConfigurationService.deleteField(field.fieldId);
      await loadFields();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete field.");
    }
  };

  const handleReorder = async (reorderedFields) => {
    const previousFields = fields;
    const orderedFields = reorderedFields.map((field, index) => ({ ...field, displayOrder: index + 1 }));
    setFields(orderedFields);
    setError("");

    try {
      await Promise.all(
        orderedFields.map((field) =>
          fieldConfigurationService.updateField(field.fieldId, field)
        )
      );
    } catch (reorderError) {
      setFields(previousFields);
      setError(reorderError.message || "Unable to save the new field order.");
      await loadFields();
    }
  };

  const nextFieldId = fields.length ? Math.max(...fields.map((field) => field.fieldId ?? 0)) + 1 : 1;

  return (
    <div className="field-configuration-page">
      <div className="field-page-header">
        <div><h1>Field Configuration</h1><p>Define and manage the fields used across your CET rules.</p></div>
        <Button onClick={openCreate} className="add-field-button" title="Add Field" aria-label="Add Field">
          <FiPlus size={18} strokeWidth={2.2} />
        </Button>
      </div>
      {error && <div className="field-page-error">{error}</div>}
      <FieldList fields={fields} loading={loading} onEdit={openEdit} onDelete={handleDelete} onReorder={handleReorder} />
      <FieldForm open={formOpen} field={selectedField} nextFieldId={nextFieldId} saving={saving} onClose={() => setFormOpen(false)} onSave={handleSave} />
    </div>
  );
}

export default FieldConfiguration;
