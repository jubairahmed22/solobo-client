import { describe, it, expect } from "vitest";
import { COMPANY, resolveCompany, reportEntityInconsistencies } from "./company";
import type { SiteSettings } from "@/types/siteSettings";

/** Minimal SiteSettings factory for tests. */
function settings(partial: Partial<SiteSettings>): SiteSettings {
  return {
    _id: "1",
    key: "site",
    companyName: "Solobo",
    companyTitle: "",
    companyLogo: "",
    shortDescription: "",
    delivery: { insideDhaka: 60, outsideDhaka: 120, freeShippingThreshold: 1500 },
    contact: {},
    termsAndConditions: "",
    returnPolicy: "",
    shippingDetails: "",
    faqs: [],
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("resolveCompany", () => {
  it("falls back to the canonical constants when no settings", () => {
    const c = resolveCompany();
    expect(c.name).toBe(COMPANY.name);
    expect(c.email).toBe(COMPANY.email);
    expect(c.sameAs).toEqual([...COMPANY.sameAs]);
  });

  it("merges DB contact + policies + social over the constants", () => {
    const c = resolveCompany(
      settings({
        contact: {
          email: "help@solobo.test",
          phone: "+8801711111111",
          address: "Dhaka",
          facebook: "https://facebook.com/solobo",
          instagram: "https://instagram.com/solobo",
        },
        returnPolicy: "Return within 7 days.",
        shippingDetails: "Free over 1500.",
        faqs: [
          { question: "Do you ship nationwide?", answer: "Yes." },
          { question: "", answer: "dropped" }, // incomplete → filtered out
        ],
      }),
    );
    expect(c.email).toBe("help@solobo.test");
    expect(c.phone).toBe("+8801711111111");
    expect(c.address).toBe("Dhaka");
    expect(c.sameAs).toEqual(["https://facebook.com/solobo", "https://instagram.com/solobo"]);
    expect(c.policies.returns).toBe("Return within 7 days.");
    expect(c.faqs).toHaveLength(1);
  });
});

describe("reportEntityInconsistencies", () => {
  it("flags a company-name mismatch between DB and the constant", () => {
    const issues = reportEntityInconsistencies(settings({ companyName: "Different Co" }));
    expect(issues.some((i) => i.includes("Company name mismatch"))).toBe(true);
  });

  it("flags missing critical contact/policy data", () => {
    const issues = reportEntityInconsistencies(settings({}));
    expect(issues.some((i) => i.includes("phone"))).toBe(true);
    expect(issues.some((i) => i.includes("address"))).toBe(true);
    expect(issues.some((i) => i.toLowerCase().includes("return policy"))).toBe(true);
  });

  it("is quiet when the entity is complete + consistent", () => {
    const issues = reportEntityInconsistencies(
      settings({
        companyName: COMPANY.name,
        contact: {
          email: "help@solobo.test",
          phone: "+8801711111111",
          address: "Dhaka",
          facebook: COMPANY.sameAs[0],
          instagram: COMPANY.sameAs[1],
        },
        returnPolicy: "Return within 7 days.",
        shippingDetails: "Free over 1500.",
      }),
    );
    expect(issues).toEqual([]);
  });
});
