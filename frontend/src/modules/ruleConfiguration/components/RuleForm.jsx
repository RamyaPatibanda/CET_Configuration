import { useEffect, useMemo, useState } from "react";
import { FiMenu, FiPlus, FiTrash2, FiCheckSquare, FiLayers } from "react-icons/fi";
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
  decisionAreaCode: "CANDIDATE_QUALIFICATION",
  outcome: {
    allocatedType: "",
    vacancyType: "",
    seatCategory: "",
    reservationType: "",
    candidateStatus: "",
    preferenceMode: "",
    allowBetterment: null,
    additionalValues: {},
  },
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

const normalizeOutcome = (value) => ({
  ...EMPTY_RULE.outcome,
  ...(value || {}),
  additionalValues: value?.additionalValues || {},
});

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
  const [decisionOptions, setDecisionOptions] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingDecisionOptions, setLoadingDecisionOptions] = useState(false);
  const [error, setError] = useState("");
  const [draggedRow, setDraggedRow] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      rule
        ? {
            ...EMPTY_RULE,
            ...rule,
            decisionAreaCode: rule.decisionAreaCode || "CANDIDATE_QUALIFICATION",
            outcome: normalizeOutcome(
              rule.outcome ||
              (rule.outcomeJson ? (() => {
                try { return JSON.parse(rule.outcomeJson); } catch { return {}; }
              })() : {})
            ),
          }
        : { ...EMPTY_RULE, ruleId: nextRuleId }
    );
    setRows(rule ? toRows(rule.conditions) : []);
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

  const update = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const updateOutcome = (name, value) => {
    setForm((current) => ({
      ...current,
      outcome: {
        ...normalizeOutcome(current.outcome),
        [name]: value,
      },
    }));
  };

  const addRow = () => {
    setRows((current) => {
      const groupId = current.length
        ? (current[current.length - 1].groupId || "group-1")
        : "group-1";
      return [...current, createCondition(groupId)];
    });
    setError("");
  };

  const addGroup = () => {
    setRows((current) => [
      ...current,
      createCondition(`group-${Date.now()}`),
    ]);
    setError("");
  };

  const removeRow = (rowId) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setError("");
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
      const groupId = row.groupId || "group-1";
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(row);
    });
    return [...groups.entries()].map(([id, conditions]) => ({ id, conditions }));
  }, [rows]);

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
      decisionAreaCode: form.decisionAreaCode,
      outcome: normalizeOutcome(form.outcome),
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

        <section className="conditions-section">
          <div className="conditions-header">
            <div className="conditions-heading">
              <span className="conditions-kicker">Rule logic</span>
              <h3>When should this rule match?</h3>
              <p>Conditions inside one group are evaluated together. Separate groups are combined with AND.</p>
            </div>
            <div className="condition-builder-actions">
              <Button type="button" onClick={addRow} className="condition-add-button">
                <FiPlus size={15} /> Add condition
              </Button>
              <Button type="button" onClick={addGroup} className="condition-add-group-button">
                <FiLayers size={14} /> Add condition group
              </Button>
            </div>
          </div>
          {!rows.length && (
            <div className="condition-empty">
              <div className="conditions-empty-icon"><FiCheckSquare size={21} /></div>
              <strong>No conditions added</strong>
              <span>Add a condition to start defining when this rule should match.</span>
              <button type="button" className="condition-empty-add" onClick={addRow}>
                <FiPlus size={14} /> Add your first condition
              </button>
            </div>
          )}
          {!!rows.length && (
            <div className="condition-groups">
              {[...groupedRows].map((group, groupIndex) => (
                <div className="condition-group-card" key={group.id}>
                  <div className="condition-group-header">
                    <div>
                      <span className="condition-group-kicker">Condition group {groupIndex + 1}</span>
                      <strong>{groupIndex === 0 ? "First logic block" : "Additional logic block"}</strong>
                    </div>
                    <span className="condition-group-operator">{groupIndex < groupedRows.length - 1 ? "AND" : "END"}</span>
                  </div>
                  <div className="condition-group-table">
                    {group.conditions.map((row, conditionIndex) => {
                      const field = fields.find((item) => String(item.fieldId) === String(row.fieldId));
                      const operators = optionsForType(field?.fieldType);
                      return (
                        <div className="condition-row" key={row.id} draggable
                          onDragStart={() => setDraggedRow(row.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => moveRow(row.id)}>
                          <span className="condition-drag-handle" title="Drag to reorder"><FiMenu size={15} /></span>
                          <span className="condition-index">{conditionIndex + 1}</span>
                          <div className="condition-control condition-field">
                            <SearchableSelect value={row.fieldId}
                              options={fields.map((item) => ({ value: item.fieldId, label: item.displayName }))}
                              placeholder={loadingFields ? "Loading fields..." : "Select field"}
                              disabled={loadingFields}
                              onChange={(value) => changeField(row.id, value)} />
                          </div>
                          <div className="condition-control condition-operator">
                            <Select value={row.operator} options={operators}
                              onChange={(event) => updateRow(row.id, "operator", event.target.value)} />
                          </div>
                          <div className="condition-control condition-value">
                            <TextBox value={row.value} placeholder="Enter value"
                              onChange={(event) => updateRow(row.id, "value", event.target.value)} />
                          </div>
                          <div className="condition-control condition-logic">
                            {conditionIndex < group.conditions.length - 1 ? (
                              <Select value={row.conditionLogicalOperator} options={LOGICAL_OPTIONS}
                                onChange={(event) => updateRow(row.id, "conditionLogicalOperator", event.target.value)} />
                            ) : <span className="condition-end-label">end</span>}
                          </div>
                          <button type="button" className="condition-delete-button" title="Delete condition"
                            aria-label="Delete condition" onClick={() => removeRow(row.id)}>
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="condition-logic-note">
            <FiLayers size={14} />
            <span>Groups are combined with <strong>AND</strong>. Conditions inside each group use the selected AND / OR relationship.</span>
          </div>
        </section>

        <section className="rule-outcome-section">
          <div className="rule-outcome-header">
            <div>
              <span className="conditions-kicker">Then</span>
              <h3>Decision &amp; Result</h3>
              <p>When the conditions above match, choose the decision and assign the resulting value.</p>
            </div>
          </div>
          <div className="rule-outcome-grid">
            <div className="rule-value-field">
              <label htmlFor="rule-decision-area">Decision area</label>
              <Select value={form.decisionAreaCode}
                options={decisionOptions.map((item) => ({ value: item.value, label: item.label }))}
                disabled={loadingDecisionOptions}
                onChange={(event) => update("decisionAreaCode", event.target.value)} />
              <span className="rule-value-help">This is the action taken when the rule conditions match.</span>
            </div>
            {form.decisionAreaCode === "CANDIDATE_QUALIFICATION" && (
              <div className="rule-value-info">
                <span className="rule-value-info-label">Then</span>
                <strong>No separate result</strong>
                <span>If the configured conditions match, the candidate qualifies.</span>
              </div>
            )}
            {form.decisionAreaCode === "SEAT_ALLOCATION" && (
              <div className="rule-value-field">
                <label htmlFor="rule-allocation-result">Allocation result</label>
                <Select value={form.outcome?.allocatedType || ""}
                  options={[
                    { value: "", label: "Select allocation result" },
                    ...(
                      decisionOptions.find(
                        (item) => item.value === form.decisionAreaCode
                      )?.results || []
                    ),
                  ]}
                  onChange={(event) => updateOutcome("allocatedType", event.target.value)} />
                <span className="rule-value-help">Assign this value when the conditions match.</span>
              </div>
            )}
          </div>
        </section>

      </form>
    </Dialog>
  );
}

export default RuleForm;
