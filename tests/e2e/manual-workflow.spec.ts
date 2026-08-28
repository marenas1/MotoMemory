import { expect, test, type Route } from "@playwright/test";

const manualId = "123e4567-e89b-12d3-a456-426614174000";
const factId = "223e4567-e89b-12d3-a456-426614174000";

const uploadedManual = {
  id: manualId,
  motorcycleId: "gs750",
  fileName: "synthetic-gs750-manual.pdf",
  contentType: "application/pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 3,
  status: "uploaded" as const,
  extractionMethod: "ocr" as const,
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: null,
};

const readyManual = {
  ...uploadedManual,
  status: "ready" as const,
  processedAt: new Date(0).toISOString(),
};

const readyProgress = {
  totalPages: 3,
  accountedPages: 3,
  availablePages: 3,
  failedPages: 0,
  pendingPages: 0,
  percentComplete: 100,
  failures: [],
};

const passage = {
  id: "chunk-1",
  manualId,
  pageStart: 2,
  pageEnd: 2,
  printedPageStart: "31",
  printedPageEnd: "31",
  sectionLabel: "Maintenance",
  content: "Replace engine oil every 2,000 miles.",
  processorVersion: "synthetic-ocr:v1",
  rank: 1,
  citationHref: "/manual?page=2&printedPage=31",
};

const fact = {
  id: factId,
  motorcycleId: "gs750",
  name: "Oil change",
  intervalValue: 2_000,
  intervalUnit: "mi" as const,
  intervalMiles: 2_000,
  dueWindowMiles: 2_000,
  status: "active" as const,
  source: "manual_ocr",
  notes: null,
  sourceManualId: manualId,
  sourcePageStart: 2,
  sourcePageEnd: 2,
  sourcePrintedPageLabel: "31",
  rawOcrContext: "Oil change every 2,000 miles",
  origin: "ocr" as const,
  correctedAt: null,
  sourceHref: "/manual?page=2&printedPage=31",
};

type TestFact = Omit<typeof fact, "origin" | "correctedAt"> & {
  origin: "ocr" | "rider_corrected";
  correctedAt: string | null;
};

async function fulfillJson(
  route: Route,
  payload: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

test("covers the private upload, citation, correction, duplicate, and mileage contracts", async ({
  page,
}) => {
  test.skip(
    process.env.MOTOMEMORY_OWNER_E2E !== "1",
    "Requires a configured private local-owner acceptance run.",
  );
  let currentManual: typeof uploadedManual | typeof readyManual | null = null;
  let currentFact: TestFact = fact;

  await page.route("**/api/manual", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, {
        manual: currentManual,
        progress: currentManual ? readyProgress : null,
      });
      return;
    }

    if (route.request().method() === "POST") {
      if (currentManual) {
        await fulfillJson(route, {
          error: {
            code: "MANUAL_DUPLICATE",
            message: "An identical manual is already uploaded for the GS750.",
          },
        }, 409);
        return;
      }

      currentManual = uploadedManual;
      await fulfillJson(route, { manual: uploadedManual }, 201);
      return;
    }

    await route.continue();
  });

  await page.route("**/api/manual/ingest", async (route) => {
    currentManual = readyManual;
    await fulfillJson(route, {
      manual: readyManual,
      progress: readyProgress,
      started: true,
    }, 202);
  });

  await page.route("**/api/manual/file", async (route) => {
    if (route.request().method() === "HEAD") {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": "32",
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.7 synthetic test document",
    });
  });

  await page.route("**/api/manual/facts", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, { manualId, facts: [currentFact] });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/manual/facts/*", async (route) => {
    currentFact = {
      ...currentFact,
      intervalValue: 2_500,
      intervalMiles: 2_500,
      dueWindowMiles: 2_500,
      origin: "rider_corrected",
      correctedAt: new Date(0).toISOString(),
    };
    await fulfillJson(route, {
      fact: currentFact,
      maintenanceOutlook: [{ definitionId: factId, intervalMiles: 2_500 }],
    });
  });

  await page.route("**/api/manual/search", async (route) => {
    await fulfillJson(route, {
      manualId,
      manual: {
        id: manualId,
        fileName: readyManual.fileName,
        sha256: readyManual.sha256,
        pageCount: 3,
      },
      passages: [passage],
    });
  });

  await page.route("**/api/manual/questions", async (route) => {
    await fulfillJson(route, {
      state: "supported_evidence",
      manual: {
        id: manualId,
        fileName: readyManual.fileName,
        sha256: readyManual.sha256,
        pageCount: 3,
      },
      passages: [passage],
      answer: "Replace engine oil every 2,000 miles.",
      citations: [{
        passageId: passage.id,
        manualId,
        pdfPageStart: 2,
        pdfPageEnd: 2,
        printedPageStart: "31",
        printedPageEnd: "31",
        href: passage.citationHref,
      }],
    });
  });

  await page.route("**/api/motorcycle/mileage", async (route) => {
    const body = route.request().postDataJSON() as {
      mileage: string;
      expectedCurrentMileage: number;
    };
    await fulfillJson(route, {
      motorcycle: { id: "gs750", currentMileage: Number(body.mileage) },
      maintenanceOutlook: [],
    });
  });

  await page.goto("/manual");
  await expect(page.getByRole("heading", { name: "Upload the GS750 service manual" })).toBeVisible();

  await page.locator("#manual-upload").setInputFiles({
    name: "synthetic-gs750-manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 synthetic test document"),
  });
  await page.getByRole("button", { name: "Upload manual" }).click();

  await expect(page.getByRole("heading", { name: "Manual-derived intervals" })).toBeVisible();
  await expect(page.getByText("Manual processing is complete")).toBeVisible();
  await expect(page.locator("iframe[title*='PDF page 1']")).toHaveAttribute(
    "src",
    "/api/manual/file#page=1",
  );

  const duplicate = await page.evaluate(async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File(["%PDF-1.7 synthetic test document"], "manual-copy.pdf", {
        type: "application/pdf",
      }),
    );
    const response = await fetch("/api/manual", { method: "POST", body: formData });
    return { status: response.status, body: await response.json() };
  });
  expect(duplicate).toMatchObject({
    status: 409,
    body: { error: { code: "MANUAL_DUPLICATE" } },
  });

  await page.getByLabel("Search terms").fill("oil interval");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(page.getByText(passage.content)).toBeVisible();

  await page.getByLabel("Ask what the manual says").fill("What oil interval does the manual specify?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Question result")).toBeVisible();
  await expect(page.getByText("Replace engine oil every 2,000 miles.").first()).toBeVisible();

  await page.locator(".manual-citation").click();
  await expect(page).toHaveURL(/\/manual\?page=2&printedPage=31/);
  await expect(page.locator(".manual-page-labels")).toContainText("2");
  await expect(page.locator(".manual-page-labels")).toContainText("31");

  const factCard = page.locator(".manual-fact").first();
  await factCard.getByRole("button", { name: "Correct fact" }).click();
  await factCard.getByLabel("Interval").fill("2500");
  await factCard.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Fact corrected.", { exact: false })).toBeVisible();
  await expect(factCard).toContainText("2,500 mi");

  const mileageResponse = await page.evaluate(async () => {
    const response = await fetch("/api/motorcycle/mileage", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mileage: "17000", expectedCurrentMileage: 18501 }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(mileageResponse).toMatchObject({
    status: 200,
    body: { motorcycle: { currentMileage: 17_000 } },
  });
});

test("shows OCR page failure records while keeping the original PDF viewable", async ({ page }) => {
  test.skip(
    process.env.MOTOMEMORY_OWNER_E2E !== "1",
    "Requires a configured private local-owner acceptance run.",
  );
  const failedManual = {
    ...readyManual,
    status: "failed" as const,
    errorMessage: "OCR failed for PDF page 2.",
    processedAt: null,
  };
  const failedProgress = {
    totalPages: 3,
    accountedPages: 3,
    availablePages: 2,
    failedPages: 1,
    pendingPages: 0,
    percentComplete: 100,
    failures: [{ pageNumber: 2, errorMessage: "Tesseract could not read this page." }],
  };

  await page.route("**/api/manual", async (route) => {
    await fulfillJson(route, { manual: failedManual, progress: failedProgress });
  });
  await page.route("**/api/manual/file", async (route) => {
    if (route.request().method() === "HEAD") {
      await route.fulfill({ status: 200, headers: { "content-type": "application/pdf" } });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7 synthetic" });
  });

  await page.goto("/manual");
  await expect(page.getByText("OCR processing failed")).toBeVisible();
  await expect(page.getByLabel("1 failed pages")).toBeVisible();
  await expect(page.getByText("PDF page 2: Tesseract could not read this page.")).toBeVisible();
  await expect(page.locator("iframe[title*='PDF page 1']")).toHaveAttribute(
    "src",
    "/api/manual/file#page=1",
  );
});
