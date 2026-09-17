import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
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

  const loadRules = async () => {
    try {
      setLoading(true); setError("");
      const response = await ruleConfigurationService.getRules();
      const items = Array.isArray(response) ? response : response?.data || [];
      setRules([...items].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)));
    } catch (loadError) { setError(loadError.message || "Unable to load rules."); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRules(); }, []);

  const openCreate = () => { setSelectedRule(null); setFormOpen(true); };
  const openEdit = async (rule) => {
    try {
      setError("");
      const response = await ruleConfigurationService.getRule(rule.ruleId);
      setSelectedRule(response?.data || response);
      setFormOpen(true);
    } catch (loadError) { setError(loadError.message || "Unable to load rule."); }
  };

  const handleSave = async (rule) => {
    try {
      setSaving(true); setError("");
      if (selectedRule) await ruleConfigurationService.updateRule(selectedRule.ruleId, rule);
      else {
        const nextId = rules.length ? Math.max(...rules.map((item) => item.ruleId ?? 0)) + 1 : 1;
        await ruleConfigurationService.createRule({ ...rule, ruleId: nextId });
      }
      setFormOpen(false); setSelectedRule(null); await loadRules();
    } catch (saveError) { setError(saveError.message || "Unable to save rule."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    try {
      setError(""); await ruleConfigurationService.deleteRule(deleteRule.ruleId);
      setDeleteRule(null); await loadRules();
    } catch (deleteError) { setError(deleteError.message || "Unable to delete rule."); }
  };

  return (
    <div className="rule-configuration-page">
      <div className="rule-page-header">
        <div><h1>Rule Configuration</h1><p>Build allocation rules using the active fields from Field Configuration.</p></div>
        <Button onClick={openCreate} title="Create Rule" aria-label="Create Rule"><FiPlus size={18} /> Create Rule</Button>
      </div>
      {error && <div className="rule-page-error">{error}</div>}
      {loading ? <div className="rule-list-message">Loading rules…</div> : !rules.length ? (
        <div className="rule-empty-state"><h2>No rules configured yet.</h2><p>Create the first rule using your configured fields.</p><Button onClick={openCreate}><FiPlus size={17} /> Create Rule</Button></div>
      ) : (
        <div className="rule-table-wrapper"><table className="rule-table"><thead><tr><th>Priority</th><th>Rule Name</th><th>Description</th><th>Conditions</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {rules.map((rule) => <tr key={rule.ruleId}><td>{rule.priority}</td><td><strong>{rule.ruleName}</strong></td><td>{rule.description || "—"}</td><td>{rule.conditions?.length ?? 0}</td><td><span className={`status-chip ${rule.isActive ? "active" : "inactive"}`}><span>●</span>{rule.isActive ? "Active" : "Inactive"}</span></td><td className="rule-actions"><button type="button" title="Edit rule" aria-label="Edit rule" onClick={() => openEdit(rule)}><FiEdit2 /></button><button type="button" title="Delete rule" aria-label="Delete rule" onClick={() => setDeleteRule(rule)}><FiTrash2 /></button></td></tr>)}
        </tbody></table></div>
      )}
      <RuleForm open={formOpen} rule={selectedRule} nextRuleId={rules.length ? Math.max(...rules.map((item) => item.ruleId ?? 0)) + 1 : 1} saving={saving} onClose={() => setFormOpen(false)} onSave={handleSave} />
      <Dialog open={Boolean(deleteRule)} title="Delete Rule" onClose={() => setDeleteRule(null)} footer={<><Button variant="secondary" onClick={() => setDeleteRule(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete Permanently</Button></>}>
        <div className="rule-delete-confirmation"><p>The rule <strong>{deleteRule?.ruleName}</strong> is going to be deleted permanently.</p><p>This action cannot be undone. Do you want to continue?</p></div>
      </Dialog>
    </div>
  );
}

export default RuleConfiguration;
