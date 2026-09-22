import { useEffect, useMemo, useState } from "react";
import { FiMenu, FiPlus, FiTrash2, FiUsers, FiCheckSquare, FiGitBranch } from "react-icons/fi";
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
  decisionAreaCode: "SEAT_ALLOCATION",
  outcome: { values: [] },
  conditions: [],
  branches: [],
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

const getResponseItems = (response) => Array.isArray(response) ? response : response?.data || [];
const optionsForType = (type) => OPERATORS[type] || OPERATORS.Text;

const normalizeConditions = (conditions) => (Array.isArray(conditions) ? conditions : []).map((condition, index) => ({
  id: condition.id || `condition-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  fieldId: condition.fieldId ?? condition.FieldId ?? "",
  conditionLogicalOperator: condition.conditionLogicalOperator ?? condition.ConditionLogicalOperator ?? condition.logicalOperator ?? condition.LogicalOperator ?? "AND",
  operator: condition.operator ?? condition.Operator ?? "Equals",
  value: condition.value ?? condition.Value ?? "",
  conditionOrder: condition.conditionOrder ?? condition.ConditionOrder ?? index + 1,
  groupOrder: condition.groupOrder ?? condition.GroupOrder ?? 1,
}));

const normalizeBranches = (value) => {
  const rows = Array.isArray(value) ? value : value?.branches ?? value?.Branches ?? value?.DecisionRows ?? [];
  return rows.map((row, index) => ({
    ruleBranchId: row.ruleBranchId ?? row.RuleBranchId ?? row.RuleDecisionId ?? 0,
    ruleId: row.ruleId ?? row.RuleId ?? 0,
    branchName: row.branchName ?? row.BranchName ?? row.DecisionName ?? "",
    branchOrder: row.branchOrder ?? row.BranchOrder ?? row.DecisionOrder ?? index + 1,
    isActive: row.isActive ?? row.IsActive ?? true,
    allocationType: row.allocationType ?? row.AllocationType ?? "",
    sequence: row.sequence ?? row.Sequence ?? index + 1,
    isElse: row.isElse ?? row.IsElse ?? false,
    outcome: row.outcome ?? row.Outcome ?? { vacancySource: "", vacancyType: "" },
    conditions: normalizeConditions(row.conditions ?? row.Conditions),
  }));
};

const getOutcomeOptions = (decisionOptions, area, supportingValue) => {
  const definition = decisionOptions.find((item) => item.value === area);
  const field = definition?.results?.find((item) =>
    String(item.supportingValue || "").toLowerCase() === supportingValue.toLowerCase()
  );
  return (field?.values || []).map((item) => ({ value: item.value, label: item.label }));
};

const getAllocationOptions = (decisionOptions) => {
  const definition = decisionOptions.find((item) => item.value === "SEAT_ALLOCATION");
  const field = definition?.results?.find((item) =>
    String(item.supportingValue || "").toLowerCase() === "allocatedtype"
  );
  return (field?.values || []).map((item) => ({
    value: item.value,
    label: item.label,
  }));
};

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [fields, setFields] = useState([]);
  const [decisionOptions, setDecisionOptions] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingDecisionOptions, setLoadingDecisionOptions] = useState(false);
  const [error, setError] = useState("");
  const [selectedByBranch, setSelectedByBranch] = useState({});
  const [draggedCondition, setDraggedCondition] = useState(null);

  useEffect(() => {
    if (!open) return;

    const existingRows = normalizeBranches(rule?.branches);

    setForm({
      ...EMPTY_RULE,
      ...(rule || {}),
      ruleId: rule?.ruleId ?? nextRuleId,
      decisionAreaCode: rule?.decisionAreaCode || "SEAT_ALLOCATION",
      conditions: normalizeConditions(rule?.conditions),
      branches: existingRows,
    });
    setSelectedByBranch({});
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

  const allocationOptions = useMemo(
    () => getAllocationOptions(decisionOptions),
    [decisionOptions]
  );

  const vacancySourceOptions = useMemo(
    () => getOutcomeOptions(decisionOptions, form.decisionAreaCode, "vacancySource"),
    [decisionOptions, form.decisionAreaCode]
  );

  const vacancyTypeOptions = useMemo(
    () => getOutcomeOptions(decisionOptions, form.decisionAreaCode, "vacancyType"),
    [decisionOptions, form.decisionAreaCode]
  );

  const updateForm = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));


  const addRootCondition = () => {
    setForm((current) => {
      const conditions = current.conditions || [];
      return {
        ...current,
        conditions: [
          ...conditions,
          {
            id: `root-condition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fieldId: "",
            conditionLogicalOperator: conditions.length ? "AND" : "AND",
            operator: "Equals",
            value: "",
            conditionOrder: conditions.length + 1,
            groupOrder: 1,
          },
        ],
      };
    });
  };

  const updateRootCondition = (conditionId, name, value) => {
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || []).map((condition) =>
        condition.id === conditionId ? { ...condition, [name]: value } : condition
      ),
    }));
  };

  const changeRootField = (conditionId, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const operators = optionsForType(field?.fieldType);
    updateRootCondition(conditionId, "fieldId", value);
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || []).map((condition) =>
        condition.id === conditionId
          ? { ...condition, fieldId: value, operator: operators[0]?.value || "Equals", value: "" }
          : condition
      ),
    }));
  };

  const removeRootCondition = (conditionId) => {
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || [])
        .filter((condition) => condition.id !== conditionId)
        .map((condition, index) => ({ ...condition, conditionOrder: index + 1 })),
    }));
  };

  const addBranch = () => {
    setForm((current) => {
      const rows = current.branches || [];
      const hasElse = rows.some((row) => row.isElse);
      if (hasElse) return current;
      return {
        ...current,
        branches: [
          ...rows,
          {
            ruleBranchId: 0,
            ruleId: current.ruleId,
            branchName: "",
            branchOrder: rows.length + 1,
            isActive: true,
            allocationType: "",
            sequence: rows.length + 1,
            isElse: false,
            outcome: { vacancySource: "", vacancyType: "" },
            conditions: [],
          },
        ],
      };
    });
  };

  const addElseBranch = () => {
    setForm((current) => {
      const rows = current.branches || [];
      if (rows.some((row) => row.isElse)) return current;
      return {
        ...current,
        branches: [
          ...rows,
          {
            ruleBranchId: 0,
            ruleId: current.ruleId,
            branchName: "Else",
            branchOrder: rows.length + 1,
            isActive: true,
            allocationType: "",
            sequence: rows.length + 1,
            isElse: true,
            outcome: { vacancySource: "", vacancyType: "" },
            conditions: [],
          },
        ],
      };
    });
  };

  const updateBranchOutcome = (branchIndex, name, value) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) =>
        index === branchIndex
          ? { ...branch, outcome: { ...(branch.outcome || {}), [name]: value } }
          : branch
      ),
    }));
  };

  const updateBranch = (branchIndex, name, value) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) =>
        index === branchIndex ? { ...branch, [name]: value } : branch
      ),
    }));
  };

  const removeBranch = (branchIndex) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || [])
        .filter((_, index) => index !== branchIndex)
        .map((branch, index) => ({ ...branch, branchOrder: index + 1, sequence: Number(branch.sequence || index + 1) })),
    }));
  };

  const addCondition = (branchIndex) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) => {
        if (index !== branchIndex || branch.isElse) return branch;
        const conditions = branch.conditions || [];
        return {
          ...branch,
          conditions: [
            ...conditions,
            {
              id: `condition-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fieldId: "",
              conditionLogicalOperator: conditions.length ? "AND" : "AND",
              operator: "Equals",
              value: "",
              conditionOrder: conditions.length + 1,
              groupOrder: 1,
            },
          ],
        };
      }),
    }));
  };

  const updateCondition = (branchIndex, conditionId, name, value) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) => {
        if (index !== branchIndex) return branch;
        return {
          ...branch,
          conditions: (branch.conditions || []).map((condition) =>
            condition.id === conditionId ? { ...condition, [name]: value } : condition
          ),
        };
      }),
    }));
  };

  const changeField = (branchIndex, conditionId, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const operators = optionsForType(field?.fieldType);
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) => {
        if (index !== branchIndex) return branch;
        return {
          ...branch,
          conditions: (branch.conditions || []).map((condition) =>
            condition.id === conditionId
              ? { ...condition, fieldId: value, operator: operators[0]?.value || "Equals", value: "" }
              : condition
          ),
        };
      }),
    }));
  };

  const removeCondition = (branchIndex, conditionId) => {
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) => {
        if (index !== branchIndex) return branch;
        return {
          ...branch,
          conditions: (branch.conditions || [])
            .filter((condition) => condition.id !== conditionId)
            .map((condition, conditionIndex) => ({ ...condition, conditionOrder: conditionIndex + 1 })),
        };
      }),
    }));
  };

  const toggleSelected = (branchIndex, conditionId) => {
    setSelectedByBranch((current) => {
      const selected = current[branchIndex] || [];
      return {
        ...current,
        [branchIndex]: selected.includes(conditionId)
          ? selected.filter((id) => id !== conditionId)
          : [...selected, conditionId],
      };
    });
  };

  const groupSelected = (branchIndex) => {
    const selected = new Set(selectedByBranch[branchIndex] || []);
    if (selected.size < 2) return;
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) =>
        index === branchIndex
          ? {
              ...branch,
              conditions: (branch.conditions || []).map((condition) =>
                selected.has(condition.id) ? { ...condition, groupOrder: 1 } : condition
              ),
            }
          : branch
      ),
    }));
    setSelectedByBranch((current) => ({ ...current, [branchIndex]: [] }));
  };

  const ungroupSelected = (branchIndex) => {
    const selected = new Set(selectedByBranch[branchIndex] || []);
    if (!selected.size) return;
    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) =>
        index === branchIndex
          ? {
              ...branch,
              conditions: (branch.conditions || []).map((condition) =>
                selected.has(condition.id) ? { ...condition, groupOrder: condition.conditionOrder } : condition
              ),
            }
          : branch
      ),
    }));
    setSelectedByBranch((current) => ({ ...current, [branchIndex]: [] }));
  };

  const moveCondition = (branchIndex, targetId) => {
    const sourceId = draggedCondition?.branchIndex === branchIndex ? draggedCondition.conditionId : null;
    if (!sourceId || sourceId === targetId) return;

    setForm((current) => ({
      ...current,
      branches: (current.branches || []).map((branch, index) => {
        if (index !== branchIndex) return branch;
        const conditions = [...(branch.conditions || [])];
        const sourceIndex = conditions.findIndex((condition) => condition.id === sourceId);
        const targetIndex = conditions.findIndex((condition) => condition.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return branch;
        const [moved] = conditions.splice(sourceIndex, 1);
        conditions.splice(targetIndex, 0, moved);
        return {
          ...branch,
          conditions: conditions.map((condition, conditionIndex) => ({
            ...condition,
            conditionOrder: conditionIndex + 1,
          })),
        };
      }),
    }));
    setDraggedCondition(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    const rootConditions = (form.conditions || []).map((condition, conditionIndex) => ({
      fieldId: Number(condition.fieldId),
      fieldName: fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.fieldName
        || fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.FieldName
        || "",
      conditionLogicalOperator: (condition.conditionLogicalOperator || "AND").toUpperCase(),
      operator: condition.operator,
      value: condition.value,
      conditionOrder: conditionIndex + 1,
      groupOrder: Number(condition.groupOrder || 1),
    }));

    if (rootConditions.some((condition) =>
      !condition.fieldId || !condition.operator || !String(condition.value).trim()
    )) {
      setError("Complete every condition in the Conditions section.");
      return;
    }

    const branches = form.branches || [];
    let hasValidIfBranch = false;
    const normalizedBranches = branches.map((branch, branchIndex) => {
      if (!branch.isElse) {
        hasValidIfBranch = hasValidIfBranch || branch.conditions.length > 0;
      }

      const conditions = (branch.conditions || []).map((condition, conditionIndex) => ({
        fieldId: Number(condition.fieldId),
        fieldName: fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.fieldName || fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.FieldName || "",
        conditionLogicalOperator: (condition.conditionLogicalOperator || "AND").toUpperCase(),
        operator: condition.operator,
        value: condition.value,
        conditionOrder: conditionIndex + 1,
        groupOrder: Number(condition.groupOrder || 1),
      }));

      if (!branch.isElse && conditions.some((condition) =>
        !condition.fieldId || !condition.operator || !String(condition.value).trim()
      )) {
        throw new Error(`Complete every condition in branch ${branchIndex + 1}.`);
      }

      if (!branch.isElse && conditions.length === 0) {
        throw new Error(`Decision ${branchIndex + 1} needs at least one condition.`);
      }

      if (!branch.allocationType) {
        throw new Error(`Select an Allocation Type for decision ${branchIndex + 1}.`);
      }

      return {
        branchName: branch.isElse ? "Fallback" : "Decision " + (branchIndex + 1),
        branchOrder: branchIndex + 1,
        isActive: branch.isActive !== false,
        allocationType: branch.allocationType,
        sequence: Number(branch.sequence || branchIndex + 1),
        isElse: Boolean(branch.isElse),
        outcome: {
          vacancySource: branch.outcome?.vacancySource || "",
          vacancyType: branch.outcome?.vacancyType || "",
        },
        conditions,
      };
    });

    if (branches.length > 0 && !hasValidIfBranch && !branches.some((branch) => branch.isElse)) {
      setError("Add at least one condition to a decision.");
      return;
    }

    const elseIndexes = normalizedBranches.map((branch, index) => branch.isElse ? index : -1).filter((index) => index >= 0);
    if (elseIndexes.length > 1) {
      setError("Only one ELSE branch is allowed.");
      return;
    }

    try {
      setError("");
      await onSave({
        ...form,
        conditions: rootConditions,
        outcome: { values: [] },
        branches: normalizedBranches,
      });
    } catch (saveError) {
      setError(saveError.message || "Unable to save the rule.");
    }
  };

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
      className="rule-dialog"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
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
            onChange={(event) => updateForm("ruleName", event.target.value)}
          />
          <TextBox
            name="description"
            label="Description"
            value={form.description}
            disabled={saving}
            onChange={(event) => updateForm("description", event.target.value)}
          />
        </div>

        <div className="conditions-header">
          <div className="conditions-header-copy">
            <span className="conditions-kicker">Rule logic</span>
            <h3>Conditions &amp; Decisions</h3>
            <p>
              Add the conditions that define this rule. Decisions are optional and can be added only when an allocation action is required.
            </p>
          </div>
        </div>


        <section className="rule-conditions-section">
          <div className="rule-section-heading">
            <div>
              <span className="conditions-kicker">Rule criteria</span>
              <h3>Conditions</h3>
              <p>Conditions are independent of decisions. One decision can use multiple conditions.</p>
            </div>
            <Button type="button" variant="secondary" onClick={addRootCondition}>
              <FiPlus size={13} /> Add condition
            </Button>
          </div>

          {(form.conditions || []).length > 0 ? (
            <div className="condition-single-table-wrapper">
              <table className="condition-single-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Operator</th>
                    <th>Value</th>
                    <th>Logic</th>
                    <th className="condition-action-column" />
                  </tr>
                </thead>
                <tbody>
                  {(form.conditions || []).map((condition) => {
                    const field = fields.find((item) => String(item.fieldId) === String(condition.fieldId));
                    const operators = optionsForType(field?.fieldType);
                    return (
                      <tr key={condition.id}>
                        <td>
                          <SearchableSelect
                            value={condition.fieldId}
                            options={fields.map((item) => ({ value: item.fieldId, label: item.displayName }))}
                            placeholder={loadingFields ? "Loading fields..." : "Select field"}
                            disabled={loadingFields}
                            onChange={(value) => changeRootField(condition.id, value)}
                          />
                        </td>
                        <td>
                          <Select
                            value={condition.operator}
                            options={operators}
                            onChange={(event) => updateRootCondition(condition.id, "operator", event.target.value)}
                          />
                        </td>
                        <td>
                          <TextBox
                            value={condition.value}
                            placeholder="Enter value"
                            onChange={(event) => updateRootCondition(condition.id, "value", event.target.value)}
                          />
                        </td>
                        <td>
                          <Select
                            value={condition.conditionLogicalOperator}
                            options={LOGICAL_OPTIONS}
                            onChange={(event) => updateRootCondition(condition.id, "conditionLogicalOperator", event.target.value)}
                          />
                        </td>
                        <td className="condition-action-cell">
                          <button type="button" className="condition-remove" onClick={() => removeRootCondition(condition.id)} title="Delete condition">
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rule-conditions-empty">
              <span>No conditions added yet.</span>
              <Button type="button" variant="secondary" onClick={addRootCondition}>
                <FiPlus size={13} /> Add condition
              </Button>
            </div>
          )}
        </section>

        <div className="rule-decision-section-heading">
          <div>
            <span className="conditions-kicker">Optional</span>
            <h3>Decisions</h3>
            <p>Only add a decision when this rule needs a specific allocation result.</p>
          </div>
          <div className="rule-branch-actions">
            <Button type="button" variant="secondary" onClick={addBranch} disabled={(form.branches || []).some((branch) => branch.isElse)}>
              <FiPlus size={13} /> Add decision
            </Button>
            <Button type="button" variant="secondary" onClick={addElseBranch} disabled={(form.branches || []).some((branch) => branch.isElse)}>
              <FiPlus size={13} /> Add fallback
            </Button>
          </div>
        </div>

        <div className="rule-branch-list">
          {(form.branches || []).map((branch, branchIndex) => {
            const selected = selectedByBranch[branchIndex] || [];
            const branchFields = fields;
            const branchConditions = branch.conditions || [];
            const isLastBranch = branchIndex === (form.branches || []).length - 1;
            const hasLaterBranch = branchIndex < (form.branches || []).length - 1;

            return (
              <section className={`rule-branch-card ${branch.isElse ? "rule-branch-else" : ""}`} key={branch.ruleBranchId || `branch-${branchIndex}`}>
                <div className="rule-branch-header">
                  <div className="rule-branch-title">
                    <span className="rule-branch-badge">{branch.isElse ? "Fallback" : "Decision " + (branchIndex + 1)}</span>
                  </div>
                  <button
                    type="button"
                    className="condition-remove"
                    onClick={() => removeBranch(branchIndex)}
                    title="Delete branch"
                    aria-label="Delete branch"
                  >
                    <FiTrash2 />
                  </button>
                </div>

                {!branch.isElse && (
                  <>
                    <div className="rule-branch-when">
                      <span>Conditions</span>
                      <small>Conditions that must match for this decision.</small>
                    </div>

                    <div className="condition-toolbar-actions">
                      <Button type="button" variant="secondary" className="condition-tool-button" onClick={() => groupSelected(branchIndex)} disabled={selected.length < 2}>
                        <FiUsers size={13} /><span>Group</span>
                      </Button>
                      <Button type="button" variant="secondary" className="condition-tool-button" onClick={() => ungroupSelected(branchIndex)} disabled={!selected.length}>
                        <FiMenu size={13} /><span>Ungroup</span>
                      </Button>
                      <Button type="button" variant="secondary" className="condition-tool-button condition-add-button" onClick={() => addCondition(branchIndex)}>
                        <FiPlus size={13} /><span>Add condition</span>
                      </Button>
                    </div>

                    <div className="condition-single-table-wrapper">
                      <table className="condition-single-table">
                        <thead>
                          <tr>
                            <th className="condition-check-column" />
                            <th>Field</th>
                            <th>Operator</th>
                            <th>Value</th>
                            <th>Logic</th>
                            <th className="condition-action-column" />
                          </tr>
                        </thead>
                        <tbody>
                          {branchConditions.map((condition) => {
                            const field = branchFields.find((item) => String(item.fieldId) === String(condition.fieldId));
                            const operators = optionsForType(field?.fieldType);
                            return (
                              <tr
                                key={condition.id}
                                draggable
                                onDragStart={() => setDraggedCondition({ branchIndex, conditionId: condition.id })}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => moveCondition(branchIndex, condition.id)}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(condition.id)}
                                    onChange={() => toggleSelected(branchIndex, condition.id)}
                                    aria-label="Select condition"
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    value={condition.fieldId}
                                    options={branchFields.map((item) => ({ value: item.fieldId, label: item.displayName }))}
                                    placeholder={loadingFields ? "Loading fields..." : "Select field"}
                                    disabled={loadingFields}
                                    onChange={(value) => changeField(branchIndex, condition.id, value)}
                                  />
                                </td>
                                <td>
                                  <Select
                                    value={condition.operator}
                                    options={operators}
                                    onChange={(event) => updateCondition(branchIndex, condition.id, "operator", event.target.value)}
                                  />
                                </td>
                                <td>
                                  <TextBox
                                    value={condition.value}
                                    placeholder="Enter value"
                                    onChange={(event) => updateCondition(branchIndex, condition.id, "value", event.target.value)}
                                  />
                                </td>
                                <td>
                                  <Select
                                    value={condition.conditionLogicalOperator}
                                    options={LOGICAL_OPTIONS}
                                    onChange={(event) => updateCondition(branchIndex, condition.id, "conditionLogicalOperator", event.target.value)}
                                  />
                                </td>
                                <td className="condition-action-cell">
                                  <button type="button" className="condition-remove" onClick={() => removeCondition(branchIndex, condition.id)} title="Delete condition">
                                    <FiTrash2 />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {!branchConditions.length && (
                        <div className="condition-empty">
                          <div className="condition-empty-icon"><FiCheckSquare size={20} /></div>
                          <div className="condition-empty-content">
                            <strong>No conditions in this branch</strong>
                            <span>Add the conditions that make this IF / ELSE IF branch true.</span>
                          </div>
                          <Button type="button" variant="secondary" className="condition-empty-action" onClick={() => addCondition(branchIndex)}>
                            <FiPlus size={13} /> Add condition
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="rule-branch-then">
                  <span>Action</span>
                  <small>Optional allocation action for this decision.</small>
                </div>

                <div className="decision-simple-grid rule-branch-action">
                  <div>
                    <label className="rule-field-label">Allocation Type</label>
                    <Select
                      value={branch.allocationType}
                      options={allocationOptions}
                      disabled={loadingDecisionOptions || !allocationOptions.length}
                      onChange={(event) => updateBranch(branchIndex, "allocationType", event.target.value)}
                    />
                    {!loadingDecisionOptions && !allocationOptions.length && (
                      <small className="rule-field-help">No Step 0 allocation types were loaded from configuration.</small>
                    )}
                  </div>
                  <TextBox
                    label="Sequence"
                    value={branch.sequence}
                    type="number"
                    min="1"
                    placeholder="Sequence"
                    onChange={(event) => updateBranch(branchIndex, "sequence", Number(event.target.value))}
                  />
                </div>

                {form.decisionAreaCode === "SPECIAL_RESERVATION_ELIGIBILITY" && (
                  <div className="decision-simple-grid rule-branch-action">
                    <div>
                      <label className="rule-field-label">Vacancy Source</label>
                      <Select
                        value={branch.outcome?.vacancySource || ""}
                        options={vacancySourceOptions}
                        disabled={loadingDecisionOptions}
                        onChange={(event) => updateBranchOutcome(branchIndex, "vacancySource", event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="rule-field-label">Vacancy Type</label>
                      <Select
                        value={branch.outcome?.vacancyType || ""}
                        options={vacancyTypeOptions}
                        disabled={loadingDecisionOptions}
                        onChange={(event) => updateBranchOutcome(branchIndex, "vacancyType", event.target.value)}
                      />
                    </div>
                  </div>
                )}

                {hasLaterBranch && <div className="rule-branch-connector"><FiGitBranch size={14} /> Evaluation continues with the next decision when this one does not match.</div>}
              </section>
            );
          })}
        </div>
        {!isNaN(0) && isLastBranchPlaceholder(form) && null}
      </form>
    </Dialog>
  );
}

function isLastBranchPlaceholder() {
  return false;
}

export default RuleForm;
