import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("shares and restores the current workspace", async ({ page }) => {
	await page
		.getByRole("textbox", { name: "A row 1 column 1" })
		.fill("sqrt(2)");
	await page.getByRole("button", { name: "Share" }).click();

	await expect(page.locator(".share-dialog[open]")).toBeVisible({
		timeout: 10_000,
	});
	const shareUrl = await page
		.getByRole("textbox", { name: "Share link" })
		.inputValue();
	expect(shareUrl).toContain("#s=");

	await page.goto(shareUrl);
	await expect(
		page.getByRole("textbox", { name: "A row 1 column 1" }),
	).toHaveValue("sqrt(2)");
});

test("registers the module service worker and serves an app shell offline", async ({
	browserName,
	context,
	page,
}) => {
	test.skip(
		browserName === "webkit",
		"WebKit does not activate module service workers",
	);
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
