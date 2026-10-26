"use client";

import { useState } from "react";
import type { Client } from "@/types";
import CustomLightSelect from "@/components/CustomLightSelect";
import ClientModal from "@/components/ClientModal";
import { getStoredClients, saveStoredClients } from "@/lib/client-store";

export interface FacilityPickerProps {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  label?: string;
  allowIndependent?: boolean;
  placeholder?: string;
}

export default function FacilityPicker({ clients, value, onChange, label, allowIndependent = true, placeholder = "Select organisation" }: FacilityPickerProps) {
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<Client[]>([]);
  const organisations = Array.from(new Map([...clients, ...created].map(client => [client.id, client])).values());
  return <>
    <div>
      {label && <label className="form-label">{label}</label>}
      <CustomLightSelect
        value={value || (allowIndependent ? "__independent__" : "")}
        options={[
          ...(allowIndependent ? [{ value: "__independent__", label: "Independent / Consultant" }] : []),
          ...organisations.map(client => ({ value: client.id, label: client.name, subtext: [client.orgType, client.city].filter(Boolean).join(" · ") })),
        ]}
        onChange={id => onChange(id === "__independent__" ? "" : id)}
        searchable clearable={false} placeholder={placeholder} sheetTitle="Choose organisation"
        onAddNew={() => setAdding(true)} addNewLabel="+ Add organisation"
        buttonStyle={{ minHeight: 48, width: "100%", borderRadius: 12, fontSize: 13 }}
      />
    </div>
    {adding && <ClientModal zIndex={12000} onClose={() => setAdding(false)} onSave={async data => {
      const organisation = { ...data, id: `client-${crypto.randomUUID()}`, name: data.name || "", entityType: "Company", contacts: data.contacts || [], createdAt: new Date().toISOString() } as Client;
      const existing = getStoredClients();
      saveStoredClients([...existing, organisation]);
      setCreated(previous => [...previous, organisation]);
      onChange(organisation.id);
      setAdding(false);
    }} />}
  </>;
}
