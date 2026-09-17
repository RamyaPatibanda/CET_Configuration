import { useEffect, useMemo, useState } from "react";
import { FiCheckSquare, FiMenu, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";

const EMPTY_RULE = {
  ruleId: 0,
  ruleName: "",
  description: "",
  priority: 1,
  isActive: true,
  conditions: [],
};

const OPERATORS = {
  Text: [
    { value: "Equals", label: "Equals" },
    { value: "NotEquals", label: "Not Equals" },
    { value: "Contains", label: "Contains" },
    { value: "StartsWith", label: "Starts With" },
  ],
  Number: [
    { value: "Equals", label: "Equals" },
    { value: "NotEquals", label: "Not Equals" },
    { value: "GreaterThan", label: "Greater Than" },
    { value: "LessThan", label: "Less Than" },
    { value: "GreaterThanOrEqual", label: "Greater Than or Equal" },
    { value: "LessThanOrEqual", label: "Less Than or Equal" },
  ],
  Date: [
    { value: "Equals", label: "Equals" },
    { value: "Before", label: "Before" },
    { value: "After", label: "After" },
  ],
  Boolean: [{ value: "Equals", label: "Equals" }],
};

const LOGICAL_OPTIONS = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
];

const GROUP_COLORS = ["blue", "violet", "teal", "amber", "rose", "indigo"];

function optionsForType(type) {
  return OPERATORS[type] || OPERATORS.Text;
}

function getResponseItems(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function createCondition(groupId = "group-1") {
  return {
    id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    fieldId: "",
    logicalOperator: "AND",
    operator: "Equals",
    value: "",
  };
}

function toRows(conditions) {
  if (!conditions?.length) return [];

  return [...conditions]
    .sort(
      (a, b) =>
        (a.groupOrder ?? 1) - (b.groupOrder ?? 1) ||
        (a.conditionOrder ?? 1) - (b.conditionOrder ?? 1)
    )
    .map((condition, index, all) => ({
      id: `condition-${condition.fieldId}-${condition.conditionOrder}-${index}`,
      groupId: `group-${condition.groupOrder ?? 1}`,
      fieldId: condition.fieldId,
      logicalOperator: condition.logicalOperator || "AND",
      operator: condition.operator || "Equals",
      value: condition.value || "",
      groupLogicalOperator: condition.groupLogicalOperator || "AND",
      groupOrder: condition.groupOrder ?? 1,
      previousGroupId:
        index > 0 && all[index - 1].groupOrder !== (condition.groupOrder ?? 1)
          ? all[index - 1].groupOrder
          : null,
    }));
}

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [draggedRow, setDraggedRow] = useState(null);

  useEffect(() => {
    if (!open) return;

    setForm(rule ? { ...EMPTY_RULE, ...rule } : { ...EMPTY_RULE, ruleId: nextRuleId });
    setRows(rule ? toRows(rule.conditions) : []);
    setSelectedRows([]);
    setError("");

    const loadFields = async () => {
      try {
        setLoadingFields(true);
        const response = await ruleConfigurationService.getFields();
        setFields(getResponseItems(response));
      } catch (loadError) {
        setError(loadError.message || "Unable to load active fields.");
      } finally {
        setLoadingFields(false);
      }
    };

    loadFields();
  }, [open, rule, nextRuleId]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const addRow = () => {
    const existingGroupIds = rows.map((row) => row.groupId);
    const groupId = existingGroupIds.length
      ? existingGroupIds[existingGroupIds.length - 1]
      : "group-1";

    setRows((current) => [...current, createCondition(groupId)]);
  };

  const removeRow = (rowId) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setSelectedRows((current) => current.filter((id) => id !== rowId));
  };

  const updateRow = (rowId, name, value) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [name]: value } : row))
    );
  };

  const changeField = (rowId, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const firstOperator = optionsForType(field?.fieldType)[0]?.value || "Equals";

    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? { ...row, fieldId: value, operator: firstOperator, value: "" }
          : row
      )
    );
  };

  const toggleSelected = (rowId) => {
    setSelectedRows((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  };

  const selectAll = () => {
    setSelectedRows((current) =>
      current.length === rows.length ? [] : rows.map((row) => row.id)
    );
  };

  const getGroupId = (row) => row.groupId || "group-1";

  const groupSelected = () => {
    if (selectedRows.length < 2) return;

    const groupId = `group-${Date.now()}`;
    const firstSelectedIndex = Math.min(
      ...selectedRows.map((id) => rows.findIndex((row) => row.id === id))
    );

    setRows((current) => {
      const selected = new Set(selectedRows);
      const selectedItems = current.filter((row) => selected.has(row.id));
      const remaining = current.filter((row) => !selected.has(row.id));
      const groupedItems = selectedItems.map((row) => ({ ...row, groupId }));
      remaining.splice(Math.min(firstSelectedIndex, remaining.length), 0, ...groupedItems);
      return remaining;
    });

    setSelectedRows([]);
  };

  const ungroupSelected = () => {
    if (!selectedRows.length) return;

    setRows((current) =>
      current.map((row) =>
        selectedRows.includes(row.id)
          ? { ...row, groupId: `group-${row.id}` }
          : row
      )
    );
    setSelectedRows([]);
  };

  const moveRow = (targetId) => {
    if (!draggedRow || draggedRow === targetId) return;

    setRows((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((row) => row.id === draggedRow);
      const targetIndex = next.findIndex((row) => row.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDraggedRow(null);
  };

  const groupedRows = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const groupId = getGroupId(row);
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(row);
    });
    return groups;
  }, [rows]);

  const getBracePosition = (row, index) => {
    const group = groupedRows.get(getGroupId(row)) || [];
    const groupIndex = group.findIndex((item) => item.id === row.id);

    if (group.length === 1) return "single";
    if (groupIndex === 0) return "start";
    if (groupIndex === group.length - 1) return "end";
    return "middle";
  };

  const getGroupColor = (row) => {
    const groupIds = [...groupedRows.keys()];
    const groupIndex = groupIds.indexOf(getGroupId(row));
    return GROUP_COLORS[groupIndex % GROUP_COLORS.length];
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    if (!rows.length) {
      setError("Add at least one condition.");
      return;
    }

    const groupIds = [...groupedRows.keys()];
    const conditions = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.fieldId || !row.operator || !String(row.value).trim()) {
        setError("Complete every condition before saving.");
        return;
      }

      const groupOrder = groupIds.indexOf(getGroupId(row)) + 1;
      const groupRows = groupedRows.get(getGroupId(row));
      const rowIndex = groupRows.findIndex((item) => item.id === row.id);
      const groupLogicalOperator = rowIndex === 0 ? "AND" : row.groupLogicalOperator || "AND";

      conditions.push({
        fieldId: Number(row.fieldId),
        logicalOperator:
          rowIndex === groupRows.length - 1 ? "AND" : row.logicalOperator || "AND",
        operator: row.operator,
        value: row.value,
        conditionOrder: index + 1,
        groupOrder,
        groupLogicalOperator,
      });
    }

    setError("");
    await onSave({
      ...form,
      priority: Number(form.priority || 1),
      conditions,
    });
  };

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
      className="rule-dialog"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="rule-form" disabled={saving || loadingFields}>
            {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
        </>
      }
    >
      <form id="rule-form" className="rule-form" onSubmit={handleSubmit}>
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-grid">
          <TextBox
            name="ruleName"
            label="Rule Name"
            value={form.ruleName}
            required
            disabled={saving}
            onChange={(event) => update("ruleName", event.target.value)}
          />
          <TextBox
            name="description"
            label="Description"
            value={form.description}
            disabled={saving}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>

        <div className="conditions-header">
          <div>
            <span className="conditions-kicker">Rule logic</span>
            <h3>Conditions</h3>
            <p>Select rows and group them together. The colored braces show which rows belong to the same group.</p>
          </div>
          <div className="condition-toolbar-actions">
            <Button type="button" variant="secondary" onClick={groupSelected} disabled={selectedRows.length < 2}>
              <FiUsers size={14} />
              Group {selectedRows.length > 1 ? `(${selectedRows.length})` : ""}
            </Button>
            <Button type="button" variant="secondary" onClick={ungroupSelected} disabled={!selectedRows.length}>
              Ungroup
            </Button>
            <Button type="button" variant="secondary" onClick={addRow}>
              <FiPlus size={14} />
              Add Condition
            </Button>
          </div>
        </div>

        <div className="condition-selection-note">
          {selectedRows.length
            ? `${selectedRows.length} condition${selectedRows.length === 1 ? "" : "s"} selected`
            : "Select two or more rows to group them. Select grouped rows and click Ungroup to separate them."}
        </div>

        <div className="condition-single-table-wrapper">
          <table className="condition-single-table">
            <thead>
              <tr>
                <th className="condition-check-column">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRows.length === rows.length}
                    onChange={selectAll}
                    aria-label="Select all conditions"
                  />
                </th>
                <th className="condition-brace-column">Group</th>
                <th className="condition-drag-column" />
                <th>Field</th>
                <th>Operator</th>
                <th>Value</th>
                <th>Logic</th>
                <th className="condition-action-column" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const field = fields.find(
                  (item) => String(item.fieldId) === String(row.fieldId)
                );
                const operators = optionsForType(field?.fieldType);
                const bracePosition = getBracePosition(row, index);
                const groupColor = getGroupColor(row);
                const isSelected = selectedRows.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    draggable
                    className={isSelected ? "condition-row-selected" : ""}
                    onDragStart={() => setDraggedRow(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveRow(row.id)}
                    onDragEnd={() => setDraggedRow(null)}
                  >
                    <td className="condition-check-cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(row.id)}
                        aria-label="Select condition"
                      />
                    </td>
                    <td className={`condition-brace-cell brace-${groupColor}`}>
                      <span className={`condition-brace brace-${bracePosition}`} aria-hidden="true">
                        {bracePosition === "start" && "⎧"}
                        {bracePosition === "middle" && "⎪"}
                        {bracePosition === "end" && "⎩"}
                        {bracePosition === "single" && "⎨"}
                      </span>
                    </td>
                    <td className="condition-drag-cell">
                      <span className="condition-drag-handle" title="Drag to rearrange">
                        <FiMenu size={14} />
                      </span>
                    </td>
                    <td>
                      <Select
                        label=""
                        value={row.fieldId}
                        options={fields.map((item) => ({
                          value: item.fieldId,
                          label: item.displayName,
                        }))}
                        placeholder={loadingFields ? "Loading..." : "Field"}
                        disabled={loadingFields || saving}
                        onChange={(event) => changeField(row.id, event.target.value)}
                      />
                    </td>
                    <td>
                      <Select
                        label=""
                        value={row.operator}
                        options={operators}
                        placeholder="Operator"
                        disabled={!field || saving}
                        onChange={(event) => updateRow(row.id, "operator", event.target.value)}
                      />
                    </td>
                    <td>
                      {field?.fieldType === "Boolean" ? (
                        <Select
                          label=""
                          value={row.value}
                          options={[
                            { value: "Y", label: "Yes" },
                            { value: "N", label: "No" },
                          ]}
                          placeholder="Value"
                          disabled={saving}
                          onChange={(event) => updateRow(row.id, "value", event.target.value)}
                        />
                      ) : (
                        <TextBox
                          label=""
                          value={row.value}
                          type={
                            field?.fieldType === "Number"
                              ? "number"
                              : field?.fieldType === "Date"
                                ? "date"
                                : "text"
                          }
                          disabled={!field || saving}
                          placeholder={field ? "Value" : "Select field"}
                          onChange={(event) => updateRow(row.id, "value", event.target.value)}
                        />
                      )}
                    </td>
                    <td>
                      <Select
                        label=""
                        value={row.logicalOperator}
                        options={LOGICAL_OPTIONS}
                        disabled={saving}
                        onChange={(event) => updateRow(row.id, "logicalOperator", event.target.value)}
                      />
                    </td>
                    <td className="condition-action-cell">
                      <button
                        type="button"
                        className="condition-remove"
                        title="Delete condition"
                        aria-label="Delete condition"
                        onClick={() => removeRow(row.id)}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && (
            <div className="conditions-empty">
              <FiCheckSquare size={22} />
              <strong>No conditions yet</strong>
              <span>Add a condition, then select rows when you want to group them.</span>
              <Button type="button" variant="secondary" onClick={addRow}>
                <FiPlus size={14} />
                Add Condition
              </Button>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export default RuleForm;
