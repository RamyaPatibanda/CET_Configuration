import { useEffect, useState } from "react";
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
    try { setLoading(true); setError(""); const response = await fieldConfigurationService.getFields(); setFields(Array.isArray(response) ? response : response?.data || []); }
    catch (loadError) { setError(loadError.message || "Unable to load fields."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadFields(); }, []);
  const openCreate = () => { setSelectedField(null); setFormOpen(true); };
  const openEdit = (field) => { setSelectedField(field); setFormOpen(true); };
  const handleSave = async (field) => {
    try { setSaving(true); setError(""); if (selectedField) await fieldConfigurationService.updateField(selectedField.fieldId, field); else await fieldConfigurationService.createField(field); setFormOpen(false); setSelectedField(null); await loadFields(); }
    catch (saveError) { setError(saveError.message || "Unable to save field."); }
    finally { setSaving(false); }
  };
  const handleDelete = async (field) => {
    if (!window.confirm(`Delete field "${field.displayName}"?`)) return;
    try { setError(""); await fieldConfigurationService.deleteField(field.fieldId); await loadFields(); }
    catch (deleteError) { setError(deleteError.message || "Unable to delete field."); }
  };
  return (
    <div className="field-configuration-page">
      <div className="field-page-header"><div><h1>Field Configuration</h1><p>Define and manage the fields used across your CET rules.</p></div><Button onClick={openCreate}>Add Field</Button></div>
      {error && <div className="field-page-error">{error}</div>}
      <FieldList fields={fields} loading={loading} onEdit={openEdit} onDelete={handleDelete}/>
      <FieldForm open={formOpen} field={selectedField} saving={saving} onClose={() => setFormOpen(false)} onSave={handleSave}/>
    </div>
  );
}
export default FieldConfiguration;
