export type CRMOutreachContact = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type OutreachContactChoice = {
  contactId: string | null;
  contactEmail: string;
  whatsappPhone: string;
  contactSource: "crm_contact" | "discovered_business_email" | "none";
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

export function chooseOutreachContact(
  primary: CRMOutreachContact | null | undefined,
  fallback: CRMOutreachContact | null | undefined,
  discoveredBusinessEmail: string | null | undefined,
): OutreachContactChoice {
  const crm = [primary, fallback].find((contact) =>
    Boolean(clean(contact?.email) || clean(contact?.phone))
  );

  if (crm) {
    return {
      contactId: clean(crm.id) || null,
      contactEmail: clean(crm.email).toLowerCase(),
      whatsappPhone: clean(crm.phone),
      contactSource: "crm_contact",
    };
  }

  const discovered = clean(discoveredBusinessEmail).toLowerCase();
  if (discovered && validEmail(discovered)) {
    return {
      contactId: null,
      contactEmail: discovered,
      whatsappPhone: "",
      contactSource: "discovered_business_email",
    };
  }

  return {
    contactId: null,
    contactEmail: "",
    whatsappPhone: "",
    contactSource: "none",
  };
}
