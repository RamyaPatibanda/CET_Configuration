import { useEffect, useMemo, useState } from "react";
import { FiCheckSquare, FiMenu, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";
import "./RuleConditionGrouping.css";

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

function createCondition(groupId = null) {
  return {
    id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    fieldId: "",
    logicalOperator: "AND",
    operator: "Equals",
    value: "",
    groupLogicalOperator: "AND",
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
    .map((condition, index) => ({
      id: `condition-${condition.fieldId}-${condition.conditionOrder}-${index}`,
      groupId: `group-${condition.groupOrder ?? 1}`,
      fieldId: condition.fieldId,
      logicalOperator: condition.logicalOperator || "AND",
      operator: condition.operator || "Equals",
      value: condition.value || "",
      groupLogicalOperator: condition.groupLogicalOperator || "AND",
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
    setRows((current) => [...current, createCondition()]);
    setError("");
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

  const toggleSelected = (rowId) => {
    setSelectedRows((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  };

  const groupSelected = () => {
    if (selectedRows.length < 2) {
      setError("Select at least two conditions to group.");
      return;
    }

    const selected = rows.filter((row) => selectedRows.includes(row.id));
    const existingGroups = selected.filter((row) => row.groupId).map((row) => row.groupId);
    if (existingGroups.length && new Set(existingGroups).size === 1) {
      setError("The selected conditions are already in the same group.");
      return;
    }

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const selectedSet = new Set(selectedRows);
    const firstSelectedIndex = rows.findIndex((row) => selectedSet.has(row.id));
    const grouped = selected.map((row) => ({ ...row, groupId }));
    const remaining = rows.filter((row) => !selectedSet.has(row.id));
    remaining.splice(firstSelectedIndex, 0, ...grouped);

    setRows(remaining);
    setSelectedRows([]);
    setError("");
  };

  const ungroupSelected = () => {
    if (!selectedRows.length) {
      setError("Select conditions to ungroup.");
      return;
    }

    const counts = new Map();
    rows.filter((row) => row.groupId).forEach((row) => {
      counts.set(row.groupId, (counts.get(row.groupId) || 0) + 1);
    });

    const hasGroup = rows.some(
      (row) => selectedRows.includes(row.id) && row.groupId && counts.get(row.groupId) > 1
    );

    if (!hasGroup) {
      setError("Select conditions belonging to a multi-row group to ungroup.");
      return;
    }

    setRows((current) =>
      current.map((row) =>
        selectedRows.includes(row.id) && row.groupId && counts.get(row.groupId) > 1
          ? { ...row, groupId: null }
          : row
      )
    );
    setSelectedRows([]);
    setError("");
  };

  const handleDragStart = (rowId) => setDraggedRow(rowId);

  const handleDrop = (targetId) => {
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

  const validate = () => {
    if (!form.ruleName.trim()) return "Rule name is required.";
    if (!rows.length) return "At least one condition is required.";
    if (rows.some((row) => !row.fieldId || !row.operator || !String(row.value).trim())) {
      return "Please complete all condition fields.";
    }
    return "";
  };

  const handleSubmit = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    let groupOrder = 0;
    let previousGroupKey = null;

    const conditions = rows.map((row, index) => {
      // Every standalone row is its own group for backend ordering purposes.
      const currentGroupKey = row.groupId || `ungrouped-${row.id}`;
      if (currentGroupKey !== previousGroupKey) {
        groupOrder += 1;
        previousGroupKey = currentGroupKey;
      }

      return {
        fieldId: Number(row.fieldId),
        logicalOperator: row.logicalOperator || "AND",
        operator: row.operator,
        value: row.value,
        conditionOrder: index + 1,
        groupOrder,
        groupLogicalOperator: row.groupLogicalOperator || "AND",
      };
    });

    onSave({
      ...form,
      ruleName: form.ruleName.trim(),
      description: form.description?.trim() || "",
      conditions,
    });
  };

  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [String(field.fieldId), field])),
    [fields]
  );

  const groupMeta = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (!row.groupId) return;
      if (!map.has(row.groupId)) map.set(row.groupId, []);
      map.get(row.groupId).push(row.id);
    });
    return map;
  }, [rows]);

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
      onClose={onClose}
      className="rule-form-dialog"
    >
      <div className="rule-form">
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-header-fields">
          <TextBox
            label="Rule Name"
            value={form.ruleName}
            onChange={(event) => update("ruleName", event.target.value)}
            required
          />
          <TextBox
            label="Description"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
          <label className="rule-active-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
            />
            <span>Active</span>
          </label>
        </div>

        <div className="rule-condition-toolbar">
          <div>
            <h3>Conditions</h3>
            <span>Select rows and use Group/Ungroup to manage condition groups.</span>
          </div>
          <div className="rule-condition-actions">
            <Button type="button" variant="secondary" onClick={groupSelected} disabled={selectedRows.length < 2}>
              <FiUsers /> Group
            </Button>
            <Button type="button" variant="secondary" onClick={ungroupSelected} disabled={!selectedRows.length}>
              Ungroup
            </Button>
            <Button type="button" onClick={addRow}>
              <FiPlus /> Add Condition
            </Button>
          </div>
        </div>

        <div className="rule-condition-table-wrap">
          <table className="rule-condition-table">
            <thead>
              <tr>
                <th className="group-column">Group</th>
                <th className="select-column">Select</th>
                <th>Field</th>
                <th>Operator</th>
                <th>Value</th>
                <th>Logic</th>
                <th className="drag-column" />
                <th className="action-column" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const groupRows = row.groupId ? groupMeta.get(row.groupId) || [] : [];
                const groupIndex = row.groupId
                  ? Array.from(groupMeta.keys()).indexOf(row.groupId)
                  : -1;
                const position =
                  groupRows.length < 2
                    ? "single"
                    : groupRows[0] === row.id
                      ? "start"
                      : groupRows[groupRows.length - 1] === row.id
                        ? "end"
                        : "middle";
                const color = GROUP_COLORS[(groupIndex < 0 ? 0 : groupIndex) % GROUP_COLORS.length];
                const field = fieldMap.get(String(row.fieldId));
                const operatorOptions = optionsForType(field?.fieldType);

                return (
                  <tr
                    key={row.id}
                    className={selectedRows.includes(row.id) ? "selected-condition-row" : ""}
                    draggable
                    onDragStart={() => handleDragStart(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(row.id)}
                  >
                    <td className="group-column">
                      <div className={`group-brace group-brace-${color}`} data-position={position}>
                        {position === "single" ? "•" : position === "middle" ? "│" : position === "start" ? "(" : ")"}
                      </div>
                    </td>
                    <td className="select-column">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label="Select condition"
                      />
                    </td>
                    <td>
                      <Select
                        value={String(row.fieldId ?? "")}
                        options={fields.map((item) => ({
                          value: String(item.fieldId),
                          label: item.displayName || item.fieldName,
                        }))}
                        onChange={(event) => updateRow(row.id, "fieldId", event.target.value)}
                        disabled={loadingFields}
                      />
                    </td>
                    <td>
                      <Select
                        value={row.operator}
                        options={operatorOptions}
                        onChange={(event) => updateRow(row.id, "operator", event.target.value)}
                      />
                    </td>
                    <td>
                      <TextBox
                        value={row.value}
                        onChange={(event) => updateRow(row.id, "value", event.target.value)}
                      />
                    </td>
                    <td>
                      <Select
                        value={row.logicalOperator}
                        options={LOGICAL_OPTIONS}
                        onChange={(event) => updateRow(row.id, "logicalOperator", event.target.value)}
                      />
                    </td>
                    <td className="drag-column">
                      <FiMenu />
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        className="condition-delete-button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        aria-label="Delete condition"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rule-form-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            <FiCheckSquare /> {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default RuleForm;
