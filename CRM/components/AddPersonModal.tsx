"use client";

import React, { useState, useRef } from "react";
import type { ContactPerson, Client, Department } from "@/types";
import { INITIAL_DEPARTMENTS } from "@/lib/client-store";
import toast from "react-hot-toast";
import FacilityPicker from "@/components/FacilityPicker";
import {
  User,
  X,
  Camera,
  Trash2,
} from "lucide-react";

export interface AddPersonModalProps {
  clients: Client[];
  departments?: string[];
  onAddDepartment?: (dept: string) => void;
  onClose: () => void;
  onSave: (person: Omit<ContactPerson, "id">) => void;
  preselectedClientId?: string;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
}

export default function AddPersonModal({
  clients,
  departments = INITIAL_DEPARTMENTS,
  onAddDepartment,
  onClose,
  onSave,
  preselectedClientId,
  initialName = "",
  initialPhone = "",
  initialEmail = "",
}: AddPersonModalProps) {
  const [name, setName] = useState(initialName);
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState<Department>("Purchase");
  const [deptList, setDeptList] = useState<string[]>(departments);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const handleCreateDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      toast.error("Please enter a department name");
      return;
    }
    if (!deptList.includes(trimmed)) {
      setDeptList((prev) => [...prev, trimmed]);
      if (onAddDepartment) onAddDepartment(trimmed);
    }
    setDepartment(trimmed as Department);
    setIsAddingDept(false);
    setNewDeptName("");
    toast.success(`Department "${trimmed}" selected!`);
  };

  const [phone, setPhone] = useState(initialPhone);
  const [whatsapp, setWhatsapp] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [linkedin, setLinkedin] = useState("");
  const [clientId, setClientId] = useState<string>(preselectedClientId || "");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto(reader.result);
        toast.success("Profile photo uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the contact person's name");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    const selectedClient = clients.find((c) => c.id === clientId);
    onSave({
      name: name.trim(),
      designation: designation.trim() || "Healthcare Specialist",
      department,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim() || "contact@facility.ae",
      linkedin: linkedin.trim() || undefined,
      clientId: clientId || undefined,
      clientName: selectedClient ? selectedClient.name : undefined,
      notes: notes.trim(),
      status: clientId ? "Active at Organisation" : "Independent / Consultant",
      previousOrganisations: [],
      photo: photo || undefined,
      avatar: photo || undefined,
    });
  };

  return (
    <div data-mobile-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: "20px 16px",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 740, // Increased width as requested!
          maxHeight: "92vh",
          overflow: "auto",
          padding: 0,
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.06)",
          backgroundColor: "#ffffff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#f0fdfa",
                border: "1px solid #ccfbf1",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Add Healthcare Professional
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            className="hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Photo Upload Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 18px",
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              border: "1.5px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 58,
                height: 58,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
                flexShrink: 0,
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <User size={24} style={{ color: "#94a3b8" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                Profile Photo
              </div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 8 }}>
                Upload JPG, PNG or WebP image (max 5MB)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                >
                  <Camera size={13} />
                  <span>{photo ? "Change Photo" : "Add Photo"}</span>
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto("")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
              Full Name *
            </label>
            <input
              className="form-input"
              placeholder="e.g. Dr. Tariq Al Mansoori"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ fontSize: 13, height: 38, borderRadius: 8 }}
            />
          </div>

          {/* Designation & Department */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                Designation / Title *
              </label>
              <input
                className="form-input"
                placeholder="e.g. Chief Biomedical Engineer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
                style={{ fontSize: 13, height: 38, borderRadius: 8 }}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", margin: 0 }}>
                  Department
                </label>
                {!isAddingDept && (
                  <button
                    type="button"
                    onClick={() => setIsAddingDept(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#004d66",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {isAddingDept ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="text"
                    autoFocus
                    className="form-input"
                    placeholder="New department..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateDept();
                      } else if (e.key === "Escape") {
                        setIsAddingDept(false);
                        setNewDeptName("");
                      }
                    }}
                    style={{ flex: 1, fontSize: 12, height: 38, borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateDept}
                    className="btn btn-primary"
                    style={{ height: 38, padding: "0 10px", fontSize: 11, backgroundColor: "#004d66", borderRadius: 8 }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDept(false);
                      setNewDeptName("");
                    }}
                    style={{
                      height: 38,
                      padding: "0 8px",
                      fontSize: 12,
                      background: "none",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={department}
                  onChange={(e) => {
                    if (e.target.value === "__ADD_NEW__") {
                      setIsAddingDept(true);
                    } else {
                      setDepartment(e.target.value as Department);
                    }
                  }}
                  style={{ fontSize: 13, height: 38, borderRadius: 8 }}
                >
                  {deptList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__ADD_NEW__">+ Add New Department...</option>
                </select>
              )}
            </div>
          </div>

          {/* Direct Mobile / Phone & WhatsApp */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                Direct Mobile / Phone *
              </label>
              <input
                className="form-input"
                placeholder="+971 50 000 0000"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (!whatsapp || whatsapp === phone) {
                    setWhatsapp(e.target.value);
                  }
                }}
                required
                style={{ fontSize: 13, height: 38, borderRadius: 8 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                WhatsApp Number
              </label>
              <input
                className="form-input"
                placeholder="+971 50 000 0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ fontSize: 13, height: 38, borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Direct Email & LinkedIn Profile */}
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                Direct Email
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="contact@facility.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: 13, height: 38, borderRadius: 8 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
                LinkedIn Profile URL
              </label>
              <input
                className="form-input"
                placeholder="linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                style={{ fontSize: 13, height: 38, borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Healthcare Facility */}
          <div>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>
              Healthcare Facility ({clients.length} Facilities Available)
            </label>
            <FacilityPicker
              clients={clients}
              value={clientId}
              onChange={setClientId}
            />
          </div>

          {/* Background / Notes */}
          <div>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>
              Background / Notes
            </label>
            <textarea
              className="form-input"
              placeholder="e.g. Key decision maker for ICU ventilators & patient monitors. Contact via WhatsApp."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ fontSize: 13, resize: "vertical", minHeight: 70, borderRadius: 8, lineHeight: 1.45 }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                backgroundColor: "#004d66",
                fontSize: 13,
                padding: "8px 22px",
                fontWeight: 600,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0, 77, 102, 0.25)",
              }}
            >
              Add Contact Person
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
