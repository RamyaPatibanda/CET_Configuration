import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiSearch } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import fieldConfigurationService from "../services/fieldConfigurationService";
import authService from "../../../services/authService";
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
  const [deleteField, setDeleteField] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        await fieldConfigurationService.createField({ ...field, displayOrder: nextDisplayOrder, isActive: true });
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

  const updateFieldStatus = async (field, property, value) => {
    const previousFields = fields;
    const updatedField = { ...field, [property]: value };
    setFields((current) => current.map((item) => item.fieldId === field.fieldId ? updatedField : item));

    try {
      setError("");
      await fieldConfigurationService.updateField(field.fieldId, updatedField);
    } catch (updateError) {
      setFields(previousFields);
      setError(updateError.message || "Unable to update field status.");
    }
  };

  const handleDelete = async () => {
    if (!deleteField) return;
    try {
      setError("");
      await fieldConfigurationService.deleteField(deleteField.fieldId);
      setDeleteField(null);
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
        orderedFields.map((field) => fieldConfigurationService.updateField(field.fieldId, field))
      );
    } catch (reorderError) {
      setFields(previousFields);
      setError(reorderError.message || "Unable to save the new field order.");
      await loadFields();
    }
  };

  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => [field.tableName, field.fieldName, field.displayName, field.fieldType].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [fields, search]);
  const totalPages = Math.max(1, Math.ceil(filteredFields.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedFields = filteredFields.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [search, pageSize]);
  const nextFieldId = fields.length ? Math.max(...fields.map((field) => field.fieldId ?? 0)) + 1 : 1;

  return (
    <div className="field-configuration-page">
      <div className="field-page-header">
        <div><h1>Field Configuration</h1><p>Define and manage the fields used across your CET rules.</p></div>
        {canWrite && <Button onClick={openCreate} className="add-field-button" title="Add Field" aria-label="Add Field">
          <FiPlus size={18} strokeWidth={2.2} />
        </Button>}
      </div>
      {error && <div className="field-page-error">{error}</div>}
      <div className="field-list-toolbar"><div className="field-search-box"><FiSearch size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fields..." aria-label="Search fields" /></div><div className="field-page-size"><span>Rows</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></div></div>
      <FieldList
        fields={pagedFields}
        loading={loading}
        canWrite={canWrite}
        onEdit={canWrite ? openEdit : undefined}
        onDelete={canWrite ? setDeleteField : undefined}
        onReorder={canWrite ? handleReorder : undefined}
        onToggleRequired={canWrite ? (field, value) => updateFieldStatus(field, "isRequired", value) : undefined}
        onToggleActive={canWrite ? (field, value) => updateFieldStatus(field, "isActive", value) : undefined}
      />
      {filteredFields.length > 0 && <div className="field-pagination"><span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredFields.length)} of {filteredFields.length}</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button><span>Page {safePage} of {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next</button></div></div>}
      <FieldForm
        open={formOpen}
        field={selectedField}
        nextFieldId={nextFieldId}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
      <Dialog
        open={Boolean(deleteField)}
        title="Delete Field"
        onClose={() => setDeleteField(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeleteField(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Permanently</Button>
          </>
        )}
      >
        <div className="field-delete-confirmation">
          <p>
            The field <strong>{deleteField?.displayName}</strong> is going to be deleted permanently.
          </p>
          <p>This action cannot be undone. Do you want to continue?</p>
        </div>
      </Dialog>
    </div>
  );
}

export default FieldConfiguration;
