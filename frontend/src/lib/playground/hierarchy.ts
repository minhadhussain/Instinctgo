import type { Branch, Role } from "./types";

export const registrarPath: Role[] = ["Dealing Assistant", "Section Officer", "Assistant Registrar", "Deputy Registrar", "Registrar", "Vice-Chancellor"];
export const controllerPath: Role[] = ["Dealing Assistant", "Section Officer", "Assistant Controller", "Deputy Controller", "Controller", "Vice-Chancellor"];
export const allRoles: Role[] = [...registrarPath, "Assistant Controller", "Deputy Controller", "Controller"];
export const branches: { name: Branch; head: string; sections: string[]; note: string }[] = [
  { name: "Administrative", head: "Deputy Registrar", sections: ["AR/Admin", "Establishment", "AB", "Student Welfare Section (SWS)"], note: "Registrar-side sequential review" },
  { name: "Examination", head: "Controller", sections: ["Examinations", "Results"], note: "Controller → Deputy Controller → Assistant Controller → Section Officer → Dealing Assistant" },
  { name: "PNC", head: "Engineer", sections: [], note: "Intermediate reporting levels must be supplied by the institution. No PNC cases are routed until configured." },
];

export function getPath(branch: Branch, terminal: Role): Role[] {
  if (branch === "PNC") return [];
  const path = branch === "Examination" ? controllerPath : registrarPath;
  const index = path.indexOf(terminal);
  return index >= 1 ? path.slice(0, index + 1) : [];
}
