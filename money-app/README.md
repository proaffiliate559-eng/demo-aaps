# Paisa – Simple Money Manager (mobile)

A simple, mobile-first money management app. Plain HTML/CSS/JS, no build step, no dependencies.

## Screens
- **Home** – total balance card (income / expense), recent transactions
- **Add (+)** – Expense/Income toggle, number keypad, category chips, optional note
- **Stats** – this month's spending donut by category, monthly budget progress bar, full list (tap a row to delete)

Data is saved in the browser's `localStorage`. Light and dark mode follow the phone setting.

## Run
Open `money-app/index.html` in a browser, or serve the folder:

```bash
npx serve money-app
```

On a phone, use "Add to Home Screen" to install it like an app.
