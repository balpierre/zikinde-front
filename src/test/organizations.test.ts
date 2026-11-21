import { describe, expect, it } from "vitest";
import { selectOrganization } from "@/lib/backend";

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
