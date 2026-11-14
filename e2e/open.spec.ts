import { expect, type Page, test } from "@playwright/test";
import { credentialsFor, signUp } from "./app";
import { ARCHIVE_NOTE, E2E_ARCHIVE_URL } from "./archive";

/** The address an archive opens for its "Öffnen mit Schreibzeug" button. */
const openAddress = (link: string, name: string) =>
  `/open?url=${encodeURIComponent(link)}&name=${encodeURIComponent(name)}`;

const textEditor = (page: Page) => page.getByTestId("text-editor").locator(".cm-content");

test("opens a copy of a file another app links to", async ({ page }, testInfo) => {
  await signUp(page, credentialsFor(testInfo));
  await page.goto(openAddress(`${E2E_ARCHIVE_URL}/freigabe/note`, "Protokoll März.md"));

  await expect(page).toHaveURL(/\/edit\//);
  await expect(page.getByLabel("Dateiname")).toHaveValue("Protokoll März");
  await expect(textEditor(page)).toContainText(ARCHIVE_NOTE.split("\n")[2] ?? "");
  // One copy, not one per run of the page's effect.
  await page.goto("/");
  await expect(page.locator('tr[data-node="Protokoll März.md"]')).toHaveCount(1);
});

test("signs in first and comes back to open the file", async ({ page }, testInfo) => {
  const credentials = credentialsFor(testInfo);
  await signUp(page, credentials);
  await page.context().clearCookies();

  await page.goto(openAddress(`${E2E_ARCHIVE_URL}/freigabe/note`, "Aus dem Archiv.md"));
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByLabel("E-Mail").fill(credentials.email);
  await page.getByLabel("Passwort").fill(credentials.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();

  await expect(page).toHaveURL(/\/edit\//);
  await expect(page.getByLabel("Dateiname")).toHaveValue("Aus dem Archiv");
});

test("says so when the link has expired", async ({ page }, testInfo) => {
  await signUp(page, credentialsFor(testInfo));
  await page.goto(openAddress(`${E2E_ARCHIVE_URL}/freigabe/expired`, "Alt.md"));

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Die Datei ließ sich nicht öffnen.");
  await expect(alert).toContainText("Der Link ist abgelaufen oder ungültig.");
  await page.getByRole("link", { name: "Zu meinen Dateien" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meine Dateien");
});
