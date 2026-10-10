import { expect, test, type Page } from '@playwright/test'

// Level 1 world size and first tower slot, see src/domain/levels/level1.ts.
const LEVEL = { width: 1200, height: 700 }
const FIRST_SLOT = { x: 205, y: 175 }

async function clickWorld(page: Page, point: { x: number; y: number }) {
    const box = (await page.getByTestId('game-canvas').boundingBox())!
    const scale = Math.min(box.width / LEVEL.width, box.height / LEVEL.height)
    const offsetX = (box.width - LEVEL.width * scale) / 2
    const offsetY = (box.height - LEVEL.height * scale) / 2
    await page.mouse.move(box.x + offsetX + point.x * scale, box.y + offsetY + point.y * scale)
    await page.mouse.down()
    await page.mouse.up()
}

async function answerDialog(page: Page) {
    await page.locator('.story-dialog .choice-button').first().click()
    const ok = page.locator('.story-dialog').getByRole('button', { name: 'ОК', exact: true })
    if (await ok.isVisible()) await ok.click()
}

test('plays the first wave of level 1 from the main menu', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'НАЧАТЬ МИССИЮ' }).click()
    await expect(page).toHaveURL(/\/levels$/)

    await page.getByRole('button', { name: /ПЕРВЫЙ КОНТАКТ/ }).click()
    await page.getByRole('button', { name: 'НАЧАТЬ ЗАЩИТУ' }).click()
    await expect(page).toHaveURL(/\/game\/level_1$/)

    await expect(page.locator('.story-dialog')).toContainText('КОМАНДИР МАРКУС')
    await answerDialog(page)

    await page.getByRole('button', { name: /Пушка/ }).click()
    await clickWorld(page, FIRST_SLOT)
    await clickWorld(page, FIRST_SLOT)
    await expect(page.locator('.side-panel')).toContainText('Пушка (Ур. 1)')

    // ×1 → ×2 → ×4 → ×8 to keep the test short.
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /УСКОРЕНИЕ/ }).click()
    await expect(page.getByRole('button', { name: /УСКОРЕНИЕ ×8/ })).toBeVisible()

    await page.getByRole('button', { name: 'НАЧАТЬ ВОЛНУ 1' }).click()
    await answerDialog(page)
    await expect(page.getByRole('button', { name: 'НАЧАТЬ ВОЛНУ 2' })).toBeVisible({
        timeout: 60_000,
    })

    // First Escape clears the tower selection, the second one pauses.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.game-menu')).toContainText('ПАУЗА')
    await page.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }).first().click()
    await expect(page.locator('.game-menu')).toBeHidden()

    expect(errors).toEqual([])
})

test('redirects locked levels and supports deep links and back navigation', async ({ page }) => {
    await page.goto('/game/level_5')
    await expect(page).toHaveURL(/\/levels$/)

    await page.goto('/game/level_1')
    await expect(page.getByTestId('game-canvas')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/levels$/)
})
