"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Client } from "@/types";
import {
  Search,
  Building2,
  Check,
  ChevronDown,
  X,
  User,
  ArrowUpDown,
} from "lucide-react";

export interface FacilityPickerProps {
  clients: Client[];
  value: string; // selected clientId or ""
  onChange: (clientId: string) => void;
  label?: string;
  allowIndependent?: boolean;
  placeholder?: string;
}

export default function FacilityPicker({
  clients,
  value,
  onChange,
  label,
  allowIndependent = true,
  placeholder = "Select or search healthcare facility...",
}: FacilityPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEmirate, setSelectedEmirate] = useState<string>("All");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  // Extract distinct emirates / regions for quick filter tabs
  const emirates = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const region = c.state || c.city || "UAE";
      if (region) set.add(region.trim());
    });

    const topRegions = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"];
    const foundTop = topRegions.filter((r) =>
      Array.from(set).some((item) => item.toLowerCase().includes(r.toLowerCase()))
    );

    return ["All", ...foundTop, "Other"];
  }, [clients]);

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clients
      .filter((c) => {
        // Region filter
        if (selectedEmirate !== "All") {
          const region = (c.state || c.city || "").toLowerCase();
          if (selectedEmirate === "Other") {
            const isMain = ["dubai", "abu dhabi", "sharjah", "ajman"].some((r) =>
              region.includes(r)
            );
            if (isMain) return false;
          } else {
            if (!region.includes(selectedEmirate.toLowerCase())) return false;
          }
        }

        // Search text filter
        if (!q) return true;
        const nameMatch = c.name.toLowerCase().includes(q);
        const cityMatch = c.city ? c.city.toLowerCase().includes(q) : false;
        const stateMatch = c.state ? c.state.toLowerCase().includes(q) : false;
        const placeMatch = c.place ? c.place.toLowerCase().includes(q) : false;
        return nameMatch || cityMatch || stateMatch || placeMatch;
      })
      .sort((a, b) => {
        const comp = a.name.localeCompare(b.name);
        return sortAsc ? comp : -comp;
      });
  }, [clients, search, selectedEmirate, sortAsc]);

  const handleSelect = (clientId: string) => {
    onChange(clientId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#0f172a",
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button Card */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          minHeight: 44,
          padding: "7px 12px",
          backgroundColor: "#ffffff",
          border: isOpen ? "1.5px solid #004d66" : "1px solid #cbd5e1",
          borderRadius: 10,
          boxShadow: isOpen
            ? "0 0 0 3px rgba(0, 77, 102, 0.12)"
            : "0 1px 2px rgba(15, 23, 42, 0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
      >
        {selectedClient ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: "#f0fdfa",
                border: "1px solid #ccfbf1",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {selectedClient.photo || selectedClient.logo ? (
                <img
                  src={selectedClient.photo || selectedClient.logo}
                  alt={selectedClient.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Building2 size={15} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.25,
                }}
              >
                {selectedClient.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "#0369a1",
                    backgroundColor: "#e0f2fe",
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {selectedClient.city || selectedClient.state || "UAE"}
                </span>
                {selectedClient.orgType && (
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    • {selectedClient.orgType}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User size={15} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                Independent Healthcare Consultant
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                No affiliated facility (Free Agent)
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {selectedClient && (
            <button
              type="button"
              onClick={handleClear}
              title="Switch to Independent (No Facility)"
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: "none",
                backgroundColor: "transparent",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fee2e2";
                e.currentTarget.style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: "#64748b",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
      </div>

      {/* Floating Custom Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: "#ffffff",
            borderRadius: 14,
            border: "1px solid #cbd5e1",
            boxShadow:
              "0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 6px 16px -4px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div
            style={{
              padding: "10px 12px 8px 12px",
              borderBottom: "1px solid #f1f5f9",
              backgroundColor: "#fafbfc",
            }}
          >
            {/* Search Input */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type hospital name, city, or emirate..."
                style={{
                  width: "100%",
                  height: 34,
                  paddingLeft: 32,
                  paddingRight: search ? 28 : 10,
                  fontSize: 12.5,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  outline: "none",
                  color: "#0f172a",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#004d66")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Emirate Filter Chips */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 8,
                overflowX: "auto",
                paddingBottom: 2,
              }}
            >
              {emirates.map((em) => {
                const isActive = selectedEmirate === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setSelectedEmirate(em)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? "#004d66" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#475569",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {em}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Summary & Sorting Bar */}
          <div
            style={{
              padding: "6px 12px",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>
              {filteredClients.length} of {clients.length} facilities
            </span>
            <button
              type="button"
              onClick={() => setSortAsc((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#004d66",
                fontWeight: 600,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 4px",
                borderRadius: 4,
              }}
              title="Click to toggle A-Z / Z-A sorting"
            >
              <ArrowUpDown size={11} />
              <span>{sortAsc ? "A → Z" : "Z → A"}</span>
            </button>
          </div>

          {/* Options List */}
          <div
            style={{
              maxHeight: 250,
              overflowY: "auto",
              padding: "4px",
            }}
          >
            {/* Independent Option (If permitted) */}
            {allowIndependent && !search && selectedEmirate === "All" && (
              <div
                onClick={() => handleSelect("")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 8,
                  backgroundColor: value === "" ? "#f0fdfa" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                  marginBottom: 4,
                  borderBottom: "1px solid #f1f5f9",
                }}
                onMouseEnter={(e) => {
                  if (value !== "") e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  if (value !== "") e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      backgroundColor: "#f1f5f9",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <User size={14} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: value === "" ? 700 : 500,
                        color: value === "" ? "#0f766e" : "#0f172a",
                      }}
                    >
                      Independent Healthcare Consultant
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      No facility affiliation (Consultant / Free Agent)
                    </div>
                  </div>
                </div>
                {value === "" && <Check size={15} style={{ color: "#0f766e", flexShrink: 0 }} />}
              </div>
            )}

            {/* Facilities items */}
            {filteredClients.map((c) => {
              const isSelected = value === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    backgroundColor: isSelected ? "#f0fdfa" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        backgroundColor: isSelected ? "#ccfbf1" : "#f1f5f9",
                        color: isSelected ? "#0f766e" : "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {c.photo || c.logo ? (
                        <img
                          src={c.photo || c.logo}
                          alt={c.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Building2 size={14} />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? "#0f766e" : "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            color: isSelected ? "#0f766e" : "#64748b",
                            backgroundColor: isSelected ? "#ccfbf1" : "#f1f5f9",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {c.city || c.state || "UAE"}
                        </span>
                        {c.orgType && (
                          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                            • {c.orgType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={15} style={{ color: "#0f766e", flexShrink: 0 }} />
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {filteredClients.length === 0 && (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  No facilities found
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                  No results matching &quot;{search}&quot;
                  {selectedEmirate !== "All" ? ` in ${selectedEmirate}` : ""}.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedEmirate("All");
                  }}
                  style={{
                    marginTop: 10,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    backgroundColor: "#f1f5f9",
                    color: "#004d66",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
