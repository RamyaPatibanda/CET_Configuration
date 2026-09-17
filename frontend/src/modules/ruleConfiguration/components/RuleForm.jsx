import React, { useEffect, useMemo, useState } from "react";
import { FiMenu, FiPlus, FiTrash2, FiUsers, FiUserX } from "react-icons/fi";
import Dialog from "../../../components/common/Dialog";
import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";
import ruleConfigurationService from "../services/ruleConfigurationService";
import "./RuleConditionGrouping.css";

const operators = [
  "Equals",
  "Not Equals",
  "Greater Than",
  "Greater Than or Equal",
  "Less Than",
  "Less Than or Equal",
  "Contains",
  "Starts With",
  "Ends With",
];

const groupColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"];

function createCondition(groupId = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    fieldId: "",
    logicalOperator: "AND",
    operator: "Equals",
    value: "",
  };
}

function toRows(conditions = []) {
  return conditions.map((condition, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    groupId: `group-${condition.groupOrder ?? 1}`,
    fieldId: condition.fieldId?.toString() ?? "",
    logicalOperator: condition.logicalOperator || "AND",
    operator: condition.operator || "Equals",
    value: condition.value ?? "",
  }));
}

export default function RuleForm({ open, onClose, onSaved, rule = null }) {
  const [ruleName, setRuleName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState([createCondition()]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (rule) {
      setRuleName(rule.ruleName || "");
      setDescription(rule.description || "");
      setIsActive(rule.isActive !== false);
      setRows(toRows(rule.conditions));
    } else {
      setRuleName("");
      setDescription("");
      setIsActive(true);
      setRows([createCondition()]);
    }

    setSelectedRows([]);
    setError("");
  }, [open, rule]);

  useEffect(() => {
    if (!open) return;

    ruleConfigurationService
      .getActiveFields()
      .then(setFields)
      .catch((err) => setError(err.message || "Unable to load fields."));
  }, [open]);

  const fieldOptions = useMemo(
    () => fields.map((field) => ({ value: field.fieldId?.toString(), label: field.displayName || field.fieldName })),
    [fields]
  );

  const groupedRows = useMemo(() => {
    const counts = new Map();
    rows.forEach((row) => {
      const key = row.groupId || `ungrouped-${row.id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [rows]);

  const getBracePosition = (row) => {
    if (!row.groupId) return "single";
    const indexes = rows
      .map((item, index) => (item.groupId === row.groupId ? index : -1))
      .filter((index) => index >= 0);
    const index = rows.indexOf(row);
    if (indexes.length < 2) return "single";
    if (index === indexes[0]) return "start";
    if (index === indexes[indexes.length - 1]) return "end";
    return "middle";
  };

  const getGroupColor = (row) => {
    if (!row.groupId) return "#94a3b8";
    const groupIndex = Array.from(new Set(rows.filter((item) => item.groupId).map((item) => item.groupId))).indexOf(row.groupId);
    return groupColors[groupIndex % groupColors.length];
  };

  const updateRow = (rowId, changes) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...changes } : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, createCondition()]);
    setError("");
  };

  const removeRow = (rowId) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setSelectedRows((current) => current.filter((id) => id !== rowId));
  };

  const toggleRowSelection = (rowId) => {
    setSelectedRows((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  };

  const groupSelected = () => {
    if (selectedRows.length < 2) {
      setError("Select at least two conditions to group.");
      return;
    }

    const selected = rows.filter((row) => selectedRows.includes(row.id));
    const existingGroups = selected.filter((row) => row.groupId).map((row) => row.groupId);
    if (existingGroups.length && new Set(existingGroups).size === 1 && selected.length > 1) {
      setError("The selected conditions are already in the same group.");
      return;
    }

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const selectedSet = new Set(selectedRows);
    const firstSelectedIndex = rows.findIndex((row) => selectedSet.has(row.id));
    const selectedWithGroup = selected.map((row) => ({ ...row, groupId }));
    const remaining = rows.filter((row) => !selectedSet.has(row.id));
    remaining.splice(firstSelectedIndex, 0, ...selectedWithGroup);

    setRows(remaining);
    setSelectedRows([]);
    setError("");
  };

  const ungroupSelected = () => {
    if (!selectedRows.length) {
      setError("Select conditions to ungroup.");
      return;
    }

    const selectedSet = new Set(selectedRows);
    const selectedGrouped = rows.filter((row) => selectedSet.has(row.id) && row.groupId);
    const groupedCounts = new Map();
    rows.filter((row) => row.groupId).forEach((row) => {
      groupedCounts.set(row.groupId, (groupedCounts.get(row.groupId) || 0) + 1);
    });

    if (!selectedGrouped.some((row) => groupedCounts.get(row.groupId) > 1)) {
      setError("Select conditions belonging to a multi-row group to ungroup.");
      return;
    }

    setRows((current) =>
      current.map((row) =>
        selectedSet.has(row.id) && row.groupId && groupedCounts.get(row.groupId) > 1
          ? { ...row, groupId: null }
          : row
      )
    );
    setSelectedRows([]);
    setError("");
  };

  const validate = () => {
    if (!ruleName.trim()) return "Rule name is required.";
    if (!rows.length) return "At least one condition is required.";
    if (rows.some((row) => !row.fieldId || !row.operator || !row.value.trim())) {
      return "Please complete all condition fields.";
    }
    return "";
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      let groupOrder = 0;
      let previousGroupKey = null;

      const conditions = rows.map((row, index) => {
        // Standalone rows must behave as their own groups. Using the row id
        // for ungrouped rows prevents multiple null groupIds from collapsing
        // into one group and producing non-sequential group orders.
        const currentGroupKey = row.groupId || `ungrouped-${row.id}`;

        if (currentGroupKey !== previousGroupKey) {
          groupOrder += 1;
          previousGroupKey = currentGroupKey;
        }

        const groupRows = rows.filter((item) => {
          const itemGroupKey = item.groupId || `ungrouped-${item.id}`;
          return itemGroupKey === currentGroupKey;
        });
        const isGrouped = Boolean(row.groupId) && groupRows.length > 1;

        return {
          fieldId: Number(row.fieldId),
          logicalOperator: row.logicalOperator || "AND",
          operator: row.operator,
          value: row.value,
          conditionOrder: index + 1,
          groupOrder,
          groupLogicalOperator: isGrouped ? "AND" : "AND",
        };
      });

      const payload = {
        ruleId: rule?.ruleId || 0,
        ruleName: ruleName.trim(),
        description: description.trim(),
        priority: rule?.priority || 1,
        isActive,
        conditions,
      };

      if (rule) {
        await ruleConfigurationService.updateRule(rule.ruleId, payload);
      } else {
        await ruleConfigurationService.createRule(payload);
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Unable to save rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rule ? "Edit Rule" : "Create Rule"}
      maxWidth="1400px"
      width="85vw"
      className="rule-form-dialog"
    >
      <div className="rule-form">
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-header-fields">
          <Input label="Rule Name" value={ruleName} onChange={(event) => setRuleName(event.target.value)} required />
          <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="rule-active-field">
            <span>Active</span>
            <Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          </div>
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
              <FiUserX /> Ungroup
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
                const position = getBracePosition(row);
                const color = getGroupColor(row);
                const isSelected = selectedRows.includes(row.id);
                return (
                  <tr key={row.id} className={isSelected ? "selected-condition-row" : ""}>
                    <td className="group-column">
                      <div className="group-brace" style={{ "--group-color": color }} data-position={position}>
                        {position === "single" ? "•" : position === "middle" ? "│" : position === "start" ? "(" : ")"}
                      </div>
                    </td>
                    <td className="select-column">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(row.id)} />
                    </td>
                    <td>
                      <Select value={row.fieldId} options={fieldOptions} onChange={(event) => updateRow(row.id, { fieldId: event.target.value })} />
                    </td>
                    <td>
                      <Select value={row.operator} options={operators.map((value) => ({ value, label: value }))} onChange={(event) => updateRow(row.id, { operator: event.target.value })} />
                    </td>
                    <td>
                      <Input value={row.value} onChange={(event) => updateRow(row.id, { value: event.target.value })} />
                    </td>
                    <td>
                      <Select value={row.logicalOperator} options={[{ value: "AND", label: "AND" }, { value: "OR", label: "OR" }]} onChange={(event) => updateRow(row.id, { logicalOperator: event.target.value })} />
                    </td>
                    <td className="drag-column"><FiMenu /></td>
                    <td className="action-column">
                      <button type="button" className="condition-delete-button" onClick={() => removeRow(row.id)} disabled={rows.length === 1} aria-label="Delete condition">
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
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
