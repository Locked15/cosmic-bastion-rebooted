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

// First launch: the security dialog asks for an officer's name.
async function register(page: Page, name = 'Испытатель') {
    await page.goto('/')
    await expect(page.getByRole('dialog')).toContainText('РЕГИСТРАЦИЯ ОФИЦЕРА')
    await page.getByLabel('ИМЯ ОФИЦЕРА:').fill(name)
    await page.getByRole('button', { name: 'ЗАРЕГИСТРИРОВАТЬ' }).click()
    await expect(page.locator('.main-menu__briefing')).toHaveText(`Экстренный рапорт, ${name}.`)
}

// Writes campaign progress for the active profile straight into IndexedDB, then reloads.
async function winSectors(page: Page, levels: string[]) {
    await page.evaluate(async (completed) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('cosmic-bastion')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        const read = <T>(store: string, key: string) =>
            new Promise<T>((resolve) => {
                const request = db.transaction(store).objectStore(store).get(key)
                request.onsuccess = () => resolve(request.result as T)
            })
        const profileId = await read<string>('device', 'activeProfile')
        const value = {
            flags: {},
            completedLevels: completed,
            totalStars: completed.length,
            currentLevelIndex: 0,
            levels: completed.map((id) => ({ id, completed: true, stars: 1, locked: false })),
        }
        await new Promise<void>((resolve) => {
            const tx = db.transaction('saves', 'readwrite')
            tx.objectStore('saves').put({ profileId, key: 'campaign', value })
            tx.oncomplete = () => resolve()
        })
        db.close()
    }, levels)
    await page.reload()
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

    // The menu theme starts with the app; each level switches to its own track.
    const menuMusic = page.waitForRequest(/\/audio\/music\/lightless-dawn\.webm$/)
    await register(page)
    await menuMusic
    await page.getByRole('button', { name: 'НАЧАТЬ МИССИЮ' }).click()
    await expect(page).toHaveURL(/\/levels$/)

    await page.getByRole('button', { name: /ПЕРВЫЙ КОНТАКТ/ }).click()
    const levelMusic = page.waitForRequest(/\/audio\/music\/shadowlands-1-horizon\.webm$/)
    await page.getByRole('button', { name: 'НАЧАТЬ ЗАЩИТУ' }).click()
    await expect(page).toHaveURL(/\/game\/level_1$/)
    await levelMusic

    await expect(page.locator('.story-dialog')).toContainText('КОМАНДОР МАРКУС ХЕЙЛ')
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

    // Leaving between waves keeps a checkpoint the level can resume from.
    await page.locator('.side-panel').getByRole('button', { name: 'ВЫХОД', exact: true }).click()
    await page.getByRole('button', { name: 'ДА', exact: true }).click()
    await expect(page).toHaveURL(/\/levels$/)
    await page.getByRole('button', { name: /ПЕРВЫЙ КОНТАКТ/ }).click()
    await page.getByRole('button', { name: 'ПРОДОЛЖИТЬ (ПОСЛЕ ВОЛНЫ 1)' }).click()
    await expect(page).toHaveURL(/\/game\/level_1\?resume=1$/)
    await expect(page.locator('.top-panel')).toContainText('1/4')
    await expect(page.locator('.side-panel')).toContainText('Пушка')

    // The first kill unlocked an achievement.
    await page.goto('/')
    await page.getByRole('button', { name: 'ДОСТИЖЕНИЯ' }).click()
    await expect(page.locator('.achievement-item--unlocked')).toContainText(['Первая кровь'])

    expect(errors).toEqual([])
})

test('redirects locked levels and supports deep links and back navigation', async ({ page }) => {
    // Without a profile every mission route leads back to the main menu.
    await page.goto('/levels')
    await expect(page).toHaveURL(/\/$/)
    await register(page)

    await page.goto('/game/level_5')
    await expect(page).toHaveURL(/\/levels$/)

    await page.goto('/game/level_1')
    await expect(page.getByTestId('game-canvas')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/levels$/)
})

test.describe('on a 1280x720 laptop screen', () => {
    test.use({ viewport: { width: 1280, height: 720 } })

    test('shows the start button without scrolling and starts the level', async ({ page }) => {
        await register(page)
        await page.goto('/levels')
        await page.getByRole('button', { name: /ПЕРВЫЙ КОНТАКТ/ }).click()
        const start = page.getByRole('button', { name: 'НАЧАТЬ ЗАЩИТУ' })
        await expect(start).toBeInViewport()
        await start.click({ noWaitAfter: true })
        await expect(page).toHaveURL(/\/game\/level_1$/)
    })
})

test('keeps profiles in IndexedDB, switches between them and deletes them', async ({ page }) => {
    await register(page, 'Альфа')
    await page.reload()
    await expect(page.locator('.main-menu__briefing')).toHaveText('Экстренный рапорт, Альфа.')

    await page.getByRole('button', { name: 'вызовите службу безопасности' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('СЛУЖБА БЕЗОПАСНОСТИ')
    await dialog.getByRole('button', { name: 'НОВЫЙ ПРОФИЛЬ' }).first().click()
    await page.getByLabel('ИМЯ ОФИЦЕРА:').fill('Бета')
    await page.getByRole('button', { name: 'ЗАРЕГИСТРИРОВАТЬ' }).click()
    await expect(page.locator('.main-menu__briefing')).toHaveText('Экстренный рапорт, Бета.')

    await page.reload()
    await expect(page.locator('.main-menu__briefing')).toHaveText('Экстренный рапорт, Бета.')
    await page.getByRole('button', { name: 'вызовите службу безопасности' }).click()
    await dialog.getByRole('button', { name: 'Удалить профиль Альфа' }).click()
    await page.getByRole('button', { name: 'ДА', exact: true }).click()
    await expect(dialog.locator('.profile-slot--empty')).toHaveCount(2)
    await dialog.getByRole('button', { name: 'ЗАКРЫТЬ' }).click()

    await page.reload()
    await page.getByRole('button', { name: 'вызовите службу безопасности' }).click()
    await expect(dialog).not.toContainText('Альфа')
    await expect(dialog).toContainText('Бета')
})

test('opens the quartermaster terminal from the ship map', async ({ page }) => {
    await register(page)
    await expect(page.getByRole('img', { name: 'Реквизиции: 0' })).toBeVisible()
    // Closed until the bridge is retaken; the route leads back to the ship map.
    await page.goto('/quartermaster')
    await expect(page).toHaveURL(/\/levels$/)
    await expect(page.getByRole('button', { name: 'ИТ-41 Интендантство: ПОСЛЕ S-1' })).toBeVisible()
    await winSectors(page, ['level_1', 'level_10'])
    await page.getByRole('button', { name: /^ИТ-41 Интендантство: НА СЧЁТЕ/ }).click()
    await expect(page).toHaveURL(/\/quartermaster$/)
    await expect(page.getByRole('option')).toHaveCount(10)
    // The two won sectors are paid for when the account is opened.
    await expect(page.getByRole('img', { name: /^РЕКВИЗИЦИИ НА СЧЁТЕ [1-9]\d*$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /УТВЕРДИТЬ/ })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/levels$/)
})

test('opens the wardroom from the ship map', async ({ page }) => {
    await register(page)
    await page.goto('/wardroom')
    await expect(page).toHaveURL(/\/levels$/)
    await expect(page.getByRole('button', { name: 'КК-3 Кают-компания: ПОСЛЕ B-3' })).toBeVisible()
    await winSectors(page, ['level_1', 'level_2'])
    await page.getByRole('button', { name: /^КК-3 Кают-компания/ }).click()
    await expect(page).toHaveURL(/\/wardroom$/)
    await expect(page.getByRole('button', { name: /^К-01 Лейтенант Ода Кирх/ })).toBeVisible()
    await page.getByRole('button', { name: 'К СХЕМЕ КОРАБЛЯ' }).click()
    await expect(page).toHaveURL(/\/levels$/)
})
