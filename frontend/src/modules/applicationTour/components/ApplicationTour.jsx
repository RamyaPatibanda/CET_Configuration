import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from "react-icons/fi";
import authService from "../../../services/authService";
import "../applicationTour.css";

const TOUR_STEPS = [
  { id: "welcome", selector: '[data-tour="header-actions"]', title: "Your workspace controls", description: "Your profile, application tour and sign-out controls are available here at any time.", route: "/overview" },
  { id: "overview", selector: '[data-tour="overview-nav"]', title: "Overview", description: "Start here to review previous allocation runs, their status, and saved run history.", route: "/overview" },
  { id: "overview-content", selector: ".workspace-page", title: "Allocation history", description: "The Overview page gives you a quick view of saved allocation runs and lets you open them for viewing or editing.", route: "/overview" },
  { id: "fields", selector: '[data-tour="fields-nav"]', title: "Field Configuration", description: "Define the database fields that can be used when building reusable allocation rules.", route: "/fields", permission: "FIELDS" },
  { id: "fields-content", selector: ".field-configuration-page", title: "Manage fields", description: "Create, edit, reorder and manage the active status of configured fields from this module.", route: "/fields", permission: "FIELDS" },
  { id: "rules", selector: '[data-tour="rules-nav"]', title: "Rule Configuration", description: "Build reusable business rules from the fields you configured. These rules can be selected by allocation stages.", route: "/rules", permission: "RULES" },
  { id: "rules-content", selector: ".rule-configuration-page", title: "Manage rules", description: "Create conditions, arrange rules in priority order, and maintain the rule catalogue used by allocation runs.", route: "/rules", permission: "RULES" },
  { id: "allocation", selector: '[data-tour="allocation-nav"]', title: "Allocation Run", description: "Configure a run, choose the CAP round and allocation step, select the applicable rule groups, and execute the allocation pipeline.", route: "/allocation", permission: "ALLOCATION_RUN" },
  { id: "allocation-content", selector: ".allocation-page", title: "Configure and run allocation", description: "Each allocation stage has its own decision area. Select the rules that should control the stage and then run or save the configuration.", route: "/allocation", permission: "ALLOCATION_RUN" },
  { id: "users", selector: '[data-tour="users-nav"]', title: "User Management", description: "Administrators can create users and control module access from this area.", route: "/users", permission: "__ADMIN__" },
  { id: "logout", selector: '[data-tour="logout"]', title: "Sign out", description: "Use the power button when you are finished working in the CET Configuration application.", route: "/overview" },
];

function ApplicationTour({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const user = authService.getUser();

  const steps = useMemo(() => TOUR_STEPS.filter((step) => {
    if (!step.permission) return true;
    if (step.permission === "__ADMIN__") return Boolean(user?.isAdmin);
    return authService.hasPermission(step.permission);
  }), [user?.isAdmin]);

  const step = steps[stepIndex] || steps[0];

  useEffect(() => {
    if (!open || !step) return undefined;
    if (location.pathname !== step.route) {
      navigate(step.route);
      return undefined;
    }

    let timer;
    const updateTarget = () => {
      const element = document.querySelector(step.selector);
      if (!element) {
        setTargetRect(null);
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      timer = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }, 180);
    };

    timer = window.setTimeout(updateTarget, 80);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [open, step, location.pathname, navigate]);

  useEffect(() => {
    if (open) setStepIndex(0);
    else setTargetRect(null);
  }, [open]);

  if (!open || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="application-tour" role="dialog" aria-modal="true" aria-label="Application tour">
      {targetRect ? (
        <div className="application-tour-spotlight" style={{
          top: Math.max(8, targetRect.top - 7),
          left: Math.max(8, targetRect.left - 7),
          width: targetRect.width + 14,
          height: targetRect.height + 14,
        }} />
      ) : <div className="application-tour-backdrop" />}

      <div className="application-tour-panel">
        <div className="application-tour-panel-top">
          <span>APPLICATION TOUR</span>
          <button type="button" onClick={onClose} aria-label="Close tour" title="Close tour"><FiX size={17} /></button>
        </div>
        <div className="application-tour-progress">
          <span>{stepIndex + 1} of {steps.length}</span>
          <div>{steps.map((item, index) => <i key={item.id} className={index <= stepIndex ? "active" : ""} />)}</div>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="application-tour-actions">
          <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>
          <div className="tour-navigation">
            {!isFirst && <button type="button" className="tour-secondary" onClick={() => setStepIndex((current) => current - 1)}><FiArrowLeft size={15} />Back</button>}
            <button type="button" className="tour-primary" onClick={() => isLast ? onClose() : setStepIndex((current) => current + 1)}>
              {isLast ? "Finish" : "Next"} {isLast ? <FiCheck size={15} /> : <FiArrowRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationTour;
