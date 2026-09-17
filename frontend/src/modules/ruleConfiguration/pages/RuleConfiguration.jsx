import { useEffect, useState } from "react";
import { FiEdit2, FiGripVertical, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Switch from "../../../components/common/Switch/Switch";
import RuleForm from "../components/RuleForm";
import ruleConfigurationService from "../services/ruleConfigurationService";
import "../ruleConfiguration.css";

function RuleConfiguration() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [deleteRule, setDeleteRule] = useState(null);
  const [draggedRuleId, setDraggedRuleId] = useState(null);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await ruleConfigurationService.getRules(true);
      const items = Array.isArray(response) ? response : response?.data || [];

      setRules(
        [...items].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreate = () => {
    setSelectedRule(null);
    setFormOpen(true);
  };

  const openEdit = async (rule) => {
    try {
      setError("");
      const response = await ruleConfigurationService.getRule(rule.ruleId);
      setSelectedRule(response?.data || response);
      setFormOpen(true);
    } catch (loadError) {
      setError(loadError.message || "Unable to load rule.");
    }
  };

  const handleSave = async (rule) => {
    try {
      setSaving(true);
      setError("");

      if (selectedRule) {
        await ruleConfigurationService.updateRule(selectedRule.ruleId, {
          ...rule,
          priority: selectedRule.priority,
          isActive: selectedRule.isActive,
        });
      } else {
        await ruleConfigurationService.createRule({
          ...rule,
          ruleId: rules.length
            ? Math.max(...rules.map((item) => item.ruleId ?? 0)) + 1
            : 1,
          priority: rules.length + 1,
          isActive: true,
        });
      }

      setFormOpen(false);
      setSelectedRule(null);
      await loadRules();
    } catch (saveError) {
      setError(saveError.message || "Unable to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule) => {
    const nextActive = !rule.isActive;

    setRules((current) =>
      current.map((item) =>
        item.ruleId === rule.ruleId ? { ...item, isActive: nextActive } : item
      )
    );

    try {
      setError("");
      await ruleConfigurationService.setRuleActive(rule.ruleId, nextActive);
    } catch (toggleError) {
      setRules((current) =>
        current.map((item) =>
          item.ruleId === rule.ruleId ? { ...item, isActive: rule.isActive } : item
        )
      );
      setError(toggleError.message || "Unable to update rule status.");
    }
  };

  const handleDrop = async (targetRuleId) => {
    if (!draggedRuleId || draggedRuleId === targetRuleId) {
      setDraggedRuleId(null);
      return;
    }

    const previousRules = [...rules];
    const nextRules = [...rules];
    const draggedIndex = nextRules.findIndex((item) => item.ruleId === draggedRuleId);
    const targetIndex = nextRules.findIndex((item) => item.ruleId === targetRuleId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedRuleId(null);
      return;
    }

    const [draggedRule] = nextRules.splice(draggedIndex, 1);
    nextRules.splice(targetIndex, 0, draggedRule);
    setRules(nextRules);
    setDraggedRuleId(null);

    try {
      setError("");
      await ruleConfigurationService.reorderRules(
        nextRules.map((item) => item.ruleId)
      );
    } catch (reorderError) {
      setRules(previousRules);
      setError(reorderError.message || "Unable to update rule order.");
    }
  };

  const handleDelete = async () => {
    if (!deleteRule) return;

    try {
      setError("");
      await ruleConfigurationService.deleteRule(deleteRule.ruleId);
      setDeleteRule(null);
      await loadRules();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete rule.");
    }
  };

  return (
    <div className="rule-configuration-page">
      <div className="rule-page-header">
        <div>
          <span className="page-eyebrow">Allocation rules</span>
          <h1>Rule Configuration</h1>
          <p>Create reusable rules from the fields configured in Field Configuration.</p>
        </div>

        <Button onClick={openCreate} title="Create Rule" aria-label="Create Rule">
          <FiPlus size={18} />
          Create Rule
        </Button>
      </div>

      <div className="rule-order-note">
        <div className="rule-order-note-icon">↕</div>
        <div>
          <strong>Rule order controls priority</strong>
          <span>Drag a rule to change its execution order. Active status can be changed directly here.</span>
        </div>
      </div>

      {error && <div className="rule-page-error">{error}</div>}

      {loading ? (
        <div className="rule-list-message">Loading rules…</div>
      ) : !rules.length ? (
        <div className="rule-empty-state">
          <div className="rule-empty-icon">R</div>
          <h2>No rules configured yet.</h2>
          <p>Create the first reusable allocation rule using your configured fields.</p>
          <Button onClick={openCreate}>
            <FiPlus size={17} />
            Create Rule
          </Button>
        </div>
      ) : (
        <div className="rule-table-wrapper">
          <table className="rule-table">
            <thead>
              <tr>
                <th className="rule-order-column">Order</th>
                <th>Rule</th>
                <th>Description</th>
                <th>Conditions</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr
                  key={rule.ruleId}
                  draggable
                  className={draggedRuleId === rule.ruleId ? "rule-row-dragging" : ""}
                  onDragStart={() => setDraggedRuleId(rule.ruleId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(rule.ruleId)}
                  onDragEnd={() => setDraggedRuleId(null)}
                >
                  <td className="rule-order-cell">
                    <div className="rule-order-handle" title="Drag to reorder">
                      <FiGripVertical size={17} />
                      <span>{index + 1}</span>
                    </div>
                  </td>
                  <td>
                    <div className="rule-name-cell">
                      <strong>{rule.ruleName}</strong>
                      <span>Rule #{rule.ruleId}</span>
                    </div>
                  </td>
                  <td>{rule.description || "—"}</td>
                  <td>
                    <span className="condition-count">
                      {rule.conditions?.length ?? 0} condition{(rule.conditions?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td>
                    <div className="rule-status-control">
                      <Switch
                        checked={Boolean(rule.isActive)}
                        onChange={() => handleToggleActive(rule)}
                      />
                      <span className={rule.isActive ? "active-label" : "inactive-label"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </td>
                  <td className="rule-actions">
                    <button type="button" title="Edit rule" aria-label="Edit rule" onClick={() => openEdit(rule)}>
                      <FiEdit2 />
                    </button>
                    <button type="button" title="Delete rule" aria-label="Delete rule" onClick={() => setDeleteRule(rule)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RuleForm
        open={formOpen}
        rule={selectedRule}
        nextRuleId={rules.length ? Math.max(...rules.map((item) => item.ruleId ?? 0)) + 1 : 1}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <Dialog
        open={Boolean(deleteRule)}
        title="Delete Rule"
        onClose={() => setDeleteRule(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRule(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Permanently
            </Button>
          </>
        }
      >
        <div className="rule-delete-confirmation">
          <p>The rule <strong>{deleteRule?.ruleName}</strong> is going to be deleted permanently.</p>
          <p>This action cannot be undone. Do you want to continue?</p>
        </div>
      </Dialog>
    </div>
  );
}

export default RuleConfiguration;
