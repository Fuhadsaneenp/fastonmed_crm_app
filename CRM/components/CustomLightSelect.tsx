"use client";

import { createPortal } from "react-dom";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Search, X } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
  subtext?: string;
}

export interface CustomLightSelectProps {
  value: string;
  options: (string | CustomSelectOption)[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  activeColor?: boolean;
  searchable?: boolean;
  align?: "left" | "right";
  dropUp?: boolean;
  clearable?: boolean;
  allowCustomValue?: boolean;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  onAddNew?: (searchQuery?: string) => void;
  addNewLabel?: string;
  disabled?: boolean;
  sheetTitle?: string;
}

export default function CustomLightSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  icon,
  activeColor = false,
  searchable,
  align = "left",
  dropUp = false,
  clearable = true,
  allowCustomValue = false,
  style,
  buttonStyle,
  menuStyle,
  onAddNew,
  addNewLabel = "+ Add New...",
  disabled = false,
  sheetTitle,
}: CustomLightSelectProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [fieldTitle, setFieldTitle] = useState("Select option");
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !sheetRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const normalizedOptions: CustomSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
  const shouldShowSearch = isMobile || (searchable !== undefined ? searchable : normalizedOptions.length > 8);

  useEffect(() => {
    // Keep the phone keyboard closed until the user chooses to search.
    if (isOpen && shouldShowSearch && window.matchMedia("(min-width: 768px)").matches) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, shouldShowSearch]);

  const filteredOptions = shouldShowSearch && searchQuery.trim()
    ? normalizedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.subtext && opt.subtext.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : normalizedOptions;

  const selectedOption = normalizedOptions.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (value || placeholder);

  const hasAllOption = normalizedOptions.some((o) => o.value === "All");
  const hasDefaultOption = normalizedOptions.some((o) => o.value === "default");
  const clearTarget = hasAllOption ? "All" : hasDefaultOption ? "default" : "";
  const isAllOrDefault = !value || value === "All" || value === "default" || (hasAllOption && value === "") || (hasDefaultOption && value === "");

  return (
    <div className="crm-select"
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-label={displayLabel}
        onClick={() => { setFieldTitle(sheetTitle || containerRef.current?.parentElement?.querySelector("label")?.textContent?.replace(/\*/g, "").trim() || placeholder.replace(/\.\.\.$/, "") || "Select option"); setSearchQuery(""); setIsOpen((prev) => !prev); }}
        style={{
          height: 38,
          width: "100%",
          minWidth: 0,
          overflow: "hidden",
          paddingLeft: icon ? 30 : 12,
          paddingRight: !isAllOrDefault && clearable && !disabled ? 68 : 28,
          fontSize: 13,
          borderRadius: 8,
          border: `1px solid ${isOpen ? "#004d66" : activeColor ? "#004d66" : "#cbd5e1"}`,
          background: activeColor ? "#f0fdfa" : "#ffffff",
          color: activeColor ? "#004d66" : "#0f172a",
          fontWeight: activeColor || selectedOption ? 500 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          position: "relative",
          boxShadow: isOpen ? "0 0 0 2px rgba(0, 77, 102, 0.12)" : "none",
          transition: "border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
          ...buttonStyle,
        }}
      >
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {icon}
          </span>
        )}

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
            color: activeColor ? "#004d66" : value ? "#0f172a" : "#94a3b8",
          }}
        >
          {displayLabel}
        </span>


        <ChevronDown
          size={14}
          style={{
            color: activeColor ? "#004d66" : "#64748b",
            position: "absolute",
            right: 8,
            transform: isOpen ? (dropUp ? "rotate(0deg)" : "rotate(180deg)") : (dropUp ? "rotate(180deg)" : "none"),
            transition: "transform 0.15s ease",
            pointerEvents: "none",
          }}
        />
      </button>
        {!isAllOrDefault && clearable && !disabled && (
          <button
            type="button"
            className="crm-select-clear"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(clearTarget);
            }}
            title="Clear selection"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              border: 0,
              background: "transparent",
              top: "50%",
              transform: "translateY(-50%)",
              height: 18,
              borderRadius: 9,
              color: "#94a3b8",
              position: "absolute",
              right: 26,
              cursor: "pointer",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0f172a";
              e.currentTarget.style.backgroundColor = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={12} />
          </button>
        )}


      {isOpen && isMobile && createPortal(
        <div className="app-select-backdrop" onClick={() => setIsOpen(false)}>
          <div ref={sheetRef} className="app-select-sheet" role="dialog" aria-modal="true" aria-label={`Select ${fieldTitle}`} onClick={(event) => event.stopPropagation()}>
            <div className="app-select-sheet-header"><h2>{fieldTitle}</h2><button type="button" aria-label="Close options" onClick={() => setIsOpen(false)}><X size={20} /></button></div>
            <div className="app-select-search"><Search size={18} /><input aria-label="Search options" placeholder="Search options" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
            <div className="app-select-list" role="listbox" aria-label={fieldTitle}>
              {clearable && <button type="button" role="option" aria-selected={isAllOrDefault} onClick={() => {onChange(clearTarget);setIsOpen(false);}}><span className="app-select-check">{isAllOrDefault && <Check size={16}/>}</span><span>Not selected</span></button>}
              {filteredOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => {onChange(option.value);setIsOpen(false);}}>
                <span className="app-select-check">{option.value === value && <Check size={16}/>}</span><span className="app-select-option-label">{option.label}{option.subtext && <small>{option.subtext}</small>}</span>{option.badge && <small>{option.badge}</small>}
              </button>)}
              {filteredOptions.length === 0 && <p className="app-select-empty">No matching options</p>}
            </div>
            {(onAddNew || allowCustomValue) && <div className="app-select-add">
              {onAddNew ? <button type="button" onClick={() => {setIsOpen(false);onAddNew(searchQuery.trim());}}><Plus size={18}/>{searchQuery.trim() ? `Add “${searchQuery.trim()}”` : addNewLabel.replace(/^\+\s*/, "")}</button> : <div><input aria-label="New option" placeholder="Enter a new option" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}/><button type="button" disabled={!searchQuery.trim()} onClick={() => {onChange(searchQuery.trim());setIsOpen(false);}}><Plus size={18}/>Add option</button></div>}
            </div>}
          </div>
        </div>, containerRef.current?.closest('[role="dialog"]') || document.body
      )}

      {isOpen && !isMobile && (
        <div className="crm-select-options"
          style={{
            position: "absolute",
            ...(dropUp ? { bottom: "calc(100% + 4px)", top: "auto" } : { top: "calc(100% + 4px)" }),
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            width: "100%",
            minWidth: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            maxHeight: 280,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
            zIndex: 9999,
            padding: 4,
            ...menuStyle,
          }}
        >
          {shouldShowSearch && (
            <div
              style={{
                padding: "4px 4px 6px 4px",
                position: "sticky",
                top: 0,
                backgroundColor: "#ffffff",
                zIndex: 10,
                borderBottom: "1px solid #f1f5f9",
                marginBottom: 4,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
                <Search
                  size={13}
                  style={{ position: "absolute", left: 8, color: "#94a3b8", pointerEvents: "none" }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick search..."
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: 30,
                    paddingLeft: 26,
                    paddingRight: 8,
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    outline: "none",
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#004d66")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
              </div>
            </div>
          )}

          {/* Optional Clear / None option if a non-default item is selected */}
          {!isAllOrDefault && clearable && (
            <div
              onClick={() => {
                onChange(clearTarget);
                setIsOpen(false);
              }}
              style={{
                padding: "5px 10px",
                fontSize: 11.5,
                borderRadius: 5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#dc2626",
                backgroundColor: "#fff5f5",
                marginBottom: 4,
                userSelect: "none",
                fontWeight: 600,
              }}
            >
              <X size={12} />
              <span>Clear selection</span>
            </div>
          )}

          {/* Prominent Add New Option right at top of menu */}
          {onAddNew && (
            <div
              onClick={() => {
                setIsOpen(false);
                onAddNew(searchQuery.trim());
              }}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                borderRadius: 6,
                cursor: "pointer",
                color: "#0f766e",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "#f0fdfa",
                border: "1px dashed #99f6e4",
                marginBottom: 6,
                userSelect: "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#ccfbf1";
                e.currentTarget.style.borderColor = "#2dd4bf";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f0fdfa";
                e.currentTarget.style.borderColor = "#99f6e4";
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: "#0d9488",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Plus size={11} strokeWidth={3} />
              </div>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {searchQuery.trim()
                  ? (addNewLabel.toLowerCase().includes("product")
                      ? `+ Add "${searchQuery.trim()}" as New Product`
                      : `+ Add "${searchQuery.trim()}"...`)
                  : addNewLabel}
              </span>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
              No matches found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    if (isSelected && clearable && !isAllOrDefault) {
                      onChange(clearTarget);
                    } else {
                      onChange(opt.value);
                    }
                    setIsOpen(false);
                  }}
                  style={{
                    padding: "7px 10px",
                    fontSize: 12.5,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: isSelected ? "#f0fdfa" : "transparent",
                    color: isSelected ? "#004d66" : "#0f172a",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "background 0.1s ease",
                    userSelect: "none",
                    width: "100%",
                    boxSizing: "border-box",
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {isSelected && <Check size={13} style={{ color: "#004d66", flexShrink: 0 }} />}
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", textAlign: "left", flex: 1 }}>
                      <span
                        title={opt.label}
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                      >
                        {opt.label}
                      </span>
                      {opt.subtext && (
                        <span
                          title={opt.subtext}
                          style={{ fontSize: 11, color: "#64748b", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                        >
                          {opt.subtext}
                        </span>
                      )}
                    </span>
                  </span>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 6px",
                        borderRadius: 4,
                        backgroundColor: isSelected ? "#ccfbf1" : "#f1f5f9",
                        color: isSelected ? "#004d66" : "#64748b",
                        fontWeight: 500,
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Direct custom item selection if user typed something not matching existing options */}
          {allowCustomValue && searchQuery.trim() && !normalizedOptions.some((o) => o.value.toLowerCase() === searchQuery.trim().toLowerCase() || o.label.toLowerCase() === searchQuery.trim().toLowerCase()) && (
            <div
              onClick={() => {
                onChange(searchQuery.trim());
                setIsOpen(false);
              }}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                borderRadius: 6,
                cursor: "pointer",
                borderTop: "1px solid #f1f5f9",
                color: "#0f766e",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#f0fdfa",
                marginTop: 2,
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#ccfbf1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f0fdfa";
              }}
            >
              <Check size={12} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Use &ldquo;{searchQuery.trim()}&rdquo; as custom product
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
