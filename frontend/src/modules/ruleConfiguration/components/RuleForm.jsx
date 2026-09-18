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

const optionsForType = (type) => OPERATORS[type] || OPERATORS.Text;

const getResponseItems = (response) =>
  Array.isArray(response) ? response : response?.data || [];

function createCondition(groupId = null) {
  return {
    id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    fieldId: "",
    conditionLogicalOperator: "AND",
    operator: "Equals",
    value: "",
  };
}

function toRows(conditions) {
  if (!conditions?.length) {
    return [];
  }

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
      conditionLogicalOperator:
        condition.conditionLogicalOperator ||
        condition.logicalOperator ||
        "AND",
      operator: condition.operator || "Equals",
      value: condition.value || "",
    }));
}

function RuleForm({
  open,
  rule,
  nextRuleId,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [draggedRow, setDraggedRow] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      rule
        ? { ...EMPTY_RULE, ...rule }
        : { ...EMPTY_RULE, ruleId: nextRuleId }
    );
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
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addRow = () => {
    setRows((current) => [...current, createCondition()]);
    setError("");
  };

  const removeRow = (rowId) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setSelectedRows((current) =>
      current.filter((id) => id !== rowId)
    );
  };

  const updateRow = (rowId, name, value) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [name]: value } : row
      )
    );
    setError("");
  };

  const changeField = (rowId, value) => {
    const field = fields.find(
      (item) => String(item.fieldId) === String(value)
    );
    const firstOperator =
      optionsForType(field?.fieldType)[0]?.value || "Equals";

    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              fieldId: value,
              operator: firstOperator,
              value: "",
            }
          : row
      )
    );
    setError("");
  };

  const toggleSelected = (rowId) => {
    setSelectedRows((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
    setError("");
  };

  const selectAll = () =>
    setSelectedRows((current) =>
      current.length === rows.length
        ? []
        : rows.map((row) => row.id)
    );

  const groupSelected = () => {
    if (selectedRows.length < 2) {
      setError("Select at least two conditions to create a group.");
      return;
    }

    setRows((current) => {
      const selectedSet = new Set(selectedRows);
      const selected = current.filter((row) => selectedSet.has(row.id));
      const firstSelectedIndex = current.findIndex((row) =>
        selectedSet.has(row.id)
      );

      if (selected.length < 2 || firstSelectedIndex < 0) {
        return current;
      }

      const existingGroupIds = new Set(
        selected.map((row) => row.groupId).filter(Boolean)
      );

      if (
        existingGroupIds.size === 1 &&
        selected.every((row) => row.groupId)
      ) {
        setError("The selected conditions are already in the same group.");
        return current;
      }

      const groupId = `group-${Date.now()}`;
      const remaining = current.filter(
        (row) => !selectedSet.has(row.id)
      );

      remaining.splice(
        firstSelectedIndex,
        0,
        ...selected.map((row) => ({ ...row, groupId }))
      );

      return remaining;
    });

    setSelectedRows([]);
    setError("");
  };

  const ungroupSelected = () => {
    if (!selectedRows.length) {
      setError("Select at least one condition to ungroup.");
      return;
    }

    setRows((current) => {
      const selectedSet = new Set(selectedRows);
      const groupedSelection = current.filter(
        (row) =>
          selectedSet.has(row.id) &&
          current.filter(
            (item) => item.groupId && item.groupId === row.groupId
          ).length > 1
      );

      if (!groupedSelection.length) {
        setError(
          "Select a condition that belongs to a group before ungrouping."
        );
        return current;
      }

      return current.map((row) =>
        selectedSet.has(row.id) &&
        groupedSelection.some((item) => item.id === row.id)
          ? { ...row, groupId: null }
          : row
      );
    });

    setSelectedRows([]);
    setError("");
  };

  const moveRow = (targetId) => {
    if (!draggedRow || draggedRow === targetId) {
      return;
    }

    setRows((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex(
        (row) => row.id === draggedRow
      );
      const targetIndex = next.findIndex(
        (row) => row.id === targetId
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDraggedRow(null);
  };

  const groupedRows = useMemo(() => {
    const groups = new Map();

    rows.forEach((row) => {
      const groupId = row.groupId || `ungrouped-${row.id}`;

      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }

      groups.get(groupId).push(row);
    });

    return groups;
  }, [rows]);

  const getBracePosition = (row) => {
    if (!row.groupId) {
      return "single";
    }

    const group = groupedRows.get(row.groupId) || [];
    const groupIndex = group.findIndex(
      (item) => item.id === row.id
    );

    if (group.length === 1) {
      return "single";
    }

    if (groupIndex === 0) {
      return "start";
    }

    if (groupIndex === group.length - 1) {
      return "end";
    }

    return "middle";
  };

  const getGroupColor = (row) => {
    if (!row.groupId) {
      return "blue";
    }

    const groupIndex = [...groupedRows.keys()].indexOf(row.groupId);
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

    const conditions = [];
    let groupOrder = 0;
    let previousGroupKey = null;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      if (
        !row.fieldId ||
        !row.operator ||
        !String(row.value).trim()
      ) {
        setError("Complete every condition before saving.");
        return;
      }

      const currentGroupKey =
        row.groupId || `ungrouped-${row.id}`;

      if (currentGroupKey !== previousGroupKey) {
        groupOrder += 1;
        previousGroupKey = currentGroupKey;
      }

      conditions.push({
        fieldId: Number(row.fieldId),
        conditionLogicalOperator: (
          row.conditionLogicalOperator || "AND"
        ).toUpperCase(),
        operator: row.operator,
        value: row.value,
        conditionOrder: index + 1,
        groupOrder,
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
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="rule-form"
            disabled={saving || loadingFields}
          >
            {saving
              ? "Saving..."
              : rule
                ? "Update Rule"
                : "Create Rule"}
          </Button>
        </>
      }
    >
      <form
        id="rule-form"
        className="rule-form"
        onSubmit={handleSubmit}
      >
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-grid">
          <TextBox
            name="ruleName"
            label="Rule Name"
            value={form.ruleName}
            required
            disabled={saving}
            onChange={(event) =>
              update("ruleName", event.target.value)
            }
          />
          <TextBox
            name="description"
            label="Description"
            value={form.description}
            disabled={saving}
            onChange={(event) =>
              update("description", event.target.value)
            }
          />
        </div>

        <div className="conditions-header">
          <div>
            <span className="conditions-kicker">Rule logic</span>
            <h3>Conditions</h3>
            <p>
              Use Logic for the condition-to-condition connector.
              Group Logic controls how groups are combined.
            </p>
          </div>

          <div className="condition-toolbar-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={groupSelected}
              disabled={selectedRows.length < 2}
            >
              <FiUsers size={14} />
              Group {selectedRows.length > 1 ? `(${selectedRows.length})` : ""}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={ungroupSelected}
              disabled={!selectedRows.length}
            >
              Ungroup
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={addRow}
            >
              <FiPlus size={14} />
              Add Condition
            </Button>
          </div>
        </div>

        <div className="condition-selection-note">
          {selectedRows.length
            ? `${selectedRows.length} condition${selectedRows.length === 1 ? "" : "s"} selected`
            : "Select rows to group or rearrange them with drag and drop."}
        </div>

        <div className="condition-single-table-wrapper">
          <table className="condition-single-table">
            <thead>
              <tr>
                <th className="condition-check-column">
                  <input
                    type="checkbox"
                    checked={
                      rows.length > 0 &&
                      selectedRows.length === rows.length
                    }
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
              {rows.map((row) => {
                const field = fields.find(
                  (item) =>
                    String(item.fieldId) === String(row.fieldId)
                );
                const operators = optionsForType(field?.fieldType);
                const bracePosition = getBracePosition(row);
                const groupColor = getGroupColor(row);
                const isSelected = selectedRows.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    draggable
                    onDragStart={() => setDraggedRow(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveRow(row.id)}
                    className={
                      isSelected
                        ? "condition-row-selected"
                        : ""
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(row.id)}
                        aria-label="Select condition"
                      />
                    </td>

                    <td>
                      <span
                        className={
                          `condition-group-brace ${groupColor} ${bracePosition}`
                        }
                        aria-hidden="true"
                      >
                        {bracePosition !== "single"
                          ? bracePosition === "start"
                            ? "⎧"
                            : bracePosition === "middle"
                              ? "⎪"
                              : "⎩"
                          : ""}
                      </span>
                    </td>

                    <td>
                      <FiMenu size={16} />
                    </td>

                    <td>
                      <SearchableSelect
                        value={row.fieldId}
                        options={fields.map((item) => ({
                          value: item.fieldId,
                          label: item.displayName,
                        }))}
                        placeholder={
                          loadingFields
                            ? "Loading fields..."
                            : "Select field"
                        }
                        disabled={loadingFields}
                        onChange={(value) =>
                          changeField(row.id, value)
                        }
                      />
                    </td>

                    <td>
                      <Select
                        value={row.operator}
                        options={operators}
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            "operator",
                            event.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <TextBox
                        value={row.value}
                        placeholder="Enter value"
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            "value",
                            event.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <Select
                        value={row.conditionLogicalOperator}
                        options={LOGICAL_OPTIONS}
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            "conditionLogicalOperator",
                            event.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        title="Delete condition"
                        aria-label="Delete condition"
                        onClick={() => removeRow(row.id)}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && (
            <div className="condition-empty">
              <FiCheckSquare size={18} />
              <span>
                No conditions yet. Add a condition to start building
                the rule.
              </span>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export default RuleForm;
