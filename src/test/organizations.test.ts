import { describe, expect, it } from "vitest";
import { isOwner, selectOrganization } from "@/lib/backend";

const organizations = [
  { id: "first-label", name: "Premier label" },
  { id: "second-label", name: "Deuxième label" },
];

describe("Sélection du label pour une extraction", () => {
  it("utilise le label sélectionné parmi les labels de l’utilisateur", () => {
    expect(selectOrganization(organizations, "second-label")).toEqual(organizations[1]);
  });

  it("garde le premier label accessible par défaut ou face à un ID inconnu", () => {
    expect(selectOrganization(organizations, undefined)).toEqual(organizations[0]);
    expect(selectOrganization(organizations, "other-label")).toEqual(organizations[0]);
  });

  it("attend les labels accessibles avant de sélectionner un label", () => {
    expect(selectOrganization(undefined, "second-label")).toBeUndefined();
  });
});

describe("Rôle de l’utilisateur dans le label", () => {
  const members = [
    {
      user_id: "alice",
      email: "alice@example.test",
      role: "owner" as const,
      joined_at: "2026-11-22",
    },
    {
      user_id: "carol",
      email: "carol@example.test",
      role: "member" as const,
      joined_at: "2026-11-22",
    },
  ];

  it("réserve la gestion des membres au propriétaire", () => {
    expect(isOwner(members, "alice")).toBe(true);
    expect(isOwner(members, "carol")).toBe(false);
  });

  it("refuse tant que les membres ou la session ne sont pas chargés", () => {
    expect(isOwner(undefined, "alice")).toBe(false);
    expect(isOwner(members, undefined)).toBe(false);
    expect(isOwner(members, "inconnu")).toBe(false);
  });
});
