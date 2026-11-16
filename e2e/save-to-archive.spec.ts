import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { collectErrors, openDocument, openFileId, openOwnFolder, upload } from "./app";
import { E2E_ARCHIVE_NAME, E2E_ARCHIVE_URL } from "./archive";

const HELLO = join(import.meta.dirname, "../test-files/hello.docx");

/** The PDF/A part its XMP metadata claims (ISO 19005-2 6.6.4), as pdf-a.spec.ts reads it. */
const pdfaPart = async (bytes: Uint8Array) => {
  const metadata = (await PDFDocument.load(bytes)).catalog.lookup(PDFName.of("Metadata"));
  const xmp =
    metadata instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(metadata).decode()) : "";
  return /pdfaid:part(?:>|=")(\d)/.exec(xmp)?.[1] ?? null;
};

/** "Datei" → "In Belegablage ablegen …": the dialog for the archive the E2E server is set up with. */
const openArchiveDialog = async (page: Page) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: "Datei", exact: true }).click();
  await page.getByRole("menuitem", { name: `In ${E2E_ARCHIVE_NAME} ablegen …` }).click();
  const dialog = page.getByRole("dialog", { name: `In ${E2E_ARCHIVE_NAME} ablegen` });
  await expect(dialog).toBeVisible();
  return dialog;
};

test("saves a document to the archive as PDF-A and as the original", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await openOwnFolder(page, testInfo);
  await upload(page, HELLO, "hello.docx");
  await openDocument(page, "hello.docx", errors);
  const fileId = openFileId(page);

  const dialog = await openArchiveDialog(page);
  await expect(dialog.getByLabel("PDF/A zum Aufbewahren")).toBeChecked();
  await dialog.getByLabel("Auch das Original (.docx)").check();
  await dialog.getByRole("button", { name: "Ablegen", exact: true }).click();

  await expect(dialog.getByText("Im Archiv abgelegt.")).toBeVisible({ timeout: 60_000 });
  const pdfLink = dialog.getByRole("link", { name: `In ${E2E_ARCHIVE_NAME} öffnen: hello.pdf` });
  const originalLink = dialog.getByRole("link", { name: `In ${E2E_ARCHIVE_NAME} öffnen: hello.docx` });
  await expect(originalLink).toHaveAttribute(
    "href",
    new RegExp(`^${E2E_ARCHIVE_URL}/dokumente/[0-9a-f-]{36}$`),
  );

  // What the archive holds: the PDF and the Office file, each a document of its own.
  const href = (await pdfLink.getAttribute("href")) ?? "";
  const api = href.replace("/dokumente/", "/api/dokumente/");
  const stored = await (await page.request.get(api)).json();
  expect(stored).toMatchObject({ name: "hello.pdf", type: "application/pdf", pdf: true });
  expect(stored.size).toBeGreaterThan(1000);
  const bytes = await (await page.request.get(`${api}/datei`)).body();
  expect(await pdfaPart(new Uint8Array(bytes))).toBe("2");

  // The link opens the archive's page of the document.
  const [archivePage] = await Promise.all([page.waitForEvent("popup"), pdfLink.click()]);
  await expect(archivePage.getByRole("heading", { level: 1 })).toHaveText("hello.pdf");
  await archivePage.close();

  // The version that went is kept from now on.
  const versions = await (await page.request.get(`/api/files/${fileId}/versions`)).json();
  expect(versions[0]).toMatchObject({ kept: true });
});

test("says so when the archive refuses the server's token", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await openOwnFolder(page, testInfo);
  // The stand-in refuses files with this name as an archive refuses a revoked token (archive.ts).
  const refused = testInfo.outputPath("Abgelehnt.docx");
  await copyFile(HELLO, refused);
  await upload(page, refused, "Abgelehnt.docx");
  await openDocument(page, "Abgelehnt.docx", errors);

  const dialog = await openArchiveDialog(page);
  await dialog.getByRole("button", { name: "Ablegen", exact: true }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("abgelehnt", { timeout: 60_000 });
  await expect(alert).toContainText("Verwaltung");
  // The dialog stays open to try again or cancel.
  await expect(dialog.getByRole("button", { name: "Ablegen", exact: true })).toBeEnabled();
});
