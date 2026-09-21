import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiArchive, FiCheck, FiCopy, FiEye, FiPlay, FiRefreshCw, FiSave } from "react-icons/fi";
import Step0DecisionAreas, { STEP_0_STAGES } from "../components/Step0DecisionAreas";
import Step1DecisionAreas, { STEP_1_STAGES } from "../components/Step1DecisionAreas";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import ruleConfigurationService from "../../ruleConfiguration/services/ruleConfigurationService";
import "../allocation.css";

const getItems = (response) => Array.isArray(response) ? response : response?.data || [];

const stageLabels = {
  CANDIDATE_QUALIFICATION: "Candidate Eligibility",
  SPECIAL_RESERVATION: "Special Reservation",
  SEAT_ALLOCATION: "Main Allocation",
  CONVERSION: "Seat Conversion",
  BETTERMENT: "Betterment",
  RECONCILIATION: "Reconciliation",
};

const DECISION_AREA_COMPONENTS = {
  STEP_0: { Component: Step0DecisionAreas, stages: STEP_0_STAGES },
  STEP_1: { Component: Step1DecisionAreas, stages: STEP_1_STAGES },
};

const getDecisionAreaConfig = (stepCode) => DECISION_AREA_COMPONENTS[stepCode] || null;

const createRuleGroups = (stepCode) =>
  (getDecisionAreaConfig(stepCode)?.stages || []).map((area) => ({ type: area.code, ruleIds: [] }));

const editableStatuses = new Set(["Draft", "Ready", "Failed", "Cancelled"]);
const lockedStatuses = new Set(["Running", "Completed", "Archived"]);

const normalizeStatus = (value, fallback = "Draft") => {
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    return ["Draft", "Ready", "Running", "Completed", "Failed", "Cancelled", "Archived"][value] || fallback;
  }
  return fallback;
};

function Allocation() {
  const [steps, setSteps] = useState([]);
  const [rules, setRules] = useState([]);
  const [allocationStep, setAllocationStep] = useState("STEP_0");
  const [runId, setRunId] = useState(null);
  const [runName, setRunName] = useState("");
  const [openRuleGroup, setOpenRuleGroup] = useState(null);
  const [ruleGroups, setRuleGroups] = useState([]);
  const [capRound, setCapRound] = useState(1);
  const [status, setStatus] = useState("Draft");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();
  const editRunId = searchParams.get("runId");

  const selectedStep = useMemo(
    () => steps.find((step) => step.code === allocationStep) || null,
    [steps, allocationStep]
  );

  const selectedRuleCount = useMemo(
    () => ruleGroups.reduce((count, group) => count + group.ruleIds.length, 0),
    [ruleGroups]
  );

  const isLocked = lockedStatuses.has(status);
  const canEdit = editableStatuses.has(status) && !running;

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [stepResponse, ruleResponse, historyResponse] = await Promise.all([
          allocationService.getSteps(),
          ruleConfigurationService.getRules(true),
          editRunId ? allocationService.getHistory() : Promise.resolve([]),
        ]);

        const stepItems = getItems(stepResponse);
        const ruleItems = getItems(ruleResponse)
          .filter((rule) => rule.isActive)
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

        const historyItems = getItems(historyResponse);
        const existingRun = editRunId
          ? historyItems.find((run) => String(run.allocationRunId).toLowerCase() === String(editRunId).toLowerCase())
          : null;

        setSteps(stepItems);
        setRules(ruleItems);

        if (existingRun) {
          let savedGroups = [];
          try {
            savedGroups = JSON.parse(existingRun.ruleGroupsJson || "[]");
          } catch {
            savedGroups = [];
          }

          const savedStep = stepItems.find((step) => step.code === existingRun.allocationStep);
          const groups = createRuleGroups(existingRun.allocationStep).map((group) => {
            const savedGroup = savedGroups.find(
              (item) => String(item.type).toUpperCase() === String(group.type).toUpperCase()
            );
            return {
              ...group,
              ruleIds: (savedGroup?.rules || [])
                .map((rule) => Number(rule.ruleId))
                .filter((ruleId) => ruleItems.some((rule) => rule.ruleId === ruleId)),
            };
          });

          setRunId(existingRun.allocationRunId);
          setRunName(existingRun.allocationRunName || "");
          setCapRound(existingRun.capRound || 1);
          setAllocationStep(savedStep?.code || existingRun.allocationStep);
          setRuleGroups(groups);
          setStatus(normalizeStatus(existingRun.status, "Draft"));
          setResult(null);
          setMessage(existingRun.status === "Draft"
            ? "Draft loaded in edit mode. Update the configuration and run when ready."
            : "Allocation run loaded with status " + existingRun.status + ".");
          return;
        }

        const firstAvailableStep = stepItems.find((step) => step.enabled) || stepItems[0];
        if (firstAvailableStep) {
          setAllocationStep(firstAvailableStep.code);
          setRuleGroups(createRuleGroups(firstAvailableStep.code));
        }
      } catch (e) {
        setError(e.message || "Unable to load allocation configuration.");
      }
    };

    load();
  }, [editRunId]);

  const markEdited = () => {
    if (status === "Ready") setStatus("Draft");
    setResult(null);
    setMessage("");
  };

  const changeStep = (step) => {
    if (!step.enabled || !canEdit) return;
    setAllocationStep(step.code);
    setRuleGroups(createRuleGroups(step.code));
    markEdited();
  };

  const toggleRule = (groupType, ruleId) => {
    if (!canEdit) return;
    setRuleGroups((current) => current.map((group) => {
      if (group.type !== groupType) return group;
      const selected = group.ruleIds.includes(ruleId);
      const ruleIds = selected ? group.ruleIds.filter((id) => id !== ruleId) : [...group.ruleIds, ruleId];
      return { ...group, ruleIds };
    }));
    markEdited();
  };

}
