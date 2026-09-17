import { useEffect, useState } from "react";
import Button from "../../../components/common/Button/Button";
import Checkbox from "../../../components/common/Checkbox/Checkbox";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import TextBox from "../../../components/common/TextBox/TextBox";
import { FIELD_TYPES } from "../constants/fieldConstants";

const EMPTY_FIELD = {
  fieldId: 0,
  fieldName: "",
  displayName: "",
  fieldType: "Text",
  isRequired: false,
  isActive: true,
  displayOrder: 0,
};

function FieldForm({ open, field, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FIELD);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(field ? { ...EMPTY_FIELD, ...field } : EMPTY_FIELD);
    setError("");
  }, [field, open]);

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fieldName.trim() || !form.displayName.trim() || !form.fieldType) {
      setError("Field name, display name and field type are required.");
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
          <Button type="submit" form="field-form" disabled={saving}>
            {saving ? "Saving..." : field ? "Update" : "Create"}
          </Button>
        </>
      )}
    >
      <form id="field-form" onSubmit={handleSubmit} className="field-form">
        {error && <div className="field-form-error">{error}</div>}
        <TextBox name="fieldName" label="Field Name" value={form.fieldName} required onChange={(e) => update("fieldName", e.target.value)} />
        <TextBox name="displayName" label="Display Name" value={form.displayName} required onChange={(e) => update("displayName", e.target.value)} />
        <Select name="fieldType" label="Field Type" value={form.fieldType} required options={FIELD_TYPES} onChange={(e) => update("fieldType", e.target.value)} />
        <TextBox name="displayOrder" label="Display Order" type="number" value={form.displayOrder} onChange={(e) => update("displayOrder", Number(e.target.value))} />
        <Checkbox name="isRequired" label="Required" checked={form.isRequired} onChange={(e) => update("isRequired", e.target.checked)} />
        <Checkbox name="isActive" label="Active" checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} />
      </form>
    </Dialog>
  );
}

export default FieldForm;
