import { useEffect, useState } from "react";
import { FiMenu, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";

// FIX: replace unsupported FiGripVertical with FiMenu.
// The installed react-icons/fi package does not export FiGripVertical.
// All remaining RuleForm code is unchanged.
