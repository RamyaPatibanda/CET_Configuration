import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import "./SearchableSelect.css";
function SearchableSelect({ label, value, options = [], onChange, required = false, disabled = false, name, error = "", placeholder = "Select" }) {
 const [open,setOpen]=useState(false); const [search,setSearch]=useState(""); const ref=useRef(null);
 const selected=options.find((option)=>String(option.value)===String(value)); const filtered=options.filter((option)=>String(option.label??"").toLowerCase().includes(search.trim().toLowerCase()));
 useEffect(()=>{const outside=(event)=>{if(ref.current&&!ref.current.contains(event.target))setOpen(false)};document.addEventListener("mousedown",outside);return()=>document.removeEventListener("mousedown",outside)},[]);
 useEffect(()=>{if(!open)setSearch("")},[open]);
 return <div className="common-form-control searchable-select-control" ref={ref}>{label&&<label htmlFor={name}>{label}{required&&<span className="common-required"> *</span>}</label>}<button type="button" id={name} className={"searchable-select-trigger"+(error?" common-input-error":"")} disabled={disabled} onClick={()=>setOpen((v)=>!v)}><span className={selected?"selected":"placeholder"}>{selected?.label||placeholder}</span><FiChevronDown size={15}/></button>{open&&!disabled&&<div className="searchable-select-menu"><div className="searchable-select-search"><FiSearch size={14}/><input autoFocus value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search..."/></div><div className="searchable-select-options">{filtered.map((option)=><button type="button" key={option.value} className={"searchable-select-option"+(String(option.value)===String(value)?" selected":"")} onClick={()=>{onChange?.(option.value);setOpen(false)}}><span>{option.label}</span>{String(option.value)===String(value)&&<FiCheck size={14}/>}</button>)}{!filtered.length&&<div className="searchable-select-empty">No matching options</div>}</div></div>}{error&&<div className="common-field-error">{error}</div>}</div>;
}
export default SearchableSelect;
