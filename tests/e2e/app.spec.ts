import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/");
});

test("edits a matrix and updates transformed vectors", async ({ page }) => {
	const matrixEntry = page.getByRole("textbox", {
		name: "A row 1 column 1",
	});
	const firstResult = page.locator(
		'[data-result-vector-index="0"][data-result-component-index="0"]',
	);

	await expect(firstResult).toHaveText("1");
	await matrixEntry.fill("2");
	await expect(firstResult).toHaveText("2");

	await matrixEntry.fill("not-a-number");
	await expect(matrixEntry).toHaveAttribute("aria-invalid", "");
	await expect(firstResult).toHaveText("2");

	const siblingEntry = page.getByRole("textbox", {
		name: "A row 2 column 1",
	});
	await siblingEntry.fill("3");
	await expect(siblingEntry).not.toHaveAttribute("aria-invalid", "");
	await expect(
		page.locator(
			'[data-result-vector-index="0"][data-result-component-index="1"]',
		),
	).toHaveText("1");

	await page.getByRole("button", { name: "Add matrix" }).click();
	await expect(matrixEntry).toHaveAttribute("aria-invalid", "");
});

test("rejects a matrix edit that would overflow the render transform", async ({
	page,
}) => {
	for (let index = 0; index < 15; index += 1) {
		await page.getByRole("button", { name: "Add matrix" }).click();
	}
	const firstEntries = page.locator(
		'.matrix-grid input[data-entry-index="0"]',
	);
	for (let index = 0; index < 16; index += 1) {
		await firstEntries.nth(index).fill("100");
	}

	await expect(firstEntries.nth(15)).toHaveAttribute("aria-invalid", "");

	await page.getByRole("button", { name: "Share" }).click();
	const shareUrl = await page
		.getByRole("textbox", { name: "Share link" })
		.inputValue();
	await page.goto(shareUrl);

	await expect(
		page.locator('.matrix-grid input[data-entry-index="0"]').nth(15),
	).toHaveAttribute("aria-invalid", "");
});

test("switches dimensions and adds a matrix preset", async ({ page }) => {
	await page.getByRole("button", { name: "2D" }).click();
	await expect(page.locator(".matrix-grid-2")).toBeVisible();

	await page.getByTitle("Matrix presets").click();
	await page.getByRole("menuitem", { name: "Rotate 45°" }).click();

	await expect(page.locator(".matrix-item")).toHaveCount(2);
	await expect(
		page.getByRole("textbox", { name: "B row 1 column 1" }),
	).toHaveValue("sqrt(2)/2");
});

test("shares and restores the current workspace", async ({ page }) => {
	await page
		.getByRole("textbox", { name: "A row 1 column 1" })
		.fill("sqrt(2)");
	await page.getByRole("button", { name: "Share" }).click();

	const shareDialog = page.locator(".share-dialog[open]");
	await expect(shareDialog).toBeVisible({ timeout: 10_000 });
	const shareUrl = await page
		.getByRole("textbox", { name: "Share link" })
		.inputValue();
	expect(shareUrl).toContain("#s=");

	await page.goto(shareUrl);
	await expect(
		page.getByRole("textbox", { name: "A row 1 column 1" }),
	).toHaveValue("sqrt(2)");
});

test("shows a share link when clipboard access is denied", async ({
	context,
	page,
}) => {
	await context.clearPermissions();
	await page.getByRole("button", { name: "Share" }).click();

	await expect(page.locator(".share-dialog[open]")).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Share link" })).toHaveValue(
		/#s=/,
	);
	await expect(page.locator("[data-share-status]")).toHaveText("Copy failed");
});

test("resets a workspace without relying on fragment navigation", async ({
	page,
}) => {
	await page.getByRole("textbox", { name: "A row 1 column 1" }).fill("3");
	await page.getByRole("button", { name: "Share" }).click();
	await expect(page).toHaveURL(/#s=/);
	await page.getByRole("button", { name: "Close" }).click();

	await page.getByRole("button", { name: "Reset workspace" }).click();
	await page.getByRole("button", { name: "Reset everything" }).click();

	await expect(page).not.toHaveURL(/#s=/);
	await expect(
		page.getByRole("textbox", { name: "A row 1 column 1" }),
	).toHaveValue("1");
	await expect(page.locator(".matrix-item")).toHaveCount(1);
});

test("preserves workspace state while switching locale", async ({ page }) => {
	await page.getByRole("textbox", { name: "A row 1 column 1" }).fill("3");
	await page.getByLabel("Language").selectOption("zh-Hant");

	await expect(page).toHaveURL(/\/zh-hant\/#s=/);
	await expect(page.getByRole("button", { name: "分享" })).toBeVisible();
	await expect(
		page.getByRole("textbox", { name: "A 第 1 列第 1 欄" }),
	).toHaveValue("3");
});

test("reloads the localized app shell while offline", async ({
	context,
	page,
}) => {
	await page.goto("/zh-hant/");
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect
		.poll(() =>
			page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
		)
		.toBe(true);

	await context.setOffline(true);
	await page.reload();

	await expect(page.getByRole("button", { name: "分享" })).toBeVisible();
});

test("keeps mobile controls inside the viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();

	const tools = page.locator(".view-tools");
	await expect(tools).toBeVisible();
	const bounds = await tools.boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);

	await page.getByRole("button", { name: "About" }).click();
	const dialog = page.locator(".about-dialog[open]");
	await expect(dialog).toBeVisible();
	expect(
		await dialog.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
});

test("fits localized controls at a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/zh-hant/");

	await expect(page.getByRole("button", { name: "分享" })).toBeVisible();
	const controls = page.locator(".view-tools > button, .view-tools > select");
	for (const control of await controls.all()) {
		const bounds = await control.boundingBox();
		expect(bounds).not.toBeNull();
		expect(bounds!.x).toBeGreaterThanOrEqual(0);
		expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
	}
});
