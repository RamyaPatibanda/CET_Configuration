import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
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

function optionsForType(type) {
  return OPERATORS[type] || OPERATORS.Text;
}

function getResponseItems(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm(
      rule
        ? {
            ...EMPTY_RULE,
            ...rule,
            conditions: (rule.conditions || []).map((condition) => ({ ...condition })),
          }
        : { ...EMPTY_RULE, ruleId: nextRuleId }
    );
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

  const addCondition = () => {
    setForm((current) => ({
      ...current,
      conditions: [
        ...current.conditions,
        {
          fieldId: "",
          logicalOperator: "AND",
          operator: "Equals",
          value: "",
          conditionOrder: current.conditions.length + 1,
        },
      ],
    }));
  };

  const updateCondition = (index, name, value) => {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, itemIndex) =>
        itemIndex === index ? { ...condition, [name]: value } : condition
      ),
    }));
  };

  const changeField = (index, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const firstOperator = optionsForType(field?.fieldType).at(0)?.value || "Equals";

    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, itemIndex) =>
        itemIndex === index
          ? { ...condition, fieldId: value, operator: firstOperator, value: "" }
          : condition
      ),
    }));
  };

  const removeCondition = (index) => {
    setForm((current) => ({
      ...current,
      conditions: current.conditions
        .filter((_, itemIndex) => itemIndex !== index)
        .map((condition, itemIndex) => ({ ...condition, conditionOrder: itemIndex + 1 })),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    if (!form.conditions.length) {
      setError("Add at least one condition.");
      return;
    }

    if (
      form.conditions.some(
        (condition) =>
          !condition.fieldId ||
          !condition.operator ||
          !String(condition.value).trim()
      )
    ) {
      setError("Complete every condition before saving.");
      return;
    }

    setError("");

    await onSave({
      ...form,
      priority: Number(form.priority || 1),
      conditions: form.conditions.map((condition, index) => ({
        ...condition,
        fieldId: Number(condition.fieldId),
        conditionOrder: index + 1,
      })),
    });
  };

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
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

        <div className="rule-form-id-row">
          <span className="rule-form-id-label">Rule ID</span>
          <span className="rule-form-id-value">#{form.ruleId}</span>
          <span className="rule-form-id-hint">Priority and status are managed from the rule list.</span>
        </div>

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
            <p>Select fields configured in Field Configuration and define the rule logic.</p>
          </div>
          <Button type="button" variant="secondary" onClick={addCondition} className="add-condition-button">
            <FiPlus size={16} />
            Add Condition
          </Button>
        </div>

        <div className="conditions-list">
          {form.conditions.map((condition, index) => {
            const field = fields.find((item) => String(item.fieldId) === String(condition.fieldId));
            const operators = optionsForType(field?.fieldType);

            return (
              <div className="condition-card" key={`${condition.conditionOrder}-${index}`}>
                <div className="condition-card-topline">
                  <div className="condition-number">{index + 1}</div>
                  <div className="condition-card-title">
                    <strong>{index === 0 ? "Match when" : "Then"}</strong>
                    <span>{index === 0 ? "Define the first condition" : "Connect this condition to the previous one"}</span>
                  </div>
                  <button
                    type="button"
                    className="condition-remove"
                    title="Remove condition"
                    aria-label="Remove condition"
                    onClick={() => removeCondition(index)}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>

                <div className="condition-card-fields">
                  {index > 0 && (
                    <Select
                      label="Logic"
                      value={condition.logicalOperator}
                      options={[
                        { value: "AND", label: "AND" },
                        { value: "OR", label: "OR" },
                      ]}
                      onChange={(event) => updateCondition(index, "logicalOperator", event.target.value)}
                    />
                  )}

                  <Select
                    label="Field"
                    value={condition.fieldId}
                    options={fields.map((item) => ({ value: item.fieldId, label: item.displayName }))}
                    placeholder={loadingFields ? "Loading fields..." : "Select field"}
                    disabled={loadingFields || saving}
                    onChange={(event) => changeField(index, event.target.value)}
                  />

                  <Select
                    label="Operator"
                    value={condition.operator}
                    options={operators}
                    disabled={!field || saving}
                    onChange={(event) => updateCondition(index, "operator", event.target.value)}
                  />

                  {field?.fieldType === "Boolean" ? (
                    <Select
                      label="Value"
                      value={condition.value}
                      options={[
                        { value: "Y", label: "Yes" },
                        { value: "N", label: "No" },
                      ]}
                      placeholder="Select value"
                      onChange={(event) => updateCondition(index, "value", event.target.value)}
                    />
                  ) : (
                    <TextBox
                      label="Value"
                      value={condition.value}
                      type={
                        field?.fieldType === "Number"
                          ? "number"
                          : field?.fieldType === "Date"
                            ? "date"
                            : "text"
                      }
                      disabled={!field || saving}
                      onChange={(event) => updateCondition(index, "value", event.target.value)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {!form.conditions.length && (
            <div className="conditions-empty">
              <div className="conditions-empty-icon">+</div>
              <strong>No conditions yet</strong>
              <span>Add a condition to define when this rule should apply.</span>
              <Button type="button" variant="secondary" onClick={addCondition}>
                <FiPlus size={15} />
                Add First Condition
              </Button>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export default RuleForm;
