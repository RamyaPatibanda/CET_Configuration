import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import SearchableSelect from "../../../components/common/SearchableSelect/SearchableSelect";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";

const EMPTY_RULE = {
  ruleId: 0,
  ruleName: "",
  description: "",
  priority: 1,
  isActive: true,
  decisionAreaCode: "SEAT_ALLOCATION",
  outcome: { values: [] },
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

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      ...EMPTY_RULE,
      ...(rule || {}),
      ruleId: rule?.ruleId ?? nextRuleId,
      decisionAreaCode: rule?.decisionAreaCode || "SEAT_ALLOCATION",
      conditions: normalizeConditions(rule?.conditions),
    });
    setError("");

    const loadConfiguration = async () => {
      try {
        setLoadingFields(true);
        const fieldsResponse = await ruleConfigurationService.getFields();
        setFields(getResponseItems(fieldsResponse));
      } catch (loadError) {
        setError(loadError.message || "Unable to load rule configuration options.");
      } finally {
        setLoadingFields(false);
      }
    };

    loadConfiguration();
  }, [open, rule, nextRuleId]);

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

    try {
      setError("");
      await onSave({
        ...form,
        conditions: rootConditions,
        outcome: { values: [] },
        branches: [],
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
            <h3>Rule Conditions</h3>
            <p>
              Define the conditions that determine when this rule matches. A rule contains conditions only; allocation order is selected when the rule is used.
            </p>
          </div>
        </div>


        <section className="rule-conditions-section">
          <div className="rule-section-heading">
            <div>
              <span className="conditions-kicker">Rule criteria</span>
              <h3>Conditions</h3>
              <p>Add one or more conditions. Use AND / OR to control how the conditions are evaluated.</p>
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

      </form>
    </Dialog>
  );
}


export default RuleForm;
