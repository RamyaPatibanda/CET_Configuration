import { useEffect, useMemo, useState } from "react";
import { FiMenu, FiPlus, FiTrash2, FiUsers, FiCheckSquare } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import SearchableSelect from "../../../components/common/SearchableSelect/SearchableSelect";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";
import "./RuleConditionGrouping.css";

const EMPTY_RULE = {
  ruleId: 0, ruleName: "", description: "", priority: 1, isActive: true,
  decisionAreaCode: "CANDIDATE_QUALIFICATION", outcome: { values: [] },
  conditions: [], decisionRows: [],
};

const OPERATORS = {
  Text: [
    { value: "Equals", label: "Equals" }, { value: "NotEquals", label: "Not Equals" },
    { value: "Contains", label: "Contains" }, { value: "StartsWith", label: "Starts With" },
  ],
  Number: [
    { value: "Equals", label: "Equals" }, { value: "NotEquals", label: "Not Equals" },
    { value: "GreaterThan", label: "Greater Than" }, { value: "LessThan", label: "Less Than" },
    { value: "GreaterThanOrEqual", label: "Greater Than or Equal" },
    { value: "LessThanOrEqual", label: "Less Than or Equal" },
  ],
  Date: [
    { value: "Equals", label: "Equals" }, { value: "Before", label: "Before" }, { value: "After", label: "After" },
  ],
  Boolean: [{ value: "Equals", label: "Equals" }],
};

const LOGICAL_OPTIONS = [
  { value: "AND", label: "AND" }, { value: "OR", label: "OR" },
];

const GROUP_COLORS = ["blue", "violet", "teal", "amber", "rose", "indigo"];

const normalizeOutcome = (value) => {
  const source = value || {};
  const values = source.values ?? source.Values;
  if (Array.isArray(values)) {
    return {
      values: values.map((item) => ({
        supportingValue: item.supportingValue ?? item.SupportingValue ?? "",
        value: item.value ?? item.Value ?? "",
        valueKind: item.valueKind ?? item.ValueKind ?? "text",
      })),
    };
  }
  const legacyKeys = ["allocatedType", "vacancyType", "seatCategory", "reservationType", "candidateStatus", "preferenceMode", "allowBetterment"];
  return {
    values: legacyKeys
      .filter((key) => source[key] !== undefined && source[key] !== null && source[key] !== "")
      .map((key) => ({
        supportingValue: key, value: String(source[key]),
        valueKind: typeof source[key] === "boolean" ? "boolean" : "text",
      })),
  };
};

const normalizeDecisionRows = (value) => {
  const rows = Array.isArray(value) ? value : value?.decisionRows ?? value?.DecisionRows ?? [];
  return rows.map((row) => ({
    ruleDecisionId: row.ruleDecisionId ?? row.RuleDecisionId ?? 0,
    ruleId: row.ruleId ?? row.RuleId ?? 0,
    decisionName: row.decisionName ?? row.DecisionName ?? "",
    decisionOrder: row.decisionOrder ?? row.DecisionOrder ?? 1,
    isActive: row.isActive ?? row.IsActive ?? true,
    allocationType: row.allocationType ?? row.AllocationType ?? "",
    sequence: row.sequence ?? row.Sequence ?? 1,
  }));
};

const optionsForType = (type) => OPERATORS[type] || OPERATORS.Text;
const getResponseItems = (response) => Array.isArray(response) ? response : response?.data || [];

function toRows(conditions) {
  if (!conditions?.length) return [];
  return [...conditions]
    .sort((a, b) => (a.groupOrder ?? 1) - (b.groupOrder ?? 1) || (a.conditionOrder ?? 1) - (b.conditionOrder ?? 1))
    .map((condition, index) => ({
      id: `condition-${condition.fieldId}-${condition.conditionOrder}-${index}`,
      groupId: `group-${condition.groupOrder ?? 1}`,
      fieldId: condition.fieldId,
      conditionLogicalOperator: condition.conditionLogicalOperator || condition.logicalOperator || "AND",
      operator: condition.operator || "Equals",
      value: condition.value || "",
    }));
}

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [decisionOptions, setDecisionOptions] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingDecisionOptions, setLoadingDecisionOptions] = useState(false);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [draggedRow, setDraggedRow] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(rule ? {
      ...EMPTY_RULE, ...rule,
      decisionAreaCode: rule.decisionAreaCode || "CANDIDATE_QUALIFICATION",
      decisionRows: normalizeDecisionRows(rule.decisionRows),
      outcome: normalizeOutcome(rule.outcome || (rule.outcomeJson ? (() => { try { return JSON.parse(rule.outcomeJson); } catch { return {}; } })() : {})),
    } : { ...EMPTY_RULE, ruleId: nextRuleId });
    setRows(rule ? toRows(rule.conditions) : []);
    setSelectedRows([]);
    setError("");

    const loadConfiguration = async () => {
      try {
        setLoadingFields(true);
        setLoadingDecisionOptions(true);
        const [fieldsResponse, decisionResponse] = await Promise.all([
          ruleConfigurationService.getFields(),
          ruleConfigurationService.getDecisionOptions(),
        ]);
        setFields(getResponseItems(fieldsResponse));
        setDecisionOptions(getResponseItems(decisionResponse));
      } catch (loadError) {
        setError(loadError.message || "Unable to load rule configuration options.");
      } finally {
        setLoadingFields(false);
        setLoadingDecisionOptions(false);
      }
    };
    loadConfiguration();
  }, [open, rule, nextRuleId]);

  const groupedRows = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      if (!row.groupId) return;
      if (!groups.has(row.groupId)) groups.set(row.groupId, []);
      groups.get(row.groupId).push(row);
    });
    return groups;
  }, [rows]);

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const addRow = () => {
    const id = `condition-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setRows((current) => [...current, {
      id, groupId: null, fieldId: "", conditionLogicalOperator: current.length ? "AND" : "AND",
      operator: "Equals", value: "",
    }]);
  };

  const updateRow = (id, name, value) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [name]: value } : row));
  };

  const changeField = (id, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const operators = optionsForType(field?.fieldType);
    updateRow(id, "fieldId", value);
    updateRow(id, "operator", operators[0]?.value || "Equals");
    updateRow(id, "value", "");
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
    setSelectedRows((current) => current.filter((selectedId) => selectedId !== id));
  };

  const toggleSelected = (id) => {
    setSelectedRows((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const selectAll = (event) => {
    setSelectedRows(event.target.checked ? rows.map((row) => row.id) : []);
  };

  const moveRow = (targetId) => {
    if (!draggedRow || draggedRow === targetId) return;
    setRows((current) => {
      const sourceIndex = current.findIndex((row) => row.id === draggedRow);
      const targetIndex = current.findIndex((row) => row.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedRow(null);
  };

  const updateOutcome = (index, name, value) => {
    setForm((current) => {
      const values = [...(current.outcome?.values || [])];
      values[index] = { ...values[index], [name]: value };
      return { ...current, outcome: { values } };
    });
  };

  const addOutcome = () => {
    const definitions = decisionOptions.find((item) => item.value === form.decisionAreaCode)?.results || [];
    const first = definitions[0];
    setForm((current) => ({
      ...current,
      outcome: { values: [...(current.outcome?.values || []), {
        supportingValue: first?.supportingValue || "", value: "", valueKind: first?.valueKind || "text",
      }] },
    }));
  };

  const removeOutcome = (index) => setForm((current) => ({
    ...current, outcome: { values: (current.outcome?.values || []).filter((_, i) => i !== index) },
  }));

  const groupSelected = () => {
    if (selectedRows.length < 2) return;
    const selected = new Set(selectedRows);
    const newGroupId = `group-${Date.now()}`;
    setRows((current) => current.map((row) => selected.has(row.id) ? { ...row, groupId: newGroupId } : row));
    setSelectedRows([]);
  };

  const ungroupSelected = () => {
    if (!selectedRows.length) return;
    setRows((current) => current.map((row) => selectedRows.includes(row.id) ? { ...row, groupId: null } : row));
    setSelectedRows([]);
  };

  const addDecisionRow = () => {
    const definitions = decisionOptions.find((item) => item.value === form.decisionAreaCode)?.results || [];
    const allocationType = definitions.find((item) => item.supportingValue === "allocatedType");
    setForm((current) => ({
      ...current,
      decisionRows: [...(current.decisionRows || []), {
        ruleDecisionId: 0, ruleId: current.ruleId, decisionName: "",
        decisionOrder: (current.decisionRows || []).length + 1, isActive: true,
        allocationType: allocationType?.values?.[0]?.value || "",
        sequence: (current.decisionRows || []).length + 1,
      }],
    }));
  };

  const updateDecisionRow = (index, name, value) => setForm((current) => ({
    ...current,
    decisionRows: (current.decisionRows || []).map((row, rowIndex) => rowIndex === index ? { ...row, [name]: value } : row),
  }));

  const removeDecisionRow = (index) => setForm((current) => ({
    ...current,
    decisionRows: (current.decisionRows || []).filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, decisionOrder: rowIndex + 1 })),
  }));

  const getBracePosition = (row) => {
    if (!row.groupId) return "single";
    const group = groupedRows.get(row.groupId) || [];
    const groupIndex = group.findIndex((item) => item.id === row.id);
    if (group.length === 1) return "single";
    if (groupIndex === 0) return "start";
    if (groupIndex === group.length - 1) return "end";
    return "middle";
  };

  const getGroupColor = (row) => {
    if (!row.groupId) return "blue";
    const groupIndex = [...groupedRows.keys()].indexOf(row.groupId);
    return GROUP_COLORS[groupIndex % GROUP_COLORS.length];
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.ruleName.trim()) { setError("Rule name is required."); return; }
    if (!rows.length) { setError("Add at least one condition."); return; }

    const conditions = [];
    let groupOrder = 0;
    let previousGroupKey = null;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.fieldId || !row.operator || !String(row.value).trim()) {
        setError("Complete every condition before saving."); return;
      }
      const currentGroupKey = row.groupId || `ungrouped-${row.id}`;
      if (currentGroupKey !== previousGroupKey) { groupOrder += 1; previousGroupKey = currentGroupKey; }
      conditions.push({
        fieldId: Number(row.fieldId),
        conditionLogicalOperator: (row.conditionLogicalOperator || "AND").toUpperCase(),
        operator: row.operator, value: row.value, conditionOrder: index + 1, groupOrder,
      });
    }

    setError("");
    await onSave({
      ...form, priority: Number(form.priority || 1), decisionAreaCode: form.decisionAreaCode,
      outcome: normalizeOutcome(form.outcome), conditions,
      decisionRows: (form.decisionRows || []).map((decision, index) => ({
        decisionName: decision.decisionName, decisionOrder: index + 1,
        isActive: decision.isActive !== false, allocationType: decision.allocationType,
        sequence: Number(decision.sequence || index + 1),
      })),
    });
  };

  return (
    <Dialog open={open} title={rule ? "Edit Rule" : "Create Rule"} className="rule-dialog"
      onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="rule-form" disabled={saving || loadingFields}>{saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}</Button></>}>
      <form id="rule-form" className="rule-form" onSubmit={handleSubmit}>
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-grid">
          <TextBox name="ruleName" label="Rule Name" value={form.ruleName} required disabled={saving} onChange={(event) => update("ruleName", event.target.value)} />
          <TextBox name="description" label="Description" value={form.description} disabled={saving} onChange={(event) => update("description", event.target.value)} />
        </div>

        <div className="conditions-header">
          <div className="conditions-header-copy">
            <span className="conditions-kicker">Rule logic</span>
            <h3>Conditions</h3>
            <p>Build the rule using fields, operators and values. Use AND / OR between conditions and group related conditions when needed.</p>
          </div>
        </div>

        <div className="condition-toolbar-actions">
          <Button type="button" variant="secondary" className="condition-tool-button" onClick={groupSelected} disabled={selectedRows.length < 2} title="Group selected conditions"><FiUsers size={13} /><span>Group</span>{selectedRows.length > 1 && <span className="condition-tool-count">{selectedRows.length}</span>}</Button>
          <Button type="button" variant="secondary" className="condition-tool-button" onClick={ungroupSelected} disabled={!selectedRows.length} title="Ungroup selected conditions"><FiMenu size={13} /><span>Ungroup</span></Button>
          <Button type="button" variant="secondary" className="condition-tool-button condition-add-button" onClick={addRow} title="Add a condition"><FiPlus size={13} /><span>Add condition</span></Button>
        </div>

        <div className="condition-selection-note">
          {selectedRows.length ? `${selectedRows.length} condition${selectedRows.length === 1 ? "" : "s"} selected for grouping` : "Select two or more rows to group them. Drag the handle to rearrange conditions."}
        </div>

        <div className="condition-single-table-wrapper">
          <table className="condition-single-table">
            <colgroup>
              <col className="condition-col-check" /><col className="condition-col-group" /><col className="condition-col-drag" />
              <col className="condition-col-field" /><col className="condition-col-operator" /><col className="condition-col-value" />
              <col className="condition-col-logic" /><col className="condition-col-action" />
            </colgroup>
            <thead><tr>
              <th className="condition-check-column"><input type="checkbox" checked={rows.length > 0 && selectedRows.length === rows.length} onChange={selectAll} aria-label="Select all conditions" /></th>
              <th className="condition-brace-column">Group</th><th className="condition-drag-column" /><th>Field</th><th>Operator</th><th>Value</th><th>Logic</th><th className="condition-action-column" />
            </tr></thead>
            <tbody>
              {rows.map((row) => {
                const field = fields.find((item) => String(item.fieldId) === String(row.fieldId));
                const operators = optionsForType(field?.fieldType);
                const bracePosition = getBracePosition(row);
                const groupColor = getGroupColor(row);
                const isSelected = selectedRows.includes(row.id);
                return (
                  <tr key={row.id} draggable onDragStart={() => setDraggedRow(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveRow(row.id)} className={isSelected ? "condition-row-selected" : ""}>
                    <td><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(row.id)} aria-label="Select condition" /></td>
                    <td><span className={`condition-group-brace ${groupColor} ${bracePosition}`} aria-hidden="true">{bracePosition !== "single" ? bracePosition === "start" ? "⎧" : bracePosition === "middle" ? "⎪" : "⎩" : ""}</span></td>
                    <td className="condition-drag-cell"><span className="condition-drag-handle" title="Drag to rearrange"><FiMenu size={16} /></span></td>
                    <td><SearchableSelect value={row.fieldId} options={fields.map((item) => ({ value: item.fieldId, label: item.displayName }))} placeholder={loadingFields ? "Loading fields..." : "Select field"} disabled={loadingFields} onChange={(value) => changeField(row.id, value)} /></td>
                    <td><Select value={row.operator} options={operators} onChange={(event) => updateRow(row.id, "operator", event.target.value)} /></td>
                    <td><TextBox value={row.value} placeholder="Enter value" onChange={(event) => updateRow(row.id, "value", event.target.value)} /></td>
                    <td><Select value={row.conditionLogicalOperator} options={LOGICAL_OPTIONS} onChange={(event) => updateRow(row.id, "conditionLogicalOperator", event.target.value)} /></td>
                    <td className="condition-action-cell"><button type="button" className="condition-remove" title="Delete condition" aria-label="Delete condition" onClick={() => removeRow(row.id)}><FiTrash2 /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && <div className="condition-empty"><div className="condition-empty-icon"><FiCheckSquare size={20} /></div><div className="condition-empty-content"><strong>No conditions added</strong><span>Start by adding a condition to define when this rule should match.</span></div><Button type="button" variant="secondary" className="condition-empty-action" onClick={addRow}><FiPlus size={13} /> Add condition</Button></div>}
        </div>

        <section className="rule-decision-configuration">
          <div className="rule-outcome-title"><div><span className="conditions-kicker">Allocation outcome</span><h3>Decision Rows</h3><p>For this allocation step, configure only the values the allocation service needs.</p></div><Button type="button" variant="secondary" onClick={addDecisionRow}><FiPlus size={13} /> Add decision</Button></div>
          <div className="decision-row-editor-list">
            {(form.decisionRows || []).map((decision, rowIndex) => {
              const definition = decisionOptions.find((item) => item.value === form.decisionAreaCode);
              const allocationTypeField = definition?.results?.find((item) => item.supportingValue === "allocatedType");
              const sequenceField = definition?.results?.find((item) => item.supportingValue === "sequence");
              const allocationOptions = allocationTypeField?.values || [];
              return (
                <div className="decision-row-editor" key={decision.ruleDecisionId || `new-${rowIndex}`}>
                  <div className="decision-row-editor-header"><div><span>Decision {rowIndex + 1}</span><TextBox value={decision.decisionName} placeholder="Decision name" onChange={(event) => updateDecisionRow(rowIndex, "decisionName", event.target.value)} /></div><button type="button" className="condition-remove" onClick={() => removeDecisionRow(rowIndex)} title="Delete decision"><FiTrash2 /></button></div>
                  <div className="decision-simple-grid">
                    <SearchableSelect value={decision.allocationType} options={allocationOptions.map((item) => ({ value: item.value, label: item.label }))} placeholder="Select allocation type" disabled={loadingDecisionOptions} onChange={(value) => updateDecisionRow(rowIndex, "allocationType", value)} />
                    <TextBox label="Sequence" value={decision.sequence} type={sequenceField?.valueKind === "number" ? "number" : "text"} min="1" placeholder="Sequence" onChange={(event) => updateDecisionRow(rowIndex, "sequence", Number(event.target.value))} />
                  </div>
                </div>
              );
            })}
            {!(form.decisionRows || []).length && <div className="decision-rows-empty"><strong>No decision rows configured.</strong><span>Add a decision to define the Step 0 allocation outcome.</span></div>}
          </div>
        </section>
      </form>
    </Dialog>
  );
}

export default RuleForm;
