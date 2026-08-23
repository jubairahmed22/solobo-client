/**
 * pdfkit ships its browser-ready build at this subpath with no dedicated
 * type declarations (@types/pdfkit only models the bare "pdfkit" import,
 * which resolves to the Node build). pdf.ts imports this subpath
 * specifically and casts the result to `typeof import("pdfkit")`, since the
 * standalone build has the same public API - this ambient declaration just
 * lets the dynamic import resolve without an "implicitly any" error.
 */
declare module "pdfkit/js/pdfkit.standalone.js";
