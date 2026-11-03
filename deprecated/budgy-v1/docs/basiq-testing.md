# Basiq Sandbox Testing & Reference Data

This document provides a quick reference for test credentials, institutions, and user personas to use while testing the Basiq connection flow locally.

---

## 🏦 Open Banking Sandbox (Hooli OB)

To test Open Banking consent flows, select the **Hooli OB** institution and use the following deterministic credentials:

*   **Institution:** Hooli OB (AU00000)
*   **Member Number:** `374829`
*   **OTP (One-Time Passcode):** `227470`

---

## 👥 Sandbox Personas

The table below lists pre-configured Basiq personas that mimic real-life financial behaviors. These can be used during connection login:

| Username / Login ID | Password | Name | Persona & Suitable Use Case |
| :--- | :--- | :--- | :--- |
| **`Wentworth-Smith`** | `whislter` | Max Wentworth-Smith | **Joint account**: Has 2 income sources (fortnightly & monthly), mortgage, car loan payments, credit card expenses, and predictable bills. Good for affordability and liability checks. |
| **`Whistler`** | `ShowBox` | Whistler Smith | **Single Income**: Fortnightly salary, BNPL (Buy Now Pay Later) liabilities, no mortgage. High amount of external transfers. Good for risk profiling. |
| **`Gilfoyle`** | `PiedPiper` | Gilfoyle Bertram | **Unemployed benefits**: Income stopped, rising BNPL liabilities, predictable credit card expenses with late fees. Good for assessing creditworthiness and risk flags. |
| **`gavinBelson`** | `hooli2016` | Gavin Belson | **HooliGov Bank (AU00004)**: Monthly salary + additional volatile tutoring income, personal loan liability, and regular credit card expenses. Good for PFM and income verification. |
| **`jared`** | `django` | Jared Dunn | **Uber Income**: Volatile weekly earnings, term deposit asset, unshared mortgage, and car loan payments. Good for asset/liability verification. |
| **`richard`** | `tabsnotspaces` | Richard Birtles | **High Earner**: Stable fortnightly income, rental income from 2 properties. Multiple liabilities: 3 mortgages, 2 car loans, and 4 credit cards. Good for complex debt-to-income and liability assessments. |
| **`laurieBream`** | `business2024` | Laurie Bream | **Business User**: Happy path business account. Designed for testing business-scoped consumer consents. |
| **`ashMann`** | `hooli2024` | Ash Mann | **Gambling & Crypto**: Regular salary and rental income, but exhibits high-risk behaviors: gambling transactions, large cash withdrawals, and cryptocurrency exchanges. |

---

## ⚠️ Unhappy Path Test Users (Always Fail)

Use these credentials to test error-handling in your app. These logins will always trigger specific failure modes at the connection step:

| Username / Login ID | Password | Expected Error | Detail / User Message |
| :--- | :--- | :--- | :--- |
| **`bighead`** | `password` | `invalid-credentials` | "Account is locked" |
| **`erlich`** | `aviato` | `account-not-accessible-requires-user-action` | "An action is required from end-user before account details can be returned." |
| **`jianYang`** | `nothotdog` | `service-unavailable` | "Service is currently unavailable. Please try again later." |

---

## 🔐 Multi-Factor Authentication (MFA) Users

Use these credentials to test dynamic Multi-Factor Authentication prompt UI and verify step handling. 

*   **Pied Piper Bank**: Always prompts for MFA challenge.
*   **Nucleus Bank**: Triggers MFA challenge intermittently (50/50 chance).

| Username / Login ID | Password | Challenge Type | Challenge Prompt | Solution / Answer |
| :--- | :--- | :--- | :--- | :--- |
| **`jared`** | `django` | `token` | OTP Password | `1234` |
| **`richard`** | `tabsnotspaces` | `token` | OTP Password | `1234` |
| **`gavinBelson`** | `hooli2016` | `security-questions` | What's your first company? | `Hooli` |
| **`Gilfoyle`** | `PiedPiper` | `security-questions` | What's your first company? | `Hooli` |
| **`Whistler`** | `ShowBox` | `security-questions` | What's your favourite company?<br>What's the ID of this institution? | `Basiq`<br>`AU00000` |
| **`Wentworth-Smith`** | `whislter` | `security-questions` | What's your favourite company?<br>What's the ID of this institution? | `Basiq`<br>`AU00000` |
