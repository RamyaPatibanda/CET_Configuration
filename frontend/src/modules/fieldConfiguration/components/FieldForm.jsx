import { useEffect, useState } from "react";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import Switch from "../../../components/common/Switch/Switch";
import TextBox from "../../../components/common/TextBox/TextBox";
import fieldConfigurationService from "../services/fieldConfigurationService";

const EMPTY_FIELD = {
  fieldId: 0,
  tableName: "",
  fieldName: "",
  displayName: "",
  fieldType: "Text",
  isRequired: false,
  isActive: true,
  displayOrder: 0,
};

function toOptions(items) {
  return (Array.isArray(items) ? items : items?.data || []).map((item) => ({
    value: item.name ?? item.value ?? item,
    label: item.name ?? item.label ?? item,
    fieldType: item.fieldType ?? "Text",
  }));
}

function FieldForm({ open, field, nextFieldId = 1, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FIELD);
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadTables = async () => {
      try {
        setLoadingTables(true);
        const response = await fieldConfigurationService.getTables();
        setTables(toOptions(response));
      } catch (loadError) {
        setError(loadError.message || "Unable to load configured tables.");
      } finally {
        setLoadingTables(false);
      }
    };

    setForm(field ? { ...EMPTY_FIELD, ...field } : { ...EMPTY_FIELD, fieldId: nextFieldId });
    setColumns([]);
    setError("");
    loadTables();
  }, [field, nextFieldId, open]);

  useEffect(() => {
    if (!open || !form.tableName) {
      setColumns([]);
      return;
    }

    const loadColumns = async () => {
      try {
        setLoadingColumns(true);
        const response = await fieldConfigurationService.getColumns(form.tableName);
        setColumns(toOptions(response));
      } catch (loadError) {
        setColumns([]);
        setError(loadError.message || "Unable to load table columns.");
      } finally {
        setLoadingColumns(false);
      }
    };

    loadColumns();
  }, [open, form.tableName]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "tableName") {
      setForm((current) => ({ ...current, tableName: value, fieldName: "", fieldType: "Text" }));
      setError("");
    }
  };

  const handleColumnChange = (event) => {
    const selectedColumn = columns.find((column) => column.value === event.target.value);
    setForm((current) => ({
      ...current,
      fieldName: event.target.value,
      fieldType: selectedColumn?.fieldType || "Text",
    }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.tableName || !form.fieldName || !form.displayName.trim()) {
      setError("Table, column and display name are required.");
      return;
    }
    setError("");
    await onSave(form);
  };

  return (
    <Dialog
      open={open}
      title={field ? "Edit Field" : "Create Field"}
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="field-form" disabled={saving || loadingTables || loadingColumns}>
            {saving ? "Saving..." : field ? "Update" : "Create"}
          </Button>
        </>
      )}
    >
      <form id="field-form" onSubmit={handleSubmit} className="field-form">
        {error && <div className="field-form-error">{error}</div>}
        <Select
          name="tableName"
          label="Table"
          value={form.tableName}
          required
          disabled={loadingTables || saving}
          options={tables}
          placeholder={loadingTables ? "Loading tables..." : "Select table"}
          onChange={(e) => update("tableName", e.target.value)}
        />
        <Select
          name="fieldName"
          label="Column"
          value={form.fieldName}
          required
          disabled={!form.tableName || loadingColumns || saving}
          options={columns}
          placeholder={loadingColumns ? "Loading columns..." : "Select column"}
          onChange={handleColumnChange}
        />
        <TextBox name="fieldType" label="Field Type" value={form.fieldType} disabled />
        <TextBox name="displayName" label="Display Name" value={form.displayName} required onChange={(e) => update("displayName", e.target.value)} />
        <div className="field-form-switches">
          <Switch name="isRequired" label="Required" checked={form.isRequired} onChange={(e) => update("isRequired", e.target.checked)} />
          <Switch name="isActive" label="Active" checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} />
        </div>
      </form>
    </Dialog>
  );
}

export default FieldForm;
