import { expect, test } from "@playwright/test";

const login = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

test("loads the kanban board", async ({ page }) => {
  await login(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("renames a column", async ({ page }) => {
  await login(page);
  const firstTitleInput = page.getByLabel("Column title").first();
  await firstTitleInput.fill("Renamed Backlog");
  await expect(firstTitleInput).toHaveValue("Renamed Backlog");
});

test("logs out and returns to sign in", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("applies AI-triggered board refresh", async ({ page }) => {
  const board = {
    columns: [
      { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
      { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
      { id: "col-progress", title: "In Progress", cardIds: ["card-4"] },
      { id: "col-review", title: "Review", cardIds: ["card-5"] },
      { id: "col-done", title: "Done", cardIds: ["card-6"] },
    ],
    cards: {
      "card-1": { id: "card-1", title: "A", details: "A" },
      "card-2": { id: "card-2", title: "B", details: "B" },
      "card-3": { id: "card-3", title: "C", details: "C" },
      "card-4": { id: "card-4", title: "D", details: "D" },
      "card-5": { id: "card-5", title: "E", details: "E" },
      "card-6": { id: "card-6", title: "F", details: "F" },
    },
  };

  await page.route("**/api/board/user", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      const next = request.postDataJSON();
      board.columns = next.columns;
      board.cards = next.cards;
      await route.fulfill({ status: 200, json: board });
      return;
    }
    await route.fulfill({ status: 200, json: board });
  });

  await page.route("**/api/chat", async (route) => {
    board.columns[0].title = "AI Backlog";
    await route.fulfill({
      status: 200,
      json: {
        answer: "Updated your board.",
        model: "openai/gpt-oss-120b",
        provider: "openrouter",
        board_update_applied: true,
        board_update: null,
      },
    });
  });

  await login(page);
  await page
    .getByPlaceholder("Ask AI to summarize progress or move cards...")
    .fill("Rename backlog to AI Backlog");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Updated your board.")).toBeVisible();
  await expect(page.locator('input[aria-label="Column title"][value="AI Backlog"]')).toBeVisible();
});
