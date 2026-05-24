import { expect, test } from '@playwright/test'

test.describe('PWA update prompt', () => {
  test('shows update prompt when a new service worker is waiting', async ({ page, request }) => {
    await page.goto('/')

    const promptTitle = page.getByText('A new version of Outflow is ready.')

    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.ready
        return Boolean(registration.active)
      },
      undefined,
      { timeout: 20000 },
    )

    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return !registration?.waiting
      },
      undefined,
      { timeout: 10000 },
    )

    if (await promptTitle.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Later' }).click()
      await expect(promptTitle).not.toBeVisible()
    }

    const bumpResponse = await request.post('/__test__/sw-version')
    expect(bumpResponse.ok()).toBe(true)

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) throw new Error('Service worker registration is missing')

      for (let attempt = 0; attempt < 12; attempt += 1) {
        await registration.update()
        if (registration.waiting) return
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    })

    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return Boolean(registration?.waiting)
      },
      undefined,
      { timeout: 20000 },
    )

    await expect(promptTitle).toBeVisible()
    await expect(page.getByRole('button', { name: 'Later' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible()
  })
})
