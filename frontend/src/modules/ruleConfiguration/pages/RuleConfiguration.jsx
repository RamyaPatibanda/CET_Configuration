import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiMenu, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await ruleConfigurationService.getRules(true);
      const items = Array.isArray(response) ? response : response?.data || [];
      setRules([...items].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)));
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
        const nextPriority = rules.length
          ? Math.max(...rules.map((item) => item.priority ?? 0)) + 1
          : 1;

        await ruleConfigurationService.createRule({
          ...rule,
          ruleId: rules.length
            ? Math.max(...rules.map((item) => item.ruleId ?? 0)) + 1
            : 1,
          priority: nextPriority,
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
      await ruleConfigurationService.reorderRules(nextRules.map((item) => item.ruleId));
    } catch (reorderError) {
      setRules(previousRules);
      setError(reorderError.message || "Unable to update rule order.");
    }
  };

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) => [rule.ruleName, rule.description].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [rules, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRules.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRules = filteredRules.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [search, pageSize]);

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

        <Button onClick={openCreate} title="Create Rule" aria-label="Create Rule" className="add-rule-button">
          <FiPlus size={18} strokeWidth={2.2} />
        </Button>
      </div>

      {/* <div className="rule-order-note">
        <div className="rule-order-note-icon">↕</div>
        <div>
          <strong>Rule order controls priority</strong>
          <span>Drag a rule to change its execution order. Active status can be changed directly here.</span>
        </div>
      </div> */}

      {error && <div className="rule-page-error">{error}</div>}

      <div className="rule-list-toolbar"><div className="rule-search-box"><FiSearch size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules..." aria-label="Search rules" /></div><div className="rule-page-size"><span>Rows</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></div></div>

      {loading ? (
        <div className="rule-list-message">Loading rules…</div>
      ) : !rules.length ? (
        <div className="rule-empty-state">
          <div className="rule-empty-icon">R</div>
          <h2>No rules configured yet.</h2>
          <p>Create the first reusable allocation rule using your configured fields.</p>
        </div>
      ) : (
        <div className="rule-table-wrapper">
          <table className="rule-table">
            <thead>
              <tr>
                <th className="rule-order-column">Order</th>
                <th>Rule</th>
                <th>Description</th>
                <th>Decision Area</th>
                <th>Conditions</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRules.map((rule) => {
                const conditionCount = Number(rule.conditionCount ?? rule.ConditionCount ?? 0);

                return (
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
                        <FiMenu size={17} />
                      </div>
                    </td>
                    <td>
                      <div className="rule-name-cell">
                        <strong>{rule.ruleName}</strong>
                      </div>
                    </td>
                    <td>{rule.description || "—"}</td>
                    <td>
                      <span className="rule-decision-area-label">
                        {{
                          CANDIDATE_QUALIFICATION: "Candidate Eligibility",
                          SPECIAL_RESERVATION_ELIGIBILITY: "Reservation Eligibility",
                          PREFERENCE_EVALUATION: "Preference Evaluation",
                          SEAT_ELIGIBILITY: "Seat Eligibility",
                          SEAT_ALLOCATION: "Seat Allocation",
                          BETTERMENT: "Betterment",
                          CONVERSION: "Conversion"
                        }[rule.decisionAreaCode] || rule.decisionAreaCode || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="condition-count">
                        {conditionCount} condition{conditionCount === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>
                      <div className="rule-status-control">
                        <Switch checked={Boolean(rule.isActive)} onChange={() => handleToggleActive(rule)} />
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filteredRules.length > 0 && <div className="rule-pagination"><span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRules.length)} of {filteredRules.length}</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button><span>Page {safePage} of {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next</button></div></div>}

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
            <Button variant="secondary" onClick={() => setDeleteRule(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Permanently</Button>
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
